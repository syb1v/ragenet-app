import { requireNativeModule } from 'expo-modules-core';

export interface ParticleHapticFrame {
  energy: number;
  density: number;
  frequency: number;
}

interface NativeParticleHaptics {
  isAvailable(): boolean;
  start(): boolean;
  update(energy: number, density: number, frequency: number): void;
  burst(intensity: number): void;
  stop(): void;
}

export interface ParticleHaptics {
  readonly available: boolean;
  start(): void;
  update(frame: ParticleHapticFrame): void;
  burst(intensity?: number): void;
  stop(): void;
}

function unit(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

let nativeModule: NativeParticleHaptics | null | undefined;

function getNativeModule(): NativeParticleHaptics | null {
  if (nativeModule !== undefined) return nativeModule;
  try {
    nativeModule = requireNativeModule<NativeParticleHaptics>('RageNetHaptics');
  } catch {
    nativeModule = null;
  }
  return nativeModule;
}

/**
 * Continuous haptic stream backed by Core Haptics on iOS and the amplitude
 * waveform API on Android. Every active particle contributes its own energy,
 * rate and onset to the aggregate frame.
 */
export function createParticleHaptics(): ParticleHaptics {
  const native = getNativeModule();
  let available = false;
  try {
    available = native?.isAvailable?.() === true;
  } catch {
    // Old native binaries may not expose the haptics module.
  }
  let started = false;

  return {
    available,
    start() {
      if (!available || started) return;
      started = true;
      try {
        if (!native!.start()) started = false;
      } catch {
        started = false;
      }
    },
    update(frame) {
      if (!available || !started) return;
      const energy = unit(frame.energy);
      const density = unit(frame.density);
      const frequency = unit(frame.frequency);
      try {
        native!.update(energy, density, frequency);
      } catch {
        // Haptics are optional feedback; never break the gesture.
      }
    },
    burst(intensity = 1) {
      if (!available) return;
      try {
        native!.burst(unit(intensity));
      } catch {
        // Haptics are optional feedback.
      }
    },
    stop() {
      if (!available || !started) return;
      started = false;
      try {
        native!.stop();
      } catch {
        // Best effort.
      }
    },
  };
}
