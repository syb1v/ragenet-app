import type { VpnState, VpnStatus } from '@ragenet/core';
import { requireNativeModule } from 'expo-modules-core';
import { MockVpnBridge } from './mock';
import type { StartVpnOptions, VpnBridge, VpnEventListener } from './types';

interface NativeVpnModule {
  prepare(): Promise<boolean>;
  start(config: string, options: Record<string, unknown>): Promise<boolean>;
  stop(): Promise<boolean>;
  getStatus(): Promise<{ state: string; since?: number; error?: string }>;
  addListener(
    event: 'onVpnStatus',
    listener: (event: { state: string; since?: number; error?: string }) => void,
  ): { remove(): void };
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
  };
}
