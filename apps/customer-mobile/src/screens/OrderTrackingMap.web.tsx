import { AppText as Text } from '@makanza/mobile-ui';
import { StyleSheet, View } from 'react-native';
import type { OrderTracking } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';

type Props={tracking:OrderTracking|null;loading:boolean;error:string;colors:AppColors};
export default function OrderTrackingMap({tracking,loading,error,colors:c}:Props){
  const hasRoute=tracking?.vendor.latitude!==null&&tracking?.vendor.latitude!==undefined&&tracking?.customer.latitude!==null&&tracking?.customer.latitude!==undefined;
  return <View style={[s.wrap,{backgroundColor:c.card}]}>
    <View style={s.heading}><View style={[s.dot,{backgroundColor:tracking?.rider?c.green:c.muted}]}/><Text style={[s.headingText,{color:c.ink}]}>{tracking?.rider?'LIVE RIDER LOCATION':'DELIVERY ROUTE'}</Text></View>
    <View style={[s.route,{backgroundColor:c.cream}]}><View style={[s.point,{backgroundColor:c.green}]}/><View style={[s.line,{backgroundColor:c.green}]}/><View style={[s.rider,{borderColor:c.accent,backgroundColor:c.card}]}><Text style={{color:c.accent,fontSize:13}}>➤</Text></View><View style={[s.line,{backgroundColor:c.line}]}/><View style={[s.point,{backgroundColor:c.accent}]}/></View>
    <View style={s.labels}><Text style={[s.label,{color:c.ink}]}>{tracking?.vendor.name??'Restaurant'}</Text><Text style={[s.label,{color:c.ink}]}>Your address</Text></View>
    <Text style={[s.caption,{color:c.muted}]}>{!hasRoute?'Map pins are not available for this order yet.':tracking?.rider?'Rider location is refreshing automatically.':loading?'Refreshing rider location…':error||'Waiting for the rider’s next location update.'}</Text>
  </View>;
}
const s=StyleSheet.create({wrap:{borderRadius:17,overflow:'hidden',padding:14,marginBottom:15},heading:{height:30,flexDirection:'row',alignItems:'center',gap:8},dot:{width:8,height:8,borderRadius:4},headingText:{fontSize:12,fontWeight:'900',letterSpacing:.6},route:{height:130,borderRadius:12,paddingHorizontal:20,flexDirection:'row',alignItems:'center',marginTop:7},point:{width:12,height:12,borderRadius:6},line:{height:3,flex:1},rider:{width:28,height:28,borderRadius:14,borderWidth:2,alignItems:'center',justifyContent:'center',marginHorizontal:5},labels:{flexDirection:'row',justifyContent:'space-between',marginTop:8},label:{fontSize:11,fontWeight:'800'},caption:{fontSize:11,lineHeight:16,textAlign:'center',marginTop:9}});
