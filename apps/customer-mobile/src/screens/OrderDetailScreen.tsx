import { AppText as Text } from '@makanza/mobile-ui';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BackHeader } from '../components/ui';
import type { CustomerOrder, OrderTracking } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';
import { api } from '../services/api';
import OrderTrackingMap from './OrderTrackingMap';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';
import { formatOrderNumber } from '../utils/format';
type Props={order:CustomerOrder;colors:AppColors;token:string|null;demoMode:boolean;onBack:()=>void};
const timeline=[['CONFIRMED','Order received'],['ACCEPTED_BY_VENDOR','Kitchen confirmed'],['PREPARING','Being prepared'],['READY_FOR_PICKUP','Ready · finding a rider'],['RIDER_ASSIGNED','Rider assigned'],['PICKED_UP','On the way'],['DELIVERED','Delivered']] as const;
const step=(status:string)=>({PENDING_PAYMENT:0,CONFIRMED:0,ACCEPTED_BY_VENDOR:1,PREPARING:2,READY_FOR_PICKUP:3,RIDER_ASSIGNED:4,PICKED_UP:5,DELIVERED:6} as Record<string,number>)[status]??-1;
export default function OrderDetailScreen({order,colors:c,token,demoMode,onBack}:Props){
  const s=styles(c);
  const active=step(order.status);
  const wait=order.status==='READY_FOR_PICKUP'&&['OFFERING','UNASSIGNED'].includes(order.delivery?.status??'');
  const showTracking=['RIDER_ASSIGNED','PICKED_UP'].includes(order.status);
  const [tracking,setTracking]=useState<OrderTracking|null>(order.tracking??null);
  const [trackingLoading,setTrackingLoading]=useState(false);
  const [trackingError,setTrackingError]=useState('');
  const rider=tracking?.riderContact??(order.delivery?.riderName?{name:order.delivery.riderName,phone:order.delivery.riderPhone??null,vehicleType:order.delivery.riderVehicleType??null}:null);
  const callRider=()=>{if(rider?.phone)void Linking.openURL(`tel:${rider.phone}`).catch(()=>undefined);};
  const messageRider=()=>{if(rider?.phone){const phone=whatsAppNumber(rider.phone);if(phone)void Linking.openURL(`https://wa.me/${phone}`).catch(()=>undefined);}};

  useEffect(()=>{
    if(!showTracking)return;
    if(demoMode){setTracking(order.tracking??null);setTrackingLoading(false);setTrackingError('');return;}
    if(!token){setTrackingError('Sign in to view your rider’s location.');return;}
    let current=true;
    const refresh=async()=>{
      if(current)setTrackingLoading(true);
      try{const result=await api.get<OrderTracking>(`/orders/${encodeURIComponent(order.id)}/tracking`,token);if(current){setTracking(result);setTrackingError('');}}
      catch(reason){if(current)setTrackingError(reason instanceof Error?reason.message:'Rider location is unavailable.');}
      finally{if(current)setTrackingLoading(false);}
    };
    void refresh();
    const timer=setInterval(()=>void refresh(),10000);
    return()=>{current=false;clearInterval(timer);};
  },[demoMode,order.id,order.tracking,showTracking,token]);

  return <View style={s.screen}><BackHeader title="Order details" subtitle="Track your delivery" colors={c} onBack={onBack}/><ScrollView style={{flex:1}} contentContainerStyle={s.page}>
    {showTracking&&<OrderTrackingMap tracking={tracking} loading={trackingLoading} error={trackingError} colors={c}/>}
    {showTracking&&rider&&<View style={s.contactCard}><View style={s.riderAvatar}><Text style={s.avatarText}>{rider.name.trim().slice(0,1).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={s.riderLabel}>YOUR RIDER</Text><Text style={s.riderName}>{rider.name}</Text><Text style={s.body}>{rider.vehicleType?`${rider.vehicleType.replace(/_/g,' ').toLowerCase()} · `:''}On the way with your order</Text></View></View>}
    {showTracking&&rider?.phone&&<View style={s.contactActions}><Pressable accessibilityRole="button" onPress={callRider} style={s.contactButton}><Text style={s.contactButtonText}>Call rider</Text></Pressable><Pressable accessibilityRole="button" onPress={messageRider} style={[s.contactButton,s.whatsappButton]}><Text style={s.whatsappText}>WhatsApp rider</Text></Pressable></View>}
    <Text style={s.kicker}>ORDER DETAILS</Text><Text style={s.title}>{order.vendor?.name??'Your order'}</Text><Text style={s.body}>Order {formatOrderNumber(order.displayNumber,order.id)} · {new Date(order.createdAt).toLocaleString()}</Text>
    <View style={s.card}><Text style={s.section}>DELIVERY PROGRESS</Text>{timeline.map(([key,label],index)=><View key={key} style={s.stage}><View style={s.track}><View style={[s.dot,index<active&&s.done,index===active&&s.current]}/>{index<timeline.length-1&&<View style={[s.line,index<active&&s.lineDone]}/>}</View><View style={s.stageCopy}><Text style={[s.stageTitle,index>active&&s.future]}>{label}</Text>{index===active&&<Text style={s.body}>{wait?'Your order is ready while we find a nearby rider.':key==='RIDER_ASSIGNED'?`Rider assigned${order.delivery?.riderName?`: ${order.delivery.riderName}`:''}.`:key==='PICKED_UP'?'The rider has collected your order and is on the way.':key==='DELIVERED'?'Your order has been handed over.':label+'.'}</Text>}</View></View>)}</View>
    {order.deliveryCode&&<View style={s.code}><Text style={s.codeLabel}>YOUR DELIVERY CODE</Text><Text style={s.codeValue}>{order.deliveryCode}</Text><Text style={s.body}>Share with your rider only at the door when receiving your order.</Text></View>}
    <View style={s.card}><Text style={s.section}>YOUR ITEMS</Text>{order.items.map(item=><View key={item.id}><View style={s.item}><Text style={s.itemName}>{item.quantity} × {item.nameSnapshot}</Text><Text style={s.itemPrice}>₦{((item.unitPriceMinor+((item.addons??[]).reduce((sum,a)=>sum+a.unitPriceMinor*a.quantity,0)))*item.quantity/100).toLocaleString('en-NG')}</Text></View>{item.addons?.map(addon=><View key={addon.id} style={s.item}><Text style={s.body}>   + {addon.quantity*item.quantity} × {addon.nameSnapshot}</Text><Text style={s.body}>₦{(addon.unitPriceMinor*addon.quantity*item.quantity/100).toLocaleString('en-NG')}</Text></View>)}</View>)}<View style={s.total}><Text style={s.stageTitle}>Order total</Text><Text style={s.totalPrice}>₦{(order.totalMinor/100).toLocaleString('en-NG')}</Text></View></View>
    <View style={s.card}><Text style={s.section}>STATUS HISTORY</Text>{order.events.map(event=><View key={event.id}><Text style={s.eventTitle}>{event.status.replace(/_/g,' ').toLowerCase()}</Text><Text style={s.body}>{new Date(event.createdAt).toLocaleString()}</Text>{event.note&&<Text style={s.body}>{event.note}</Text>}</View>)}</View>
  </ScrollView></View>;
}
const styles=(colors:AppColors)=>{
  const c=customerPalette(colors);
  return StyleSheet.create({
    screen:{flex:1,backgroundColor:c.canvas},
    page:{padding:customerSpace.lg,paddingBottom:customerSpace.xxl},
    kicker:{fontSize:10,fontWeight:'900',letterSpacing:1.1,color:c.primary},
    title:{fontSize:27,lineHeight:33,fontWeight:'900',letterSpacing:-.7,color:c.ink,marginTop:6},
    body:{fontSize:11,lineHeight:17,color:c.muted,marginTop:4},
    card:{padding:14,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.md,backgroundColor:c.surface,marginTop:12},
    section:{fontSize:9,fontWeight:'900',letterSpacing:1,color:c.muted,marginBottom:10},
    stage:{flexDirection:'row',gap:10,minHeight:35},
    track:{width:13,alignItems:'center'},
    dot:{width:10,height:10,borderRadius:5,borderWidth:1.5,borderColor:c.border,backgroundColor:c.surface,zIndex:2},
    done:{backgroundColor:c.primary,borderColor:c.primary},
    current:{width:12,height:12,borderRadius:6,backgroundColor:c.accent,borderColor:c.accent},
    line:{position:'absolute',top:10,width:2,height:28,backgroundColor:c.border},
    lineDone:{backgroundColor:c.primary},
    stageCopy:{flex:1,paddingBottom:7},
    stageTitle:{fontSize:12,fontWeight:'800',color:c.ink},
    future:{color:c.muted,fontWeight:'600'},
    contactCard:{flexDirection:'row',alignItems:'center',gap:12,padding:14,marginTop:12,borderRadius:customerRadius.md,borderWidth:1,borderColor:c.border,backgroundColor:c.surface},
    riderAvatar:{width:46,height:46,borderRadius:23,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
    avatarText:{fontSize:19,fontWeight:'900',color:c.primary},
    riderLabel:{fontSize:9,fontWeight:'900',letterSpacing:1,color:c.primary},
    riderName:{fontSize:14,fontWeight:'900',color:c.ink,marginTop:3},
    contactActions:{flexDirection:'row',gap:9,marginTop:9},
    contactButton:{flex:1,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm,backgroundColor:c.primary},
    contactButtonText:{fontSize:11,fontWeight:'900',color:'white'},
    whatsappButton:{backgroundColor:c.primarySoft},
    whatsappText:{fontSize:11,fontWeight:'900',color:c.primary},
    code:{padding:14,borderRadius:customerRadius.md,backgroundColor:c.accentSoft,marginTop:12},
    codeLabel:{fontSize:9,fontWeight:'900',letterSpacing:1,color:c.primary},
    codeValue:{fontSize:29,fontWeight:'900',letterSpacing:6,color:c.ink,marginTop:6},
    item:{flexDirection:'row',justifyContent:'space-between',paddingVertical:8,borderBottomWidth:1,borderColor:c.border},
    itemName:{fontSize:11,color:c.ink},
    itemPrice:{fontSize:11,fontWeight:'800',color:c.ink},
    total:{flexDirection:'row',justifyContent:'space-between',paddingTop:12},
    totalPrice:{fontSize:15,fontWeight:'900',color:c.primary},
    event:{paddingVertical:8,borderBottomWidth:1,borderColor:c.border},
    eventTitle:{fontSize:11,fontWeight:'800',color:c.ink},
  });
};
const whatsAppNumber=(phone:string)=>{let digits=phone.replace(/\D/g,'');if(digits.startsWith('0'))digits=`234${digits.slice(1)}`;return digits.length>=10?digits:'';};
