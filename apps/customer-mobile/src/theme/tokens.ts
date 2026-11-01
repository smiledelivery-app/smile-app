import type { AppColors } from './colors';

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 24,
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 12,
  xl: 16,
  pill: 9999,
} as const;

export const typeScale = {
  display: { fontSize: 36, lineHeight: 42, fontWeight: '800' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  headline: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '700' as const },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 1.2 },
} as const;

export const semantic = (colors: AppColors) => ({
  background: colors.paper,
  surface: colors.card,
  surfaceSubtle: colors.cream,
  surfaceElevated: colors.card,
  textPrimary: colors.ink,
  textSecondary: colors.muted,
  border: colors.line,
  primary: colors.green,
  primarySoft: colors.mint,
  success: colors.accent,
  warning: colors.isDark ? '#e0b252' : '#845600',
  danger: colors.isDark ? '#f0877a' : '#9f2f2d',
  overlay: colors.isDark ? 'rgba(0,0,0,.62)' : 'rgba(31,35,33,.42)',
  onPrimary: colors.isDark ? '#0a120e' : '#fbfbfa',
});

export type SemanticColors = ReturnType<typeof semantic>;
