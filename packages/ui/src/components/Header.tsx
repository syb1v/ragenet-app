import { colors, fonts, layout } from '@ragenet/design';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrandLockup } from './BrandLockup';

interface HeaderProps {
  left?: ReactNode;
  right?: ReactNode;
  title?: string;
  centeredLogo?: boolean;
}

export function Header({ left, right, title, centeredLogo = true }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>{left}</View>
      <View style={styles.center} pointerEvents="none">
        {title ? (
          <Text style={styles.title}>{title}</Text>
        ) : centeredLogo ? (
          <BrandLockup size={34} />
        ) : null}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: layout.headerHeight,
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  side: {
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'center',
  },
  right: {
    alignItems: 'flex-end',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: -0.2,
  },
});
