import { AppText as Text } from '@makanza/mobile-ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { CustomerOrder } from '@makanza/mobile-core';
import { CancellationReasonModal, type CancellationReason } from '@makanza/mobile-ui';
import { Ionicons } from '../components/AppIcon';
import { ScreenHeader } from '../components/ui';
import { darkColors, lightColors } from '../theme/colors';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';

type Props={orders:CustomerOrder[];loading:boolean;error:string;hasAccount:boolean;dark:boolean;onRetry:()=>void;onSignIn:()=>void;onOpen:(order:CustomerOrder)=>void;onCancel:(orderId:string,reason:CancellationReason,details:string)=>void};
const completedStatuses=new Set(['DELIVERED','REJECTED','CANCELLED','PAYMENT_FAILED','REFUNDED','REFUND_PENDING']);
const isOngoing=(order:CustomerOrder)=>!completedStatuses.has(order.status);
const itemCount=(order:CustomerOrder)=>order.items.reduce((total,item)=>total+item.quantity,0);
const money=(minor:number)=>`₦${(minor/100).toLocaleString('en-NG')}`;

function orderStatus(order:CustomerOrder,waitingRider:boolean){
  if(waitingRider)return 'Finding a rider';
  return ({PENDING_PAYMENT:'Payment pending',CONFIRMED:'Awaiting kitchen',ACCEPTED_BY_VENDOR:'Kitchen confirmed',PREPARING:'Being prepared',READY_FOR_PICKUP:'Ready for pickup',RIDER_ASSIGNED:'Rider assigned',PICKED_UP:'On the way',DELIVERED:'Delivered',REJECTED:'Order rejected',CANCELLED:'Order cancelled',PAYMENT_FAILED:'Payment failed',DELIVERY_EXCEPTION:'Delivery needs attention'} as Record<string,string>)[order.status]??order.status.replaceAll('_',' ').toLowerCase();
}

