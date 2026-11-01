import { AppText as Text } from '@makanza/mobile-ui';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { BackHeader } from '../components/ui';
import type { CustomerOrder } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';

type Props={orders:CustomerOrder[];loading:boolean;error:string;hasAccount:boolean;colors:AppColors;onRetry:()=>void;onSignIn:()=>void;onOpen:(order:CustomerOrder)=>void;onBack:()=>void};
type Update={id:string;order:CustomerOrder;status:string;createdAt:string;note:string|null};
const titleFor=(status:string)=>({PENDING_PAYMENT:'Payment required',CONFIRMED:'Order confirmed',ACCEPTED_BY_VENDOR:'Kitchen confirmed your order',PREPARING:'Your order is being prepared',READY_FOR_PICKUP:'Your order is ready',RIDER_ASSIGNED:'A rider has been assigned',PICKED_UP:'Your order is on the way',DELIVERED:'Your order was delivered',REJECTED:'Order update',CANCELLED:'Order cancelled',PAYMENT_FAILED:'Payment update',REFUNDED:'Refund completed',REFUND_PENDING:'Refund update'} as Record<string,string>)[status]??status.replaceAll('_',' ').toLowerCase();
const detailFor=(status:string)=>({CONFIRMED:'The kitchen received your order.',ACCEPTED_BY_VENDOR:'The kitchen is preparing to make your order.',PREPARING:'We’ll let you know when it’s ready.',READY_FOR_PICKUP:'Your order is ready and a rider is being arranged.',RIDER_ASSIGNED:'Your rider is getting ready to pick up your order.',PICKED_UP:'Your rider is bringing your order to you.',DELIVERED:'Thanks for ordering with Smile.'} as Record<string,string>)[status]??'Open this update to see your order details.';
const iconFor=(status:string)=>status==='DELIVERED'?'checkmark-circle-outline':status==='PICKED_UP'||status==='RIDER_ASSIGNED'?'bicycle-outline':status==='PREPARING'?'restaurant-outline':status==='REJECTED'||status==='CANCELLED'||status==='PAYMENT_FAILED'?'alert-circle-outline':'receipt-outline';

export default function NotificationsScreen({orders,loading,error,hasAccount,colors:c,onRetry,onSignIn,onOpen,onBack}:Props){
  const s=styles(c);
  const updates:Update[]=orders.flatMap(order=>order.events.length?order.events.map(event=>({id:event.id,order,status:event.status,createdAt:event.createdAt,note:event.note??null})):[{id:order.id,order,status:order.status,createdAt:order.createdAt,note:null}]).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,40);
  return <View style={s.screen}>
    <BackHeader title="Notifications" subtitle="Updates about your orders" colors={c} onBack={onBack}/>
    <ScrollView style={{flex:1}} contentContainerStyle={s.page}>
      {!hasAccount?<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="notifications-outline" size={25} color={c.green}/></View><Text style={s.emptyTitle}>Sign in to see order updates</Text><Text style={s.emptyCopy}>Your order notifications will appear here.</Text><Pressable accessibilityRole="button" onPress={onSignIn} style={s.primary}><Text style={s.primaryText}>Sign in</Text></Pressable></View>
      :loading&&!orders.length?<ActivityIndicator color={c.green} style={{margin:32}}/>
      :error&&!orders.length?<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="alert-circle-outline" size={25} color={c.green}/></View><Text style={s.emptyTitle}>Updates couldn’t load</Text><Text style={s.emptyCopy}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={s.primary}><Text style={s.primaryText}>Try again</Text></Pressable></View>
      :updates.length===0?<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="notifications-outline" size={25} color={c.green}/></View><Text style={s.emptyTitle}>No order updates yet</Text><Text style={s.emptyCopy}>Updates will appear here as your orders progress.</Text></View>
      :<>
        <View style={s.listHeading}><Text style={s.headingTitle}>Recent updates</Text><Text style={s.headingMeta}>{updates.length} {updates.length===1?'update':'updates'}</Text></View>
        {updates.map(update=><Pressable key={update.id} accessibilityRole="button" accessibilityHint={`Opens order ${update.order.id.slice(-8)}`} onPress={()=>onOpen(update.order)} style={({pressed})=>[s.card,pressed&&s.pressed]}>
          <View style={s.icon}><Ionicons name={iconFor(update.status)} size={21} color={c.green}/></View>
          <View style={s.copy}><View style={s.cardHeading}><Text style={s.cardTitle}>{titleFor(update.status)}</Text><Text style={s.date}>{new Date(update.createdAt).toLocaleDateString('en-NG',{day:'numeric',month:'short'})}</Text></View>
            <Text style={s.vendor} numberOfLines={1}>{update.order.vendor?.name??'Your order'} · #{update.order.id.slice(-8)}</Text>
            <Text style={s.message}>{update.note||detailFor(update.status)}</Text>
          </View><Ionicons name="chevron-forward" size={19} color={c.muted}/>
        </Pressable>)}
      </>}
    </ScrollView>
  </View>;
}

const styles=(c:AppColors)=>StyleSheet.create({screen:{flex:1,backgroundColor:c.paper},page:{paddingHorizontal:18,paddingTop:8,paddingBottom:28},listHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:9},headingTitle:{fontSize:17,fontWeight:'900',color:c.ink},headingMeta:{fontSize:11,fontWeight:'700',color:c.muted},card:{flexDirection:'row',alignItems:'flex-start',gap:11,padding:13,borderRadius:16,borderWidth:1,borderColor:c.line,backgroundColor:c.card,marginTop:8},icon:{width:40,height:40,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:c.mint},copy:{flex:1},cardHeading:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:7},cardTitle:{flex:1,fontSize:13,fontWeight:'900',color:c.ink},date:{fontSize:10,color:c.muted},vendor:{fontSize:10,fontWeight:'800',color:c.green,marginTop:5},message:{fontSize:11,lineHeight:16,color:c.muted,marginTop:4},pressed:{opacity:.72},empty:{flex:1,minHeight:340,alignItems:'center',justifyContent:'center',padding:25},emptyIcon:{width:58,height:58,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:c.mint},emptyTitle:{fontSize:17,fontWeight:'900',color:c.ink,textAlign:'center',marginTop:13},emptyCopy:{fontSize:12,lineHeight:18,color:c.muted,textAlign:'center',marginTop:5},primary:{minHeight:43,paddingHorizontal:18,alignItems:'center',justifyContent:'center',borderRadius:13,backgroundColor:c.green,marginTop:14},primaryText:{fontSize:12,fontWeight:'900',color:'white'}});
