import type { ServerNode } from '../types';
import { decodeBase64 } from '../subscription/base64';

type JsonObject = Record<string, unknown>;

export class UnsupportedProtocolError extends Error {
  constructor(protocol: string) {
    super(`Протокол ${protocol} пока не поддерживается`);
    this.name = 'UnsupportedProtocolError';
  }
}

function queryObject(link: string): Record<string, string> {
  const queryIndex = link.indexOf('?');
  if (queryIndex < 0) return {};
  const hashIndex = link.indexOf('#', queryIndex);
  const raw = link.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined);
  const result: Record<string, string> = {};
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const equals = pair.indexOf('=');
    const key = equals >= 0 ? pair.slice(0, equals) : pair;
    const value = equals >= 0 ? pair.slice(equals + 1) : '';
    try {
      result[decodeURIComponent(key)] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

function authorityFromLink(link: string): string {
  const prefix = link.indexOf('://') + 3;
  const rest = link.slice(prefix);
  const end = rest.search(/[/?#]/);
  return end >= 0 ? rest.slice(0, end) : rest;
}

function hostPortFromAuthority(
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
  if (hostPort.startsWith('[')) {
    const end = hostPort.indexOf(']');
    const host = hostPort.slice(1, end);
    const port = Number(hostPort.slice(end + 2)) || fallbackPort;
    return { user, host, port };
  }
  const colon = hostPort.lastIndexOf(':');
  if (colon > 0) {
    return {
      user,
      host: hostPort.slice(0, colon),
      port: Number(hostPort.slice(colon + 1)) || fallbackPort,
    };
  }
  return { user, host: hostPort, port: fallbackPort };
}

function parseObject(value: string | undefined): JsonObject | null {
  if (!value) return null;
  const candidates = [value];
  try {
    candidates.push(decodeBase64(value));
  } catch {
    // Not base64; the value can still be JSON.
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as JsonObject;
      }
    } catch {
      // Try the next representation.
    }
  }
  return null;
}

function isObject(value: unknown): value is JsonObject {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

const XHTTP_EXTRA_KEYS = [
  'scMaxEachPostBytes',
  'scMinPostsIntervalMs',
  'scMaxBufferedPosts',
  'scStreamUpServerSecs',
  'seqKey',
  'seqPlacement',
  'sessionIDKey',
  'sessionIDPlacement',
  'sessionKey',
  'sessionPlacement',
  'sessionIDTable',
  'sessionIDLength',
  'uplinkDataKey',
  'uplinkDataPlacement',
  'uplinkHTTPMethod',
  'uplinkChunkSize',
  'xPaddingBytes',
  'xPaddingHeader',
  'xPaddingKey',
  'xPaddingMethod',
  'xPaddingObfsMode',
  'xPaddingPlacement',
  'serverMaxHeaderBytes',
  'noGRPCHeader',
  'noSSEHeader',
  'xmux',
  'headers',
  'downloadSettings',
] as const;

const XHTTP_NUMERIC_KEYS = new Set([
  'scMaxBufferedPosts',
  'serverMaxHeaderBytes',
  'scMaxEachPostBytes',
  'scMinPostsIntervalMs',
  'scStreamUpServerSecs',
  'uplinkChunkSize',
  'xPaddingBytes',
  'sessionIDLength',
]);

const XHTTP_BOOLEAN_KEYS = new Set(['xPaddingObfsMode', 'noGRPCHeader', 'noSSEHeader']);

function xhttpExtra(query: Record<string, string>): JsonObject | undefined {
  const extra: JsonObject = {};
  const fromPayload = parseObject(query.extra);
  if (fromPayload) Object.assign(extra, fromPayload);

  for (const key of XHTTP_EXTRA_KEYS) {
    const value = query[key];
    if (value == null || value === '') continue;
    if (key === 'xmux' || key === 'headers' || key === 'downloadSettings') {
      const parsed = parseObject(value);
      if (parsed) extra[key] = parsed;
      continue;
    }
    if (XHTTP_BOOLEAN_KEYS.has(key)) {
      extra[key] = value === '1' || value.toLowerCase() === 'true';
      continue;
    }
    if (XHTTP_NUMERIC_KEYS.has(key) && !value.includes('-')) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        extra[key] = numeric;
        continue;
      }
    }
    extra[key] = value;
  }

  return Object.keys(extra).length > 0 ? extra : undefined;
}

