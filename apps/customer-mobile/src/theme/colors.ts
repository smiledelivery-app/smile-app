export const lightColors={ink:'#192b23',green:'#194c3a',lime:'#d5ef81',cream:'#f7f7ef',paper:'#fffef9',card:'#ffffff',muted:'#79817a',orange:'#e87c59',line:'#e8ebe2',isDark:false} as const;
export const darkColors={ink:'#edf3e9',green:'#d5ef81',lime:'#d5ef81',cream:'#202b24',paper:'#0e1711',card:'#18251c',muted:'#aab4a8',orange:'#ff9c79',line:'#202b24',isDark:true} as const;
export type AppColors=typeof lightColors|typeof darkColors;
