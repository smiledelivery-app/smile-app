import { AppText as Text } from '@makanza/mobile-ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import type { AppColors } from '../theme/colors';
import { api } from '../services/api';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';

export type VendorProfile={id:string;name:string;ownerName:string;description:string;address:string;contactPhone:string|null;logoUrl:string|null;coverImageUrl:string|null;cacNumber:string|null;cacDocumentUrl:string|null;latitude:number|string|null;longitude:number|string|null;status:string;isOpen:boolean};

type UploadSignature={cloudName:string;apiKey:string;timestamp:number;folder:string;signature:string};
type Props={token:string;profile:VendorProfile|null;authorized:boolean;colors:AppColors;onAuthorized:()=>void;onSaved:(profile:VendorProfile)=>void;onCancel?:()=>void};
type Form={name:string;ownerName:string;contactPhone:string;description:string;address:string;logoUrl:string;coverImageUrl:string;cacNumber:string;cacDocumentUrl:string;latitude:number|undefined;longitude:number|undefined;termsAccepted:boolean};
const emptyForm=():Form=>({name:'',ownerName:'',contactPhone:'',description:'',address:'',logoUrl:'',coverImageUrl:'',cacNumber:'',cacDocumentUrl:'',latitude:undefined,longitude:undefined,termsAccepted:false});

export function VendorStoreProfileForm({token,profile,authorized,colors,onAuthorized,onSaved,onCancel}:Props){
  const [form,setForm]=useState<Form>(emptyForm);const [busy,setBusy]=useState(false);const [mediaBusy,setMediaBusy]=useState<'logo'|'cover'|null>(null);const [error,setError]=useState('');const s=styles(colors);
  useEffect(()=>{if(profile)setForm({name:profile.name,ownerName:profile.ownerName??'',contactPhone:profile.contactPhone??'',description:profile.description??'',address:profile.address??'',logoUrl:profile.logoUrl??'',coverImageUrl:profile.coverImageUrl??'',cacNumber:profile.cacNumber??'',cacDocumentUrl:profile.cacDocumentUrl??'',latitude:profile.latitude===null?undefined:Number(profile.latitude),longitude:profile.longitude===null?undefined:Number(profile.longitude),termsAccepted:false});},[profile]);
  const set=<K extends keyof Form>(key:K,value:Form[K])=>setForm(current=>({...current,[key]:value}));

  const pickImage=async(kind:'logo'|'cover')=>{
    setError('');
    try{
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:kind==='logo'?[1,1]:[16,9],quality:0.82});
      if(result.canceled)return;
      const asset=result.assets[0];if(!asset)return;
      setMediaBusy(kind);
      const signature=await api.post<UploadSignature>('/vendor/media/sign',{},token);
      const data=new FormData();
      data.append('file',{uri:asset.uri,name:asset.fileName??`${kind}-${Date.now()}.jpg`,type:asset.mimeType??'image/jpeg'} as unknown as Blob);
      data.append('api_key',signature.apiKey);data.append('timestamp',String(signature.timestamp));data.append('folder',signature.folder);data.append('signature',signature.signature);
      const response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/image/upload`,{method:'POST',body:data});
      const uploaded=await response.json().catch(()=>null) as {secure_url?:string;error?:{message?:string}}|null;
      if(!response.ok||!uploaded?.secure_url)throw new Error(uploaded?.error?.message??'Could not upload this image. Try another photo.');
      set(kind==='logo'?'logoUrl':'coverImageUrl',uploaded.secure_url);
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not choose or upload the image.');}
    finally{setMediaBusy(null);}
  };

  const chooseLocation=async()=>{setError('');try{const permission=await Location.requestForegroundPermissionsAsync();if(permission.status!=='granted')throw new Error('Allow location access to set your store pin.');const point=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});const [place]=await Location.reverseGeocodeAsync(point.coords);const street=[place?.streetNumber,place?.street,place?.name].filter(Boolean).join(' ');setForm(current=>({...current,latitude:point.coords.latitude,longitude:point.coords.longitude,address:current.address||street||`${point.coords.latitude.toFixed(5)}, ${point.coords.longitude.toFixed(5)}`}));}catch(reason){setError(reason instanceof Error?reason.message:'Could not read your location.');}};

  const save=async()=>{
    if(!form.name.trim()||!form.ownerName.trim()||!form.contactPhone.trim()||!form.address.trim()){setError('Store name, owner, phone, and address are required.');return;}
    if(mediaBusy){setError('Wait for the image upload to finish.');return;}
    if((form.latitude===undefined)!==(form.longitude===undefined)){setError('Use the location button to add a complete map pin.');return;}
    if(!authorized&&!form.termsAccepted){setError('Accept the vendor terms before submitting.');return;}
    setBusy(true);setError('');
    try{
      const body={...form,name:form.name.trim(),ownerName:form.ownerName.trim(),contactPhone:form.contactPhone.trim(),address:form.address.trim(),description:form.description.trim(),logoUrl:form.logoUrl||null,coverImageUrl:form.coverImageUrl||null,cacNumber:form.cacNumber.trim()||null,cacDocumentUrl:form.cacDocumentUrl.trim()||null,termsAccepted:true};
      if(authorized)await api.put('/vendor/profile',body,token);else{await api.post('/vendors/onboarding',body,token);onAuthorized();}
      const latest=await api.get<VendorProfile>('/vendor/profile',token);onSaved(latest);
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not save your store details.');}
    finally{setBusy(false);}
  };

  return <View style={s.card}>
    <Text style={s.formTitle}>{authorized?'Store details':'Set up your store'}</Text>
    <Text style={s.copy}>Tell customers and the review team about your business. CAC details are optional.</Text>
    <FormField label="Store name" value={form.name} onChangeText={value=>set('name',value)} placeholder="e.g. Mama T's Kitchen" dark={colors.isDark}/>
    <FormField label="Owner name" value={form.ownerName} onChangeText={value=>set('ownerName',value)} placeholder="Full name" dark={colors.isDark}/>
    <FormField label="Store phone" value={form.contactPhone} onChangeText={value=>set('contactPhone',value)} placeholder="+234…" keyboardType="phone-pad" dark={colors.isDark}/>
    <FormField label="Business address" value={form.address} onChangeText={value=>set('address',value)} placeholder="Street, area, and city" dark={colors.isDark}/>
    <Pressable accessibilityRole="button" onPress={()=>void chooseLocation()} style={s.locationButton}><Text style={s.link}>⌖  Use current location for store pin</Text></Pressable>
    {form.latitude!==undefined&&<Text style={s.copy}>Map pin set · {form.latitude.toFixed(5)}, {form.longitude?.toFixed(5)}</Text>}
    <FormField label="Store description" value={form.description} onChangeText={value=>set('description',value)} placeholder="A short introduction to your store" multiline dark={colors.isDark}/>
    <ImageChoice label="Store logo" helper="Square image recommended" uri={form.logoUrl} busy={mediaBusy==='logo'} colors={colors} onPick={()=>void pickImage('logo')} onRemove={()=>set('logoUrl','')}/>
    <ImageChoice label="Cover image" helper="Wide image recommended" uri={form.coverImageUrl} busy={mediaBusy==='cover'} colors={colors} onPick={()=>void pickImage('cover')} onRemove={()=>set('coverImageUrl','')}/>
    <FormField label="CAC registration number (optional)" value={form.cacNumber} onChangeText={value=>set('cacNumber',value)} placeholder="RC…" dark={colors.isDark}/>
    <FormField label="CAC document URL (optional)" value={form.cacDocumentUrl} onChangeText={value=>set('cacDocumentUrl',value)} placeholder="Private document link" keyboardType="url" dark={colors.isDark}/>
    {!authorized&&<Pressable accessibilityRole="checkbox" accessibilityState={{checked:form.termsAccepted}} style={s.terms} onPress={()=>set('termsAccepted',!form.termsAccepted)}><Text style={s.link}>{form.termsAccepted?'☑':'□'}  I accept the vendor terms</Text></Pressable>}
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
    <PrimaryButton title={busy?'Saving…':authorized?'Save store details':'Submit store for review'} disabled={busy||Boolean(mediaBusy)} onPress={()=>void save()} style={s.button}/>
    {onCancel&&<PrimaryButton title="Cancel" secondary onPress={onCancel} style={s.button}/>}
  </View>;
}

function ImageChoice({label,helper,uri,busy,colors,onPick,onRemove}:{label:string;helper:string;uri:string;busy:boolean;colors:AppColors;onPick:()=>void;onRemove:()=>void}){
  const s=styles(colors);
  return <View style={s.imageField}>
    <View style={s.imageLabel}><Text style={s.fieldLabel}>{label}</Text><Text style={s.imageHelper}>{helper}</Text></View>
    <View style={s.imageActions}>
      <Pressable accessibilityRole="button" onPress={onPick} disabled={busy} style={[s.imagePick,busy&&{opacity:.65}]}>
        {busy?<ActivityIndicator color={colors.green}/>:uri?<Image source={{uri}} resizeMode="cover" style={label==='Store logo'?s.logoPreview:s.coverPreview}/>:<Text style={s.pickPlaceholder}>＋</Text>}
        <Text style={s.imageButtonText}>{busy?'Uploading…':uri?'Change image':'Choose image'}</Text>
      </Pressable>
      {uri&&!busy&&<Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label.toLowerCase()}`} onPress={onRemove} style={s.removeImage}><Text style={s.removeText}>Remove</Text></Pressable>}
    </View>
  </View>;
}

