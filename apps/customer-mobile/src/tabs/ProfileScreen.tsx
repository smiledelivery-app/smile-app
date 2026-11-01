import { AppText as Text } from '@makanza/mobile-ui';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import type { Session } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';
import { ScreenHeader } from '../components/ui';

type Props={
  session:Session;colors:AppColors;guest:boolean;onSignOut:()=>void;onSignIn:()=>void;onEdit:()=>void;onPreferences:()=>void;
  onPassword:()=>void;onAddresses:()=>void;onFavorites:()=>void;onHelp:()=>void;onAbout:()=>void;
};

export default function ProfileScreen({session,colors:c,guest,onSignOut,onSignIn,onEdit,onPreferences,onPassword,onAddresses,onFavorites,onHelp,onAbout}:Props){
  const s=styles(c);
  return <View style={s.screen}><ScreenHeader title="Profile" subtitle="Your account, preferences, and support" icon="person-outline" colors={c}/><ScrollView style={{flex:1}} contentContainerStyle={s.page}>
    <View style={s.profile}>
      <View style={s.profileTop}><View style={s.avatar}><Text style={s.avatarText}>{session.user.name.trim().slice(0,1).toUpperCase()}</Text></View><View style={s.details}>
        <Text style={s.profileLabel}>YOUR ACCOUNT</Text>
        <Text style={s.name}>{session.user.name}</Text>
      </View><Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={onEdit} style={({pressed})=>[s.edit,pressed&&s.pressed]}>
        <Ionicons name="create-outline" size={25} color={c.green}/>
      </Pressable></View>
      <View style={s.contactList}><View style={s.contactRow}><Ionicons name="call-outline" size={16} color={c.green}/><Text style={s.detail}>{session.user.phone||'Add a phone number'}</Text></View><View style={s.contactRow}><Ionicons name="mail-outline" size={16} color={c.green}/><Text style={s.detail}>{session.user.email||'No email added'}</Text></View></View>
    </View>
    {guest&&<Pressable accessibilityRole="button" onPress={onSignIn} style={({pressed})=>[s.signIn,pressed&&s.pressed]}><View style={s.signInIcon}><Ionicons name="log-in-outline" size={20} color={c.green}/></View><View style={s.signInCopy}><Text style={s.signInText}>Sign in to manage your account</Text><Text style={s.signInHint}>Access your saved details and preferences</Text></View><Ionicons name="arrow-forward" size={21} color={c.green}/></Pressable>}
    <View style={s.sectionHeader}><Text style={s.section}>ACCOUNT</Text><Text style={s.sectionHint}>Personal details and saved items</Text></View>
    <View style={s.actionGroup}>
      <Action icon="person-outline" title="Edit profile" onPress={onEdit} c={c}/>
      <Action icon="location-outline" title="Saved addresses" onPress={onAddresses} c={c}/>
      <Action icon="heart-outline" title="Favourites" onPress={onFavorites} c={c}/>
      <Action icon="lock-closed-outline" title="Change password" onPress={onPassword} c={c}/>
    </View>
    <View style={s.sectionHeader}><Text style={s.section}>PREFERENCES</Text><Text style={s.sectionHint}>Help and app information</Text></View>
    <View style={s.actionGroup}>
      <Action icon="settings-outline" title="Settings" onPress={onPreferences} c={c}/>
      <Action icon="help-circle-outline" title="Help & support" onPress={onHelp} c={c}/>
      <Action icon="information-circle-outline" title="About Smile" onPress={onAbout} c={c}/>
    </View>
    {!guest&&<Pressable accessibilityRole="button" onPress={onSignOut} style={s.signOut}>
      <Ionicons name="log-out-outline" size={22} color="#a34232"/>
      <Text style={s.signOutText}>Log out</Text>
    </Pressable>}
    <Text style={s.version}>SMILE · CUSTOMER · VERSION 0.1.0</Text>
  </ScrollView></View>;
}

function Action({icon,title,onPress,c}:{icon:'person-outline'|'location-outline'|'heart-outline'|'lock-closed-outline'|'settings-outline'|'help-circle-outline'|'information-circle-outline';title:string;onPress:()=>void;c:AppColors}){
  const s=styles(c);
  return <Pressable accessibilityRole="button" accessibilityHint={`Opens ${title.toLowerCase()}`} onPress={onPress} style={({pressed})=>[s.action,pressed&&s.actionPressed]}>
    <View style={s.actionIcon}><Ionicons name={icon} size={20} color={c.green}/></View>
    <Text style={s.actionTitle}>{title}</Text>
    <View style={s.actionArrow}><Ionicons name="chevron-forward" size={18} color={c.muted}/></View>
  </Pressable>;
}

const styles=(c:AppColors)=>StyleSheet.create({
  screen:{flex:1,backgroundColor:c.paper},
  page:{padding:20,paddingTop:12,paddingBottom:34},
  kicker:{fontSize:11,fontWeight:'900',letterSpacing:1.2,color:c.green,marginBottom:15},
  profile:{padding:16,borderRadius:20,backgroundColor:c.card,borderWidth:1,borderColor:c.line,marginBottom:4},
  profileTop:{flexDirection:'row',alignItems:'center',gap:12},
  avatar:{width:58,height:58,borderRadius:29,alignItems:'center',justifyContent:'center',backgroundColor:c.green},
  avatarText:{fontSize:26,fontWeight:'900',color:'white'},
  details:{flex:1,gap:4},
  profileLabel:{fontSize:9,fontWeight:'900',letterSpacing:1.2,color:c.green},
  name:{fontSize:19,fontWeight:'900',color:c.ink},
  contactList:{marginTop:14,paddingTop:11,borderTopWidth:1,borderTopColor:c.line,gap:8},
  contactRow:{flexDirection:'row',alignItems:'center',gap:9},
  detail:{fontSize:12,color:c.muted},
  edit:{width:40,height:40,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:c.cream},
  pressed:{opacity:.78},
  signIn:{minHeight:68,flexDirection:'row',alignItems:'center',gap:11,padding:12,marginTop:10,borderRadius:16,backgroundColor:c.mint},
  signInIcon:{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:c.card},
  signInCopy:{flex:1},
  signInText:{fontSize:12,fontWeight:'900',color:c.green},
  signInHint:{fontSize:10,color:c.muted,marginTop:3},
  sectionHeader:{marginTop:21,marginBottom:7},
  section:{fontSize:10,fontWeight:'900',letterSpacing:1.2,color:c.muted},
  sectionHint:{fontSize:11,color:c.muted,marginTop:3},
  actionGroup:{paddingHorizontal:11,borderRadius:17,borderWidth:1,borderColor:c.line,backgroundColor:c.card},
  action:{minHeight:59,paddingHorizontal:3,flexDirection:'row',alignItems:'center',gap:11,borderBottomWidth:1,borderBottomColor:c.line},
  actionPressed:{opacity:.65},
  actionIcon:{width:38,height:38,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:c.cream},
  actionTitle:{flex:1,fontSize:13,fontWeight:'700',color:c.ink},
  actionArrow:{width:28,height:28,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:c.cream},
  signOut:{minHeight:49,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8,marginTop:22,borderRadius:14,backgroundColor:c.card},
  signOutText:{fontSize:13,fontWeight:'800',color:'#a34232'},
  version:{fontSize:10,letterSpacing:.8,color:c.muted,textAlign:'center',marginTop:16},
});
