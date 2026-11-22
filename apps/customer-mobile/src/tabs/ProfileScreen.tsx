import { AppText as Text } from '@makanza/mobile-ui';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import type { Session } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';
import { ScreenHeader } from '../components/ui';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';

type Props={
  session:Session;colors:AppColors;guest:boolean;onSignOut:()=>void;onSignIn:()=>void;onEdit:()=>void;onPreferences:()=>void;
  onPassword:()=>void;onAddresses:()=>void;onFavorites:()=>void;onWallet:()=>void;onHelp:()=>void;onAbout:()=>void;
};

export default function ProfileScreen({session,colors:c,guest,onSignOut,onSignIn,onEdit,onPreferences,onPassword,onAddresses,onFavorites,onWallet,onHelp,onAbout}:Props){
  const p=customerPalette(c);
  const s=styles(p);
  const initial=session.user.name.trim().split(/\s+/).slice(0,2).map(part=>part.charAt(0)).join('').toUpperCase()||'S';
  return <View style={s.screen}>
    <ScreenHeader title="Profile" subtitle="Your account, your way" icon="person-outline" colors={c}/>
    <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
      <View style={s.identityCard}>
        <View pointerEvents="none" style={s.identityGlow}/>
        <View style={s.identityTop}>
          <View style={s.avatar}><Text style={s.avatarText}>{initial}</Text></View>
          <View style={s.identityCopy}><View style={s.memberLine}><View style={s.memberDot}/><Text style={s.eyebrow}>{guest?'LOCAL PROFILE':'SMILE MEMBER'}</Text></View><Text numberOfLines={1} style={s.name}>{session.user.name}</Text><Text style={s.identityCaption}>{guest?'Your profile on this device':'Good to have you back'}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={onEdit} style={s.editButton}><Ionicons name="create-outline" size={19} color="white"/></Pressable>
        </View>
        <View style={s.divider}/>
        <View style={s.contactRow}><View style={s.contactIcon}><Ionicons name="call-outline" size={15} color="white"/></View><View style={s.contactCopy}><Text style={s.contactLabel}>PHONE</Text><Text numberOfLines={1} style={s.contactText}>{session.user.phone||'Add a phone number'}</Text></View></View>
        <View style={s.contactRow}><View style={s.contactIcon}><Ionicons name="mail-outline" size={15} color="white"/></View><View style={s.contactCopy}><Text style={s.contactLabel}>EMAIL</Text><Text numberOfLines={1} style={s.contactText}>{session.user.email||'No email added'}</Text></View></View>
      </View>

      <View style={s.quickGrid}>
        <Pressable accessibilityRole="button" onPress={onWallet} style={s.quickTile}>
          <View style={[s.quickIcon,{backgroundColor:p.primarySoft}]}><Ionicons name="wallet-outline" size={20} color={p.primary}/></View>
          <View style={s.quickCopy}><Text style={s.quickTitle}>Wallet</Text><Text style={s.quickDetail}>Balance & payments</Text></View>
          <Ionicons name="chevron-forward" size={16} color={p.muted}/>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onAddresses} style={s.quickTile}>
          <View style={[s.quickIcon,{backgroundColor:p.accentSoft}]}><Ionicons name="location-outline" size={20} color={p.accent}/></View>
          <View style={s.quickCopy}><Text style={s.quickTitle}>Addresses</Text><Text style={s.quickDetail}>Saved locations</Text></View>
          <Ionicons name="chevron-forward" size={16} color={p.muted}/>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onFavorites} style={s.quickTile}>
          <View style={[s.quickIcon,{backgroundColor:p.accentSoft}]}><Ionicons name="heart-outline" size={20} color={p.accent}/></View>
          <View style={s.quickCopy}><Text style={s.quickTitle}>Favourites</Text><Text style={s.quickDetail}>Your saved items</Text></View>
          <Ionicons name="chevron-forward" size={16} color={p.muted}/>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onPassword} style={s.quickTile}>
          <View style={[s.quickIcon,{backgroundColor:p.primarySoft}]}><Ionicons name="shield-checkmark-outline" size={20} color={p.primary}/></View>
          <View style={s.quickCopy}><Text style={s.quickTitle}>Security</Text><Text style={s.quickDetail}>Password & access</Text></View>
          <Ionicons name="chevron-forward" size={16} color={p.muted}/>
        </Pressable>
      </View>

      {guest&&<Pressable accessibilityRole="button" onPress={onSignIn} style={({pressed})=>[s.signIn,pressed&&s.pressed]}>
        <View style={s.signInIcon}><Ionicons name="log-in-outline" size={20} color="white"/></View>
        <View style={s.signInCopy}><Text style={s.signInTitle}>Make it yours</Text><Text style={s.signInHint}>Sign in to keep orders and saved places with you.</Text></View>
        <View style={s.signInArrow}><Ionicons name="arrow-forward" size={17} color={p.primary}/></View>
      </Pressable>}

      <View style={s.sectionHeading}><View><Text style={s.sectionEyebrow}>PERSONAL</Text><Text style={s.sectionTitle}>Your account</Text></View><Text style={s.sectionHint}>Manage the essentials</Text></View>
      <View style={s.actionGroup}>
        <Action icon="person-outline" title="Personal details" detail="Name and contact information" onPress={onEdit} p={p} last/>
      </View>

      <View style={s.sectionHeading}><View><Text style={s.sectionEyebrow}>PREFERENCES</Text><Text style={s.sectionTitle}>More for you</Text></View><Text style={s.sectionHint}>Settings and support</Text></View>
      <View style={s.actionGroup}>
        <Action icon="settings-outline" title="Preferences" detail="Theme and notifications" onPress={onPreferences} p={p}/>
        <Action icon="help-circle-outline" title="Help & support" detail="Find answers and get assistance" onPress={onHelp} p={p}/>
        <Action icon="information-circle-outline" title="About Smile" detail="Learn more about the app" onPress={onAbout} p={p} last/>
      </View>

      {!guest&&<Pressable accessibilityRole="button" onPress={onSignOut} style={({pressed})=>[s.signOut,pressed&&s.pressed]}>
        <View style={s.signOutIcon}><Ionicons name="log-out-outline" size={17} color={p.danger}/></View><Text style={s.signOutText}>Sign out</Text><Ionicons name="chevron-forward" size={17} color={p.danger}/>
      </Pressable>}
      <Text style={s.version}>SMILE CUSTOMER  ·  VERSION 0.1.0</Text>
    </ScrollView>
  </View>;
}

