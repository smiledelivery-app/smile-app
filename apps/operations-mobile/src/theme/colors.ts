export const lightColors={ink:'#153a2b',green:'#176b4d',mint:'#ddf2e6',cream:'#f8f4ea',paper:'#ffffff',card:'#ffffff',muted:'#62756b',accent:'#46a878',line:'#dce8e0',isDark:false,lime:'#ddf2e6',orange:'#46a878'} as const;
export const darkColors={ink:'#ecf7f0',green:'#62c892',mint:'#24583f',cream:'#1b2a23',paper:'#0e1712',card:'#15231c',muted:'#a8b9af',accent:'#8ae0b0',line:'#2a4234',isDark:true,lime:'#24583f',orange:'#8ae0b0'} as const;
export type AppColors=typeof lightColors|typeof darkColors;
