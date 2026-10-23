export type Protocol =
  | 'vless'
  | 'vmess'
  | 'trojan'
  | 'shadowsocks'
  | 'socks'
  | 'http'
  | 'wireguard'
  | 'hysteria2'
  | 'unknown';

export type Transport =
  'tcp' | 'ws' | 'grpc' | 'httpupgrade' | 'xhttp' | 'mkcp' | 'hysteria' | 'unknown';

export interface ServerNode {
  id: string;
  name: string;
  protocol: Protocol;
  host: string;
  port: number;
  rawLink: string;
  /** ISO 3166-1 alpha-2 when the name carries a flag emoji or a known country. */
  countryCode?: string;
  flagEmoji?: string;
  transport?: Transport;
  security?: 'none' | 'tls' | 'reality';
  latencyMs?: number;
  /** Full Xray config when the subscription returned a complete config. */
  fullConfig?: string;
  /** A non-connectable separator/header emitted by the subscription. */
  isGroup?: boolean;
}

export interface SubscriptionMeta {
  title?: string;
  supportUrl?: string;
  webPageUrl?: string;
  announce?: string;
  updateIntervalHours?: number;
  uploadBytes?: number;
  downloadBytes?: number;
  totalBytes?: number;
  expiresAt?: number;
  hideUrl?: boolean;
  hideTraffic?: boolean;
  sortOrder?: 'ping' | 'name' | 'none';
}

export interface Subscription {
  id: string;
  url: string;
  meta: SubscriptionMeta;
  servers: ServerNode[];
  updatedAt: number;
  /** True when the body was a complete Xray config rather than share links. */
  isFullConfig?: boolean;
}

export interface ParsedSubscription {
  meta: SubscriptionMeta;
  servers: ServerNode[];
  isFullConfig?: boolean;
  fullConfig?: Record<string, unknown>;
}

export type RoutingMode = 'global' | 'bypass-local' | 'bypass-ru' | 'custom';

export type VpnState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error';

export interface VpnStats {
  uploadedBytes: number;
  downloadedBytes: number;
  uptimeSeconds: number;
}

export interface VpnStatus {
  state: VpnState;
  since?: number;
  error?: string;
  stats?: VpnStats;
}

export interface AppSettings {
  routingMode: RoutingMode;
  killSwitch: boolean;
  autoConnect: boolean;
  logLevel: 'warning' | 'info' | 'debug';
  language: 'ru' | 'en';
  theme: 'dark' | 'light';
}

export const DEFAULT_SETTINGS: AppSettings = {
  routingMode: 'global',
  killSwitch: false,
  autoConnect: false,
  logLevel: 'warning',
  language: 'ru',
  theme: 'dark',
};

export interface SubscriptionUserInfo {
  uploadBytes?: number;
  downloadBytes?: number;
  totalBytes?: number;
  expiresAt?: number;
}