function Action({icon,title,detail,onPress,p,last=false}:{icon:string;title:string;detail:string;onPress:()=>void;p:ReturnType<typeof customerPalette>;last?:boolean}){
  const s=styles(p);
  return <Pressable accessibilityRole="button" accessibilityHint={`Opens ${title.toLowerCase()}`} onPress={onPress} style={({pressed})=>[s.action,!last&&s.actionDivider,pressed&&s.pressed]}>
    <View style={s.actionIcon}><Ionicons name={icon} size={18} color={p.primary}/></View>
    <View style={s.actionCopy}><Text style={s.actionTitle}>{title}</Text><Text style={s.actionDetail}>{detail}</Text></View>
    <Ionicons name="chevron-forward" size={17} color={p.muted}/>
  </Pressable>;
}

const styles=(p:ReturnType<typeof customerPalette>)=>StyleSheet.create({
  screen:{flex:1,backgroundColor:p.canvas},
  page:{paddingHorizontal:customerSpace.lg,paddingTop:customerSpace.sm,paddingBottom:customerSpace.xxl},
  identityCard:{position:'relative',overflow:'hidden',padding:17,borderRadius:customerRadius.xl,backgroundColor:p.balance},
  identityGlow:{position:'absolute',top:-92,right:-45,width:210,height:210,borderRadius:105,backgroundColor:'rgba(255,255,255,.07)'},
  identityTop:{flexDirection:'row',alignItems:'center',gap:12},
  avatar:{width:60,height:60,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.lg,borderWidth:1,borderColor:'rgba(255,255,255,.35)',backgroundColor:'rgba(255,255,255,.16)'},
  avatarText:{fontSize:26,fontWeight:'900',color:'white'},
  identityCopy:{flex:1,minWidth:0},
  memberLine:{flexDirection:'row',alignItems:'center',gap:6},
  memberDot:{width:6,height:6,borderRadius:3,backgroundColor:'#b9e6c6'},
  eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.1,color:'#d8e8dc'},
  name:{fontSize:21,lineHeight:26,fontWeight:'900',letterSpacing:-.5,color:'white',marginTop:4},
  identityCaption:{fontSize:10,color:'#d8e8dc',marginTop:2},
  editButton:{width:40,height:40,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.md,borderWidth:1,borderColor:'rgba(255,255,255,.2)',backgroundColor:'rgba(255,255,255,.12)'},
  divider:{height:1,backgroundColor:'rgba(255,255,255,.18)',marginVertical:15},
  contactRow:{minHeight:39,flexDirection:'row',alignItems:'center',gap:10,marginTop:4},
  contactIcon:{width:30,height:30,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm,backgroundColor:'rgba(255,255,255,.12)'},
  contactCopy:{flex:1},
  contactLabel:{fontSize:8,fontWeight:'900',letterSpacing:.8,color:'#cddfd2'},
  contactText:{fontSize:11,fontWeight:'700',color:'white',marginTop:2},
  quickGrid:{gap:8,marginTop:12},
  quickTile:{minHeight:68,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12,borderWidth:1,borderColor:p.border,borderRadius:customerRadius.lg,backgroundColor:p.surface},
  quickIcon:{width:42,height:42,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.md},
  quickCopy:{flex:1},
  quickTitle:{fontSize:13,fontWeight:'900',color:p.ink},
  quickDetail:{fontSize:10,color:p.muted,marginTop:3},
  signIn:{minHeight:78,flexDirection:'row',alignItems:'center',gap:11,padding:13,marginTop:12,borderRadius:customerRadius.lg,backgroundColor:p.primary},
  signInIcon:{width:42,height:42,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.md,backgroundColor:'rgba(255,255,255,.16)'},
  signInCopy:{flex:1},
  signInTitle:{fontSize:13,fontWeight:'900',color:'white'},
  signInHint:{fontSize:10,lineHeight:15,color:'#d8e8dc',marginTop:3},
  signInArrow:{width:31,height:31,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.pill,backgroundColor:'white'},
  sectionHeading:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginTop:customerSpace.xl,marginBottom:10},
  sectionEyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1,color:p.primary,marginBottom:3},
  sectionTitle:{fontSize:18,fontWeight:'900',letterSpacing:-.4,color:p.ink},
  sectionHint:{fontSize:9,color:p.muted,paddingBottom:2},
  actionGroup:{paddingHorizontal:11,borderWidth:1,borderColor:p.border,borderRadius:customerRadius.lg,backgroundColor:p.surface},
  action:{minHeight:66,flexDirection:'row',alignItems:'center',gap:11},
  actionDivider:{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:p.border},
  actionIcon:{width:38,height:38,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.md,backgroundColor:p.primarySoft},
  actionCopy:{flex:1},
  actionTitle:{fontSize:12,fontWeight:'800',color:p.ink},
  actionDetail:{fontSize:9,color:p.muted,marginTop:3},
  signOut:{minHeight:54,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:13,marginTop:customerSpace.xl,borderWidth:1,borderColor:p.border,borderRadius:customerRadius.md,backgroundColor:p.surface},
  signOutIcon:{width:32,height:32,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm,backgroundColor:p.accentSoft},
  signOutText:{flex:1,fontSize:12,fontWeight:'800',color:p.danger},
  version:{fontSize:8,fontWeight:'700',letterSpacing:1,color:p.muted,textAlign:'center',marginTop:20},
  pressed:{opacity:.72},
});
