import type { VpnState, VpnStatus } from '@ragenet/core';
import { requireNativeModule } from 'expo-modules-core';
import { MockVpnBridge } from './mock';
import type {
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
  measureLatency(host: string, port: number, timeoutMs: number): Promise<number | null>;
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
    measureLatency: (host, port, timeoutMs = 1600) => native.measureLatency(host, port, timeoutMs),
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
