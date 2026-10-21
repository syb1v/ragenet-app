import { colors, fonts, layout, radii, shadows, spacing, typography } from './tokens';

export const darkTheme = {
  name: 'dark' as const,
  colors,
  fonts,
  layout,
  radii,
  shadows,
  spacing,
  typography,
};

export type RageNetTheme = typeof darkTheme;
export const theme = darkTheme;
