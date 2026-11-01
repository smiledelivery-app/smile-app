import { AppText as Text } from '@makanza/mobile-ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from './AppIcon';
import type { CustomerTab } from '../navigation/types';
import { darkColors, lightColors, type AppColors } from '../theme/colors';
import { radius, semantic, space, typeScale } from '../theme/tokens';

const tabs:{key:CustomerTab;label:string;icon:'home-outline'|'search-outline'|'clipboard-list-outline'|'card-outline'|'account-outline'}[]=[{key:'home',label:'Home',icon:'home-outline'},{key:'search',label:'Search',icon:'search-outline'},{key:'orders',label:'Orders',icon:'clipboard-list-outline'},{key:'wallet',label:'Wallet',icon:'card-outline'},{key:'profile',label:'Profile',icon:'account-outline'}];
export default function TabBar({active,dark,onChange}:{active:CustomerTab;dark:boolean;onChange:(tab:CustomerTab)=>void}){const c=semantic(dark?darkColors:lightColors);return <View style={[s.bar,{backgroundColor:c.surface,borderTopColor:c.border}]}>{tabs.map(tab=><Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{selected:active===tab.key}} accessibilityLabel={tab.label} onPress={()=>onChange(tab.key)} style={({pressed})=>[s.item,pressed&&s.pressed]}><Ionicons name={tab.icon} size={24} color={active===tab.key?c.primary:c.textSecondary}/><Text style={[s.label,{color:active===tab.key?c.primary:c.textSecondary},active===tab.key&&s.active]}>{tab.label}</Text></Pressable>)}</View>}
const s=StyleSheet.create({bar:{height:72,borderTopWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingBottom:space.xs},item:{flex:1,minHeight:52,alignItems:'center',justifyContent:'center',gap:4,borderRadius:radius.md},pressed:{opacity:.7},label:{...typeScale.caption,fontWeight:'600'},active:{fontWeight:'800'}});
