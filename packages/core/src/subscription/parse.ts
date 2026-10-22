import type {
  ParsedSubscription,
  Protocol,
  ServerNode,
  Subscription,
  SubscriptionMeta,
  SubscriptionUserInfo,
  Transport,
} from '../types';
import { isProbablyBase64, maybeDecodeBase64 } from './base64';
import { countryCodeFromFlag, countryCodeFromName, extractFlagEmoji } from './countries';

export type HeaderMap = Record<string, string | undefined>;

const LINK_PROTOCOLS: Protocol[] = [
  'vless',
  'vmess',
  'trojan',
  'shadowsocks',
  'socks',
  'http',
  'wireguard',
  'hysteria2',
];

const TRANSPORTS: Record<string, Transport> = {
  tcp: 'tcp',
  raw: 'tcp',
  ws: 'ws',
  websocket: 'ws',
  grpc: 'grpc',
  httpupgrade: 'httpupgrade',
  xhttp: 'xhttp',
  splithttp: 'xhttp',
  mkcp: 'mkcp',
  kcp: 'mkcp',
  hysteria: 'hysteria',
};

function lowerHeaders(headers: HeaderMap): HeaderMap {
  const result: HeaderMap = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value != null) result[key.toLowerCase()] = value;
  }
  return result;
}

function header(headers: HeaderMap, name: string): string | undefined {
  return headers[name.toLowerCase()];
}

function safeDecode(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const decoded = maybeDecodeBase64(value);
  return decoded.trim() || undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (value == null || value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function parseUserInfo(value: string | undefined): SubscriptionUserInfo {
  if (!value) return {};
  const result: SubscriptionUserInfo = {};
  for (const part of value.split(';')) {
    const [rawKey, rawValue] = part.split('=');
    if (!rawKey || rawValue == null) continue;
    const key = rawKey.trim().toLowerCase();
    const number = parseNumber(rawValue.trim());
    if (number == null) continue;
    if (key === 'upload') result.uploadBytes = number;
    if (key === 'download') result.downloadBytes = number;
    if (key === 'total') result.totalBytes = number;
    if (key === 'expire') {
      // Some panels return milliseconds. Normalise to seconds.
      result.expiresAt = number > 32_000_000_000 ? Math.floor(number / 1000) : number;
    }
  }
  return result;
}

function parseMetadataFromBody(body: string): SubscriptionMeta {
  const meta: SubscriptionMeta = {};
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^#\s*([a-z0-9-]+)\s*:\s*(.*)$/i);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = safeDecode(match[2]);
    if (!value) continue;

    if (key === 'profile-title') meta.title = value;
    if (key === 'announce') meta.announce = value;
    if (key === 'support-url') meta.supportUrl = value;
    if (key === 'profile-web-page-url' || key === 'homepage') meta.webPageUrl = value;
    if (key === 'profile-update-interval') {
      const hours = parseNumber(value);
      if (hours != null && hours > 0) meta.updateIntervalHours = hours;
    }
  }
  return meta;
}

function metadataFromHeaders(headers: HeaderMap): SubscriptionMeta {
  const meta: SubscriptionMeta = {};
  meta.title =
    safeDecode(header(headers, 'profile-title')) ??
    safeDecode(header(headers, 'subscription-name'));
  meta.announce = safeDecode(header(headers, 'announce'));
  meta.supportUrl = safeDecode(header(headers, 'support-url'));
  meta.webPageUrl =
    safeDecode(header(headers, 'profile-web-page-url')) ?? safeDecode(header(headers, 'homepage'));

  const updateInterval = parseNumber(header(headers, 'profile-update-interval'));
  if (updateInterval != null && updateInterval > 0) meta.updateIntervalHours = updateInterval;

  const hideUrl = header(headers, 'hide-url')?.toLowerCase();
  if (hideUrl) meta.hideUrl = hideUrl === '1' || hideUrl === 'true';

  const sortOrder = header(headers, 'sort-order')?.toLowerCase();
  if (sortOrder === 'ping' || sortOrder === 'name' || sortOrder === 'none') {
    meta.sortOrder = sortOrder;
  }

  const userInfo = parseUserInfo(header(headers, 'subscription-userinfo'));
  if (userInfo.uploadBytes != null) meta.uploadBytes = userInfo.uploadBytes;
  if (userInfo.downloadBytes != null) meta.downloadBytes = userInfo.downloadBytes;
  if (userInfo.totalBytes != null) meta.totalBytes = userInfo.totalBytes;
  if (userInfo.expiresAt != null) meta.expiresAt = userInfo.expiresAt;
  if (header(headers, 'subscription-userinfo')?.trim() === '0') meta.hideTraffic = true;

  return meta;
}

function splitLink(link: string): {
  scheme: string;
  authority: string;
  query: URLSearchParams;
  fragment: string;
} | null {
  const match = link.match(/^([a-z0-9+.-]+):\/\/(.*)$/i);
  if (!match) return null;

  let rest = match[2];
  let fragment = '';
  const hashIndex = rest.indexOf('#');
  if (hashIndex >= 0) {
    fragment = rest.slice(hashIndex + 1);
    rest = rest.slice(0, hashIndex);
  }

  let queryString = '';
  const queryIndex = rest.indexOf('?');
  if (queryIndex >= 0) {
    queryString = rest.slice(queryIndex + 1);
    rest = rest.slice(0, queryIndex);
  }

  let decodedFragment = fragment;
  try {
    decodedFragment = decodeURIComponent(fragment);
  } catch {
    // Keep the raw fragment if it is not valid percent-encoding.
  }

  return {
    scheme: match[1].toLowerCase(),
    authority: rest,
    query: new URLSearchParams(queryString),
    fragment: safeDecode(decodedFragment) ?? decodedFragment,
  };
}

function splitHostPort(value: string, fallbackPort: number): { host: string; port: number } {
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end > 0) {
      const host = value.slice(1, end);
      const portPart = value.slice(end + 1).replace(/^:/, '');
      const port = parseNumber(portPart) ?? fallbackPort;
      return { host, port };
    }
  }

  const lastColon = value.lastIndexOf(':');
  if (lastColon > 0 && value.indexOf(':') === lastColon) {
    const host = value.slice(0, lastColon);
    const port = parseNumber(value.slice(lastColon + 1)) ?? fallbackPort;
    return { host, port };
  }

  return { host: value, port: fallbackPort };
}

