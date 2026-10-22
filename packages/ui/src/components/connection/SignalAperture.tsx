import { colors } from '@ragenet/design';
import type { VpnState } from '@ragenet/core';
import { LinearGradient } from 'expo-linear-gradient';
import { Power } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import {
  chargeHaptic,
  dragHaptic,
  startHapticRamp,
  stopHapticRamp,
  tapHaptic,
  tickHaptic,
} from '../../lib/haptics';

interface SignalApertureProps {
  state: VpnState;
  onToggle: () => void;
  size?: number;
}

const HOLD_MS = 600;
const TAP_MAX_MS = 260;
const VIEWBOX = 276;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * 124;

function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

function accentFor(state: VpnState): string {
  if (state === 'connected') return colors.green;
  if (state === 'connecting' || state === 'disconnecting') return colors.brandStrong;
  if (state === 'error') return colors.danger;
  return colors.cyan;
}

export function SignalAperture({ state, onToggle, size: explicitSize }: SignalApertureProps) {
  const { width } = useWindowDimensions();
  const size = explicitSize ?? Math.min(width * 0.72, 276);
  const coreSize = size * 0.275;
  const reduceMotion = useReduceMotion();
  const accent = accentFor(state);
  const coreStops: [string, string, string] =
    state === 'connected'
      ? ['#256B62', '#152F38', '#0D1424']
      : state === 'error'
        ? ['#5A2433', '#281824', '#0D1424']
        : state === 'connecting'
          ? ['#3C4B9A', '#202950', '#0D1424']
          : ['#293A67', '#17223E', '#0D1424'];

  const spinA = useRef(new Animated.Value(0)).current;
  const spinB = useRef(new Animated.Value(0)).current;
  const dustDrag = useRef(new Animated.Value(0)).current;
  const vibration = useRef(new Animated.Value(0)).current;
  const dragAngle = useRef(0);
  const pressing = useRef(false);
  const triggeredByHold = useRef(false);
  const startedAt = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chargeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [charge, setCharge] = useState(0);
  const [isCharging, setIsCharging] = useState(false);

  const dust = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => {
        const outer = index % 2 === 0;
        const angle = ((index * 137.508 + (outer ? 0 : 23)) * Math.PI) / 180;
        const radius = outer ? 134 : 113;
        return {
          x: 138 + Math.cos(angle) * radius,
          y: 138 + Math.sin(angle) * radius,
          radius: outer ? 1.1 : 0.8,
          opacity: outer ? 0.58 : 0.38,
        };
      }),
    [],
  );

  useEffect(() => {
    if (!isCharging || reduceMotion) {
      vibration.stopAnimation();
      vibration.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(vibration, {
          toValue: 1,
          duration: 90,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(vibration, {
          toValue: -1,
          duration: 90,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(vibration, {
          toValue: 0,
          duration: 90,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      vibration.setValue(0);
    };
  }, [isCharging, reduceMotion, vibration]);

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

  const rotateA = spinA.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const rotateB = spinB.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });
  const rotateDust = spinB.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const dragRotate = dustDrag.interpolate({
    inputRange: [-55, 55],
    outputRange: ['-55deg', '55deg'],
  });
  const vibrateX = vibration.interpolate({
    inputRange: [-1, 1],
    outputRange: [-1.5, 1.5],
  });
  const vibrateY = vibration.interpolate({
    inputRange: [-1, 1],
    outputRange: [1.2, -1.2],
  });

  const isInside = (x: number, y: number) => {
    const dx = x - size / 2;
    const dy = y - size / 2;
    return Math.hypot(dx, dy) <= size * 0.46;
  };

  const resetCharge = () => {
    clearTimers();
    stopHapticRamp();
    setCharge(0);
    setIsCharging(false);
    dragAngle.current = 0;
    Animated.spring(dustDrag, {
      toValue: 0,
      speed: 18,
      bounciness: 4,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const beginPress = (event: GestureResponderEvent) => {
    if (state === 'connecting' || state === 'disconnecting') return;
    const { locationX, locationY } = event.nativeEvent;
    if (!isInside(locationX, locationY)) return;

    clearTimers();
    pressing.current = true;
    triggeredByHold.current = false;
    startedAt.current = Date.now();
    lastPoint.current = null;
    setCharge(0);
    setIsCharging(true);
    tickHaptic();
    startHapticRamp(HOLD_MS, 260);

    chargeTimer.current = setInterval(() => {
      if (!pressing.current) return;
      const progress = Math.min(1, (Date.now() - startedAt.current) / HOLD_MS);
      setCharge(progress);
    }, 24);

    holdTimer.current = setTimeout(() => {
      if (!pressing.current || triggeredByHold.current) return;
      triggeredByHold.current = true;
      clearTimers();
      setCharge(0);
      setIsCharging(false);
      chargeHaptic('light');
      onToggle();
    }, HOLD_MS);
  };

  const updatePointer = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    if (pressing.current && !isInside(locationX, locationY)) {
      pressing.current = false;
      triggeredByHold.current = false;
      resetCharge();
      lastPoint.current = null;
      return;
    }
    if (!pressing.current || !isInside(locationX, locationY)) return;

    const x = locationX / size;
    const y = locationY / size;
    if (lastPoint.current) {
      const dx = (x - lastPoint.current.x) * size;
      const distance = Math.hypot(x - lastPoint.current.x, y - lastPoint.current.y) * size;
      dragAngle.current = Math.max(-55, Math.min(55, dragAngle.current + dx * 0.16));
      dustDrag.setValue(dragAngle.current);
      if (distance > 3) dragHaptic(Math.min(1, distance / 32));
    }
    lastPoint.current = { x, y };
  };

  const finishPress = () => {
    if (!pressing.current) return;
    const elapsed = Date.now() - startedAt.current;
    const wasTriggered = triggeredByHold.current;

    pressing.current = false;
    resetCharge();
    lastPoint.current = null;

    if (!wasTriggered && elapsed <= TAP_MAX_MS) {
      onToggle();
    }
    triggeredByHold.current = false;
  };

  const coreBorderColor =
    state === 'connected'
      ? 'rgba(52, 211, 153, 0.4)'
      : state === 'error'
        ? 'rgba(243, 101, 110, 0.4)'
        : 'rgba(255, 255, 255, 0.16)';

  const webGestureStyle =
    Platform.OS === 'web'
      ? ({
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          touchAction: 'none',
        } as unknown as ViewStyle)
      : undefined;

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
      onResponderRelease={finishPress}
      onResponderTerminate={finishPress}
      onResponderTerminationRequest={() => false}
      onStartShouldSetResponder={(event) =>
        isInside(event.nativeEvent.locationX, event.nativeEvent.locationY)
      }
      onStartShouldSetResponderCapture={(event) =>
        isInside(event.nativeEvent.locationX, event.nativeEvent.locationY)
      }
      style={[styles.root, { width: size, height: size }, webGestureStyle]}
      testID="signal-aperture"
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.layer, { transform: [{ rotate: rotateA }] }]}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
          <Circle
            cx="138"
            cy="138"
            r="124"
            fill="none"
            stroke={accent}
            strokeOpacity={state === 'connected' ? 0.62 : 0.5}
            strokeWidth={1.1}
            strokeDasharray="2 8"
          />
          <Circle
            cx="138"
            cy="138"
            r="124"
            fill="none"
            stroke={accent}
            strokeOpacity={0.82}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeDasharray="48 731"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.layer, { transform: [{ rotate: rotateB }] }]}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
          <Circle
            cx="138"
            cy="138"
            r="102"
            fill="none"
            stroke={colors.brandStrong}
            strokeOpacity={state === 'connected' ? 0.46 : 0.4}
            strokeWidth={1}
            strokeDasharray="1 11"
          />
          <Circle
            cx="138"
            cy="138"
            r="102"
            fill="none"
            stroke={accent}
            strokeOpacity={0.55}
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeDasharray="34 607"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.layer, { transform: [{ rotate: rotateA }] }]}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
          <Circle
            cx="138"
            cy="138"
            r="78"
            fill="none"
            stroke={colors.text2}
            strokeOpacity={0.22}
            strokeWidth={1}
            strokeDasharray="1 6"
          />
          <Circle
            cx="138"
            cy="138"
            r="54"
            fill="none"
            stroke={accent}
            strokeOpacity={0.32}
            strokeWidth={1}
            strokeDasharray="2 5"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.layer, { transform: [{ rotate: rotateDust }] }]}
      >
        <Animated.View style={[styles.layer, { transform: [{ rotate: dragRotate }] }]}>
          <Animated.View
            style={[
              styles.layer,
              {
                opacity: state === 'connected' ? 0.9 : state === 'error' ? 0.38 : 0.7,
                transform: [
                  { scale: 1 - charge * 0.055 },
                  { translateX: vibrateX },
                  { translateY: vibrateY },
                ],
              },
            ]}
          >
            <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
              {dust.map((dot, index) => (
                <Circle
                  key={index}
                  cx={dot.x}
                  cy={dot.y}
                  r={dot.radius}
                  fill={accent}
                  opacity={dot.opacity}
                />
              ))}
            </Svg>
          </Animated.View>
        </Animated.View>
      </Animated.View>

      <Svg
        pointerEvents="none"
        width={size}
        height={size}
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        style={styles.layer}
      >
        <Defs>
          <RadialGradient id="apertureHalo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={accent} stopOpacity={state === 'connected' ? 0.22 : 0.16} />
            <Stop offset="0.55" stopColor={accent} stopOpacity="0.045" />
            <Stop offset="1" stopColor={accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="138" cy="138" r="74" fill="url(#apertureHalo)" />
        <Circle
          cx="138"
          cy="138"
          r="124"
          fill="none"
          stroke={accent}
          strokeOpacity={charge > 0 ? 0.95 : 0}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={`${PROGRESS_CIRCUMFERENCE} ${PROGRESS_CIRCUMFERENCE}`}
          strokeDashoffset={PROGRESS_CIRCUMFERENCE * (1 - charge)}
          rotation={-90}
          origin="138, 138"
        />
      </Svg>

      <LinearGradient
        colors={coreStops}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[
          styles.core,
          {
            width: coreSize,
            height: coreSize,
            borderRadius: coreSize / 2,
            borderColor: coreBorderColor,
          },
        ]}
        pointerEvents="none"
      >
        <Power
          color={state === 'connected' ? colors.green : colors.text}
          size={coreSize * 0.34}
          strokeWidth={1.8}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    position: 'absolute',
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.42,
    shadowRadius: 24,
    elevation: 10,
  },
});
