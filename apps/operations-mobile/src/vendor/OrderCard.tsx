import { AppText as Text } from '@makanza/mobile-ui';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { formatOrderNumber, type VendorOrder } from '@makanza/mobile-core';
import FormField from '../components/FormField';
import { Ionicons } from '../components/AppIcon';
import { CancellationReasonModal, type CancellationReason } from '@makanza/mobile-ui';
import type { AppColors } from '../theme/colors';
import { vendorRadius, vendorSpace } from '../theme/vendor';

type Props={order:VendorOrder;busy:boolean;colors:AppColors;onAction:(id:string,status:string,reason?:string)=>void;onVerifyPickup:(id:string,code:string)=>void;onCancel:(id:string,reason:CancellationReason,details:string)=>void};
type StatusStyle={label:string;color:string;background:string;icon:string};

export default function OrderCard({order,busy,colors,onAction,onVerifyPickup,onCancel}:Props){
  const [pickupCode,setPickupCode]=useState('');
  const [cancelOpen,setCancelOpen]=useState(false);
  const s=styles(colors);
  const next=order.status==='CONFIRMED'?['Accept order','ACCEPTED_BY_VENDOR']:order.status==='ACCEPTED_BY_VENDOR'?['Start preparing','PREPARING']:order.status==='PREPARING'?['Ready for pickup','READY_FOR_PICKUP']:null;
  const status=statusStyle(order.status,colors);
  const decline=()=>{if(Platform.OS==='web'){const reason=window.prompt('Reason: enter NOT_AVAILABLE or OUT_OF_STOCK','NOT_AVAILABLE');if(reason==='NOT_AVAILABLE'||reason==='OUT_OF_STOCK')onAction(order.id,'REJECTED',reason);return;}Alert.alert('Decline this order?','Choose a reason to share with the customer.',[{text:'Cancel',style:'cancel'},{text:'Not available',onPress:()=>onAction(order.id,'REJECTED','NOT_AVAILABLE')},{text:'Out of stock',style:'destructive',onPress:()=>onAction(order.id,'REJECTED','OUT_OF_STOCK')}]);};
  const items=order.items.map(line=>`${line.quantity} × ${line.nameSnapshot}${line.addons?.length?` (+ ${line.addons.map(extra=>`${extra.quantity*line.quantity} ${extra.nameSnapshot}`).join(', ')})`:''}`).join(' · ');
  const itemCount=order.items.reduce((count,line)=>count+line.quantity,0);
  return <View style={s.card}>
    <View style={s.header}>
      <View style={s.orderIdentity}>
        <Text style={s.orderLabel}>CUSTOMER ORDER</Text>
        <Text style={s.id}>{formatOrderNumber(order.displayNumber,order.id)}</Text>
        <Text style={s.date}>{new Date(order.createdAt).toLocaleString('en-NG',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</Text>
      </View>
      <View style={[s.statusBadge,{backgroundColor:status.background}]}>
        <Ionicons name={status.icon} size={14} color={status.color}/>
        <Text style={[s.status,{color:status.color}]}>{status.label}</Text>
      </View>
    </View>
    <View style={s.itemsPanel}>
      <Text style={s.itemsLabel}>{itemCount} {itemCount===1?'ITEM':'ITEMS'}</Text>
      <Text style={s.items}>{items}</Text>
    </View>
    <View style={s.totalRow}>
      <Text style={s.totalLabel}>Order total</Text>
      <Text style={s.total}>₦{(order.totalMinor/100).toLocaleString('en-NG')}</Text>
    </View>
    {order.delivery?.status==='ASSIGNED'&&!order.delivery.pickupVerified&&<View style={s.pickupPanel}>
      <View style={s.pickupHeading}><View style={s.pickupIcon}><Ionicons name="lock-closed-outline" size={16} color={colors.green}/></View><Text style={s.pickupLabel}>VERIFY RIDER PICKUP</Text></View>
      <Text style={s.pickupCopy}>Ask the rider to show their six-digit pickup code before handing over the order.</Text>
      <FormField label="Rider pickup code" value={pickupCode} onChangeText={value=>setPickupCode(value.replace(/\D/g,'').slice(0,6))} placeholder="000000" keyboardType="number-pad" maxLength={6} dark={colors.isDark}/>
      <Pressable accessibilityRole="button" onPress={()=>onVerifyPickup(order.id,pickupCode)} disabled={busy||pickupCode.length!==6} style={[s.primaryButton,(busy||pickupCode.length!==6)&&s.disabled]}>
        <Text style={s.primaryText}>{busy?'Verifying…':'Verify pickup code'}</Text>
      </Pressable>
    </View>}
    {order.delivery?.pickupVerified&&<View style={s.verified}><Ionicons name="checkmark-circle-outline" size={18} color={colors.green}/><Text style={s.verifiedText}>Pickup verified · rider can continue to the customer.</Text></View>}
    {['CONFIRMED','ACCEPTED_BY_VENDOR','PREPARING','READY_FOR_PICKUP','RIDER_ASSIGNED'].includes(order.status)&&<Pressable accessibilityRole="button" onPress={()=>setCancelOpen(true)} disabled={busy} style={s.cancelButton}><Ionicons name="close" size={16} color={colors.isDark?'#f0877a':'#a34232'}/><Text style={s.cancelText}>Cancel order</Text></Pressable>}
    {next&&<View style={s.actions}>
      {order.status==='CONFIRMED'&&<Pressable accessibilityRole="button" onPress={decline} disabled={busy} style={[s.secondaryButton,busy&&s.disabled]}><Text style={s.secondaryText}>Decline</Text></Pressable>}
      <Pressable accessibilityRole="button" onPress={()=>onAction(order.id,next[1])} disabled={busy} style={[s.primaryButton,busy&&s.disabled]}><Text style={s.primaryText}>{busy?'Updating…':next[0]}</Text></Pressable>
    </View>}
    <CancellationReasonModal visible={cancelOpen} role="VENDOR" dark={colors.isDark} busy={busy} onClose={()=>setCancelOpen(false)} onSubmit={(reason,details)=>{setCancelOpen(false);onCancel(order.id,reason,details)}}/>
  </View>;
}

function statusStyle(status:string,colors:AppColors):StatusStyle{
  if(status==='CONFIRMED')return{label:'New order',color:colors.green,background:colors.mint,icon:'notifications-outline'};
  if(status==='ACCEPTED_BY_VENDOR')return{label:'Accepted',color:colors.green,background:colors.mint,icon:'checkmark-circle-outline'};
  if(status==='PREPARING')return{label:'Preparing',color:colors.orange,background:colors.cream,icon:'time-outline'};
  if(status==='READY_FOR_PICKUP')return{label:'Ready for pickup',color:colors.green,background:colors.mint,icon:'checkmark-circle-outline'};
  if(status==='RIDER_ASSIGNED')return{label:'Rider assigned',color:colors.green,background:colors.mint,icon:'bicycle-outline'};
  if(status==='PICKED_UP')return{label:'On the way',color:colors.green,background:colors.mint,icon:'navigate-outline'};
  if(status==='DELIVERED')return{label:'Delivered',color:colors.green,background:colors.mint,icon:'checkmark-circle-outline'};
  if(status==='REJECTED'||status==='CANCELLED')return{label:status==='REJECTED'?'Declined':'Cancelled',color:colors.isDark?'#f0877a':'#a34232',background:colors.isDark?'#392a20':'#fdf0ed',icon:'close'};
  return{label:status.replaceAll('_',' ').toLowerCase(),color:colors.muted,background:colors.cream,icon:'information-circle-outline'};
}

const styles=(c:AppColors)=>StyleSheet.create({
  card:{padding:vendorSpace.md,marginTop:vendorSpace.sm,gap:vendorSpace.md,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.card,shadowColor:'#153a2b',shadowOpacity:.04,shadowRadius:8,shadowOffset:{width:0,height:3},elevation:1},
  header:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:vendorSpace.sm},
  orderIdentity:{flex:1},
  orderLabel:{fontSize:8,fontWeight:'900',letterSpacing:1.1,color:c.muted},
  id:{fontSize:16,fontWeight:'900',letterSpacing:-.2,color:c.ink,marginTop:3},
  date:{fontSize:10,color:c.muted,marginTop:4},
  statusBadge:{minHeight:30,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:9,borderRadius:vendorRadius.pill},
  status:{fontSize:9,fontWeight:'900'},
  itemsPanel:{padding:12,borderRadius:vendorRadius.md,backgroundColor:c.paper},
  itemsLabel:{fontSize:8,fontWeight:'900',letterSpacing:1,color:c.muted,marginBottom:5},
  items:{fontSize:12,lineHeight:19,fontWeight:'600',color:c.ink},
  totalRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  totalLabel:{fontSize:11,fontWeight:'700',color:c.muted},
  total:{fontSize:15,fontWeight:'900',color:c.green},
  pickupPanel:{padding:12,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.md,backgroundColor:c.cream},
  pickupHeading:{flexDirection:'row',alignItems:'center',gap:8},
  pickupIcon:{width:30,height:30,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.sm,backgroundColor:c.card},
  pickupLabel:{fontSize:9,fontWeight:'900',letterSpacing:.7,color:c.green},
  pickupCopy:{fontSize:10,lineHeight:15,color:c.muted,marginTop:6},
  verified:{flexDirection:'row',alignItems:'center',gap:7,padding:10,borderRadius:vendorRadius.sm,backgroundColor:c.mint},
  verifiedText:{flex:1,fontSize:10,fontWeight:'700',color:c.green},
  actions:{flexDirection:'row',gap:8},
  primaryButton:{flex:1,minHeight:44,alignItems:'center',justifyContent:'center',paddingHorizontal:13,borderRadius:vendorRadius.sm,backgroundColor:c.green},
  primaryText:{fontSize:11,fontWeight:'900',color:'white',textAlign:'center'},
  secondaryButton:{minHeight:44,minWidth:88,alignItems:'center',justifyContent:'center',paddingHorizontal:13,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.sm,backgroundColor:c.card},
  secondaryText:{fontSize:11,fontWeight:'800',color:c.ink},
  cancelButton:{minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,alignSelf:'flex-start',paddingHorizontal:11,borderRadius:vendorRadius.sm,backgroundColor:c.isDark?'#392a20':'#fdf0ed'},
  cancelText:{fontSize:10,fontWeight:'800',color:c.isDark?'#f0877a':'#a34232'},
  disabled:{opacity:.5},
});