const styles=(c:AppColors)=>StyleSheet.create({card:{padding:15,borderWidth:1,borderColor:c.line,borderRadius:17,backgroundColor:c.card,marginTop:8},formTitle:{fontSize:19,fontWeight:'900',color:c.ink,marginBottom:4},copy:{color:c.muted,fontSize:12,lineHeight:18},locationButton:{paddingVertical:10},link:{color:c.green,fontSize:12,fontWeight:'900'},terms:{paddingVertical:10},error:{color:'#a44232',fontSize:13,marginTop:8},button:{marginTop:6},imageField:{marginTop:14},imageLabel:{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:8,marginBottom:7},fieldLabel:{fontSize:13,fontWeight:'700',color:c.ink},imageHelper:{fontSize:11,color:c.muted},imageActions:{flexDirection:'row',alignItems:'center',gap:12},imagePick:{minHeight:62,flexDirection:'row',alignItems:'center',gap:10,padding:8,borderWidth:1,borderColor:c.line,borderRadius:13,backgroundColor:c.cream},pickPlaceholder:{width:43,height:43,textAlign:'center',textAlignVertical:'center',borderRadius:10,overflow:'hidden',backgroundColor:c.card,color:c.green,fontSize:28,fontWeight:'600'},logoPreview:{width:48,height:48,borderRadius:10},coverPreview:{width:92,height:52,borderRadius:9},imageButtonText:{color:c.green,fontSize:12,fontWeight:'800',paddingHorizontal:4},removeImage:{paddingVertical:8,paddingHorizontal:5},removeText:{fontSize:11,fontWeight:'800',color:'#a44232'}});
