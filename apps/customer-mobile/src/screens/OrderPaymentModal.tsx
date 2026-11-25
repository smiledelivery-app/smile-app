import { AppText as Text } from '@makanza/mobile-ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { api } from '../services/api';
import type { AppColors } from '../theme/colors';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';

type Props={
  visible:boolean;
  token:string;
  amountMinor:number;
  subtotalMinor?:number;
  deliveryFeeMinor?:number;
  serviceFeeMinor?:number;
  deliveryDistanceMeters?:number|null;
  busy:boolean;
  error:string;
  colors:AppColors;
  onClose:()=>void;
  onPay:(method:'wallet'|'paystack')=>void;
};
const money=(minor:number)=>`₦${(minor/100).toLocaleString('en-NG')}`;

export default function OrderPaymentModal({visible,token,amountMinor,subtotalMinor,deliveryFeeMinor,serviceFeeMinor,deliveryDistanceMeters,busy,error,colors,onClose,onPay}:Props){
  const [balanceMinor,setBalanceMinor]=useState<number|null>(null);
  const [balanceLoading,setBalanceLoading]=useState(false);
  const [balanceError,setBalanceError]=useState('');
  const s=styles(colors);

  useEffect(()=>{
    if(!visible)return;
    let active=true;
    setBalanceMinor(null);
    setBalanceError('');
    setBalanceLoading(true);
    void api.get<{balanceMinor:number}>('/wallet',token)
      .then(wallet=>{if(active)setBalanceMinor(wallet.balanceMinor);})
      .catch(reason=>{if(active)setBalanceError(reason instanceof Error?reason.message:'Could not load your wallet balance.');})
      .finally(()=>{if(active)setBalanceLoading(false);});
    return()=>{active=false;};
  },[visible,token]);

  const insufficient=balanceMinor!==null&&balanceMinor<amountMinor;
  const hasBreakdown=subtotalMinor!==undefined&&deliveryFeeMinor!==undefined&&serviceFeeMinor!==undefined;
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={s.overlay}>
      <View style={s.sheet}>
        <View style={s.headingRow}>
          <View style={s.headingIcon}><Ionicons name="lock-closed-outline" size={20} color={colors.green}/></View>
          <View style={{flex:1}}><Text style={s.title}>Choose payment</Text><Text style={s.subtitle}>Order total · {money(amountMinor)}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close payment options" onPress={onClose} style={s.close}><Ionicons name="close" size={21} color={colors.muted}/></Pressable>
        </View>
        {hasBreakdown&&<View style={s.breakdown}>
          <View style={s.breakdownRow}><Text style={s.breakdownLabel}>Items subtotal</Text><Text style={s.breakdownValue}>{money(subtotalMinor)}</Text></View>
          <View style={s.breakdownRow}><Text style={s.breakdownLabel}>Rider delivery fee{typeof deliveryDistanceMeters==='number'?` (${(deliveryDistanceMeters/1000).toFixed(1)} km)`:''}</Text><Text style={s.breakdownValue}>{money(deliveryFeeMinor)}</Text></View>
          <View style={s.breakdownRow}><Text style={s.breakdownLabel}>Service charge</Text><Text style={s.breakdownValue}>{money(serviceFeeMinor)}</Text></View>
          <View style={[s.breakdownRow,s.breakdownTotal]}><Text style={s.breakdownTotalLabel}>Total due</Text><Text style={s.breakdownTotalValue}>{money(amountMinor)}</Text></View>
        </View>}
        {balanceLoading?<View style={s.balanceLoading}><ActivityIndicator color={colors.green}/><Text style={s.balanceText}>Checking your wallet balance…</Text></View>
        :<Text style={[s.balanceText,insufficient&&s.warning]}>{balanceMinor===null?balanceError||'Wallet balance unavailable':`Wallet balance · ${money(balanceMinor)}${insufficient?' · Not enough to cover this order':''}`}</Text>}
        {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
        <Pressable accessibilityRole="button" disabled={busy||balanceLoading||insufficient} onPress={()=>onPay('wallet')} style={({pressed})=>[s.option,((busy||balanceLoading||insufficient)&&s.disabled),pressed&&!busy&&s.pressed]}>
          <View style={s.optionIcon}><Ionicons name="wallet-outline" size={21} color={colors.green}/></View>
          <View style={s.optionCopy}><Text style={s.optionTitle}>Smile wallet</Text><Text style={s.optionSubtitle}>{insufficient?'Top up your wallet or choose Paystack':balanceMinor===null?'Pay from your available balance':'Pay instantly from your balance'}</Text></View>
          {busy?<ActivityIndicator color={colors.green}/>:<Ionicons name="chevron-forward" size={19} color={colors.muted}/>}
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={()=>onPay('paystack')} style={({pressed})=>[s.option,pressed&&!busy&&s.pressed,busy&&s.disabled]}>
          <View style={s.paystackIcon}><Ionicons name="card-outline" size={21} color={colors.green}/></View>
          <View style={s.optionCopy}><Text style={s.optionTitle}>Pay with Paystack</Text><Text style={s.optionSubtitle}>Pay securely with your bank card or supported method</Text></View>
          <Ionicons name="chevron-forward" size={19} color={colors.muted}/>
        </Pressable>
        <Text style={s.footer}>Your order is confirmed after payment is verified.</Text>
      </View>
    </View>
  </Modal>;
}

const styles=(colors:AppColors)=>{
  const c=customerPalette(colors);
  return StyleSheet.create({
    overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.4)'},
    sheet:{paddingHorizontal:customerSpace.lg,paddingTop:customerSpace.lg,paddingBottom:customerSpace.xl,borderTopLeftRadius:customerRadius.lg,borderTopRightRadius:customerRadius.lg,backgroundColor:c.surface},
    headingRow:{flexDirection:'row',alignItems:'center',gap:11,marginBottom:11},
    headingIcon:{width:42,height:42,borderRadius:customerRadius.md,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
    title:{fontSize:18,fontWeight:'900',color:c.ink},
    subtitle:{fontSize:11,color:c.muted,marginTop:3},
    close:{width:40,height:40,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm,backgroundColor:c.surfaceAlt},
    breakdown:{padding:12,marginBottom:10,borderRadius:customerRadius.md,backgroundColor:c.surfaceAlt,gap:6},
    breakdownRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
    breakdownLabel:{fontSize:11,color:c.muted},
    breakdownValue:{fontSize:11,fontWeight:'700',color:c.ink},
    breakdownTotal:{marginTop:4,paddingTop:7,borderTopWidth:1,borderTopColor:c.border},
    breakdownTotalLabel:{fontSize:12,fontWeight:'900',color:c.ink},
    breakdownTotalValue:{fontSize:14,fontWeight:'900',color:c.primary},
    balanceLoading:{minHeight:39,flexDirection:'row',alignItems:'center',gap:9},
    balanceText:{fontSize:11,lineHeight:17,color:c.muted,marginBottom:10},
    warning:{color:c.danger},
    error:{fontSize:11,lineHeight:17,color:c.danger,marginBottom:9},
    option:{minHeight:75,flexDirection:'row',alignItems:'center',gap:11,padding:12,marginTop:9,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.md,backgroundColor:c.surface},
    optionIcon:{width:42,height:42,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm,backgroundColor:c.primarySoft},
    paystackIcon:{width:42,height:42,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm,backgroundColor:c.surfaceAlt},
    optionCopy:{flex:1,gap:4},
    optionTitle:{fontSize:12,fontWeight:'900',color:c.ink},
    optionSubtitle:{fontSize:10,lineHeight:15,color:c.muted},
    footer:{fontSize:10,lineHeight:15,color:c.muted,textAlign:'center',marginTop:13},
    disabled:{opacity:.5},
    pressed:{opacity:.75},
  });
};
