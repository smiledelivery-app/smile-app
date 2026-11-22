import { AppTextInput as TextInput } from '@makanza/mobile-ui';
import { AppText as Text } from '@makanza/mobile-ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import type { Session, Vendor } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';
import { api } from '../services/api';
import { BackHeader } from '../components/ui';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';

export type AccountProfile={id:string;name:string;email:string|null;phone:string|null};
export type FavoriteProduct={id:string;name:string;imageUrl:string|null;priceMinor:number;vendor:Vendor};

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
    <View style={s.editHero}>
      <View style={s.editHeroIcon}><Ionicons name="person-outline" size={23} color={colors.green}/></View>
      <Text style={s.editHeroTitle}>The details behind your deliveries</Text>
      <Text style={s.body}>Keep your contact information up to date so every order gets to you smoothly.</Text>
    </View>
    <View style={s.formCard}>
      <Text style={s.cardEyebrow}>PERSONAL INFORMATION</Text>
      <Field label="Full name" value={name} onChangeText={setName} colors={colors}/>
      <Field label="Phone number" value={phone} onChangeText={setPhone} colors={colors} keyboardType="phone-pad"/>
      <Text style={s.label}>Email address</Text>
      <View style={s.readonly}><Text style={s.readonlyText}>{session.user.email||'No email added'}</Text><Ionicons name="lock-closed-outline" size={15} color={colors.muted}/></View>
      <Text style={s.hint}>Email changes are not currently available.</Text>
    </View>
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
    <Pressable disabled={busy} onPress={()=>void save()} style={[s.primary,busy&&{opacity:.6}]}>
      {busy?<ActivityIndicator color="white"/>:<Text style={s.primaryText}>Save changes</Text>}
    </Pressable>
  </ScrollView>;
}