function splitUserHost(
  authority: string,
  fallbackPort: number,
): {
  user: string;
  host: string;
  port: number;
} {
  const at = authority.lastIndexOf('@');
  const user = at >= 0 ? authority.slice(0, at) : '';
  const hostPort = at >= 0 ? authority.slice(at + 1) : authority;
  return { user, ...splitHostPort(hostPort, fallbackPort) };
}

function protocolFromScheme(scheme: string): Protocol {
  if (scheme === 'ss') return 'shadowsocks';
  if (scheme === 'socks5') return 'socks';
  if (scheme === 'hy2' || scheme === 'hysteria2' || scheme === 'hysteria') {
    return 'hysteria2';
  }
  if (scheme === 'wg') return 'wireguard';
  if (LINK_PROTOCOLS.includes(scheme as Protocol)) return scheme as Protocol;
  return 'unknown';
}

function defaultPort(protocol: Protocol): number {
  if (protocol === 'socks' || protocol === 'http') return 1080;
  return 443;
}

function transportFromQuery(query: URLSearchParams): Transport | undefined {
  const value = (query.get('type') ?? query.get('net') ?? '').toLowerCase();
  return TRANSPORTS[value];
}

function securityFromQuery(query: URLSearchParams): ServerNode['security'] {
  const value = (query.get('security') ?? query.get('tls') ?? '').toLowerCase();
  if (value === 'tls' || value === 'xtls') return 'tls';
  if (value === 'reality') return 'reality';
  if (value === 'none') return 'none';
  return undefined;
}

function nameFromParts(fragment: string, meta: SubscriptionMeta, fallback: string): string {
  const decoded = safeDecode(fragment) ?? fragment;
  return decoded.trim() || meta.title || fallback;
}

function makeNode(
  protocol: Protocol,
  host: string,
  port: number,
  name: string,
  rawLink: string,
  extra: Partial<ServerNode> = {},
): ServerNode {
  const flagEmoji = extractFlagEmoji(`${name} ${extra.countryCode ?? ''}`);
  const countryCode =
    extra.countryCode ?? countryCodeFromFlag(flagEmoji) ?? countryCodeFromName(name) ?? undefined;
  const id = `${protocol}:${host}:${port}:${name}`.toLowerCase();

  return {
    id,
    name,
    protocol,
    host,
    port,
    rawLink,
    countryCode,
    flagEmoji,
    ...extra,
  };
}

