import { colors, layout } from '@ragenet/design';
import type { VpnState } from '@ragenet/core';
import { ParticleSphereSimulation, type ParticleMode } from '@ragenet/particles';
import { useEffect, useMemo, useRef, useState } from 'react';
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
const MOVE_CANCEL_PX = 26;

export function ParticleSphere({ state, onToggle, size: explicitSize }: ParticleSphereProps) {
  const { width } = useWindowDimensions();
  const size = explicitSize ?? Math.min(width * 0.8, layout.sphereMaxSize);
  const simulation = useMemo(() => new ParticleSphereSimulation({ count: 2200 }), []);
  const [charge, setCharge] = useState(0);
  const webGestureStyle =
    Platform.OS === 'web'
      ? ({
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          touchAction: 'none',
        } as unknown as ViewStyle)
      : undefined;

  const pressing = useRef(false);
  const dragging = useRef(false);
  const triggeredByHold = useRef(false);
  const pressStartedAt = useRef(0);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chargeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const previousState = useRef(state);

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

  const cancelCharge = () => {
    clearTimers();
    stopHapticRamp();
    simulation.setCharge(0);
    setCharge(0);
  };

  const beginPress = (event: GestureResponderEvent) => {
    clearTimers();
    pressing.current = true;
    dragging.current = false;
    triggeredByHold.current = false;
    pressStartedAt.current = Date.now();
    pressOrigin.current = {
      x: event.nativeEvent.locationX,
      y: event.nativeEvent.locationY,
    };
    lastPoint.current = null;
    simulation.setCharge(0);
    setCharge(0);
    updatePointer(event);

    startHapticRamp(HOLD_MS, 120);
    chargeTimer.current = setInterval(() => {
      if (!pressing.current || dragging.current) return;
      const progress = Math.min(1, (Date.now() - pressStartedAt.current) / HOLD_MS);
      simulation.setCharge(progress);
      setCharge(progress);
    }, 32);

    holdTimer.current = setTimeout(() => {
      if (!pressing.current || dragging.current || triggeredByHold.current) return;
      triggeredByHold.current = true;
      cancelCharge();
      chargeHaptic('medium');
      onToggle();
    }, HOLD_MS);
  };

  const updatePointer = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const x = Math.max(0, Math.min(size, locationX)) / size;
    const y = Math.max(0, Math.min(size, locationY)) / size;
    simulation.setPointer(x, y);

    if (pressing.current && !dragging.current && !triggeredByHold.current) {
      const origin = pressOrigin.current;
      if (origin && Math.hypot(locationX - origin.x, locationY - origin.y) > MOVE_CANCEL_PX) {
        // The user is playing with the sphere, not committing an action.
        dragging.current = true;
        cancelCharge();
      }
    }

    if (lastPoint.current) {
      const dx = x - lastPoint.current.x;
      const dy = y - lastPoint.current.y;
      const pixelDistance = Math.hypot(dx * size, dy * size);
      simulation.addSpin(dx, dy);
      simulation.addPointerEnergy(Math.min(0.35, pixelDistance / 45));
      if (!triggeredByHold.current && pixelDistance > 2) {
        dragHaptic(Math.min(1, pixelDistance / 14));
      }
    }
    lastPoint.current = { x, y };
  };

  const finishPress = (allowTap: boolean) => {
    if (!pressing.current) return;
    const elapsed = Date.now() - pressStartedAt.current;
    const wasDragging = dragging.current;
    const wasTriggered = triggeredByHold.current;

    pressing.current = false;
    clearTimers();
    stopHapticRamp();
    simulation.setCharge(0);
    setCharge(0);
    simulation.setPointer(null, null);
    lastPoint.current = null;
    pressOrigin.current = null;

    if (allowTap && !wasDragging && !wasTriggered && elapsed <= TAP_MAX_MS) {
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
      onMoveShouldSetResponder={() => true}
      onMoveShouldSetResponderCapture={() => true}
      onResponderGrant={beginPress}
      onResponderMove={updatePointer}
      onResponderRelease={() => finishPress(true)}
      onResponderTerminate={() => finishPress(false)}
      onResponderTerminationRequest={() => false}
      onStartShouldSetResponder={() => true}
      onStartShouldSetResponderCapture={() => true}
      style={[styles.root, { width: size, height: size }, webGestureStyle]}
      testID="particle-sphere"
    >
      <ParticleRenderer simulation={simulation} size={size} mode={mode} />
      <View
        pointerEvents="none"
        style={[
          styles.chargeRing,
          {
            width: size * 0.96,
            height: size * 0.96,
            borderRadius: size,
            borderColor: state === 'connected' ? colors.danger : colors.brandStrong,
            opacity: charge * 0.48,
            transform: [{ scale: 0.98 + charge * 0.05 }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  chargeRing: {
    position: 'absolute',
    borderWidth: 1.2,
  },
});
