import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Session } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';

type Props={
  session:Session;colors:AppColors;guest:boolean;onSignOut:()=>void;onSignIn:()=>void;onEdit:()=>void;onPreferences:()=>void;
  onPassword:()=>void;onAddresses:()=>void;onFavorites:()=>void;onHelp:()=>void;onAbout:()=>void;
};

export default function ProfileScreen({session,colors:c,guest,onSignOut,onSignIn,onEdit,onPreferences,onPassword,onAddresses,onFavorites,onHelp,onAbout}:Props){
  const s=styles(c);
  return <ScrollView style={s.screen} contentContainerStyle={s.page}>
    <Text style={s.kicker}>YOUR SMILE ACCOUNT</Text>
    <View style={s.profile}>
      <View style={s.avatar}><Text style={s.avatarText}>{session.user.name.trim().slice(0,1).toUpperCase()}</Text></View>
      <View style={s.details}>
        <Text style={s.name}>{session.user.name}</Text>
        <Text style={s.detail}>{session.user.phone||'Add a phone number'}</Text>
        <Text style={s.detail}>{session.user.email||'No email added'}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={onEdit} style={s.edit}>
        <Ionicons name="create-outline" size={25} color={c.green}/>
      </Pressable>
    </View>
    {guest&&<Pressable accessibilityRole="button" onPress={onSignIn} style={s.signIn}><Text style={s.signInText}>Sign in to manage your account</Text><Ionicons name="arrow-forward" size={21} color={c.green}/></Pressable>}
    <Text style={s.section}>ACCOUNT</Text>
    <Action icon="person-outline" title="Edit profile" onPress={onEdit} c={c}/>
    <Action icon="location-outline" title="Saved addresses" onPress={onAddresses} c={c}/>
    <Action icon="heart-outline" title="Favourites" onPress={onFavorites} c={c}/>
    <Action icon="lock-closed-outline" title="Change password" onPress={onPassword} c={c}/>
    <Text style={s.section}>PREFERENCES</Text>
    <Action icon="settings-outline" title="Settings" onPress={onPreferences} c={c}/>
    <Action icon="help-circle-outline" title="Help & support" onPress={onHelp} c={c}/>
    <Action icon="information-circle-outline" title="About Smile" onPress={onAbout} c={c}/>
    {!guest&&<Pressable accessibilityRole="button" onPress={onSignOut} style={s.signOut}>
      <Ionicons name="log-out-outline" size={22} color="#a34232"/>
      <Text style={s.signOutText}>Log out</Text>
    </Pressable>}
    <Text style={s.version}>SMILE · CUSTOMER · VERSION 0.1.0</Text>
  </ScrollView>;
}

function Action({icon,title,onPress,c}:{icon:'person-outline'|'location-outline'|'heart-outline'|'lock-closed-outline'|'settings-outline'|'help-circle-outline'|'information-circle-outline';title:string;onPress:()=>void;c:AppColors}){
  const s=styles(c);
  return <Pressable accessibilityRole="button" onPress={onPress} style={s.action}>
    <Ionicons name={icon} size={24} color={c.green}/>
    <Text style={s.actionTitle}>{title}</Text>
    <Ionicons name="chevron-forward" size={21} color={c.muted}/>
  </Pressable>;
}

const styles=(c:AppColors)=>StyleSheet.create({
  screen:{flex:1,backgroundColor:c.paper},
  page:{padding:20,paddingTop:24,paddingBottom:34},
  kicker:{fontSize:11,fontWeight:'900',letterSpacing:1.2,color:c.green,marginBottom:15},
  profile:{minHeight:96,padding:14,borderRadius:17,backgroundColor:c.cream,flexDirection:'row',alignItems:'center',gap:12},
  avatar:{width:54,height:54,borderRadius:19,alignItems:'center',justifyContent:'center',backgroundColor:c.green},
  avatarText:{fontSize:26,fontWeight:'900',color:'white'},
  details:{flex:1,gap:4},
  name:{fontSize:17,fontWeight:'900',color:c.ink},
  detail:{fontSize:12,color:c.muted},
  edit:{width:38,height:38,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:c.card},
  signIn:{minHeight:45,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:13,marginTop:10,borderRadius:13,backgroundColor:c.cream},
  signInText:{fontSize:12,fontWeight:'800',color:c.green},
  section:{fontSize:10,fontWeight:'900',letterSpacing:1.2,color:c.muted,marginTop:22,marginBottom:3},
  action:{minHeight:52,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:12,backgroundColor:c.card,borderRadius:13,marginTop:7},
  actionTitle:{flex:1,fontSize:13,fontWeight:'700',color:c.ink},
  signOut:{minHeight:49,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8,marginTop:22,borderRadius:14,backgroundColor:c.card},
  signOutText:{fontSize:13,fontWeight:'800',color:'#a34232'},
  version:{fontSize:10,letterSpacing:.8,color:c.muted,textAlign:'center',marginTop:16},
});
