import { AppText as Text } from '@makanza/mobile-ui';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { CustomerOrder } from '@makanza/mobile-core';
import { CancellationReasonModal } from '@makanza/mobile-ui';
import { ScreenHeader } from '../components/ui';
import { darkColors, lightColors } from '../theme/colors';

type Props={orders:CustomerOrder[];loading:boolean;error:string;hasAccount:boolean;dark:boolean;onRetry:()=>void;onSignIn:()=>void;onOpen:(order:CustomerOrder)=>void;onCancel:(orderId:string,reason:CancellationReason,details:string)=>void};
const completedStatuses=new Set(['DELIVERED','REJECTED','CANCELLED','PAYMENT_FAILED','REFUNDED','REFUND_PENDING']);
const isOngoing=(order:CustomerOrder)=>!completedStatuses.has(order.status);
const itemCount=(order:CustomerOrder)=>order.items.reduce((total,item)=>total+item.quantity,0);
function orderStatus(order:CustomerOrder,waitingRider:boolean){
  if(waitingRider)return 'Finding a rider';
  return ({PENDING_PAYMENT:'Payment pending',CONFIRMED:'Awaiting kitchen',ACCEPTED_BY_VENDOR:'Kitchen confirmed',PREPARING:'Being prepared',READY_FOR_PICKUP:'Ready for pickup',RIDER_ASSIGNED:'Rider assigned',PICKED_UP:'On the way',DELIVERED:'Delivered',REJECTED:'Order rejected',CANCELLED:'Order cancelled',PAYMENT_FAILED:'Payment failed',DELIVERY_EXCEPTION:'Delivery needs attention'} as Record<string,string>)[order.status]??order.status.replaceAll('_',' ').toLowerCase();
}

export default function OrdersScreen({orders,loading,error,hasAccount,dark,onRetry,onSignIn,onOpen,onCancel}:Props){
  const [showHistory,setShowHistory]=useState(false);
  const [cancelOrderId,setCancelOrderId]=useState<string|null>(null);
  const visibleOrders=orders.filter(order=>showHistory?!isOngoing(order):isOngoing(order));
  return <View style={[s.screen,dark&&s.screenDark]}><ScreenHeader title="Orders" subtitle="Track deliveries and view your history" icon="receipt-outline" colors={dark?darkColors:lightColors}/><ScrollView style={{flex:1}} contentContainerStyle={s.page}>
    <View style={[s.tabs,dark&&s.tabsDark]}>
      <Pressable accessibilityRole="button" accessibilityState={{selected:!showHistory}} onPress={()=>setShowHistory(false)} style={[s.tab,!showHistory&&s.tabActive]}><Text style={[s.tabText,!showHistory&&s.tabTextActive]}>Ongoing orders</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{selected:showHistory}} onPress={()=>setShowHistory(true)} style={[s.tab,showHistory&&s.tabActive]}><Text style={[s.tabText,showHistory&&s.tabTextActive]}>Order history</Text></Pressable>
    </View>
    {!hasAccount?<View style={[s.empty,dark&&s.cardDark]}><Text style={s.emptyIcon}>◇</Text><Text style={[s.cardTitle,dark&&s.textDark]}>Sign in to see your orders</Text><Text style={[s.muted,dark&&s.mutedDark]}>Your receipts and delivery updates stay together in one place.</Text><Text onPress={onSignIn} style={s.link}>Sign in to continue</Text></View>
      :loading&&!orders.length?<ActivityIndicator color="#1d6147" style={{margin:28}}/>
        :error&&!orders.length?<View style={[s.empty,dark&&s.cardDark]}><Text style={[s.cardTitle,dark&&s.textDark]}>Orders could not load</Text><Text style={[s.muted,dark&&s.mutedDark]}>{error}</Text><Text onPress={onRetry} style={s.link}>Try again</Text></View>
          :visibleOrders.length===0?<View style={[s.empty,dark&&s.cardDark]}><Text style={s.emptyIcon}>{showHistory?'•':'✓'}</Text><Text style={[s.cardTitle,dark&&s.textDark]}>{showHistory?'No past orders yet':'No ongoing orders'}</Text><Text style={[s.muted,dark&&s.mutedDark]}>{showHistory?'Completed orders will appear here.':'Your active orders will appear here as soon as you place one.'}</Text>{error?<Text onPress={onRetry} style={s.link}>Refresh orders</Text>:null}</View>
            :<>
              {error?<Text style={s.inlineError}>Could not refresh orders. Showing the last loaded response. {error}</Text>:null}
              {visibleOrders.map(order=>{
                const failed=['REJECTED','CANCELLED','PAYMENT_FAILED','DELIVERY_EXCEPTION'].includes(order.status);
                const waitingRider=order.status==='READY_FOR_PICKUP'&&['UNASSIGNED','OFFERING'].includes(order.delivery?.status??'');
                const statusLabel=orderStatus(order,waitingRider);
                const canCancel=['PENDING_PAYMENT','CONFIRMED','ACCEPTED_BY_VENDOR','PREPARING','READY_FOR_PICKUP','RIDER_ASSIGNED'].includes(order.status);
                return <View key={order.id}><Pressable accessibilityRole="button" accessibilityHint={showHistory?'Opens this order receipt and details.':'Opens delivery tracking and order details.'} accessibilityLabel={`${order.vendor?.name??'Kitchen order'}, ${failed?'Needs attention':statusLabel}, ${showHistory?'view order':'track order'}`} onPress={()=>onOpen(order)} style={({pressed})=>[s.card,dark&&s.cardDark,pressed&&s.cardPressed]}>
                  <View style={s.row}><View style={s.flex}><Text style={[s.cardTitle,dark&&s.textDark]}>{order.vendor?.name??'Kitchen order'}</Text><Text style={[s.orderNumber,dark&&s.mutedDark]}>ORDER  {order.id.slice(-8)}</Text></View><View style={[s.status,failed&&s.statusError]}><View style={[s.statusDot,failed&&s.statusDotError]}/><Text style={[s.statusText,failed&&s.statusTextError]}>{failed?'Needs attention':statusLabel}</Text></View></View>
                  <Text style={[s.items,dark&&s.mutedDark]} numberOfLines={2}>{order.items.map(item=>`${item.quantity} × ${item.nameSnapshot}`).join(' · ')}</Text>
                  <View style={s.row}><Text style={[s.muted,dark&&s.mutedDark]}>{new Date(order.createdAt).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})} · {itemCount(order)} {itemCount(order)===1?'item':'items'}</Text><Text style={s.price}>₦{(order.totalMinor/100).toLocaleString('en-NG')}</Text></View>
                  <View style={[s.cardAction,dark&&s.cardActionDark]}><Text style={s.actionText}>{showHistory?'View order details':'Track this order'}</Text><View style={s.actionArrow}><Text style={s.arrowText}>›</Text></View></View>
                </Pressable>{canCancel&&!showHistory&&<Pressable accessibilityRole="button" onPress={()=>setCancelOrderId(order.id)} style={{alignSelf:'flex-end',paddingHorizontal:12,paddingVertical:8}}><Text style={{fontSize:12,fontWeight:'800',color:'#a44232'}}>Cancel order</Text></Pressable>}<CancellationReasonModal visible={cancelOrderId===order.id} role="CUSTOMER" dark={dark} onClose={()=>setCancelOrderId(null)} onSubmit={(reason,details)=>{setCancelOrderId(null);onCancel(order.id,reason,details)}}/></View>;
              })}
            </>}
  </ScrollView></View>;
}

