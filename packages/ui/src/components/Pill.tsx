import { colors, fonts, radii } from '@ragenet/design';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

type PillTone = 'brand' | 'neutral' | 'success' | 'danger';

interface PillProps {
  children: ReactNode;
  tone?: PillTone;
  style?: StyleProp<ViewStyle>;
}

const toneStyles: Record<
  PillTone,
  { backgroundColor: string; borderColor: string; color: string }
> = {
  brand: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandBorder,
    color: colors.brandStrong,
  },
  neutral: {
    backgroundColor: colors.surface2,
    borderColor: colors.line,
    color: colors.text2,
  },
  success: {
    backgroundColor: colors.greenSoft,
    borderColor: 'rgba(52, 211, 153, 0.28)',
    color: colors.green,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: 'rgba(243, 101, 110, 0.28)',
    color: colors.danger,
  },
};

export function Pill({ children, tone = 'brand', style }: PillProps) {
  const toneStyle = toneStyles[tone];
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: toneStyle.color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 30,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  text: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
