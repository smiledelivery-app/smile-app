import { AppText as Text } from '@makanza/mobile-ui';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import type { Session } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';
import { ScreenHeader } from '../components/ui';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';

type Props={
  session:Session;colors:AppColors;guest:boolean;onSignOut:()=>void;onSignIn:()=>void;onEdit:()=>void;onPreferences:()=>void;
  onPassword:()=>void;onAddresses:()=>void;onFavorites:()=>void;onHelp:()=>void;onAbout:()=>void;
};

export default function ProfileScreen({session,colors:c,guest,onSignOut,onSignIn,onEdit,onPreferences,onPassword,onAddresses,onFavorites,onHelp,onAbout}:Props){
  const p=customerPalette(c);
  const s=styles(p);
  const initial=session.user.name.trim().slice(0,1).toUpperCase()||'S';
  return <View style={s.screen}>
    <ScreenHeader title="You" subtitle="Your account and preferences" icon="person-outline" colors={c}/>
    <ScrollView contentContainerStyle={s.page}>
      <View style={s.identityCard}>
        <View style={s.identityTop}>
          <View style={s.avatar}><Text style={s.avatarText}>{initial}</Text></View>
          <View style={s.identityCopy}><Text style={s.eyebrow}>{guest?'LOCAL PROFILE':'SMILE MEMBER'}</Text><Text numberOfLines={1} style={s.name}>{session.user.name}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={onEdit} style={s.editButton}><Ionicons name="create-outline" size={19} color={p.primary}/></Pressable>
        </View>
        <View style={s.divider}/>
        <View style={s.contactRow}><View style={s.contactIcon}><Ionicons name="call-outline" size={16} color={p.primary}/></View><Text numberOfLines={1} style={s.contactText}>{session.user.phone||'Add a phone number'}</Text></View>
        <View style={s.contactRow}><View style={s.contactIcon}><Ionicons name="mail-outline" size={16} color={p.primary}/></View><Text numberOfLines={1} style={s.contactText}>{session.user.email||'No email added'}</Text></View>
      </View>

      {guest&&<Pressable accessibilityRole="button" onPress={onSignIn} style={({pressed})=>[s.signIn,pressed&&s.pressed]}>
        <View style={s.signInIcon}><Ionicons name="log-in-outline" size={20} color={p.primary}/></View>
        <View style={s.signInCopy}><Text style={s.signInTitle}>Connect your Smile account</Text><Text style={s.signInHint}>Keep orders and saved places with you.</Text></View>
        <Ionicons name="arrow-forward" size={18} color={p.primary}/>
      </Pressable>}

      <View style={s.sectionHeading}><Text style={s.sectionTitle}>Your account</Text><Text style={s.sectionHint}>Details and saved places</Text></View>
      <View style={s.actionGroup}>
        <Action icon="person-outline" title="Personal details" onPress={onEdit} p={p}/>
        <Action icon="location-outline" title="Saved addresses" onPress={onAddresses} p={p}/>
        <Action icon="heart-outline" title="Favourites" onPress={onFavorites} p={p}/>
        <Action icon="lock-closed-outline" title="Change password" onPress={onPassword} p={p} last/>
      </View>

      <View style={s.sectionHeading}><Text style={s.sectionTitle}>More</Text><Text style={s.sectionHint}>Settings and support</Text></View>
      <View style={s.actionGroup}>
        <Action icon="settings-outline" title="Preferences" onPress={onPreferences} p={p}/>
        <Action icon="help-circle-outline" title="Help & support" onPress={onHelp} p={p}/>
        <Action icon="information-circle-outline" title="About Smile" onPress={onAbout} p={p} last/>
      </View>

      {!guest&&<Pressable accessibilityRole="button" onPress={onSignOut} style={({pressed})=>[s.signOut,pressed&&s.pressed]}>
        <Ionicons name="log-out-outline" size={18} color={p.danger}/><Text style={s.signOutText}>Sign out</Text>
      </Pressable>}
      <Text style={s.version}>SMILE CUSTOMER · VERSION 0.1.0</Text>
    </ScrollView>
  </View>;
}

