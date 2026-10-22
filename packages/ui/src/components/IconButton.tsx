import { colors, radii } from '@ragenet/design';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { tapHaptic } from '../lib/haptics';

interface IconButtonProps {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  variant?: 'surface' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  children,
  onPress,
  accessibilityLabel,
  size = 42,
  variant = 'surface',
  style,
}: IconButtonProps) {
  const backgroundColor =
    variant === 'danger'
      ? colors.dangerSoft
      : variant === 'ghost'
        ? 'transparent'
        : colors.surface2;
  const borderColor = variant === 'danger' ? 'rgba(243, 101, 110, 0.24)' : colors.line;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={Platform.OS === 'android' ? { color: colors.white10 } : undefined}
      onPress={onPress}
      onPressIn={tapHaptic}
      style={({ pressed }) => [
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: Math.min(radii.md, size / 2),
          backgroundColor,
          borderColor,
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed && Platform.OS === 'ios' ? 0.93 : 1 }],
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
  },
});
