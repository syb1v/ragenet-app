import { colors } from '@ragenet/design';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

export function Background() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[colors.bgSoft, colors.bg, colors.bgDeep]}
        locations={[0, 0.52, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="ragenetBlueGlow" gradientUnits="userSpaceOnUse" cx="12" cy="0" r="68">
            <Stop offset="0" stopColor="#2F7BFF" stopOpacity="0.2" />
            <Stop offset="0.45" stopColor="#2F7BFF" stopOpacity="0.07" />
            <Stop offset="1" stopColor="#2F7BFF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id="ragenetVioletGlow"
            gradientUnits="userSpaceOnUse"
            cx="102"
            cy="38"
            r="52"
          >
            <Stop offset="0" stopColor="#9A82F6" stopOpacity="0.12" />
            <Stop offset="0.5" stopColor="#9A82F6" stopOpacity="0.045" />
            <Stop offset="1" stopColor="#9A82F6" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id="ragenetBottomGlow"
            gradientUnits="userSpaceOnUse"
            cx="50"
            cy="108"
            r="50"
          >
            <Stop offset="0" stopColor="#6C79DB" stopOpacity="0.1" />
            <Stop offset="1" stopColor="#6C79DB" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#ragenetBlueGlow)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#ragenetVioletGlow)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#ragenetBottomGlow)" />
      </Svg>
      <LinearGradient
        colors={['rgba(5, 8, 16, 0)', 'rgba(5, 8, 16, 0.62)']}
        style={styles.bottomFade}
      />
      <View style={styles.vignette} />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 240,
  },
  vignette: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
});
