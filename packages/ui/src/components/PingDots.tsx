import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface PingDotsProps {
  color: string;
  size?: number;
}

export function PingDots({ color, size = 4 }: PingDotsProps) {
  const first = useRef(new Animated.Value(0.35)).current;
  const second = useRef(new Animated.Value(0.35)).current;
  const third = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const makeLoop = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.35, duration: 240, useNativeDriver: true }),
          Animated.delay(240 - delay),
        ]),
      );

    const animations = [makeLoop(first, 0), makeLoop(second, 140), makeLoop(third, 280)];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [first, second, third]);

  return (
    <View style={styles.row} accessibilityLabel="Идёт проверка пинга">
      {[first, second, third].map((opacity, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              opacity,
              transform: [
                {
                  scale: opacity.interpolate({ inputRange: [0.35, 1], outputRange: [0.8, 1] }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
  },
  dot: {
    marginHorizontal: 0.5,
  },
});
