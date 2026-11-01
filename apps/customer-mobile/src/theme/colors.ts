// Ported from RafiqHQ_mobile's design system. `cream` is retained as a
// compatibility alias for secondary surfaces; white remains the primary light
// surface and brand green is reserved for actions and emphasis.
export const lightColors={ink:'#1f2321',green:'#1d6147',mint:'#e6f0ea',cream:'#f6f5f2',paper:'#fbfbfa',card:'#ffffff',muted:'#4f5451',accent:'#2e8a62',line:'#eaeae7',isDark:false} as const;
export const darkColors={ink:'#eff0e7',green:'#7cc7a0',mint:'#203b2d',cream:'#19241e',paper:'#0a120e',card:'#111a15',muted:'#b5bcb3',accent:'#5dbe8e',line:'rgba(239,240,231,0.09)',isDark:true} as const;
export type AppColors=typeof lightColors|typeof darkColors;
