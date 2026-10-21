import { colors, fonts } from '@ragenet/design';
import { StyleSheet, Text, View } from 'react-native';
import { RageNetMark } from './Logo';

interface BrandLockupProps {
  size?: number;
  showWordmark?: boolean;
  vertical?: boolean;
}

export function BrandLockup({
  size = 32,
  showWordmark = true,
  vertical = false,
}: BrandLockupProps) {
  return (
    <View style={[styles.row, vertical && styles.column]}>
      <RageNetMark size={size} />
      {showWordmark ? (
        <Text
          style={[
            styles.wordmark,
            { fontSize: Math.round(size * 0.52), lineHeight: Math.round(size * 0.62) },
          ]}
        >
          RageNet
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  column: {
    flexDirection: 'column',
    gap: 6,
  },
  wordmark: {
    color: colors.text,
    fontFamily: fonts.extrabold,
    letterSpacing: -0.5,
  },
});
