import { AppText as Text } from '@makanza/mobile-ui';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { BackHeader } from '../components/ui';
import type { NotificationInboxItem } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';

type Props={
  items:NotificationInboxItem[];
  unreadCount:number;
  loading:boolean;
  error:string;
  hasAccount:boolean;
  colors:AppColors;
  onRetry:()=>void;
  onSignIn:()=>void;
  onOpen:(item:NotificationInboxItem)=>void;
  onReadAll:()=>void;
  onBack:()=>void;
};
const iconFor=(type:string)=>type==='RIDER_OFFER'?'bicycle-outline':type.includes('CANCELLED')?'alert-circle-outline':type.includes('DELIVERED')?'checkmark-circle-outline':type.includes('PICKED_UP')||type.includes('RIDER_ASSIGNED')?'bicycle-outline':'notifications-outline';

export default function NotificationsScreen({items,unreadCount,loading,error,hasAccount,colors:c,onRetry,onSignIn,onOpen,onReadAll,onBack}:Props){
  const p=customerPalette(c);
  const s=styles(p);
  return <View style={s.screen}>
    <BackHeader title="Notifications" subtitle="Updates about your orders" colors={c} onBack={onBack}/>
    <ScrollView style={{flex:1}} contentContainerStyle={s.page}>
      {!hasAccount?<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="notifications-outline" size={23} color={p.primary}/></View><Text style={s.emptyTitle}>Sign in to see notifications</Text><Text style={s.emptyCopy}>Your order and account updates will appear here.</Text><Pressable accessibilityRole="button" onPress={onSignIn} style={s.primary}><Text style={s.primaryText}>Sign in</Text></Pressable></View>
      :loading&&!items.length?<ActivityIndicator color={p.primary} style={{margin:32}}/>
      :error&&!items.length?<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="alert-circle-outline" size={23} color={p.danger}/></View><Text style={s.emptyTitle}>Notifications couldn’t load</Text><Text style={s.emptyCopy}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={s.primary}><Text style={s.primaryText}>Try again</Text></Pressable></View>
      :items.length===0?<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="notifications-outline" size={23} color={p.primary}/></View><Text style={s.emptyTitle}>You’re all caught up</Text><Text style={s.emptyCopy}>New updates will appear here.</Text></View>
      :<>
        <View style={s.listHeading}><View><Text style={s.headingTitle}>Recent updates</Text><Text style={s.headingMeta}>{unreadCount} unread</Text></View>{unreadCount>0&&<Pressable accessibilityRole="button" onPress={onReadAll}><Text style={s.readAll}>Mark all read</Text></Pressable>}</View>
        {items.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityHint={item.orderId?`Opens order ${item.orderId.slice(-8)}`:'Opens this notification'} onPress={()=>onOpen(item)} style={({pressed})=>[s.card,!item.readAt&&s.unread,pressed&&s.pressed]}>
          <View style={s.icon}><Ionicons name={iconFor(item.type)} size={21} color={c.green}/></View>
          <View style={s.copy}><View style={s.cardHeading}><Text style={s.cardTitle}>{item.title}</Text><Text style={s.date}>{new Date(item.createdAt).toLocaleDateString('en-NG',{day:'numeric',month:'short'})}</Text></View>
            {item.orderId&&<Text style={s.vendor} numberOfLines={1}>Order #{item.orderId.slice(-8).toUpperCase()}</Text>}
            <Text style={s.message}>{item.body}</Text>
          </View>{!item.readAt&&<View style={s.unreadDot}/>}
        </Pressable>)}
      </>}
    </ScrollView>
  </View>;
}

const styles=(c:ReturnType<typeof customerPalette>)=>StyleSheet.create({
  screen:{flex:1,backgroundColor:c.canvas},
  page:{paddingHorizontal:customerSpace.lg,paddingTop:customerSpace.sm,paddingBottom:customerSpace.xxl},
  listHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:8},
  headingTitle:{fontSize:17,fontWeight:'900',color:c.ink},
  headingMeta:{fontSize:10,fontWeight:'700',color:c.muted,marginTop:3},
  readAll:{fontSize:11,fontWeight:'800',color:c.primary},
  card:{flexDirection:'row',alignItems:'flex-start',gap:11,padding:12,borderRadius:customerRadius.md,borderWidth:1,borderColor:c.border,backgroundColor:c.surface,marginTop:8},
  unread:{borderColor:c.primary},
  icon:{width:39,height:39,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
  copy:{flex:1},
  cardHeading:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:7},
  cardTitle:{flex:1,fontSize:12,fontWeight:'900',color:c.ink},
  date:{fontSize:9,color:c.muted},
  vendor:{fontSize:9,fontWeight:'800',color:c.primary,marginTop:5},
  message:{fontSize:10,lineHeight:15,color:c.muted,marginTop:4},
  unreadDot:{width:7,height:7,borderRadius:4,backgroundColor:c.accent,marginTop:6},
  pressed:{opacity:.72},
  empty:{flex:1,minHeight:300,alignItems:'center',justifyContent:'center',padding:24},
  emptyIcon:{width:54,height:54,borderRadius:customerRadius.md,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
  emptyTitle:{fontSize:15,fontWeight:'900',color:c.ink,textAlign:'center',marginTop:12},
  emptyCopy:{fontSize:11,lineHeight:17,color:c.muted,textAlign:'center',marginTop:5},
  primary:{minHeight:42,paddingHorizontal:17,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm,backgroundColor:c.primary,marginTop:13},
  primaryText:{fontSize:11,fontWeight:'900',color:'white'},
});
