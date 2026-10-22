import type { VpnState } from '@ragenet/core';
import { ParticleSphereSimulation, type ParticleMode } from '@ragenet/particles';
import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
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
  tickHaptic,
} from '../../lib/haptics';
import { ParticleRenderer } from './ParticleRenderer';

interface ParticleSphereProps {
  state: VpnState;
  onToggle: () => void;
  onChargeProgress?: (progress: number | null) => void;
  size?: number;
}

const HOLD_MS = 8000;
const TAP_MAX_MS = 320;

export function ParticleSphere({
  state,
  onToggle,
  onChargeProgress,
  size: explicitSize,
}: ParticleSphereProps) {
  const { width } = useWindowDimensions();
  const size = explicitSize ?? Math.min(width * 0.7, 280);
  const hitRadius = size * 0.46;
  const simulation = useMemo(() => new ParticleSphereSimulation({ count: 680 }), []);

  const pressing = useRef(false);
  const triggeredByHold = useRef(false);
  const pressStartedAt = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chargeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const pressOrigin = useRef({ x: 0.5, y: 0.5 });
  const burstHapticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousState = useRef(state);
  const renderScale = useRef(new Animated.Value(1)).current;
  const burstStarted = useRef(false);
  const reportedCharge = useRef(0);

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
    if (burstHapticTimer.current) {
      clearTimeout(burstHapticTimer.current);
      burstHapticTimer.current = null;
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
    onChargeProgress?.(null);
  };

  const runBurst = () => {
    if (burstStarted.current) return;
    burstStarted.current = true;
    clearTimers();
    stopHapticRamp();
    simulation.setPointer(null, null);
    simulation.setCharge(1);
    onChargeProgress?.(1);
    chargeHaptic('light');
    Animated.timing(renderScale, {
      toValue: 0.56,
      duration: 820,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished: compressed }) => {
      if (!compressed) return;
      onToggle();
      burstHapticTimer.current = setTimeout(() => chargeHaptic('light'), 760);
      Animated.timing(renderScale, {
        toValue: 1.3,
        duration: 760,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished: expanded }) => {
        if (!expanded) return;
        Animated.spring(renderScale, {
          toValue: 1,
          speed: 8,
          bounciness: 9,
          useNativeDriver: true,
        }).start(({ finished: settled }) => {
          simulation.setCharge(0);
          renderScale.setValue(1);
          burstStarted.current = false;
          if (settled) onChargeProgress?.(null);
        });
      });
    });
  };

  const beginPress = (event: GestureResponderEvent) => {
    if (burstStarted.current || state === 'connecting' || state === 'disconnecting') return;
    const { locationX, locationY } = event.nativeEvent;
    if (!isInside(locationX, locationY)) return;

    clearTimers();
    pressing.current = true;
    triggeredByHold.current = false;
    pressStartedAt.current = Date.now();
    lastPoint.current = null;
    burstStarted.current = false;
    simulation.setCharge(0);
    reportedCharge.current = 0;
    onChargeProgress?.(0);
    pressOrigin.current = { x: locationX / size, y: locationY / size };
    updatePointer(event);
    tickHaptic();

    startHapticRamp(HOLD_MS, 260);
    chargeTimer.current = setInterval(() => {
      if (!pressing.current) return;
      const progress = Math.min(1, (Date.now() - pressStartedAt.current) / HOLD_MS);
      simulation.setCharge(progress);
      if (progress >= 1 || progress - reportedCharge.current >= 0.02) {
        reportedCharge.current = progress;
        onChargeProgress?.(progress);
      }
    }, 32);

    holdTimer.current = setTimeout(() => {
      if (!pressing.current || triggeredByHold.current) return;
      triggeredByHold.current = true;
      runBurst();
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
    if (wasTriggered) {
      clearTimers();
      return;
    }
    resetCharge();
    simulation.setPointer(null, null);
    lastPoint.current = null;

    if (allowTap && !wasTriggered && elapsed <= TAP_MAX_MS) {
      simulation.triggerWave(pressOrigin.current.x, pressOrigin.current.y);
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
      <Animated.View style={[styles.render, { transform: [{ scale: renderScale }] }]}>
        <ParticleRenderer simulation={simulation} size={size} mode={mode} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  render: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
