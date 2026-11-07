import { AppText as Text } from '@makanza/mobile-ui';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { BackHeader } from '../components/ui';
import type { NotificationInboxItem } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';

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
  const s=styles(c);
  return <View style={s.screen}>
    <BackHeader title="Notifications" subtitle="Updates about your orders" colors={c} onBack={onBack}/>
    <ScrollView style={{flex:1}} contentContainerStyle={s.page}>
      {!hasAccount?<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="notifications-outline" size={25} color={c.green}/></View><Text style={s.emptyTitle}>Sign in to see notifications</Text><Text style={s.emptyCopy}>Your order and account updates will appear here.</Text><Pressable accessibilityRole="button" onPress={onSignIn} style={s.primary}><Text style={s.primaryText}>Sign in</Text></Pressable></View>
      :loading&&!items.length?<ActivityIndicator color={c.green} style={{margin:32}}/>
      :error&&!items.length?<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="alert-circle-outline" size={25} color={c.green}/></View><Text style={s.emptyTitle}>Notifications couldn’t load</Text><Text style={s.emptyCopy}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={s.primary}><Text style={s.primaryText}>Try again</Text></Pressable></View>
      :items.length===0?<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="notifications-outline" size={25} color={c.green}/></View><Text style={s.emptyTitle}>You’re all caught up</Text><Text style={s.emptyCopy}>New updates will appear here.</Text></View>
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

const styles=(c:AppColors)=>StyleSheet.create({screen:{flex:1,backgroundColor:c.paper},page:{paddingHorizontal:18,paddingTop:8,paddingBottom:28},listHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:9},headingTitle:{fontSize:17,fontWeight:'900',color:c.ink},headingMeta:{fontSize:11,fontWeight:'700',color:c.muted,marginTop:3},readAll:{fontSize:11,fontWeight:'800',color:c.green},card:{flexDirection:'row',alignItems:'flex-start',gap:11,padding:13,borderRadius:16,borderWidth:1,borderColor:c.line,backgroundColor:c.card,marginTop:8},unread:{borderColor:c.green},icon:{width:40,height:40,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:c.mint},copy:{flex:1},cardHeading:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:7},cardTitle:{flex:1,fontSize:13,fontWeight:'900',color:c.ink},date:{fontSize:10,color:c.muted},vendor:{fontSize:10,fontWeight:'800',color:c.green,marginTop:5},message:{fontSize:11,lineHeight:16,color:c.muted,marginTop:4},unreadDot:{width:8,height:8,borderRadius:4,backgroundColor:c.green,marginTop:6},pressed:{opacity:.72},empty:{flex:1,minHeight:340,alignItems:'center',justifyContent:'center',padding:25},emptyIcon:{width:58,height:58,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:c.mint},emptyTitle:{fontSize:17,fontWeight:'900',color:c.ink,textAlign:'center',marginTop:13},emptyCopy:{fontSize:12,lineHeight:18,color:c.muted,textAlign:'center',marginTop:5},primary:{minHeight:43,paddingHorizontal:18,alignItems:'center',justifyContent:'center',borderRadius:13,backgroundColor:c.green,marginTop:14},primaryText:{fontSize:12,fontWeight:'900',color:'white'}});
