import type { RoutingMode, ServerNode } from '../types';
import { buildOutbound } from './outbound';

export type JsonObject = Record<string, unknown>;

export interface BuildXrayConfigOptions {
  selectedServerId: string;
  routingMode?: RoutingMode;
  logLevel?: 'warning' | 'info' | 'debug';
  tunName?: string;
  tunMtu?: number;
  dnsServers?: string[];
}

export interface XrayConfig extends JsonObject {
  inbounds: JsonObject[];
  outbounds: JsonObject[];
}

const DEFAULT_DNS = ['1.1.1.1', '8.8.8.8'];

/** Must stay in sync with the latency probe in the UI store. */
export const LATENCY_PROBE_DOMAIN = 'gstatic.com';

function isObject(value: unknown): value is JsonObject {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function tunInbound(options: BuildXrayConfigOptions): JsonObject {
  return {
    tag: 'tun',
    protocol: 'tun',
    settings: {
      name: options.tunName ?? 'ragenet0',
      mtu: options.tunMtu ?? 1500,
    },
    sniffing: {
      enabled: true,
      destOverride: ['http', 'tls', 'quic'],
      routeOnly: false,
    },
  };
}

function proxyOutboundTag(config: JsonObject): string | undefined {
  const outbounds = Array.isArray(config.outbounds) ? config.outbounds : [];
  const proxy = outbounds.find((outbound) => {
    if (!isObject(outbound)) return false;
    const protocol = String(outbound.protocol ?? '');
    return !['freedom', 'blackhole', 'dns', 'loopback'].includes(protocol);
  });
  return isObject(proxy) && typeof proxy.tag === 'string' ? proxy.tag : undefined;
}

function directRules(mode: RoutingMode): JsonObject[] {
  if (mode === 'global') return [];
  const rules: JsonObject[] = [
    {
      type: 'field',
      outboundTag: 'direct',
      domain: ['localhost', 'domain:local'],
      // Keep the generated config independent from geoip.dat/geosite.dat.
      // Mobile clients cannot rely on those assets being present in the app bundle.
      ip: [
        '127.0.0.0/8',
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
        '169.254.0.0/16',
        '::1/128',
        'fc00::/7',
        'fe80::/10',
      ],
    },
  ];
  if (mode === 'bypass-ru') {
    rules.push({
      type: 'field',
      outboundTag: 'direct',
      domain: ['domain:ru'],
    });
  }
  return rules;
}

/**
 * Build a minimal, safe Xray client config.
 *
 * The TUN inbound is platform-agnostic: on Android/iOS the runtime injects
 * `xray.tun.fd` into the config `env` before starting the core. On desktop
 * Xray creates the interface itself (wintun/utun/Linux tun).
 */
export function buildXrayConfig(
  servers: ServerNode[],
  options: BuildXrayConfigOptions,
): XrayConfig {
  const selected = servers.find((server) => server.id === options.selectedServerId) ?? servers[0];
  if (!selected) throw new Error('No servers in subscription');
  if (selected.fullConfig) {
    return sanitizeFullConfig(JSON.parse(selected.fullConfig) as JsonObject, options);
  }

  const proxy = buildOutbound(selected);
  const routingMode = options.routingMode ?? 'global';
  const rules: JsonObject[] = [
    {
      type: 'field',
      domain: [`domain:${LATENCY_PROBE_DOMAIN}`],
      outboundTag: String(proxy.tag),
    },
    ...directRules(routingMode),
    { type: 'field', inboundTag: ['tun'], port: 53, outboundTag: String(proxy.tag) },
    { type: 'field', network: 'tcp,udp', outboundTag: String(proxy.tag) },
  ];

  return {
    log: {
      loglevel: options.logLevel ?? 'warning',
      access: 'none',
    },
    dns: {
      servers: options.dnsServers ?? DEFAULT_DNS,
      queryStrategy: 'UseIP',
    },
    inbounds: [tunInbound(options)],
    outbounds: [
      proxy,
      { tag: 'direct', protocol: 'freedom', settings: {} },
      { tag: 'block', protocol: 'blackhole', settings: {} },
    ],
    routing: {
      domainStrategy: 'IPIfNonMatch',
      rules,
    },
  };
}

/**
 * Harden a full Xray config before it reaches the core.
 *
 * Full configs are powerful and easy to misconfigure: a public SOCKS inbound
 * would turn the device into an open relay, and a local API inbound would let
 * other apps control the running core. We keep only the TUN inbound and remove
 * every control or proxy inbound. Server routing and outbounds are preserved.
 */
export function sanitizeFullConfig(input: JsonObject, options: BuildXrayConfigOptions): XrayConfig {
  const config = clone(input);
  const inbounds = Array.isArray(config.inbounds) ? config.inbounds.filter(isObject) : [];
  const safeInbounds: JsonObject[] = [];

  for (const inbound of inbounds) {
    const protocol = String(inbound.protocol ?? '').toLowerCase();
    if (protocol !== 'tun') continue;

    const sniffing = isObject(inbound.sniffing) ? inbound.sniffing : {};
    const destOverride = Array.isArray(sniffing.destOverride)
      ? sniffing.destOverride
      : ['http', 'tls', 'quic'];
    safeInbounds.push({
      ...inbound,
      tag: inbound.tag ?? 'tun',
      settings: {
        ...(isObject(inbound.settings) ? inbound.settings : {}),
        name:
          (isObject(inbound.settings) && inbound.settings.name) || options.tunName || 'ragenet0',
        mtu: (isObject(inbound.settings) && inbound.settings.mtu) || options.tunMtu || 1500,
      },
      // The generated probe rule matches the gstatic domain, so TUN
      // sniffing must stay enabled even in a custom config.
      sniffing: {
        ...sniffing,
        enabled: true,
        destOverride,
      },
    });
  }

  if (!safeInbounds.some((inbound) => inbound.protocol === 'tun')) {
    safeInbounds.unshift(tunInbound(options));
  }

  const outbounds = Array.isArray(config.outbounds) ? config.outbounds.filter(isObject) : [];
  if (outbounds.length === 0) {
    outbounds.push({ tag: 'direct', protocol: 'freedom', settings: {} });
    outbounds.push({ tag: 'block', protocol: 'blackhole', settings: {} });
  }

  // The API inbound is never started by the client. Remove any server-provided
  // API block as well, otherwise a full config could expose control services
  // on an inherited local port.
  delete config.api;
  delete config.stats;

  const routing = isObject(config.routing) ? config.routing : { domainStrategy: 'IPIfNonMatch' };
  const rules = Array.isArray(routing.rules) ? routing.rules.filter(isObject) : [];
  const inboundTags = new Set(
    safeInbounds
      .map((inbound) => inbound.tag)
      .filter((tag): tag is string => typeof tag === 'string'),
  );
  for (const rule of rules) {
    if (!Array.isArray(rule.inboundTag)) continue;
    const keptTags = rule.inboundTag.filter(
      (tag): tag is string => typeof tag === 'string' && inboundTags.has(tag),
    );
    if (keptTags.length === 0) {
      rule.inboundTag = [];
    } else {
      rule.inboundTag = keptTags;
    }
  }
  const activeRules = rules.filter(
    (rule) =>
      (!Array.isArray(rule.inboundTag) || rule.inboundTag.length > 0) && rule.outboundTag !== 'api',
  );

  // A full config may have been written for its own local proxy inbounds and
  // never mention the TUN inbound we inject. Give TUN an explicit route so
  // custom DNS/routing rules cannot accidentally leave device traffic
  // unhandled. Explicit user rules still win because this is prepended only
  // when no TUN rule exists.
  const proxyTag = proxyOutboundTag(config);
  const configuredTunTag = safeInbounds.find((inbound) => inbound.protocol === 'tun')?.tag;
  const tunTag = typeof configuredTunTag === 'string' ? configuredTunTag : 'tun';
  if (proxyTag) {
    // The latency probe must follow the proxy path even in a custom config
    // whose first-match rules would send Google traffic direct.
    activeRules.unshift({
      type: 'field',
      domain: [`domain:${LATENCY_PROBE_DOMAIN}`],
      outboundTag: proxyTag,
    });
  }
  if (
    proxyTag &&
    !activeRules.some((rule) => Array.isArray(rule.inboundTag) && rule.inboundTag.includes(tunTag))
  ) {
    const tunRule = { type: 'field', inboundTag: [tunTag], outboundTag: proxyTag };
    // Insert before a final catch-all. Appending after it would make the TUN
    // rule unreachable and could send device traffic direct in custom configs.
    const catchAllIndex = activeRules.findIndex((rule) => {
      const constraints = Object.keys(rule).filter(
        (key) => key !== 'type' && key !== 'outboundTag',
      );
      return constraints.length === 0 || (constraints.length === 1 && constraints[0] === 'network');
    });
    if (catchAllIndex >= 0) activeRules.splice(catchAllIndex, 0, tunRule);
    else activeRules.push(tunRule);
  }
  if (activeRules.length === 0) {
    const tag = proxyOutboundTag(config);
    if (tag) activeRules.push({ type: 'field', network: 'tcp,udp', outboundTag: tag });
  }

  return {
    ...config,
    log: {
      loglevel: options.logLevel ?? 'warning',
      access: 'none',
      ...(isObject(config.log) ? config.log : {}),
    },
    inbounds: safeInbounds,
    outbounds,
    routing: { ...routing, rules: activeRules },
  };
}

export interface PingBatchConfig {
  xrayJson: string;
  outboundTag: string;
}

/**
 * Build the isolated Xray config used by libXray's pingBatch. It contains only
 * outbounds: no TUN, DNS or routing, because the temporary core is created
 * solely to probe one location through its own proxy.
 */
export function buildPingBatchConfig(server: ServerNode): PingBatchConfig | null {
  if (server.fullConfig) {
    try {
      const fullConfig = JSON.parse(server.fullConfig) as JsonObject;
      const tag = proxyOutboundTag(fullConfig);
      if (!tag) return null;
      // The probe only needs outbounds. Do not start the server's inbounds or
      // API services in the temporary core.
      const outbounds = Array.isArray(fullConfig.outbounds)
        ? fullConfig.outbounds.filter(isObject)
        : [];
      return { xrayJson: JSON.stringify({ outbounds }), outboundTag: tag };
    } catch {
      return null;
    }
  }

  try {
    const outbound = buildOutbound(server);
    return {
      xrayJson: JSON.stringify({ outbounds: [outbound] }),
      outboundTag: String(outbound.tag),
    };
  } catch {
    return null;
  }
}

export function injectTunFd(config: XrayConfig, fd: number): XrayConfig {
  return {
    ...config,
    env: {
      ...(isObject(config.env) ? config.env : {}),
      'xray.tun.fd': String(fd),
    },
  };
}