function Action({icon,title,onPress,p,last=false}:{icon:string;title:string;onPress:()=>void;p:ReturnType<typeof customerPalette>;last?:boolean}){
  const s=styles(p);
  return <Pressable accessibilityRole="button" accessibilityHint={`Opens ${title.toLowerCase()}`} onPress={onPress} style={({pressed})=>[s.action,!last&&s.actionDivider,pressed&&s.pressed]}>
    <View style={s.actionIcon}><Ionicons name={icon} size={18} color={p.primary}/></View>
    <Text style={s.actionTitle}>{title}</Text>
    <Ionicons name="chevron-forward" size={17} color={p.muted}/>
  </Pressable>;
}

const styles=(p:ReturnType<typeof customerPalette>)=>StyleSheet.create({
  screen:{flex:1,backgroundColor:p.canvas},
  page:{paddingHorizontal:customerSpace.lg,paddingTop:customerSpace.sm,paddingBottom:customerSpace.xxl},
  identityCard:{padding:16,borderWidth:1,borderColor:p.border,borderRadius:customerRadius.lg,backgroundColor:p.surface},
  identityTop:{flexDirection:'row',alignItems:'center',gap:12},
  avatar:{width:54,height:54,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.md,backgroundColor:p.primary},
  avatarText:{fontSize:24,fontWeight:'900',color:'white'},
  identityCopy:{flex:1,minWidth:0},
  eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.1,color:p.primary},
  name:{fontSize:18,lineHeight:24,fontWeight:'900',letterSpacing:-.5,color:p.ink,marginTop:4},
  editButton:{width:42,height:42,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm,backgroundColor:p.primarySoft},
  divider:{height:1,backgroundColor:p.border,marginVertical:14},
  contactRow:{minHeight:32,flexDirection:'row',alignItems:'center',gap:9,marginTop:2},
  contactIcon:{width:26,height:26,alignItems:'center',justifyContent:'center',borderRadius:8,backgroundColor:p.surfaceAlt},
  contactText:{flex:1,fontSize:11,color:p.muted},
  signIn:{minHeight:70,flexDirection:'row',alignItems:'center',gap:11,padding:12,marginTop:10,borderRadius:customerRadius.md,backgroundColor:p.primarySoft},
  signInIcon:{width:40,height:40,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm,backgroundColor:p.surface},
  signInCopy:{flex:1},
  signInTitle:{fontSize:12,fontWeight:'900',color:p.primary},
  signInHint:{fontSize:10,lineHeight:15,color:p.muted,marginTop:3},
  sectionHeading:{marginTop:customerSpace.section,marginBottom:9},
  sectionTitle:{fontSize:17,fontWeight:'900',letterSpacing:-.4,color:p.ink},
  sectionHint:{fontSize:10,color:p.muted,marginTop:3},
  actionGroup:{paddingHorizontal:11,borderWidth:1,borderColor:p.border,borderRadius:customerRadius.md,backgroundColor:p.surface},
  action:{minHeight:55,flexDirection:'row',alignItems:'center',gap:10},
  actionDivider:{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:p.border},
  actionIcon:{width:35,height:35,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm,backgroundColor:p.surfaceAlt},
  actionTitle:{flex:1,fontSize:12,fontWeight:'700',color:p.ink},
  signOut:{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:customerSpace.xl,borderWidth:1,borderColor:p.border,borderRadius:customerRadius.md,backgroundColor:p.surface},
  signOutText:{fontSize:12,fontWeight:'800',color:p.danger},
  version:{fontSize:9,letterSpacing:.8,color:p.muted,textAlign:'center',marginTop:18},
  pressed:{opacity:.72},
});
