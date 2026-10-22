import type { VpnState, VpnStatus } from '@ragenet/core';
import { requireNativeModule } from 'expo-modules-core';
import { MockVpnBridge } from './mock';
import type {
  PingBatchConfig,
  PingBatchResult,
  StartVpnOptions,
  VpnBridge,
  VpnEventListener,
  VpnLogEntry,
  VpnLogEventListener,
} from './types';

interface NativeVpnModule {
  prepare(): Promise<boolean>;
  start(config: string, options: Record<string, unknown>): Promise<boolean>;
  stop(): Promise<boolean>;
  getStatus(): Promise<{ state: string; since?: number; error?: string }>;
  addListener(
    event: 'onVpnStatus',
    listener: (event: { state: string; since?: number; error?: string }) => void,
  ): { remove(): void };
  addListener(
    event: 'onVpnLog',
    listener: (event: { time: number; level: string; message: string }) => void,
  ): { remove(): void };
  getStableDeviceId(): string;
  getPingInterface?(): string | null;
  measureHttpLatency(url: string, timeoutMs: number): Promise<number | null>;
  measureLatency(host: string, port: number, timeoutMs: number): Promise<number | null>;
  pingBatch(payload: string, timeoutMs: number): Promise<string | null>;
  getLogs(): Promise<{ time: number; level: string; message: string }[]>;
  clearLogs(): Promise<boolean>;
}

interface NativeStatusEvent {
  state: string;
  since?: number;
  error?: string;
}

function toStatus(event: NativeStatusEvent): VpnStatus {
  return {
    state: event.state as VpnState,
    since: event.since,
    error: event.error,
  };
}

export function isNativeVpnAvailable(): boolean {
  try {
    requireNativeModule('RageNetVpn');
    return true;
  } catch {
    return false;
  }
}

export function createVpnBridge(): VpnBridge {
  let native: NativeVpnModule;
  try {
    native = requireNativeModule<NativeVpnModule>('RageNetVpn');
  } catch {
    // Expo Go/web/dev without the native module.
    return new MockVpnBridge();
  }

  return {
    prepare: () => native.prepare(),
    start: (options: StartVpnOptions) =>
      native
        .start(options.config, {
          killSwitch: options.killSwitch ?? false,
          mtu: options.mtu,
          dns: options.dns,
          allowedPackages: options.allowedPackages,
          disallowedPackages: options.disallowedPackages,
        })
        .then(() => undefined),
    stop: () => native.stop().then(() => undefined),
    getStatus: () => native.getStatus().then(toStatus),
    subscribe: (listener: VpnEventListener) => {
      const subscription = native.addListener('onVpnStatus', (event) => listener(toStatus(event)));
      return () => subscription.remove();
    },
    getStableDeviceId: () => native.getStableDeviceId(),
    getPingInterface: () => native.getPingInterface?.() ?? null,
    measureHttpLatency: (url, timeoutMs = 4000) => native.measureHttpLatency(url, timeoutMs),
    measureLatency: (host, port, timeoutMs = 4000) => native.measureLatency(host, port, timeoutMs),
    pingBatch: async (
      configs: PingBatchConfig[],
      url: string,
      timeoutSeconds: number,
    ): Promise<PingBatchResult[] | null> => {
      const payload = JSON.stringify({
        apiVersion: 3,
        method: 'pingBatch',
        payload: { configs, timeout: timeoutSeconds, url },
      });
      const raw = await native.pingBatch(payload, (timeoutSeconds + 8) * 1000);
      if (!raw) return null;
      try {
        const response = JSON.parse(raw) as {
          success?: boolean;
          data?: { results?: PingBatchResult[] };
        };
        if (!response.success) return null;
        return Array.isArray(response.data?.results) ? response.data.results : [];
      } catch {
        return null;
      }
    },
    getLogs: () =>
      native.getLogs().then((entries) =>
        entries.map((entry) => ({
          time: entry.time,
          level:
            entry.level === 'warn' || entry.level === 'error' ? entry.level : ('info' as const),
          message: entry.message,
        })),
      ),
    clearLogs: () => native.clearLogs().then(() => undefined),
    subscribeLogs: (listener: VpnLogEventListener) => {
      const subscription = native.addListener('onVpnLog', (event) =>
        listener({
          time: event.time,
          level:
            event.level === 'warn' || event.level === 'error' ? event.level : ('info' as const),
          message: event.message,
        }),
      );
      return () => subscription.remove();
    },
  };
}
