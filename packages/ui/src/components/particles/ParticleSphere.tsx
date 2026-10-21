import type { VpnState } from '@ragenet/core';
import { ParticleSphereSimulation, type ParticleMode } from '@ragenet/particles';
import { useEffect, useMemo, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import {
  chargeHaptic,
  dragHaptic,
  startHapticRamp,
  stopHapticRamp,
  tapHaptic,
} from '../../lib/haptics';
import { ParticleRenderer } from './ParticleRenderer';

interface ParticleSphereProps {
  state: VpnState;
  onToggle: () => void;
  size?: number;
}

const HOLD_MS = 600;
const TAP_MAX_MS = 260;

export function ParticleSphere({ state, onToggle, size: explicitSize }: ParticleSphereProps) {
  const { width } = useWindowDimensions();
  const size = explicitSize ?? Math.min(width * 0.7, 280);
  const hitRadius = size * 0.46;
  const simulation = useMemo(() => new ParticleSphereSimulation({ count: 1600 }), []);

  const pressing = useRef(false);
  const triggeredByHold = useRef(false);
  const pressStartedAt = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chargeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const previousState = useRef(state);

  const webGestureStyle =
    Platform.OS === 'web'
      ? ({
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          touchAction: 'none',
        } as unknown as ViewStyle)
      : undefined;

  const mode: ParticleMode =
    state === 'connected'
      ? 'connected'
      : state === 'connecting' || state === 'disconnecting'
        ? 'connecting'
        : 'idle';

  useEffect(() => {
    simulation.setMode(mode);
  }, [mode, simulation]);

  useEffect(() => {
    if (previousState.current === state) return;
    simulation.triggerReaction(state === 'connected' ? 1.3 : state === 'disconnected' ? 0.9 : 1.1);
    previousState.current = state;
  }, [simulation, state]);

  const clearTimers = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (chargeTimer.current) {
      clearInterval(chargeTimer.current);
      chargeTimer.current = null;
    }
  };

  useEffect(
    () => () => {
      clearTimers();
      stopHapticRamp();
    },
    [],
  );

  const isInside = (x: number, y: number): boolean => {
    const dx = x - size / 2;
    const dy = y - size / 2;
    return Math.hypot(dx, dy) <= hitRadius;
  };

  const resetCharge = () => {
    clearTimers();
    stopHapticRamp();
    simulation.setCharge(0);
  };

  const beginPress = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    if (!isInside(locationX, locationY)) return;

    clearTimers();
    pressing.current = true;
    triggeredByHold.current = false;
    pressStartedAt.current = Date.now();
    lastPoint.current = null;
    simulation.setCharge(0);
    updatePointer(event);

    startHapticRamp(HOLD_MS, 120);
    chargeTimer.current = setInterval(() => {
      if (!pressing.current) return;
      const progress = Math.min(1, (Date.now() - pressStartedAt.current) / HOLD_MS);
      simulation.setCharge(progress);
    }, 32);

    holdTimer.current = setTimeout(() => {
      if (!pressing.current || triggeredByHold.current) return;
      triggeredByHold.current = true;
      resetCharge();
      chargeHaptic('medium');
      onToggle();
    }, HOLD_MS);
  };

  const updatePointer = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;

    if (pressing.current && !isInside(locationX, locationY)) {
      pressing.current = false;
      triggeredByHold.current = false;
      resetCharge();
      simulation.setPointer(null, null);
      lastPoint.current = null;
      return;
    }

    if (!isInside(locationX, locationY)) return;

    const x = locationX / size;
    const y = locationY / size;
    simulation.setPointer(x, y);

    if (lastPoint.current) {
      const dx = x - lastPoint.current.x;
      const dy = y - lastPoint.current.y;
      const pixelDistance = Math.hypot(dx * size, dy * size);
      simulation.addSpin(dx, dy);
      simulation.addPointerEnergy(Math.min(0.35, pixelDistance / 45));
      if (pixelDistance > 2) dragHaptic(Math.min(1, pixelDistance / 14));
    }
    lastPoint.current = { x, y };
  };

  const finishPress = (allowTap: boolean) => {
    if (!pressing.current) return;
    const elapsed = Date.now() - pressStartedAt.current;
    const wasTriggered = triggeredByHold.current;

    pressing.current = false;
    resetCharge();
    simulation.setPointer(null, null);
    lastPoint.current = null;

    if (allowTap && !wasTriggered && elapsed <= TAP_MAX_MS) {
      tapHaptic();
      onToggle();
    }
    triggeredByHold.current = false;
  };

  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={
        state === 'connected'
          ? 'VPN подключён. Нажмите или удерживайте, чтобы отключить'
          : 'VPN отключён. Нажмите или удерживайте, чтобы подключить'
      }
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'activate') onToggle();
      }}
      onMoveShouldSetResponder={(event) =>
        isInside(event.nativeEvent.locationX, event.nativeEvent.locationY)
      }
      onMoveShouldSetResponderCapture={(event) =>
        isInside(event.nativeEvent.locationX, event.nativeEvent.locationY)
      }
      onResponderGrant={beginPress}
      onResponderMove={updatePointer}
      onResponderRelease={() => finishPress(true)}
      onResponderTerminate={() => finishPress(false)}
      onResponderTerminationRequest={() => false}
      onStartShouldSetResponder={(event) =>
        isInside(event.nativeEvent.locationX, event.nativeEvent.locationY)
      }
      onStartShouldSetResponderCapture={(event) =>
        isInside(event.nativeEvent.locationX, event.nativeEvent.locationY)
      }
      style={[styles.root, { width: size, height: size }, webGestureStyle]}
      testID="particle-sphere"
    >
      <ParticleRenderer simulation={simulation} size={size} mode={mode} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
