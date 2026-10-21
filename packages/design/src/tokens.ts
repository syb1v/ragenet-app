/**
 * RageNet design tokens.
 *
 * The palette intentionally mirrors the cabinet design system
 * (cabinet/src/styles/rage-ds.css) so the native app and the mini app
 * feel like one product.
 */

export const colors = {
  bg: '#080D18',
  bgDeep: '#050810',
  bgSoft: '#0B1220',

  surface: 'rgba(21, 30, 47, 0.92)',
  surfaceSolid: '#151E2F',
  surfaceRaised: '#1B2740',
  surface2: 'rgba(148, 163, 184, 0.06)',
  surface3: 'rgba(148, 163, 184, 0.1)',

  line: 'rgba(148, 163, 184, 0.14)',
  lineStrong: 'rgba(148, 163, 184, 0.22)',

  text: '#FFFFFF',
  text2: '#94A3B8',
  text3: '#64748B',

  brand: '#6C79DB',
  brandStrong: '#8792F0',
  brandSoft: 'rgba(108, 121, 219, 0.16)',
  brandBorder: 'rgba(108, 121, 219, 0.34)',
  violet: '#9A82F6',
  violetSoft: 'rgba(154, 130, 246, 0.16)',

  green: '#34D399',
  greenSoft: 'rgba(52, 211, 153, 0.14)',
  amber: '#F6B53D',
  amberSoft: 'rgba(246, 181, 61, 0.14)',
  danger: '#F3656E',
  dangerSoft: 'rgba(243, 101, 110, 0.14)',
  cyan: '#56C7E6',

  white06: 'rgba(255, 255, 255, 0.06)',
  white10: 'rgba(255, 255, 255, 0.1)',
  white16: 'rgba(255, 255, 255, 0.16)',
  black40: 'rgba(0, 0, 0, 0.4)',
  black70: 'rgba(0, 0, 0, 0.7)',
} as const;

export const radii = {
  hero: 26,
  card: 20,
  md: 16,
  sm: 12,
  xs: 8,
  pill: 999,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
  mega: 72,
} as const;

export const typography = {
  display: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  heading: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400' as const,
  },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600' as const,
  },
  small: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  smallStrong: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  caption: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
  mono: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
    letterSpacing: 0.1,
  },
} as const;

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 12,
  },
  sheet: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -14 },
    shadowOpacity: 0.45,
    shadowRadius: 34,
    elevation: 24,
  },
} as const;

export const layout = {
  maxContentWidth: 520,
  desktopWindowWidth: 460,
  desktopWindowHeight: 900,
  headerHeight: 56,
  buttonHeight: 56,
  rowHeight: 58,
  sphereMaxSize: 340,
} as const;
