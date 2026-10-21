import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

let rampTimer: ReturnType<typeof setTimeout> | null = null;
let rampToken = 0;
let lastDragHapticAt = 0;

function run(action: () => Promise<void>): void {
  if (!enabled) return;
  action().catch(() => {
    // Haptics are optional feedback; never break the UI because of them.
  });
}

export function tapHaptic(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function tickHaptic(): void {
  run(() => Haptics.selectionAsync());
}

/**
 * A light tick while the finger travels across the sphere. The interval and
 * intensity follow the gesture speed, so slow strokes feel soft and quick
 * strokes feel more alive without turning into a constant buzz.
 */
export function dragHaptic(speed = 0.5): void {
  if (!enabled) return;
  const now = Date.now();
  const normalized = Math.min(1, Math.max(0, speed));
  const interval = 85 - normalized * 30;
  if (now - lastDragHapticAt < interval) return;
  lastDragHapticAt = now;
  chargeHaptic(normalized > 0.72 ? 'medium' : 'light');
}

export function chargeHaptic(intensity: 'light' | 'medium' | 'heavy'): void {
  const style =
    intensity === 'heavy'
      ? Haptics.ImpactFeedbackStyle.Heavy
      : intensity === 'medium'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
  run(() => Haptics.impactAsync(style));
}

/**
 * A soft, progressive haptic ramp for a press-and-hold.
 *
 * Expo Haptics has no continuous actuator API, so we schedule gentle impacts
 * with an easing interval. It feels like a rising pulse rather than a sharp
 * vibration, and a quick tap never reaches the first pulse.
 */
export function startHapticRamp(durationMs = 650, initialDelayMs = 220): () => void {
  stopHapticRamp();
  if (!enabled) return stopHapticRamp;

  const token = ++rampToken;
  const startedAt = Date.now();

  const pulse = () => {
    if (token !== rampToken) return;
    const elapsed = Date.now() - startedAt;
    const progress = Math.min(
      1,
      Math.max(0, (elapsed - initialDelayMs) / Math.max(1, durationMs - initialDelayMs)),
    );

    if (progress >= 1) {
      return;
    }

    if (elapsed >= initialDelayMs) {
      chargeHaptic(progress > 0.72 ? 'medium' : 'light');
      const interval = 150 - progress * 55;
      rampTimer = setTimeout(pulse, interval);
    } else {
      rampTimer = setTimeout(pulse, initialDelayMs - elapsed);
    }
  };

  rampTimer = setTimeout(pulse, initialDelayMs);
  return stopHapticRamp;
}

export function stopHapticRamp(): void {
  rampToken += 1;
  if (rampTimer) {
    clearTimeout(rampTimer);
    rampTimer = null;
  }
}

export function successHaptic(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function errorHaptic(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
