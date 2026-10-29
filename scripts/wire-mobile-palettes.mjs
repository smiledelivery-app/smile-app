import fs from 'node:fs';
for(const [path,themeImport] of [
  ['apps/customer-mobile/src/navigation/CustomerNavigator.tsx',"import { darkColors, lightColors, type AppColors } from '../theme/colors';"],
  ['apps/operations-mobile/src/navigation/OperationsNavigator.tsx',"import { darkColors, lightColors, type AppColors } from '../theme/colors';"]
]){
  let s=fs.readFileSync(path,'utf8');
  const oldLight="const lightColors={ink:'#192b23',green:'#194c3a',lime:'#d5ef81',cream:'#f7f7ef',paper:'#fffef9',card:'#ffffff',muted:'#79817a',orange:'#e87c59',line:'#e8ebe2',isDark:false};\n";
  const oldDark="const darkColors={ink:'#edf3e9',green:'#d5ef81',lime:'#d5ef81',cream:'#142019',paper:'#0e1711',card:'#18251c',muted:'#aab4a8',orange:'#ff9c79',line:'#2a382f',isDark:true};\n";
  s=s.replace(oldLight,'').replace(oldDark,'');
  if(!s.includes(themeImport))s=s.replace("import { formatMoney as money, makeIdempotencyKey } from '../utils/format';",`import { formatMoney as money, makeIdempotencyKey } from '../utils/format';\n${themeImport}`).replace("import { formatMoney as money } from '../utils/format';",`import { formatMoney as money } from '../utils/format';\n${themeImport}`);
  s=s.replace('const createStyles=(colors:typeof lightColors|typeof darkColors)=>','const createStyles=(colors:AppColors)=>').replace('const createStyles=(c:typeof lightColors|typeof darkColors)=>','const createStyles=(c:AppColors)=>');
  s=s.replace("backgroundColor:'white'","backgroundColor:colors.card").replace("borderColor:'#dce4d6'","borderColor:colors.line").replace("backgroundColor:'#f0f4e7'","backgroundColor:colors.cream").replace("backgroundColor:'#eef2df'","backgroundColor:colors.cream");
  s=s.replace("buttonText:{color:'white',fontSize:12,fontWeight:'700'}","buttonText:{color:colors.isDark?'#17231b':'white',fontSize:12,fontWeight:'700'}");
  s=s.replace("buttonText:{fontSize:11,fontWeight:'800',color:'white'}","buttonText:{fontSize:11,fontWeight:'800',color:c.isDark?'#17231b':'white'}");
  s=s.replace("brandMark:{backgroundColor:colors.green","brandMark:{backgroundColor:colors.isDark?'#194c3a':colors.green");
  if(path.includes('operations-mobile'))s=s.replace("hero:{padding:20,backgroundColor:c.green","hero:{padding:20,backgroundColor:c.isDark?'#194c3a':c.green").replace("riderHero:{minHeight:154,padding:19,borderRadius:22,backgroundColor:c.green","riderHero:{minHeight:154,padding:19,borderRadius:22,backgroundColor:c.isDark?'#194c3a':c.green");
  if(path.includes('operations-mobile'))s=s.replaceAll('colors.card','c.card').replaceAll('colors.line','c.line').replaceAll('colors.cream','c.cream');
  fs.writeFileSync(path,s);
}
