import type { AppColors } from './colors';

export const customerPalette=(colors:AppColors)=>({
  canvas:colors.isDark?'#0c1510':'#ffffff',
  surface:colors.isDark?'#142019':'#ffffff',
  surfaceAlt:colors.isDark?'#1b2b21':'#fcfcfb',
  border:colors.isDark?'#2a3b30':'#f2f2ef',
  ink:colors.ink,
  muted:colors.muted,
  primary:colors.isDark?'#87c6a0':'#1b5b42',
  balance:colors.isDark?'#174b36':'#1b5b42',
  primarySoft:colors.isDark?'#203a2b':'#f7faf8',
  accent:colors.isDark?'#f2b56b':'#dd704e',
  accentSoft:colors.isDark?'#392a20':'#fdfaf8',
  warning:colors.isDark?'#e4b75f':'#926510',
  danger:colors.isDark?'#f0877a':'#a33d32',
});

export const customerSpace={xs:4,sm:8,md:12,lg:16,xl:20,xxl:24,section:30} as const;
export const customerRadius={sm:10,md:14,lg:20,xl:26,pill:999} as const;