const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#ffffff'},screenDark:{backgroundColor:'#0e1712'},page:{padding:20,paddingTop:25,paddingBottom:32},tabs:{width:'100%',flexDirection:'row',alignItems:'center',gap:4,padding:4,borderRadius:12,backgroundColor:'#f6f5f2',marginTop:4},tabsDark:{backgroundColor:'#18251c'},tab:{flex:1,alignItems:'center',paddingHorizontal:8,paddingVertical:11,borderRadius:9},tabActive:{backgroundColor:'#1d6147'},tabText:{fontSize:13,fontWeight:'800',color:'#4f5451'},tabTextActive:{color:'white'},card:{padding:15,borderRadius:18,borderWidth:1,borderColor:'#e2e8e2',backgroundColor:'white',gap:12,marginTop:13,shadowColor:'#193a2b',shadowOpacity:.07,shadowRadius:13,shadowOffset:{width:0,height:5},elevation:2},cardPressed:{opacity:.88,transform:[{scale:.99}]},cardContent:{flexDirection:'row',alignItems:'center',gap:8},cardMain:{flex:1,gap:12},cardArrow:{width:48,alignItems:'center',justifyContent:'center'},cardDark:{backgroundColor:'#18251c',borderColor:'#2d4034'},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},flex:{flex:1},cardTitle:{fontSize:17,fontWeight:'900',color:'#1f2321'},orderNumber:{fontSize:10,lineHeight:16,letterSpacing:1,fontWeight:'800',color:'#747b75',marginTop:4},status:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#e9f4ed',paddingHorizontal:9,paddingVertical:8,borderRadius:11,maxWidth:'57%'},statusDot:{width:7,height:7,borderRadius:4,backgroundColor:'#238154'},statusText:{fontSize:10,fontWeight:'900',color:'#1d6147',flexShrink:1},statusError:{backgroundColor:'#fcece8'},statusDotError:{backgroundColor:'#b94739'},statusTextError:{color:'#9f2f2d'},items:{fontSize:13,lineHeight:20,color:'#4f5451'},muted:{fontSize:11,lineHeight:17,color:'#68716a'},price:{fontSize:15,fontWeight:'900',color:'#1d6147'},cardAction:{height:43,borderRadius:12,backgroundColor:'#1d6147',paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:1},cardActionDark:{backgroundColor:'#2c7958'},actionText:{fontSize:13,fontWeight:'900',color:'#fff'},actionArrow:{width:25,height:25,borderRadius:13,backgroundColor:'rgba(255,255,255,.19)',alignItems:'center',justifyContent:'center'},arrowText:{fontSize:24,lineHeight:25,color:'#fff',marginTop:-3},empty:{padding:22,borderRadius:18,backgroundColor:'#f6f5f2',alignItems:'center',gap:8,marginTop:14},emptyIcon:{fontSize:31,color:'#658351'},link:{fontSize:13,fontWeight:'800',color:'#1d6147',padding:8},inlineError:{fontSize:12,lineHeight:18,color:'#9f2f2d'},textDark:{color:'#eff0e7'},mutedDark:{color:'#b5bcb3'}});
