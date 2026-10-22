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
  statsPort?: number;
}

export interface XrayConfig extends JsonObject {
  inbounds: JsonObject[];
  outbounds: JsonObject[];
}

const DEFAULT_DNS = ['1.1.1.1', '8.8.8.8'];

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

function apiInbound(port: number): JsonObject {
  return {
    tag: 'api',
    listen: '127.0.0.1',
    port,
    protocol: 'dokodemo-door',
    settings: { address: '127.0.0.1' },
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
    { type: 'field', inboundTag: ['api'], outboundTag: 'api' },
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
    stats: {},
    policy: {
      system: {
        statsInboundUplink: true,
        statsInboundDownlink: true,
        statsOutboundUplink: true,
        statsOutboundDownlink: true,
      },
    },
    api: {
      tag: 'api',
      services: ['HandlerService', 'LoggerService', 'StatsService'],
    },
    inbounds: [tunInbound(options), apiInbound(options.statsPort ?? 10085)],
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
 * would turn the device into an open relay. We force every non-TUN inbound to
 * loopback and add the client's TUN/stats plumbing.
 */
export function sanitizeFullConfig(input: JsonObject, options: BuildXrayConfigOptions): XrayConfig {
  const config = clone(input);
  const inbounds = Array.isArray(config.inbounds) ? config.inbounds.filter(isObject) : [];
  const safeInbounds: JsonObject[] = [];

  for (const inbound of inbounds) {
    const protocol = String(inbound.protocol ?? '').toLowerCase();
    if (protocol === 'tun') {
      safeInbounds.push({
        ...inbound,
        tag: inbound.tag ?? 'tun',
        settings: {
          ...(isObject(inbound.settings) ? inbound.settings : {}),
          name:
            (isObject(inbound.settings) && inbound.settings.name) || options.tunName || 'ragenet0',
          mtu: (isObject(inbound.settings) && inbound.settings.mtu) || options.tunMtu || 1500,
        },
        sniffing: inbound.sniffing ?? {
          enabled: true,
          destOverride: ['http', 'tls', 'quic'],
          routeOnly: false,
        },
      });
      continue;
    }

    // Keep local control/proxy inbounds, but never expose them to the network.
    if (['socks', 'http', 'mixed', 'dokodemo-door'].includes(protocol)) {
      safeInbounds.push({
        ...inbound,
        listen: '127.0.0.1',
      });
    }
  }

  if (!safeInbounds.some((inbound) => inbound.protocol === 'tun')) {
    safeInbounds.unshift(tunInbound(options));
  }
  if (!safeInbounds.some((inbound) => inbound.tag === 'api')) {
    safeInbounds.push(apiInbound(options.statsPort ?? 10085));
  }

  const outbounds = Array.isArray(config.outbounds) ? config.outbounds.filter(isObject) : [];
  if (outbounds.length === 0) {
    outbounds.push({ tag: 'direct', protocol: 'freedom', settings: {} });
    outbounds.push({ tag: 'block', protocol: 'blackhole', settings: {} });
  }

  const routing = isObject(config.routing) ? config.routing : { domainStrategy: 'IPIfNonMatch' };
  const rules = Array.isArray(routing.rules) ? routing.rules.filter(isObject) : [];
  if (!rules.some((rule) => Array.isArray(rule.inboundTag) && rule.inboundTag.includes('api'))) {
    rules.unshift({ type: 'field', inboundTag: ['api'], outboundTag: 'api' });
  }
  // A full config may have been written for its own local proxy inbounds and
  // never mention the TUN inbound we inject. Give TUN an explicit route so
  // custom DNS/routing rules cannot accidentally leave device traffic
  // unhandled. Explicit user rules still win because this is prepended only
  // when no TUN rule exists.
  const proxyTag = proxyOutboundTag(config);
  if (
    proxyTag &&
    !rules.some((rule) => Array.isArray(rule.inboundTag) && rule.inboundTag.includes('tun'))
  ) {
    rules.push({ type: 'field', inboundTag: ['tun'], outboundTag: proxyTag });
  }
  if (rules.length === 0) {
    const tag = proxyOutboundTag(config);
    if (tag) rules.push({ type: 'field', network: 'tcp,udp', outboundTag: tag });
  }

  return {
    ...config,
    log: {
      loglevel: options.logLevel ?? 'warning',
      access: 'none',
      ...(isObject(config.log) ? config.log : {}),
    },
    stats: {},
    policy: {
      ...(isObject(config.policy) ? config.policy : {}),
      system: {
        statsInboundUplink: true,
        statsInboundDownlink: true,
        statsOutboundUplink: true,
        statsOutboundDownlink: true,
        ...(isObject(config.policy) && isObject(config.policy.system) ? config.policy.system : {}),
      },
    },
    api: {
      tag: 'api',
      services: ['HandlerService', 'LoggerService', 'StatsService'],
      ...(isObject(config.api) ? config.api : {}),
    },
    inbounds: safeInbounds,
    outbounds,
    routing: { ...routing, rules },
  };
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