export function FavoritesScreen({colors,vendors,favoriteIds,products,onBack,onOpen,onToggleVendor,onToggleProduct}:{colors:AppColors;vendors:Vendor[];favoriteIds:string[];products:FavoriteProduct[];onBack:()=>void;onOpen:(vendor:Vendor)=>void;onToggleVendor:(id:string)=>void;onToggleProduct:(id:string,vendorId:string)=>void}){
  const s=styles(colors);
  const p=customerPalette(colors);
  const favorites=vendors.filter(vendor=>favoriteIds.includes(vendor.id));
  return <ScrollView style={s.screen} contentContainerStyle={s.page}>
    <Header title="Favourites" subtitle="Your personal shortlist" colors={colors} onBack={onBack}/>
    <View style={s.favoritesSummary}>
      <View style={s.favoritesIcon}><Ionicons name="heart" size={22} color={p.primary}/></View>
      <View style={{flex:1}}><Text style={s.favoritesCount}>{favorites.length+products.length} saved</Text><Text style={s.body}>Kitchens and dishes you love, together.</Text></View>
    </View>
    {favorites.length>0&&<Text style={s.favoriteHeading}>SAVED KITCHENS</Text>}
    {favorites.length?favorites.map(vendor=><View key={vendor.id} style={s.favorite}>
      <Pressable accessibilityRole="button" onPress={()=>onOpen(vendor)} style={s.favoriteMain}>
        <Image source={{uri:vendor.image||'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=500&q=80'}} style={s.favoriteImage}/>
        <View style={{flex:1,gap:5}}><Text style={s.rowTitle}>{vendor.name}</Text><Text style={s.body}>{vendor.cuisine} · {vendor.neighborhood}</Text></View>
        <Ionicons name="chevron-forward" size={22} color={colors.muted}/>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${vendor.name} from favourites`} onPress={()=>onToggleVendor(vendor.id)} style={s.heart}>
        <Ionicons name="heart" size={23} color={colors.accent}/>
      </Pressable>
    </View>):null}
    {products.length>0&&<Text style={s.favoriteHeading}>SAVED DISHES</Text>}
    {products.map(product=><View key={`${product.vendor.id}:${product.id}`} style={s.favorite}>
      <Pressable accessibilityRole="button" accessibilityHint={`Opens ${product.vendor.name}'s menu`} onPress={()=>onOpen(product.vendor)} style={s.favoriteMain}>
        {product.imageUrl?<Image source={{uri:product.imageUrl}} style={s.favoriteImage}/>:<View style={[s.favoriteImage,s.favoriteImageFallback]}><Ionicons name="restaurant-outline" size={22} color={colors.green}/></View>}
        <View style={{flex:1,gap:5}}><Text style={s.rowTitle}>{product.name}</Text><Text style={s.body}>{product.vendor.name} · ₦{(product.priceMinor/100).toLocaleString('en-NG')}</Text></View>
        <Ionicons name="chevron-forward" size={22} color={colors.muted}/>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${product.name} from favourites`} onPress={()=>onToggleProduct(product.id,product.vendor.id)} style={s.heart}>
        <Ionicons name="heart" size={23} color={colors.accent}/>
      </Pressable>
    </View>)}
    {!favorites.length&&!products.length&&<View style={s.empty}><Ionicons name="heart-outline" size={36} color={colors.green}/><Text style={s.rowTitle}>No favourites yet</Text><Text style={s.body}>Save kitchens and dishes you love and they’ll show up here.</Text></View>}
  </ScrollView>;
}

type InfoKind='help'|'about'|'privacy'|'account-required';
export function AccountInfoScreen({kind,colors,onBack}:{kind:InfoKind;colors:AppColors;onBack:()=>void}){
  const s=styles(colors);
  const p=customerPalette(colors);
  const content={
    help:{title:'Help & support',intro:'Need a hand with Smile?',items:[['Orders','Open Orders to follow a delivery or review a recent order.'],['Addresses','Manage delivery locations from Account → Saved addresses.'],['Contact','Support contact details will be added here.']]},
    about:{title:'About Smile',intro:'Neighbourhood favourites, delivered with a smile.',items:[['Smile Customer','Version 0.1.0'],['Made for local discovery','Browse restaurants, groceries, pharmacies, pickup, and local markets.'],['Demo mode','Sample orders and wallet actions stay on this device and do not charge money.']]},
    privacy:{title:'Privacy policy',intro:'A quick overview of account data used by Smile.',items:[['Account details','Your name, email, and phone number help identify your account.'],['Delivery','Saved addresses and order details are used to fulfil and show your orders.'],['Your choices','You can edit your profile, manage saved addresses, or delete your account from the app.'],['Order records','Some order records may be retained after account deletion for operational and legal recordkeeping.']]},
    'account-required':{title:'Sign in required',intro:'This account feature needs a connected Smile account.',items:[['Demo profile','You can preview and edit sample profile details on this device.'],['Account security','Password changes and account deletion are available after signing in to a connected account.']]},
  }[kind];
  const heroIcon=kind==='help'?'help-circle-outline':kind==='privacy'?'shield-checkmark-outline':kind==='account-required'?'lock-closed-outline':'information-circle-outline';
  return <ScrollView style={s.screen} contentContainerStyle={s.page}>
    <Header title={content.title} colors={colors} onBack={onBack}/>
    <View style={s.infoHero}>
      <View style={s.infoHeroIcon}><Ionicons name={heroIcon} size={23} color={p.primary}/></View>
      <Text style={s.infoHeroTitle}>{content.intro}</Text>
    </View>
    <View style={s.infoList}>{content.items.map(([title,detail],index)=><View key={title} style={[s.infoCard,index===content.items.length-1&&s.infoCardLast]}>
      <View style={s.infoBullet}><Ionicons name={kind==='help'?'information-circle-outline':kind==='privacy'?'shield-checkmark-outline':'checkmark'} size={17} color={p.primary}/></View>
      <View style={{flex:1}}><Text style={s.rowTitle}>{title}</Text><Text style={s.body}>{detail}</Text></View>
    </View>)}</View>
  </ScrollView>;
}

export function DeleteAccountScreen({token,colors,onBack,onDeleted}:{token:string;colors:AppColors;onBack:()=>void;onDeleted:()=>void}){
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const s=styles(colors);
  const confirm=()=>{
    const message='Your contact details and saved addresses will be removed. Existing order records may be retained for operational and legal purposes. This cannot be undone.';
    if(Platform.OS==='web'){if(window.confirm(`Delete your Smile account?\n\n${message}`))void remove();return;}
    Alert.alert('Delete your Smile account?',message,[{text:'Keep account',style:'cancel'},{text:'Delete account',style:'destructive',onPress:()=>void remove()}]);
  };
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
    <View style={s.formCard}>
      <Text style={s.cardEyebrow}>CONFIRM YOUR IDENTITY</Text>
      <Text style={s.body}>Enter your current password to continue.</Text>
      <Field label="Current password" value={password} onChangeText={setPassword} colors={colors} secureTextEntry/>
    </View>
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
    <Pressable disabled={busy} onPress={confirm} style={[s.danger,busy&&{opacity:.6}]}>
      {busy?<ActivityIndicator color="white"/>:<Text style={s.primaryText}>Permanently delete account</Text>}
    </Pressable>
  </ScrollView>;
}

function Header({title,subtitle,colors,onBack}:{title:string;subtitle?:string;colors:AppColors;onBack:()=>void}){
  return <BackHeader title={title} subtitle={subtitle} colors={colors} onBack={onBack}/>;
}

function Field({label,value,onChangeText,colors,keyboardType,secureTextEntry}:{label:string;value:string;onChangeText:(value:string)=>void;colors:AppColors;keyboardType?:'phone-pad';secureTextEntry?:boolean}){
  const s=styles(colors);
  const [visible,setVisible]=useState(false);
  return <View style={s.field}><Text style={s.label}>{label}</Text><View><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} secureTextEntry={secureTextEntry&&!visible} autoCapitalize={secureTextEntry?'none':'words'} style={[s.input,secureTextEntry&&{paddingRight:48}]}/>{secureTextEntry&&<Pressable accessibilityRole="button" accessibilityLabel={`${visible?'Hide':'Show'} ${label.toLowerCase()}`} onPress={()=>setVisible(current=>!current)} style={{position:'absolute',right:7,top:0,bottom:0,width:38,alignItems:'center',justifyContent:'center'}}><Ionicons name={visible?'eye-off-outline':'eye-outline'} size={19} color={colors.muted}/></Pressable>}</View></View>;
}

const styles=(colors:AppColors)=>{
  const c=customerPalette(colors);
  return StyleSheet.create({
    screen:{flex:1,backgroundColor:c.canvas},
    page:{paddingHorizontal:customerSpace.lg,paddingTop:customerSpace.md,paddingBottom:customerSpace.xxl},
    header:{minHeight:42,flexDirection:'row',alignItems:'center',gap:6,marginBottom:13},
    back:{width:42,height:42,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:c.surfaceAlt},
    title:{fontSize:27,lineHeight:33,fontWeight:'900',letterSpacing:-.7,color:c.ink},
    body:{fontSize:12,lineHeight:19,color:c.muted,marginTop:5},
    editHero:{padding:17,marginTop:5,borderRadius:customerRadius.lg,backgroundColor:c.primarySoft},
    editHeroIcon:{width:42,height:42,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.md,backgroundColor:c.surface},
    editHeroTitle:{fontSize:16,lineHeight:21,fontWeight:'900',color:c.ink,marginTop:13},
    formCard:{padding:15,marginTop:14,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.lg,backgroundColor:c.surface},
    cardEyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1,color:c.primary},
    field:{marginTop:15},
    label:{fontSize:11,fontWeight:'800',color:c.ink,marginBottom:7},
    input:{minHeight:50,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.sm,paddingHorizontal:13,color:c.ink,backgroundColor:c.surface,fontSize:14},
    readonly:{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:13,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.sm,backgroundColor:c.surfaceAlt},
    readonlyText:{fontSize:12,color:c.muted},
    hint:{fontSize:10,lineHeight:15,color:c.muted,marginTop:5},
    primary:{minHeight:48,alignItems:'center',justifyContent:'center',backgroundColor:c.primary,borderRadius:customerRadius.sm,marginTop:customerSpace.xl},
    primaryText:{fontSize:12,fontWeight:'900',color:'white'},
    danger:{minHeight:48,alignItems:'center',justifyContent:'center',backgroundColor:c.danger,borderRadius:customerRadius.sm,marginTop:customerSpace.xl},
    error:{fontSize:11,lineHeight:17,color:c.danger,marginTop:11},
    favoritesSummary:{minHeight:78,flexDirection:'row',alignItems:'center',gap:12,padding:14,marginTop:5,borderRadius:customerRadius.lg,backgroundColor:c.primarySoft},
    favoritesIcon:{width:42,height:42,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.md,backgroundColor:c.surface},
    favoritesCount:{fontSize:15,fontWeight:'900',color:c.ink},
    favorite:{minHeight:84,flexDirection:'row',alignItems:'center',padding:9,marginTop:9,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.md,backgroundColor:c.surface},
    favoriteMain:{flex:1,flexDirection:'row',alignItems:'center',gap:11},
    favoriteImage:{width:62,height:62,borderRadius:customerRadius.sm,backgroundColor:c.surfaceAlt},
    favoriteImageFallback:{alignItems:'center',justifyContent:'center'},
    favoriteHeading:{fontSize:9,fontWeight:'900',letterSpacing:1.1,color:c.primary,marginTop:customerSpace.xl,marginBottom:2},
    heart:{width:44,height:44,alignItems:'center',justifyContent:'center'},
    empty:{alignItems:'center',gap:8,padding:24,marginTop:customerSpace.xl,borderRadius:customerRadius.lg,backgroundColor:c.surfaceAlt},
    rowTitle:{fontSize:14,fontWeight:'800',color:c.ink},
    infoHero:{alignItems:'flex-start',padding:17,marginTop:5,borderRadius:customerRadius.lg,backgroundColor:c.primarySoft},
    infoHeroIcon:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.md,backgroundColor:c.surface},
    infoHeroTitle:{fontSize:15,lineHeight:22,fontWeight:'700',color:c.ink,marginTop:13},
    infoList:{marginTop:14,paddingHorizontal:14,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.lg,backgroundColor:c.surface},
    infoCard:{flexDirection:'row',alignItems:'flex-start',gap:11,paddingVertical:14,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:c.border},
    infoCardLast:{borderBottomWidth:0},
    infoBullet:{width:31,height:31,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm,backgroundColor:c.primarySoft},
    warning:{flexDirection:'row',gap:10,padding:15,marginTop:10,borderWidth:1,borderColor:c.accent,borderRadius:customerRadius.md,backgroundColor:c.accentSoft},
    warningText:{flex:1,fontSize:11,lineHeight:17,color:c.danger},
  });
};
