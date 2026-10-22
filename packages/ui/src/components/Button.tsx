import { colors, fonts, layout, radii } from '@ragenet/design';
import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { tapHaptic } from '../lib/haptics';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: ReactNode;
  rightIcon?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const variantStyles: Record<
  ButtonVariant,
  { backgroundColor: string; borderColor: string; color: string }
> = {
  primary: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
    color: colors.text,
  },
  secondary: {
    backgroundColor: colors.surface2,
    borderColor: colors.line,
    color: colors.text,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    color: colors.brandStrong,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: 'rgba(243, 101, 110, 0.28)',
    color: colors.danger,
  },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  rightIcon,
  disabled = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const variantStyle = variantStyles[variant];
  const iosShape =
    Platform.OS === 'ios' ? ({ borderCurve: 'continuous' } as unknown as ViewStyle) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      android_ripple={Platform.OS === 'android' ? { color: colors.white10 } : undefined}
      disabled={disabled}
      onPress={onPress}
      onPressIn={disabled ? undefined : tapHaptic}
      style={({ pressed }) => [
        styles.button,
        iosShape,
        {
          backgroundColor: variantStyle.backgroundColor,
          borderColor: variantStyle.borderColor,
          opacity: disabled ? 0.45 : pressed ? 0.84 : 1,
          transform: [{ scale: pressed && !disabled && Platform.OS === 'ios' ? 0.975 : 1 }],
        },
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.label, { color: variantStyle.color }]}>{label}</Text>
      {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: Platform.OS === 'android' ? radii.sm : radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    height: layout.buttonHeight,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