export default function OrdersScreen({orders,loading,error,hasAccount,dark,onRetry,onSignIn,onOpen,onCancel}:Props){
  const [showHistory,setShowHistory]=useState(false);
  const [cancelOrderId,setCancelOrderId]=useState<string|null>(null);
  const colors=dark?darkColors:lightColors;
  const c=customerPalette(colors);
  const s=styles(c);
  const visibleOrders=orders.filter(order=>showHistory?!isOngoing(order):isOngoing(order));
  return <View style={s.screen}>
    <ScreenHeader title="Your orders" subtitle="Every delivery, all in one place" icon="receipt-outline" colors={colors}/>
    <View style={s.content}>
      <View style={s.segment}>
        <Pressable accessibilityRole="tab" accessibilityState={{selected:!showHistory}} onPress={()=>setShowHistory(false)} style={[s.segmentItem,!showHistory&&s.segmentActive]}><Text style={[s.segmentText,!showHistory&&s.segmentTextActive]}>In progress</Text></Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{selected:showHistory}} onPress={()=>setShowHistory(true)} style={[s.segmentItem,showHistory&&s.segmentActive]}><Text style={[s.segmentText,showHistory&&s.segmentTextActive]}>Past orders</Text></Pressable>
      </View>
      {!hasAccount?<View style={s.state}><View style={s.stateIcon}><Text style={s.stateGlyph}>↗</Text></View><Text style={s.stateTitle}>Your orders live here</Text><Text style={s.stateCopy}>Sign in to follow deliveries and revisit receipts.</Text><Pressable accessibilityRole="button" onPress={onSignIn} style={s.primary}><Text style={s.primaryText}>Sign in</Text></Pressable></View>
      :loading&&!orders.length?<ActivityIndicator color={c.primary} style={s.loader}/>
      :error&&!orders.length?<View style={s.state}><View style={s.stateIcon}><Text style={s.stateGlyph}>!</Text></View><Text style={s.stateTitle}>Orders couldn’t load</Text><Text style={s.stateCopy}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={s.primary}><Text style={s.primaryText}>Try again</Text></Pressable></View>
      :visibleOrders.length===0?<View style={s.emptyState}>
        <View accessibilityRole="image" accessibilityLabel="Delivery bike illustration" style={s.emptyIllustration}><MaterialCommunityIcons name="bike-fast" size={46} color="white"/></View>
        <Text style={s.emptyTitle}>{showHistory?'No past orders':'Nothing on the way'}</Text>
        <Text style={s.stateCopy}>{showHistory?'Completed orders will appear here.':'Your active deliveries will show up here once you order.'}</Text>
      </View>
      :<>
        {error?<Pressable accessibilityRole="button" onPress={onRetry} style={s.warning}><Text style={s.warningText}>Couldn’t refresh. Showing your last update.</Text><Text style={s.warningAction}>Retry</Text></Pressable>:null}
        <ScrollView style={s.list} contentContainerStyle={s.listContent}>
          {visibleOrders.map(order=>{
            const failed=['REJECTED','CANCELLED','PAYMENT_FAILED','DELIVERY_EXCEPTION'].includes(order.status);
            const waitingRider=order.status==='READY_FOR_PICKUP'&&['UNASSIGNED','OFFERING'].includes(order.delivery?.status??'');
            const statusLabel=orderStatus(order,waitingRider);
            const canCancel=['PENDING_PAYMENT','CONFIRMED','ACCEPTED_BY_VENDOR','PREPARING','READY_FOR_PICKUP','RIDER_ASSIGNED'].includes(order.status);
            return <View key={order.id} style={s.orderWrap}>
              <Pressable accessibilityRole="button" accessibilityHint={showHistory?'Opens this receipt and order details.':'Opens live delivery tracking.'} accessibilityLabel={`${order.vendor?.name??'Kitchen order'}, ${failed?'Needs attention':statusLabel}`} onPress={()=>onOpen(order)} style={({pressed})=>[s.orderCard,pressed&&s.pressed]}>
                <View style={s.cardTop}>
                  <View style={s.vendorMark}><Ionicons name="storefront-outline" size={18} color={c.primary}/></View>
                  <View style={s.vendorCopy}><Text numberOfLines={1} style={s.vendor}>{order.vendor?.name??'Kitchen order'}</Text><Text style={s.orderId}>ORDER {order.id.slice(-8).toUpperCase()}</Text></View>
                  <View style={[s.statusPill,failed&&s.statusFailed]}><View style={[s.statusDot,failed&&s.dotFailed]}/><Text numberOfLines={1} style={[s.statusText,failed&&s.statusTextFailed]}>{failed?'Needs attention':statusLabel}</Text></View>
                </View>
                <Text numberOfLines={2} style={s.items}>{order.items.map(item=>`${item.quantity} × ${item.nameSnapshot}`).join(' · ')}</Text>
                <View style={s.cardBottom}><Text style={s.meta}>{new Date(order.createdAt).toLocaleDateString('en-NG',{day:'numeric',month:'short'})} · {itemCount(order)} {itemCount(order)===1?'item':'items'}</Text><Text style={s.price}>{money(order.totalMinor)}</Text></View>
                <View style={s.trackAction}><Text style={s.trackText}>{showHistory?'View receipt':'Track delivery'}</Text><Ionicons name="arrow-forward" size={17} color={c.primary}/></View>
              </Pressable>
              {canCancel&&!showHistory&&<Pressable accessibilityRole="button" onPress={()=>setCancelOrderId(order.id)} style={s.cancelAction}><Text style={s.cancelText}>Cancel order</Text></Pressable>}
              <CancellationReasonModal visible={cancelOrderId===order.id} role="CUSTOMER" dark={dark} onClose={()=>setCancelOrderId(null)} onSubmit={(reason,details)=>{setCancelOrderId(null);onCancel(order.id,reason,details)}}/>
            </View>;
          })}
        </ScrollView>
      </>}
    </View>
  </View>;
}

