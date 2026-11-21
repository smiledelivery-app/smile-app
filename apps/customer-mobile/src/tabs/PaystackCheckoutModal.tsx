import { AppText as Text } from '@makanza/mobile-ui';
import { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '../components/AppIcon';
import type { AppColors } from '../theme/colors';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';

type Props={visible:boolean;authorizationUrl:string;reference:string;colors:AppColors;onClose:()=>void;onPaymentReturn:(reference:string)=>void};
const bridgeScript=`(function(){var previous='';var sendLocation=function(){var current=window.location.href;if(current!==previous&&window.ReactNativeWebView){previous=current;window.ReactNativeWebView.postMessage(current);}};sendLocation();window.addEventListener('pageshow',sendLocation);setInterval(sendLocation,500);})();true;`;

export default function PaystackCheckoutModal({visible,authorizationUrl,reference,colors,onClose,onPaymentReturn}:Props){
  const s=styles(colors);
  const onMessage=useCallback((event:{nativeEvent:{data:string}})=>{
    try{
      const destination=new URL(event.nativeEvent.data);
      if(destination.hostname.endsWith('paystack.com'))return;
      if(destination.searchParams.get('reference')===reference)onPaymentReturn(reference);
    }catch{}
  },[onPaymentReturn,reference]);
  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
    <SafeAreaView style={s.screen} edges={['top','bottom']}>
      <View style={s.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close Paystack checkout" onPress={onClose} style={s.close}><Ionicons name="close" size={23} color={colors.ink}/></Pressable>
        <View style={s.heading}><Text style={s.title}>Secure checkout</Text><Text style={s.subtitle}>Top up your Smile wallet</Text></View>
        <View style={s.lock}><Ionicons name="lock-closed-outline" size={17} color={colors.green}/></View>
      </View>
      <View style={s.webview}><WebView source={{uri:authorizationUrl}} injectedJavaScript={bridgeScript} onMessage={onMessage} style={s.webview}/></View>
      <View style={s.footer}><View style={s.footerIcon}><Ionicons name="shield-checkmark-outline" size={19} color={colors.green}/></View><Text style={s.footerText}>Payment details are handled securely by Paystack. Your wallet updates only after the payment is verified.</Text></View>
    </SafeAreaView>
  </Modal>;
}

const styles=(colors:AppColors)=>{
  const c=customerPalette(colors);
  return StyleSheet.create({
    screen:{flex:1,backgroundColor:c.canvas},
    header:{minHeight:70,flexDirection:'row',alignItems:'center',paddingHorizontal:customerSpace.lg,borderBottomWidth:1,borderBottomColor:c.border,backgroundColor:c.surface},
    close:{width:42,height:42,borderRadius:customerRadius.md,alignItems:'center',justifyContent:'center',backgroundColor:c.surfaceAlt},
    heading:{flex:1,paddingHorizontal:customerSpace.md},
    title:{fontSize:16,fontWeight:'900',color:c.ink},
    subtitle:{fontSize:11,color:c.muted,marginTop:3},
    lock:{width:38,height:38,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
    webview:{flex:1,overflow:'hidden'},
    footer:{minHeight:64,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:customerSpace.lg,paddingVertical:10,borderTopWidth:1,borderTopColor:c.border,backgroundColor:c.surface},
    footerIcon:{width:34,height:34,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
    footerText:{flex:1,fontSize:11,lineHeight:16,color:c.muted},
  });
};
