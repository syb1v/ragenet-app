import { generateHwid, type VpnStatus } from '@ragenet/core';
import type {
  StartVpnOptions,
  VpnBridge,
  VpnEventListener,
  VpnLogEntry,
  VpnLogEventListener,
} from './types';

/**
 * Deterministic bridge for UI development. It deliberately prints no secrets
 * and never pretends to be a real tunnel — the status is labelled as mock in
 * the app logs.
 */
export class MockVpnBridge implements VpnBridge {
  private status: VpnStatus = { state: 'disconnected' };
  private listeners = new Set<VpnEventListener>();
  private logListeners = new Set<VpnLogEventListener>();
  private logs: VpnLogEntry[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  async prepare(): Promise<boolean> {
    return true;
  }

  async start(_options: StartVpnOptions): Promise<void> {
    this.stopTimer();
    this.log('info', 'Mock tunnel start requested');
    this.set({ state: 'connecting', since: Date.now() });
    await new Promise<void>((resolve) => {
      this.timer = setTimeout(() => {
        this.log('info', 'Mock tunnel connected');
        this.set({
          state: 'connected',
          since: Date.now(),
          stats: { uploadedBytes: 0, downloadedBytes: 0, uptimeSeconds: 0 },
        });
        resolve();
      }, 900);
    });
  }

  async reset(): Promise<void> {
    this.stopTimer();
    this.set({ state: 'disconnected' });
  }

  async stop(): Promise<void> {
    this.stopTimer();
    this.log('info', 'Mock tunnel stop requested');
    this.set({ state: 'disconnecting' });
    await new Promise<void>((resolve) => {
      this.timer = setTimeout(() => {
        this.log('info', 'Mock tunnel stopped');
        this.set({ state: 'disconnected' });
        resolve();
      }, 350);
    });
  }

  async getStatus(): Promise<VpnStatus> {
    return this.status;
  }

  subscribe(listener: VpnEventListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  getStableDeviceId(): string {
    const storageKey = 'ragenet.device.hwid';
    try {
      if (typeof globalThis.localStorage !== 'undefined') {
        const existing = globalThis.localStorage.getItem(storageKey);
        if (existing) return existing;
        const generated = generateHwid();
        globalThis.localStorage.setItem(storageKey, generated);
        return generated;
      }
    } catch {
      // Storage can be unavailable in private browser contexts.
    }
    return generateHwid();
  }

  async measureLatency(): Promise<number | null> {
    return null;
  }

  async getLogs(): Promise<VpnLogEntry[]> {
    return [...this.logs];
  }

  async clearLogs(): Promise<void> {
    this.logs = [];
  }

  subscribeLogs(listener: VpnLogEventListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  private log(level: VpnLogEntry['level'], message: string): void {
    const entry = { time: Date.now(), level, message };
    this.logs.push(entry);
    for (const listener of this.logListeners) listener(entry);
  }

  private set(status: VpnStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
