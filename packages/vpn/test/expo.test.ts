import { describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  prepare: () => true,
  start: async () => true,
  stop: async () => true,
  // Android exposes this as a synchronous Expo Function.
  getStatus: () => ({ state: 'disconnected' }),
  addListener: () => ({ remove: () => undefined }),
  getStableDeviceId: () => 'HWID',
  measureHttpLatency: async () => null,
  measureLatency: async () => null,
  pingBatch: async () => null,
  // iOS exposes these synchronously as well.
  getLogs: () => [{ time: 1, level: 'info', message: 'ready' }],
  clearLogs: () => true,
}));

vi.mock('expo-modules-core', () => ({
  requireNativeModule: () => native,
}));

import { createVpnBridge } from '../src/expo';

describe('VPN bridge', () => {
  it('normalizes synchronous native status and log results', async () => {
    const bridge = createVpnBridge();

    await expect(bridge.getStatus()).resolves.toMatchObject({ state: 'disconnected' });
    await expect(bridge.getLogs()).resolves.toEqual([{ time: 1, level: 'info', message: 'ready' }]);
    await expect(bridge.clearLogs()).resolves.toBeUndefined();
  });
});