function parseVmess(link: string, meta: SubscriptionMeta): ServerNode | null {
  const match = link.match(/^vmess:\/\/(.+)$/i);
  if (!match) return null;
  let payload = match[1].split('#')[0];
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(maybeDecodeBase64(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const host = String(json.add ?? '').trim();
  const port = Number(json.port ?? 443);
  if (!host || !Number.isFinite(port)) return null;

  const name = String(json.ps ?? json.remark ?? meta.title ?? host);
  const network = String(json.net ?? 'tcp').toLowerCase();
  const tls = String(json.tls ?? '').toLowerCase();
  const security = tls === 'tls' ? 'tls' : tls === 'reality' ? 'reality' : undefined;

  return makeNode('vmess', host, port, name, link, {
    transport: TRANSPORTS[network] ?? 'tcp',
    security,
  });
}

function parseShadowsocks(link: string, meta: SubscriptionMeta): ServerNode | null {
  const match = link.match(/^ss:\/\/(.+)$/i);
  if (!match) return null;

  let payload = match[1];
  let fragment = '';
  const hashIndex = payload.indexOf('#');
  if (hashIndex >= 0) {
    fragment = payload.slice(hashIndex + 1);
    payload = payload.slice(0, hashIndex);
  }
  payload = payload.split('?')[0];
  try {
    fragment = decodeURIComponent(fragment);
  } catch {
    // Keep the raw fragment if it is not valid percent-encoding.
  }

  let userInfo = '';
  let hostPort = '';
  const at = payload.lastIndexOf('@');
  if (at >= 0) {
    userInfo = payload.slice(0, at);
    hostPort = payload.slice(at + 1);
  } else {
    const decoded = maybeDecodeBase64(payload);
    const decodedAt = decoded.lastIndexOf('@');
    if (decodedAt < 0) return null;
    userInfo = decoded.slice(0, decodedAt);
    hostPort = decoded.slice(decodedAt + 1);
  }

  const decodedUser = userInfo.includes(':') ? userInfo : maybeDecodeBase64(userInfo);
  const [method, ...passwordParts] = decodedUser.split(':');
  if (!method || passwordParts.length === 0) return null;
  const { host, port } = splitHostPort(hostPort, 8388);
  if (!host) return null;

  return makeNode('shadowsocks', host, port, nameFromParts(fragment, meta, host), link);
}

function parseGeneric(link: string, meta: SubscriptionMeta): ServerNode | null {
  const parts = splitLink(link);
  if (!parts) return null;

  const protocol = protocolFromScheme(parts.scheme);
  if (protocol === 'unknown') return null;

  // A bare http(s) URL in a subscription body is usually a provider link, not
  // an HTTP proxy. INCY uses the same rule: an HTTP proxy must carry userinfo.
  if (protocol === 'http' && !parts.authority.includes('@')) return null;

  const { user, host, port } = splitUserHost(parts.authority, defaultPort(protocol));
  if (!host) return null;

  const name = nameFromParts(parts.fragment, meta, `${host}:${port}`);
  const transport = transportFromQuery(parts.query);
  const security = securityFromQuery(parts.query);

  return makeNode(protocol, host, port, name, link, {
    transport,
    security,
  });
}

export function parseShareLink(link: string, meta: SubscriptionMeta = {}): ServerNode | null {
  const trimmed = link.trim();
  if (!trimmed) return null;
  if (/^vmess:\/\//i.test(trimmed)) return parseVmess(trimmed, meta);
  if (/^ss:\/\//i.test(trimmed)) return parseShadowsocks(trimmed, meta);
  return parseGeneric(trimmed, meta);
}

function isFullXrayConfig(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const object = value as Record<string, unknown>;
  return Array.isArray(object.inbounds) && Array.isArray(object.outbounds);
}

function configName(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const name = configName(entry);
      if (name) return name;
    }
  }
  return undefined;
}

function fullConfigName(
  config: Record<string, unknown>,
  proxy: Record<string, unknown> | undefined,
  index: number,
): string {
  const meta = config.meta;
  const metaObject =
    meta && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)
      : undefined;
  return (
    configName(config.remarks) ??
    configName(metaObject?.serverDescription) ??
    configName(proxy?.tag) ??
    `Full config ${index + 1}`
  );
}

function nodeFromFullConfig(config: Record<string, unknown>, index: number): ServerNode {
  const outbounds = (config.outbounds as Array<Record<string, unknown>>) ?? [];
  const proxy = outbounds.find((outbound) => {
    const protocol = String(outbound.protocol ?? '');
    return !['freedom', 'blackhole', 'dns', 'loopback'].includes(protocol);
  });
  const protocol = protocolFromScheme(String(proxy?.protocol ?? 'unknown'));
  const settings = (proxy?.settings ?? {}) as Record<string, unknown>;
  const vnext = (settings.vnext as Array<Record<string, unknown>> | undefined)?.[0];
  const servers = (settings.servers as Array<Record<string, unknown>> | undefined)?.[0];
  const host = String(vnext?.address ?? servers?.address ?? settings.address ?? 'full-config');
  const port = Number(vnext?.port ?? servers?.port ?? settings.port ?? 443);
  const name = fullConfigName(config, proxy, index);
  const countryCode = countryCodeFromName(name);

  return {
    id: `full-config:${index}:${host}:${port}:${name}`.toLowerCase(),
    name,
    protocol,
    host,
    port,
    rawLink: '',
    countryCode,
    flagEmoji: extractFlagEmoji(name),
    fullConfig: JSON.stringify(config),
  };
}

function tryParseJson(body: string, meta: SubscriptionMeta): ParsedSubscription | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (isFullXrayConfig(parsed)) {
    const node = nodeFromFullConfig(parsed, 0);
    return {
      meta,
      servers: [node],
      isFullConfig: true,
      fullConfig: parsed,
    };
  }

  if (Array.isArray(parsed)) {
    const configs = parsed.filter(isFullXrayConfig);
    if (configs.length > 0) {
      return {
        meta,
        servers: configs.map((config, index) => nodeFromFullConfig(config, index)),
        isFullConfig: true,
      };
    }
  }

  // Some providers return {"servers": [...]} with plain links.
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const object = parsed as Record<string, unknown>;
    const links = object.links ?? object.servers;
    if (Array.isArray(links) && links.every((entry) => typeof entry === 'string')) {
      const servers = (links as string[])
        .map((link) => parseShareLink(link, meta))
        .filter((node): node is ServerNode => node != null);
      if (servers.length > 0) return { meta, servers };
    }
  }

  return null;
}

function decodeBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';

  if (trimmed.includes('://') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }

  const decoded = maybeDecodeBase64(trimmed);
  if (decoded !== trimmed) {
    const decodedTrimmed = decoded.trim();
    if (
      decodedTrimmed.includes('://') ||
      decodedTrimmed.startsWith('{') ||
      decodedTrimmed.startsWith('[') ||
      decodedTrimmed.includes('#profile-title')
    ) {
      return decodedTrimmed;
    }
  }

  // URL-safe base64 is already handled above. A second decode covers panels
  // that double-encode the body.
  if (isProbablyBase64(trimmed)) {
    const twice = maybeDecodeBase64(trimmed);
    if (twice.includes('://')) return twice.trim();
  }

  return trimmed;
}

/**
 * Parse a Remnawave-compatible subscription response.
 *
 * Supports:
 *  - base64 and plain share-link lists;
 *  - metadata in HTTP headers and `#key: value` body lines;
 *  - single full Xray configs and arrays of full configs;
 *  - VLESS/VMess/Trojan/Shadowsocks/SOCKS/HTTP links.
 */
export function parseSubscription(body: string, headers: HeaderMap = {}): ParsedSubscription {
  const normalizedHeaders = lowerHeaders(headers);
  const headerMeta = metadataFromHeaders(normalizedHeaders);
  const decodedBody = decodeBody(body);
  const bodyMeta = parseMetadataFromBody(decodedBody);
  const meta: SubscriptionMeta = { ...headerMeta, ...bodyMeta };

  // Header values have priority over body values.
  for (const key of Object.keys(headerMeta) as Array<keyof SubscriptionMeta>) {
    if (headerMeta[key] != null) {
      (meta as Record<string, unknown>)[key] = headerMeta[key];
    }
  }

  const json = tryParseJson(decodedBody, meta);
  if (json) return json;

  const servers: ServerNode[] = [];
  const seen = new Set<string>();
  for (const line of decodedBody.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const node = parseShareLink(trimmed, meta);
    if (!node) continue;
    if (seen.has(node.rawLink)) continue;
    seen.add(node.rawLink);
    servers.push(node);
  }

  if (meta.title == null) {
    const disposition = header(normalizedHeaders, 'content-disposition');
    const filename = disposition?.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)?.[1];
    if (filename) meta.title = decodeURIComponent(filename.replace(/\.(txt|yaml|yml)$/i, ''));
  }

  return { meta, servers };
}

export function subscriptionFromParsed(
  id: string,
  url: string,
  parsed: ParsedSubscription,
): Subscription {
  return {
    id,
    url,
    meta: parsed.meta,
    servers: parsed.servers,
    updatedAt: Date.now(),
    isFullConfig: parsed.isFullConfig,
  };
}
