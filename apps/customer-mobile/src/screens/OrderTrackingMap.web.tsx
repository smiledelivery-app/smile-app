import { AppText as Text } from '@makanza/mobile-ui';
import { StyleSheet, View } from 'react-native';
import type { OrderTracking } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';
import { customerPalette, customerRadius } from '../theme/customer';

type Props={tracking:OrderTracking|null;loading:boolean;error:string;colors:AppColors};
export default function OrderTrackingMap({tracking,loading,error,colors:c}:Props){
  const p=customerPalette(c);
  const hasRoute=tracking?.vendor.latitude!==null&&tracking?.vendor.latitude!==undefined&&tracking?.customer.latitude!==null&&tracking?.customer.latitude!==undefined;
  const s=styles();
  return <View style={[s.wrap,{backgroundColor:p.surface,borderColor:p.border}]}>
    <View style={s.heading}><View style={[s.dot,{backgroundColor:tracking?.rider?p.primary:p.muted}]}/><Text style={[s.headingText,{color:p.ink}]}>{tracking?.rider?'LIVE RIDER LOCATION':'DELIVERY ROUTE'}</Text></View>
    <View style={[s.route,{backgroundColor:p.surfaceAlt}]}><View style={[s.point,{backgroundColor:p.primary}]}/><View style={[s.line,{backgroundColor:p.primary}]}/><View style={[s.rider,{borderColor:p.accent,backgroundColor:p.surface}]}><Text style={{color:p.accent,fontSize:13}}>➤</Text></View><View style={[s.line,{backgroundColor:p.border}]}/><View style={[s.point,{backgroundColor:p.accent}]}/></View>
    <View style={s.labels}><Text style={[s.label,{color:p.ink}]}>{tracking?.vendor.name??'Restaurant'}</Text><Text style={[s.label,{color:p.ink}]}>Your address</Text></View>
    <Text style={[s.caption,{color:p.muted}]}>{!hasRoute?'Map pins are not available for this order yet.':tracking?.rider?'Rider location is refreshing automatically.':loading?'Refreshing rider location…':error||'Waiting for the rider’s next location update.'}</Text>
  </View>;
}
const styles=()=>StyleSheet.create({wrap:{borderRadius:customerRadius.md,overflow:'hidden',padding:14,marginBottom:15,borderWidth:1},heading:{height:30,flexDirection:'row',alignItems:'center',gap:8},dot:{width:8,height:8,borderRadius:4},headingText:{fontSize:11,fontWeight:'900',letterSpacing:.6},route:{height:130,borderRadius:customerRadius.sm,paddingHorizontal:20,flexDirection:'row',alignItems:'center',marginTop:7},point:{width:12,height:12,borderRadius:6},line:{height:3,flex:1},rider:{width:28,height:28,borderRadius:14,borderWidth:2,alignItems:'center',justifyContent:'center',marginHorizontal:5},labels:{flexDirection:'row',justifyContent:'space-between',marginTop:8},label:{fontSize:11,fontWeight:'800'},caption:{fontSize:11,lineHeight:16,textAlign:'center',marginTop:9}});