function streamSettings(link: string): JsonObject {
  const query = queryObject(link);
  const network = (query.type || query.net || 'tcp').toLowerCase();
  const security = (query.security || query.tls || 'none').toLowerCase();
  const result: JsonObject = {
    network: network === 'tcp' ? 'raw' : network === 'splithttp' ? 'xhttp' : network,
    security: security === 'xtls' ? 'tls' : security === 'none' ? 'none' : security,
  };

  if (security === 'tls' || security === 'xtls') {
    result.tlsSettings = {
      serverName: query.sni || query.host || '',
      fingerprint: query.fp || 'chrome',
      allowInsecure: false,
      ...(query.alpn ? { alpn: query.alpn.split(',') } : {}),
    };
  }

  if (security === 'reality') {
    result.realitySettings = {
      serverName: query.sni || '',
      fingerprint: query.fp || 'chrome',
      publicKey: query.pbk || '',
      shortId: query.sid || '',
      spiderX: query.spx || '',
    };
  }

  if (network === 'ws' || network === 'websocket') {
    result.wsSettings = {
      path: query.path || '/',
      headers: query.host ? { Host: query.host } : {},
    };
  }

  if (network === 'grpc') {
    result.grpcSettings = {
      serviceName: query.serviceName || query.path || '',
      ...(query.authority ? { authority: query.authority } : {}),
      multiMode: query.mode === 'multi',
    };
  }

  if (network === 'httpupgrade') {
    result.httpupgradeSettings = {
      host: query.host || '',
      path: query.path || '/',
    };
  }

  if (network === 'xhttp' || network === 'splithttp') {
    const extra = xhttpExtra(query);
    const extraHost = typeof extra?.host === 'string' ? extra.host : '';
    const extraPath = typeof extra?.path === 'string' ? extra.path : '';
    const extraMode = typeof extra?.mode === 'string' ? extra.mode : '';
    result.xhttpSettings = {
      host: query.host || extraHost,
      path: query.path || extraPath || '/',
      mode: query.mode || extraMode || 'auto',
      ...(extra ? { extra } : {}),
    };
  }

  if (network === 'mkcp' || network === 'kcp') {
    result.kcpSettings = {
      header: { type: query.headerType || 'none' },
      seed: query.seed || '',
    };
  }

  return result;
}

