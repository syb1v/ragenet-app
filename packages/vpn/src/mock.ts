import type { VpnStatus } from '@ragenet/core';
import type { StartVpnOptions, VpnBridge, VpnEventListener } from './types';

/**
 * Deterministic bridge for UI development. It deliberately prints no secrets
 * and never pretends to be a real tunnel — the status is labelled as mock in
 * the app logs.
 */
export class MockVpnBridge implements VpnBridge {
  private status: VpnStatus = { state: 'disconnected' };
  private listeners = new Set<VpnEventListener>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  async prepare(): Promise<boolean> {
    return true;
  }

  async start(_options: StartVpnOptions): Promise<void> {
    this.stopTimer();
    this.set({ state: 'connecting', since: Date.now() });
    await new Promise<void>((resolve) => {
      this.timer = setTimeout(() => {
        this.set({
          state: 'connected',
          since: Date.now(),
          stats: { uploadedBytes: 0, downloadedBytes: 0, uptimeSeconds: 0 },
        });
        resolve();
      }, 900);
    });
  }

  async stop(): Promise<void> {
    this.stopTimer();
    this.set({ state: 'disconnecting' });
    await new Promise<void>((resolve) => {
      this.timer = setTimeout(() => {
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
