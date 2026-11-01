import { AppTextInput as TextInput } from '@makanza/mobile-ui';
import { AppText as Text } from '@makanza/mobile-ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import type { Session, Vendor } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';
import { api } from '../services/api';

export type AccountProfile={id:string;name:string;email:string|null;phone:string|null};

export function EditProfileScreen({session,colors,demoMode,onBack,onSaved}:{session:Session;colors:AppColors;demoMode:boolean;onBack:()=>void;onSaved:(profile:AccountProfile)=>void}){
  const [name,setName]=useState(session.user.name);
  const [phone,setPhone]=useState(session.user.phone??'');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const s=styles(colors);
  useEffect(()=>{if(demoMode)return;let active=true;void api.get<AccountProfile>('/auth/profile',session.token).then(profile=>{if(active){setName(profile.name);setPhone(profile.phone??'');}}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Could not load your profile.');});return()=>{active=false;};},[demoMode,session.token]);
  const save=async()=>{
    setError('');
    if(name.trim().length<2){setError('Enter a name with at least 2 characters.');return;}
    if(phone.trim()&&phone.trim().length<7){setError('Enter a valid phone number.');return;}
    if(demoMode){onSaved({id:session.user.id,name:name.trim(),email:session.user.email,phone:phone.trim()||null});onBack();return;}
    setBusy(true);
    try{
      const profile=await api.patch<AccountProfile>('/auth/profile',{name:name.trim(),phone:phone.trim()||null},session.token);
      onSaved(profile);
      onBack();
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not update your profile.');}
    finally{setBusy(false);}
  };
  return <ScrollView style={s.screen} contentContainerStyle={s.page}>
    <Header title="Edit profile" colors={colors} onBack={onBack}/>
    <Text style={s.body}>Keep your contact details up to date for orders and delivery.</Text>
    <Field label="Full name" value={name} onChangeText={setName} colors={colors}/>
    <Field label="Phone number" value={phone} onChangeText={setPhone} colors={colors} keyboardType="phone-pad"/>
    <Text style={s.label}>Email address</Text>
    <View style={s.readonly}><Text style={s.readonlyText}>{session.user.email||'No email added'}</Text></View>
    <Text style={s.hint}>Email changes are not currently available.</Text>
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
    <Pressable disabled={busy} onPress={()=>void save()} style={[s.primary,busy&&{opacity:.6}]}>
      {busy?<ActivityIndicator color="white"/>:<Text style={s.primaryText}>Save changes</Text>}
    </Pressable>
  </ScrollView>;
}

export function FavoritesScreen({colors,vendors,favoriteIds,onBack,onOpen,onToggle}:{colors:AppColors;vendors:Vendor[];favoriteIds:string[];onBack:()=>void;onOpen:(vendor:Vendor)=>void;onToggle:(id:string)=>void}){
  const s=styles(colors);
  const favorites=vendors.filter(vendor=>favoriteIds.includes(vendor.id));
  return <ScrollView style={s.screen} contentContainerStyle={s.page}>
    <Header title="Favourites" colors={colors} onBack={onBack}/>
    <Text style={s.body}>Your saved kitchens, all in one place.</Text>
    {favorites.length?favorites.map(vendor=><View key={vendor.id} style={s.favorite}>
      <Pressable accessibilityRole="button" onPress={()=>onOpen(vendor)} style={s.favoriteMain}>
        <Image source={{uri:vendor.image||'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=500&q=80'}} style={s.favoriteImage}/>
        <View style={{flex:1,gap:5}}><Text style={s.rowTitle}>{vendor.name}</Text><Text style={s.body}>{vendor.cuisine} · {vendor.neighborhood}</Text></View>
        <Ionicons name="chevron-forward" size={22} color={colors.muted}/>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${vendor.name} from favourites`} onPress={()=>onToggle(vendor.id)} style={s.heart}>
        <Ionicons name="heart" size={23} color={colors.accent}/>
      </Pressable>
    </View>):<View style={s.empty}><Ionicons name="heart-outline" size={36} color={colors.green}/><Text style={s.rowTitle}>No favourites yet</Text><Text style={s.body}>Save kitchens you love and they’ll show up here.</Text></View>}
  </ScrollView>;
}

type InfoKind='help'|'about'|'privacy'|'account-required';
export function AccountInfoScreen({kind,colors,onBack}:{kind:InfoKind;colors:AppColors;onBack:()=>void}){
  const s=styles(colors);
  const content={
    help:{title:'Help & support',intro:'Need a hand with Smile?',items:[['Orders','Open Orders to follow a delivery or review a recent order.'],['Addresses','Manage delivery locations from Account → Saved addresses.'],['Contact','Support contact details will be added here.']]},
    about:{title:'About Smile',intro:'Neighbourhood favourites, delivered with a smile.',items:[['Smile Customer','Version 0.1.0'],['Made for local discovery','Browse restaurants, groceries, pharmacies, pickup, and local markets.'],['Demo mode','Sample orders and wallet actions stay on this device and do not charge money.']]},
    privacy:{title:'Privacy policy',intro:'A quick overview of account data used by Smile.',items:[['Account details','Your name, email, and phone number help identify your account.'],['Delivery','Saved addresses and order details are used to fulfil and show your orders.'],['Your choices','You can edit your profile, manage saved addresses, or delete your account from the app.'],['Order records','Some order records may be retained after account deletion for operational and legal recordkeeping.']]},
    'account-required':{title:'Sign in required',intro:'This account feature needs a connected Smile account.',items:[['Demo profile','You can preview and edit sample profile details on this device.'],['Account security','Password changes and account deletion are available after signing in to a connected account.']]},
  }[kind];
  return <ScrollView style={s.screen} contentContainerStyle={s.page}>
    <Header title={content.title} colors={colors} onBack={onBack}/>
    <Text style={s.body}>{content.intro}</Text>
    {content.items.map(([title,detail])=><View key={title} style={s.infoCard}><Text style={s.rowTitle}>{title}</Text><Text style={s.body}>{detail}</Text></View>)}
  </ScrollView>;
}

export function DeleteAccountScreen({token,colors,onBack,onDeleted}:{token:string;colors:AppColors;onBack:()=>void;onDeleted:()=>void}){
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const s=styles(colors);
  const confirm=()=>Alert.alert('Delete your Smile account?', 'Your contact details and saved addresses will be removed. Existing order records may be retained for operational and legal purposes. This cannot be undone.',[
    {text:'Keep account',style:'cancel'},
    {text:'Delete account',style:'destructive',onPress:()=>void remove()},
  ]);
  const remove=async()=>{
    setError('');
    if(!password){setError('Enter your password to continue.');return;}
    setBusy(true);
    try{await api.delete('/auth/account',token,{password});onDeleted();}
    catch(reason){setError(reason instanceof Error?reason.message:'Could not delete your account.');}
    finally{setBusy(false);}
  };
  return <ScrollView style={s.screen} contentContainerStyle={s.page}>
    <Header title="Delete account" colors={colors} onBack={onBack}/>
    <View style={s.warning}><Ionicons name="warning-outline" size={25} color="#a34232"/><Text style={s.warningText}>This action is permanent. Your account access and saved addresses will be removed. Order records may be retained where required.</Text></View>
    <Field label="Current password" value={password} onChangeText={setPassword} colors={colors} secureTextEntry/>
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
    <Pressable disabled={busy} onPress={confirm} style={[s.danger,busy&&{opacity:.6}]}>
      {busy?<ActivityIndicator color="white"/>:<Text style={s.primaryText}>Permanently delete account</Text>}
    </Pressable>
  </ScrollView>;
}

function Header({title,colors,onBack}:{title:string;colors:AppColors;onBack:()=>void}){
  return <View style={styles(colors).header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to profile" onPress={onBack} style={styles(colors).back}><Ionicons name="chevron-back" size={23} color={colors.green}/></Pressable>
    <Text style={styles(colors).title}>{title}</Text>
  </View>;
}

function Field({label,value,onChangeText,colors,keyboardType,secureTextEntry}:{label:string;value:string;onChangeText:(value:string)=>void;colors:AppColors;keyboardType?:'phone-pad';secureTextEntry?:boolean}){
  const s=styles(colors);
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} secureTextEntry={secureTextEntry} autoCapitalize={secureTextEntry?'none':'words'} style={s.input}/></View>;
}

const styles=(c:AppColors)=>StyleSheet.create({
  screen:{flex:1,backgroundColor:c.paper},
  page:{padding:21,paddingTop:20,paddingBottom:40},
  header:{minHeight:42,flexDirection:'row',alignItems:'center',gap:6,marginBottom:13},
  back:{width:34,height:34,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:c.cream},
  title:{fontSize:29,fontWeight:'900',letterSpacing:-.6,color:c.ink},
  body:{fontSize:13,lineHeight:21,color:c.muted,marginTop:5},
  field:{marginTop:17},
  label:{fontSize:12,fontWeight:'800',color:c.ink,marginBottom:7},
  input:{height:48,borderWidth:1,borderColor:c.line,borderRadius:13,paddingHorizontal:13,color:c.ink,backgroundColor:c.card,fontSize:15},
  readonly:{minHeight:45,justifyContent:'center',paddingHorizontal:13,borderWidth:1,borderColor:c.line,borderRadius:13,backgroundColor:c.cream},
  readonlyText:{fontSize:13,color:c.muted},
  hint:{fontSize:11,color:c.muted,marginTop:5},
  primary:{height:49,alignItems:'center',justifyContent:'center',backgroundColor:c.green,borderRadius:14,marginTop:22},
  primaryText:{fontSize:13,fontWeight:'900',color:'white'},
  danger:{height:49,alignItems:'center',justifyContent:'center',backgroundColor:'#a34232',borderRadius:14,marginTop:22},
  error:{fontSize:12,color:'#a34232',marginTop:12},
  favorite:{minHeight:85,flexDirection:'row',alignItems:'center',padding:9,marginTop:11,borderRadius:15,backgroundColor:c.card},
  favoriteMain:{flex:1,flexDirection:'row',alignItems:'center',gap:11},
  favoriteImage:{width:60,height:60,borderRadius:12,backgroundColor:c.cream},
  heart:{width:40,height:44,alignItems:'center',justifyContent:'center'},
  empty:{alignItems:'center',gap:9,padding:28,marginTop:22,borderRadius:16,backgroundColor:c.cream},
  rowTitle:{fontSize:15,fontWeight:'800',color:c.ink},
  infoCard:{padding:15,marginTop:12,borderRadius:15,backgroundColor:c.card},
  warning:{flexDirection:'row',gap:10,padding:14,marginTop:15,borderRadius:13,backgroundColor:'#fbefeb'},
  warningText:{flex:1,fontSize:12,lineHeight:19,color:'#874032'},
});