function parseVmessLink(link: string): {
  json: Record<string, unknown>;
  host: string;
  port: number;
} | null {
  const payload = link.replace(/^vmess:\/\//i, '').split('#')[0];
  try {
    const json = JSON.parse(decodeBase64(payload)) as Record<string, unknown>;
    const host = String(json.add ?? '');
    const port = Number(json.port ?? 443);
    if (!host || !Number.isFinite(port)) return null;
    return { json, host, port };
  } catch {
    return null;
  }
}

function vmessStreamSettings(json: Record<string, unknown>): JsonObject {
  const network = String(json.net ?? 'tcp').toLowerCase();
  const tls = String(json.tls ?? '').toLowerCase();
  const result: JsonObject = {
    network: network === 'tcp' ? 'raw' : network,
    security: tls === 'tls' ? 'tls' : 'none',
  };
  if (tls === 'tls') {
    result.tlsSettings = {
      serverName: String(json.sni ?? json.host ?? json.add ?? ''),
      fingerprint: String(json.fp ?? 'chrome'),
      allowInsecure: false,
    };
  }
  if (network === 'ws') {
    result.wsSettings = {
      path: String(json.path ?? '/'),
      headers: json.host ? { Host: String(json.host) } : {},
    };
  }
  if (network === 'grpc') {
    result.grpcSettings = {
      serviceName: String(json.path ?? json.serviceName ?? ''),
      multiMode: false,
    };
  }
  return result;
}

function parseShadowsocks(link: string): {
  method: string;
  password: string;
  host: string;
  port: number;
} | null {
  let payload = link
    .replace(/^ss:\/\//i, '')
    .split('#')[0]
    .split('?')[0];
  let userInfo = '';
  let hostPort = '';
  const at = payload.lastIndexOf('@');
  if (at >= 0) {
    userInfo = payload.slice(0, at);
    hostPort = payload.slice(at + 1);
  } else {
    const decoded = decodeBase64(payload);
    const decodedAt = decoded.lastIndexOf('@');
    if (decodedAt < 0) return null;
    userInfo = decoded.slice(0, decodedAt);
    hostPort = decoded.slice(decodedAt + 1);
  }

  const credentials = userInfo.includes(':') ? userInfo : decodeBase64(userInfo);
  const colon = credentials.indexOf(':');
  if (colon < 0) return null;
  const method = credentials.slice(0, colon);
  const password = credentials.slice(colon + 1);
  const hostColon = hostPort.lastIndexOf(':');
  if (hostColon < 0) return null;
  const host = hostPort.slice(0, hostColon);
  const port = Number(hostPort.slice(hostColon + 1));
  if (!host || !Number.isFinite(port)) return null;
  return { method, password, host, port };
}

function decodedUser(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Hysteria2 is a QUIC/HTTP3 protocol. Xray 26.3+ exposes it as the
 * `hysteria` outbound protocol with the `hysteria` transport.
 */
function hysteria2Outbound(node: ServerNode): JsonObject {
  const query = queryObject(node.rawLink);
  const authority = authorityFromLink(node.rawLink);
  const { user, host, port } = hostPortFromAuthority(authority, node.port || 443);
  const address = host || node.host;
  const endpointPort = port || node.port;
  const auth = decodedUser(user || query.auth || '');
  if (!address || !Number.isFinite(endpointPort)) {
    throw new UnsupportedProtocolError('hysteria2 without endpoint');
  }

  const serverName = query.sni || query.peer || query.host || address;
  const alpn = (query.alpn ? query.alpn.split(',') : ['h3'])
    .map((value) => value.trim())
    .filter(Boolean);
  const pinned = query.pinSHA256 || query.pcs || query['pin-sha256'];
  const tls: JsonObject = {
    serverName,
    alpn,
  };
  if (pinned) tls.pinnedPeerCertSha256 = pinned;
  if (query.vcn || query.verifyPeerCertByName) {
    tls.verifyPeerCertByName = query.vcn || query.verifyPeerCertByName;
  }
  if (query.fp) tls.fingerprint = query.fp;
  // Xray 26.10 removed `allowInsecure`. Links that rely on it must carry
  // `pinSHA256`; a self-signed endpoint without a pin cannot be verified.

  const hysteriaSettings: JsonObject = {
    version: 2,
    auth,
  };
  const udpIdleTimeout = Number(query.udpIdleTimeout);
  if (Number.isFinite(udpIdleTimeout) && udpIdleTimeout >= 2 && udpIdleTimeout <= 600) {
    hysteriaSettings.udpIdleTimeout = udpIdleTimeout;
  }

  // `fm` is the server-provided FinalMask JSON. It is authoritative and may
  // contain TCP masks, UDP masks and QUIC parameters. Preserve the whole object
  // instead of rebuilding only the two fields this client happens to know.
  const serverFinalmask = parseObject(query.fm);
  const finalmask: JsonObject = serverFinalmask ? { ...serverFinalmask } : {};

  const configuredUdp =
    Array.isArray(finalmask.udp) && finalmask.udp.length > 0 ? finalmask.udp.filter(isObject) : [];
  const udpMasks: JsonObject[] = [...configuredUdp];
  if (
    udpMasks.length === 0 &&
    query.obfs?.toLowerCase() === 'salamander' &&
    query['obfs-password']
  ) {
    udpMasks.push({
      type: 'salamander',
      settings: { password: query['obfs-password'] },
    });
  }
  if (udpMasks.length > 0) finalmask.udp = udpMasks;

  const configuredQuic = isObject(finalmask.quicParams) ? finalmask.quicParams : {};
  const quicParams: JsonObject = { ...configuredQuic };
  const bandwidth = (value: string | undefined): string | undefined => {
    if (!value) return undefined;
    return /^\d+(\.\d+)?$/.test(value.trim()) ? `${value.trim()} mbps` : value.trim();
  };
  const up = bandwidth(query.up);
  const down = bandwidth(query.down);
  if (up && quicParams.brutalUp == null) quicParams.brutalUp = up;
  if (down && quicParams.brutalDown == null) quicParams.brutalDown = down;
  if (query.congestion && quicParams.congestion == null) quicParams.congestion = query.congestion;
  if (query.mport && quicParams.udpHop == null) quicParams.udpHop = { ports: query.mport };
  if (Object.keys(quicParams).length > 0) finalmask.quicParams = quicParams;

  return {
    tag: node.id,
    protocol: 'hysteria',
    settings: {
      version: 2,
      address,
      port: endpointPort,
    },
    streamSettings: {
      network: 'hysteria',
      security: 'tls',
      tlsSettings: tls,
      hysteriaSettings,
      ...(Object.keys(finalmask).length > 0 ? { finalmask } : {}),
    },
  };
}

export function buildOutbound(node: ServerNode): JsonObject {
  if (node.protocol === 'hysteria2') {
    return hysteria2Outbound(node);
  }

  if (node.protocol === 'vless') {
    const query = queryObject(node.rawLink);
    const authority = authorityFromLink(node.rawLink);
    const { user } = hostPortFromAuthority(authority, node.port);
    if (!user) throw new UnsupportedProtocolError('vless without uuid');
    return {
      tag: node.id,
      protocol: 'vless',
      settings: {
        vnext: [
          {
            address: node.host,
            port: node.port,
            users: [
              {
                id: user,
                encryption: 'none',
                flow: query.flow || '',
              },
            ],
          },
        ],
      },
      streamSettings: streamSettings(node.rawLink),
    };
  }

  if (node.protocol === 'vmess') {
    const parsed = parseVmessLink(node.rawLink);
    if (!parsed) throw new UnsupportedProtocolError('vmess');
    return {
      tag: node.id,
      protocol: 'vmess',
      settings: {
        vnext: [
          {
            address: parsed.host,
            port: parsed.port,
            users: [
              {
                id: String(parsed.json.id ?? ''),
                alterId: Number(parsed.json.aid ?? 0),
                security: String(parsed.json.scy ?? 'auto'),
              },
            ],
          },
        ],
      },
      streamSettings: vmessStreamSettings(parsed.json),
    };
  }

  if (node.protocol === 'trojan') {
    const authority = authorityFromLink(node.rawLink);
    const { user } = hostPortFromAuthority(authority, 443);
    if (!user) throw new UnsupportedProtocolError('trojan without password');
    return {
      tag: node.id,
      protocol: 'trojan',
      settings: {
        servers: [{ address: node.host, port: node.port, password: user }],
      },
      streamSettings: streamSettings(node.rawLink),
    };
  }

  if (node.protocol === 'shadowsocks') {
    const parsed = parseShadowsocks(node.rawLink);
    if (!parsed) throw new UnsupportedProtocolError('shadowsocks');
    return {
      tag: node.id,
      protocol: 'shadowsocks',
      settings: {
        servers: [
          {
            address: parsed.host,
            port: parsed.port,
            method: parsed.method,
            password: parsed.password,
            uot: true,
            UoTVersion: 2,
          },
        ],
      },
    };
  }

  if (node.protocol === 'socks' || node.protocol === 'http') {
    const authority = authorityFromLink(node.rawLink);
    const { user, host, port } = hostPortFromAuthority(authority, node.port);
    const [username, ...passwordParts] = user.split(':');
    return {
      tag: node.id,
      protocol: node.protocol,
      settings: {
        servers: [
          {
            address: host || node.host,
            port: port || node.port,
            ...(username
              ? {
                  users: [
                    {
                      user: decodeURIComponent(username),
                      pass: decodeURIComponent(passwordParts.join(':')),
                    },
                  ],
                }
              : {}),
          },
        ],
      },
    };
  }

  throw new UnsupportedProtocolError(node.protocol);
}
