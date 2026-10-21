import { colors, fonts, radii } from '@ragenet/design';
import { StyleSheet, Text, View } from 'react-native';
import { useAppStore } from '../store/useAppStore';

export function Toast() {
  const toast = useAppStore((state) => state.toast);
  if (!toast) return null;

  return (
    <View pointerEvents="none" style={styles.root}>
      <View style={styles.toast}>
        <Text style={styles.text}>{toast}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 100,
  },
  toast: {
    backgroundColor: 'rgba(21, 30, 47, 0.98)',
    borderColor: colors.lineStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 11,
    maxWidth: 420,
  },
  text: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
