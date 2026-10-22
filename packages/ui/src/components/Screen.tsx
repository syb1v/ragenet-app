import { layout } from '@ragenet/design';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { Background } from './Background';

interface ScreenProps {
  children: ReactNode;
  /** Disable the max-width column for full-bleed sheets. */
  fullWidth?: boolean;
}

export function Screen({ children, fullWidth = false }: ScreenProps) {
  const { width } = useWindowDimensions();
  const maxWidth = width >= 900 ? 760 : layout.maxContentWidth;
  return (
    <View style={styles.root}>
      <Background />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={[styles.content, !fullWidth && styles.column, !fullWidth && { maxWidth }]}>
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080D18',
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  column: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
});
