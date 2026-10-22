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
 * A very quiet selection tick. This is the base texture for the aperture:
 * iOS renders it as a soft detent, Android as a light keyboard-like tick.
 */
function softTick(): void {
  run(() => Haptics.selectionAsync());
}

/**
 * A light tick while the finger travels across the aperture. The interval and
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
  if (normalized > 0.86) {
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  } else {
    softTick();
  }
}

export function chargeHaptic(intensity: 'light' | 'medium' | 'heavy'): void {
  // The aperture never uses the heavy actuator. A medium impact is the
  // ceiling here; hold feedback is carried by the selection ticks instead.
  const style =
    intensity === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
  run(() => Haptics.impactAsync(style));
}

/**
 * A soft, progressive haptic ramp for a press-and-hold.
 *
 * Expo Haptics has no continuous actuator API, so we schedule gentle impacts
 * with an easing interval. It feels like a rising pulse rather than a sharp
 * vibration, and a quick tap never reaches the first pulse.
 */
export function startHapticRamp(durationMs = 650, initialDelayMs = 260): () => void {
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
      // Selection ticks are much softer than repeated impacts. The interval
      // tightens only slightly, so the hold feels like a rising pulse rather
      // than a buzzing motor.
      softTick();
      const interval = durationMs > 2000 ? 520 - progress * 300 : 190 - progress * 55;
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
