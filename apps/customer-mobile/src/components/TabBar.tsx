import { AppText as Text } from '@makanza/mobile-ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from './AppIcon';
import type { CustomerTab } from '../navigation/types';
import { darkColors, lightColors, type AppColors } from '../theme/colors';
import { space } from '../theme/tokens';
import { customerPalette, customerRadius } from '../theme/customer';

const tabs:{key:CustomerTab;label:string;icon:'home-outline'|'search-outline'|'clipboard-list-outline'|'card-outline'|'account-outline'}[]=[{key:'home',label:'Home',icon:'home-outline'},{key:'search',label:'Search',icon:'search-outline'},{key:'orders',label:'Orders',icon:'clipboard-list-outline'},{key:'wallet',label:'Wallet',icon:'card-outline'},{key:'profile',label:'Profile',icon:'account-outline'}];
export default function TabBar({active,dark,onChange}:{active:CustomerTab;dark:boolean;onChange:(tab:CustomerTab)=>void}){const c=customerPalette(dark?darkColors:lightColors);return <View style={[s.bar,{backgroundColor:c.surface,borderTopColor:c.border}]}>{tabs.map(tab=><Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{selected:active===tab.key}} accessibilityLabel={tab.label} onPress={()=>onChange(tab.key)} style={({pressed})=>[s.item,pressed&&s.pressed]}><View style={[s.iconWrap,active===tab.key&&{backgroundColor:c.primarySoft}]}><Ionicons name={tab.icon} size={21} color={active===tab.key?c.primary:c.muted}/></View><Text style={[s.label,{color:active===tab.key?c.primary:c.muted},active===tab.key&&s.active]}>{tab.label}</Text></Pressable>)}</View>}
const s=StyleSheet.create({bar:{height:74,borderTopWidth:StyleSheet.hairlineWidth,flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingHorizontal:space.sm,paddingTop:space.xs,paddingBottom:space.sm},item:{flex:1,minHeight:58,alignItems:'center',justifyContent:'center',gap:2,borderRadius:customerRadius.md},iconWrap:{width:46,height:31,borderRadius:customerRadius.pill,alignItems:'center',justifyContent:'center'},pressed:{opacity:.7},label:{fontSize:10,lineHeight:14,fontWeight:'600'},active:{fontWeight:'800'}});