const styles=(c:ReturnType<typeof customerPalette>)=>StyleSheet.create({
  screen:{flex:1,backgroundColor:c.canvas},
  content:{flex:1,paddingHorizontal:customerSpace.lg,paddingTop:customerSpace.sm,paddingBottom:customerSpace.md},
  segment:{minHeight:46,flexDirection:'row',padding:4,borderRadius:customerRadius.md,backgroundColor:c.surfaceAlt},
  segmentItem:{flex:1,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm},
  segmentActive:{backgroundColor:c.primary},
  segmentText:{fontSize:12,fontWeight:'700',color:c.muted},
  segmentTextActive:{color:'white',fontWeight:'900'},
  list:{flex:1,marginTop:customerSpace.md},
  listContent:{paddingBottom:customerSpace.xl},
  orderWrap:{marginTop:10},
  orderCard:{padding:13,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.lg,backgroundColor:c.surface},
  cardTop:{flexDirection:'row',alignItems:'center',gap:9},
  vendorMark:{width:39,height:39,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
  vendorCopy:{flex:1,minWidth:0},
  vendor:{fontSize:13,fontWeight:'800',color:c.ink},
  orderId:{fontSize:9,lineHeight:13,fontWeight:'800',letterSpacing:.7,color:c.muted,marginTop:3},
  statusPill:{maxWidth:'48%',flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:8,paddingVertical:6,borderRadius:customerRadius.pill,backgroundColor:c.primarySoft},
  statusFailed:{backgroundColor:c.accentSoft},
  statusDot:{width:6,height:6,borderRadius:3,backgroundColor:c.primary},
  dotFailed:{backgroundColor:c.danger},
  statusText:{fontSize:9,fontWeight:'800',color:c.primary,flexShrink:1},
  statusTextFailed:{color:c.danger},
  items:{fontSize:11,lineHeight:17,color:c.muted,marginTop:12},
  cardBottom:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:11},
  meta:{fontSize:10,color:c.muted},
  price:{fontSize:13,fontWeight:'900',color:c.ink},
  trackAction:{minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:11,marginTop:12,borderRadius:customerRadius.sm,backgroundColor:c.surfaceAlt},
  trackText:{fontSize:11,fontWeight:'800',color:c.primary},
  cancelAction:{alignSelf:'flex-end',minHeight:38,justifyContent:'center',paddingHorizontal:10},
  cancelText:{fontSize:11,fontWeight:'800',color:c.danger},
  warning:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,paddingHorizontal:12,marginTop:10,borderRadius:customerRadius.sm,backgroundColor:c.accentSoft},
  warningText:{flex:1,fontSize:10,lineHeight:15,color:c.danger},
  warningAction:{fontSize:10,fontWeight:'900',color:c.danger},
  state:{alignItems:'center',padding:24,marginTop:customerSpace.xl,borderRadius:customerRadius.lg,backgroundColor:c.surface},
  stateIcon:{width:48,height:48,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.md,backgroundColor:c.primarySoft},
  stateGlyph:{fontSize:23,fontWeight:'900',color:c.primary},
  emptyState:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:24},
  emptyIllustration:{width:92,height:92,alignItems:'center',justifyContent:'center',borderRadius:46,backgroundColor:c.primary},
  emptyTitle:{fontSize:18,fontWeight:'900',letterSpacing:-.3,color:c.ink,marginTop:16},
  stateTitle:{fontSize:15,fontWeight:'800',color:c.ink,marginTop:12},
  stateCopy:{fontSize:11,lineHeight:17,color:c.muted,textAlign:'center',marginTop:5},
  primary:{minHeight:43,alignItems:'center',justifyContent:'center',paddingHorizontal:18,borderRadius:customerRadius.sm,backgroundColor:c.primary,marginTop:14},
  primaryText:{fontSize:11,fontWeight:'900',color:'white'},
  loader:{margin:30},
  pressed:{opacity:.82},
});
