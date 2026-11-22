import { AppText as Text } from '@makanza/mobile-ui';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { AppColors } from '../theme/colors';
import { api } from '../services/api';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { Ionicons } from '../components/AppIcon';
import StoreMediaPicker from './StoreMediaPicker';
import { appendMediaAsset, createUploadFormData } from '../utils/upload-media';
import { vendorRadius, vendorSpace } from '../theme/vendor';
import VendorStoreLocationModal from './VendorStoreLocationModal';

export type OperatingHour={dayOfWeek:number;isClosed:boolean;openingTime:string|null;closingTime:string|null};
export type VendorProfile={id:string;name:string;ownerName:string;description:string;address:string;contactPhone:string|null;openingTime:string;closingTime:string;operatingHours?:OperatingHour[];logoUrl:string|null;coverImageUrl:string|null;cacNumber:string|null;cacDocumentUrl:string|null;latitude:number|string|null;longitude:number|string|null;status:string;isOpen:boolean};

type UploadSignature={cloudName:string;apiKey:string;timestamp:number;folder:string;signature:string};
type Props={token:string;profile:VendorProfile|null;authorized:boolean;colors:AppColors;onAuthorized:()=>void;onSaved:(profile:VendorProfile)=>void;onCancel?:()=>void};
type Form={name:string;ownerName:string;contactPhone:string;description:string;address:string;operatingHours:OperatingHour[];logoUrl:string;coverImageUrl:string;cacNumber:string;cacDocumentUrl:string;latitude:number|undefined;longitude:number|undefined;termsAccepted:boolean};
const dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const defaultHours=():OperatingHour[]=>dayNames.map((_,dayOfWeek)=>({dayOfWeek,isClosed:false,openingTime:'09:00',closingTime:'21:00'}));
const emptyForm=():Form=>({name:'',ownerName:'',contactPhone:'',description:'',address:'',operatingHours:defaultHours(),logoUrl:'',coverImageUrl:'',cacNumber:'',cacDocumentUrl:'',latitude:undefined,longitude:undefined,termsAccepted:false});

export function VendorStoreProfileForm({token,profile,authorized,colors,onAuthorized,onSaved,onCancel}:Props){
  const [form,setForm]=useState<Form>(emptyForm);const [busy,setBusy]=useState(false);const [mediaBusy,setMediaBusy]=useState<'logo'|'cover'|null>(null);const [error,setError]=useState('');const [locationOpen,setLocationOpen]=useState(false);const [hoursOpen,setHoursOpen]=useState(false);const [selectedDay,setSelectedDay]=useState(()=>new Date().getDay());const s=styles(colors);
  useEffect(()=>{if(profile){const oldHours=profile.operatingHours?.length===7?profile.operatingHours:null;setForm({name:profile.name,ownerName:profile.ownerName??'',contactPhone:profile.contactPhone??'',description:profile.description??'',address:profile.address??'',operatingHours:oldHours??dayNames.map((_,dayOfWeek)=>({dayOfWeek,isClosed:false,openingTime:profile.openingTime??'09:00',closingTime:profile.closingTime??'21:00'})),logoUrl:profile.logoUrl??'',coverImageUrl:profile.coverImageUrl??'',cacNumber:profile.cacNumber??'',cacDocumentUrl:profile.cacDocumentUrl??'',latitude:profile.latitude===null?undefined:Number(profile.latitude),longitude:profile.longitude===null?undefined:Number(profile.longitude),termsAccepted:false});}},[profile]);
  const set=<K extends keyof Form>(key:K,value:Form[K])=>setForm(current=>({...current,[key]:value}));
  const updateHour=(dayOfWeek:number,patch:Partial<OperatingHour>)=>setForm(current=>({...current,operatingHours:current.operatingHours.map(hour=>hour.dayOfWeek===dayOfWeek?{...hour,...patch}:hour)}));
  const selectedHour=form.operatingHours.find(hour=>hour.dayOfWeek===selectedDay)??{dayOfWeek:selectedDay,isClosed:false,openingTime:'09:00',closingTime:'21:00'};
  const openDays=form.operatingHours.filter(hour=>!hour.isClosed).length;
  const hoursComplete=form.operatingHours.length===7&&form.operatingHours.every(hour=>hour.isClosed||Boolean(hour.openingTime&&hour.closingTime&&/^([01]\d|2[0-3]):[0-5]\d$/.test(hour.openingTime)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(hour.closingTime)));
  const completedSections=[Boolean(form.name.trim()&&form.ownerName.trim()&&form.contactPhone.trim()),Boolean(form.address.trim()&&form.latitude!==undefined&&form.longitude!==undefined),hoursComplete].filter(Boolean).length;

  const pickImage=async(kind:'logo'|'cover')=>{
    setError('');
    try{
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted)throw new Error('Allow photo library access to choose a store image.');
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:kind==='logo'?[1,1]:[16,9],quality:0.82});
      if(result.canceled)return;
      const asset=result.assets[0];if(!asset)return;
      setMediaBusy(kind);
      const signature=await api.post<UploadSignature>('/vendor/media/sign',{},token);
      const data=createUploadFormData();
      await appendMediaAsset(data,asset,`${kind}-${Date.now()}.jpg`);
      data.append('api_key',signature.apiKey);data.append('timestamp',String(signature.timestamp));data.append('folder',signature.folder);data.append('signature',signature.signature);
      const response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/image/upload`,{method:'POST',body:data});
      const uploaded=await response.json().catch(()=>null) as {secure_url?:string;error?:{message?:string}}|null;
      if(!response.ok||!uploaded?.secure_url)throw new Error(uploaded?.error?.message??'Could not upload this image. Try another photo.');
      set(kind==='logo'?'logoUrl':'coverImageUrl',uploaded.secure_url);
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not choose or upload the image.');}
    finally{setMediaBusy(null);}
  };

  const save=async()=>{
    if(!form.name.trim()||!form.ownerName.trim()||!form.contactPhone.trim()||!form.address.trim()){setError('Store name, owner, phone, and address are required.');return;}
    if(form.operatingHours.some(hour=>!hour.isClosed&&(!hour.openingTime||!hour.closingTime||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hour.openingTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hour.closingTime)))){setError('Enter valid opening and closing times in 24-hour format for each open day.');return;}
    if(mediaBusy){setError('Wait for the image upload to finish.');return;}
    if((form.latitude===undefined)!==(form.longitude===undefined)){setError('Use the location button to add a complete map pin.');return;}
    if(!authorized&&!form.termsAccepted){setError('Accept the vendor terms before submitting.');return;}
    setBusy(true);setError('');
    try{
      const body={...form,name:form.name.trim(),ownerName:form.ownerName.trim(),contactPhone:form.contactPhone.trim(),address:form.address.trim(),description:form.description.trim(),operatingHours:form.operatingHours,logoUrl:form.logoUrl||null,coverImageUrl:form.coverImageUrl||null,cacNumber:form.cacNumber.trim()||null,cacDocumentUrl:form.cacDocumentUrl.trim()||null,termsAccepted:true};
      if(authorized)await api.put('/vendor/profile',body,token);else{await api.post('/vendors/onboarding',body,token);onAuthorized();}
      const latest=await api.get<VendorProfile>('/vendor/profile',token);onSaved(latest);
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not save your store details.');}
    finally{setBusy(false);}
  };

  return <View style={s.form}>
    <View style={s.hero}>
      <View pointerEvents="none" style={s.heroGlow}/>
      <View style={s.heroTop}><View style={s.heroIcon}><Ionicons name="storefront-outline" size={22} color="white"/></View><Text style={s.heroEyebrow}>{authorized?'STORE PROFILE':'VENDOR APPLICATION'}</Text></View>
      <Text style={s.heroTitle}>{authorized?'Your store details':'Bring your store to Smile'}</Text>
      <Text style={s.heroCopy}>A complete profile helps customers discover and trust your business.</Text>
      <View style={s.progressTrack}><View style={[s.progressFill,{width:`${completedSections/3*100}%`}]}/></View>
      <Text style={s.progressText}>{completedSections} of 3 essential sections complete</Text>
    </View>

    <View style={s.sectionCard}>
      <SectionHeading number="01" icon="storefront-outline" title="Business details" detail="Your name, contact, and the best place to find you." colors={colors}/>
      <FormField label="Store name" value={form.name} onChangeText={value=>set('name',value)} placeholder="e.g. Mama T's Kitchen" dark={colors.isDark} style={s.fieldInput}/>
      <FormField label="Owner name" value={form.ownerName} onChangeText={value=>set('ownerName',value)} placeholder="Full name" dark={colors.isDark} style={s.fieldInput}/>
      <FormField label="Store phone" value={form.contactPhone} onChangeText={value=>set('contactPhone',value)} placeholder="+234…" keyboardType="phone-pad" dark={colors.isDark} style={s.fieldInput}/>
      <View style={s.addressGroup}>
        <View style={s.addressTitleRow}><Text style={s.fieldLabel}>Business address</Text>{form.latitude!==undefined&&<View style={s.pinBadge}><Ionicons name="checkmark-circle-outline" size={13} color={colors.green}/><Text style={s.pinBadgeText}>PIN SET</Text></View>}</View>
        <Pressable accessibilityRole="button" onPress={()=>{setError('');setLocationOpen(true);}} style={s.locationButton}>
          <View style={s.locationIcon}><Ionicons name="location-outline" size={19} color={colors.green}/></View>
          <View style={s.locationCopy}><Text numberOfLines={2} style={s.locationText}>{form.address||'Search for an address or select a point on the map'}</Text><Text style={s.locationHelper}>{form.latitude===undefined?'Address and map pin':'Tap to update address or map pin'}</Text></View>
          <View style={s.locationArrow}><Ionicons name="chevron-forward" size={17} color={colors.muted}/></View>
        </Pressable>
      </View>
    </View>

    <View style={s.sectionCard}>
      <SectionHeading number="02" icon="time-outline" title="Weekly hours" detail="Set opening and closing times for each day." colors={colors}/>
      <View style={s.weekSummary}>
        <View style={s.weekSummaryIcon}><Ionicons name="time-outline" size={19} color={colors.green}/></View>
        <View style={s.weekSummaryCopy}><Text style={s.weekSummaryTitle}>{openDays} days open</Text><Text style={s.weekSummaryDetail}>Choose a day to set its hours</Text></View>
        <Pressable accessibilityRole="button" onPress={()=>setHoursOpen(true)} style={s.editHoursButton}><Text style={s.editHoursText}>Edit</Text><Ionicons name="chevron-forward" size={15} color={colors.green}/></Pressable>
      </View>
      <View style={s.weekDots}>{form.operatingHours.slice().sort((a,b)=>a.dayOfWeek-b.dayOfWeek).map(hour=><View key={hour.dayOfWeek} style={s.weekDotItem}><Text style={s.weekDotLabel}>{dayNames[hour.dayOfWeek].slice(0,1)}</Text><View style={[s.weekDot,hour.isClosed&&s.weekDotClosed]}/></View>)}</View>
    </View>

    <View style={s.sectionCard}>
      <SectionHeading number="03" icon="image-outline" title="Store story & photos" detail="Show customers what makes your business special." colors={colors}/>
      <FormField label="Store description" value={form.description} onChangeText={value=>set('description',value)} placeholder="Share a little about your food and your story…" multiline dark={colors.isDark} style={s.descriptionInput}/>
      <StoreMediaPicker variant="logo" label="Store logo" helper="A clear square image works best" uri={form.logoUrl} busy={mediaBusy==='logo'} colors={colors} onPick={()=>void pickImage('logo')} onRemove={()=>set('logoUrl','')}/>
      <StoreMediaPicker variant="cover" label="Cover image" helper="Choose a wide photo of your store or food" uri={form.coverImageUrl} busy={mediaBusy==='cover'} colors={colors} onPick={()=>void pickImage('cover')} onRemove={()=>set('coverImageUrl','')}/>
    </View>

    <View style={s.optionalCard}>
      <SectionHeading number="+" icon="clipboard-list-outline" title="Business registration" detail="CAC information is optional and can be added later." colors={colors}/>
      <FormField label="CAC registration number" value={form.cacNumber} onChangeText={value=>set('cacNumber',value)} placeholder="RC…" dark={colors.isDark} style={s.fieldInput}/>
      <FormField label="CAC document URL" value={form.cacDocumentUrl} onChangeText={value=>set('cacDocumentUrl',value)} placeholder="Private document link" keyboardType="url" dark={colors.isDark} style={s.fieldInput}/>
    </View>

    {!authorized&&<Pressable accessibilityRole="checkbox" accessibilityState={{checked:form.termsAccepted}} style={s.terms} onPress={()=>set('termsAccepted',!form.termsAccepted)}><View style={[s.checkbox,form.termsAccepted&&s.checkboxChecked]}>{form.termsAccepted&&<Ionicons name="checkmark" size={13} color="white"/>}</View><Text style={s.termsText}>I accept the vendor terms</Text></Pressable>}
    {error?<View accessibilityRole="alert" style={s.errorBox}><Ionicons name="alert-circle-outline" size={18} color={colors.isDark?'#f0877a':'#a44232'}/><Text style={s.error}>{error}</Text></View>:null}
    <PrimaryButton title={busy?'Saving…':authorized?'Save store details':'Submit store for review'} disabled={busy||Boolean(mediaBusy)} onPress={()=>void save()} style={s.submitButton}/>
    {onCancel&&<PrimaryButton title="Cancel" secondary onPress={onCancel} style={s.cancelButton}/>}
    <Modal visible={hoursOpen} transparent animationType="slide" onRequestClose={()=>setHoursOpen(false)}>
      <View style={s.hoursOverlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close weekly hours" onPress={()=>setHoursOpen(false)} style={s.hoursBackdrop}/>
        <View style={s.hoursSheet}>
          <View style={s.sheetHandle}/>
          <View style={s.sheetHeader}>
            <View style={s.sheetTitleCopy}><Text style={s.sheetEyebrow}>STORE SCHEDULE</Text><Text style={s.sheetTitle}>Weekly hours</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close weekly hours" onPress={()=>setHoursOpen(false)} style={s.sheetClose}><Ionicons name="close" size={20} color={colors.ink}/></Pressable>
          </View>
          <Text style={s.sheetPrompt}>Choose a day to edit its hours</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayChoices}>
            {dayNames.map((day,index)=><Pressable key={day} accessibilityRole="button" accessibilityState={{selected:selectedDay===index}} onPress={()=>setSelectedDay(index)} style={[s.dayChoice,selectedDay===index&&s.dayChoiceSelected]}>
              <Text style={[s.dayChoiceLabel,selectedDay===index&&s.dayChoiceLabelSelected]}>{day.slice(0,3)}</Text><View style={[s.choiceDot,form.operatingHours.find(hour=>hour.dayOfWeek===index)?.isClosed&&s.choiceDotClosed]}/>
            </Pressable>)}
          </ScrollView>
          <View style={s.selectedDayCard}>
            <View style={s.selectedDayHeading}><View style={s.selectedDayCopy}><Text style={s.selectedDayName}>{dayNames[selectedDay]}</Text><Text style={s.selectedDayHint}>{selectedHour.isClosed?'Unavailable for orders':'Available for orders'}</Text></View>
              <Pressable accessibilityRole="switch" accessibilityState={{checked:selectedHour.isClosed}} onPress={()=>updateHour(selectedDay,{isClosed:!selectedHour.isClosed,openingTime:selectedHour.isClosed?'09:00':null,closingTime:selectedHour.isClosed?'21:00':null})} style={[s.dayToggle,selectedHour.isClosed&&s.dayToggleClosed]}><Text style={[s.dayToggleText,selectedHour.isClosed&&s.dayToggleTextClosed]}>{selectedHour.isClosed?'Closed':'Open'}</Text></Pressable>
            </View>
            {!selectedHour.isClosed&&<View style={s.hoursRow}>
              <FormField label="OPENS AT" value={selectedHour.openingTime??''} onChangeText={value=>updateHour(selectedDay,{openingTime:value})} placeholder="09:00" keyboardType="numbers-and-punctuation" maxLength={5} dark={colors.isDark} style={s.timeInput}/>
              <FormField label="CLOSES AT" value={selectedHour.closingTime??''} onChangeText={value=>updateHour(selectedDay,{closingTime:value})} placeholder="21:00" keyboardType="numbers-and-punctuation" maxLength={5} dark={colors.isDark} style={s.timeInput}/>
            </View>}
            {!selectedHour.isClosed&&<Text style={s.timeHint}>Use 24-hour time, for example 09:00.</Text>}
          </View>
          <PrimaryButton title="Done" onPress={()=>setHoursOpen(false)} style={s.doneHoursButton}/>
        </View>
      </View>
    </Modal>
    <VendorStoreLocationModal visible={locationOpen} token={token} address={form.address} point={form.latitude===undefined||form.longitude===undefined?null:{latitude:form.latitude,longitude:form.longitude}} colors={colors} onClose={()=>setLocationOpen(false)} onSelect={(address,point)=>{setForm(current=>({...current,address,latitude:point.latitude,longitude:point.longitude}));setLocationOpen(false);}}/>
  </View>;
}
function SectionHeading({number,icon,title,detail,colors}:{number:string;icon:string;title:string;detail:string;colors:AppColors}){
  const s=styles(colors);
  return <View style={s.sectionHeading}>
    <View style={s.sectionIcon}><Ionicons name={icon} size={19} color={colors.green}/></View>
    <View style={s.sectionCopy}>
      <View style={s.sectionTitleRow}><Text style={s.sectionNumber}>{number}</Text><Text style={s.sectionTitle}>{title}</Text></View>
      <Text style={s.sectionDetail}>{detail}</Text>
    </View>
  </View>;
}

const styles=(c:AppColors)=>{
  const fieldSurface=c.isDark?c.cream:'#f2f6f4';
  return StyleSheet.create({
  form:{gap:vendorSpace.md},
  hero:{position:'relative',overflow:'hidden',padding:vendorSpace.lg,borderRadius:vendorRadius.xl,backgroundColor:c.isDark?'#194c3a':c.green},
  heroGlow:{position:'absolute',top:-70,right:-40,width:190,height:190,borderRadius:95,backgroundColor:'rgba(255,255,255,.08)'},
  heroTop:{flexDirection:'row',alignItems:'center',gap:10},
  heroIcon:{width:40,height:40,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.md,backgroundColor:'rgba(255,255,255,.14)'},
  heroEyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.2,color:'#d8e9df'},
  heroTitle:{marginTop:vendorSpace.md,fontSize:24,lineHeight:30,fontWeight:'900',letterSpacing:-.5,color:'#fff'},
  heroCopy:{maxWidth:300,marginTop:5,fontSize:12,lineHeight:18,color:'#d8e9df'},
  progressTrack:{height:5,overflow:'hidden',marginTop:vendorSpace.lg,borderRadius:vendorRadius.pill,backgroundColor:'rgba(255,255,255,.2)'},
  progressFill:{height:'100%',borderRadius:vendorRadius.pill,backgroundColor:'#b9e6c6'},
  progressText:{marginTop:7,fontSize:10,fontWeight:'800',color:'#e4eee5'},
  sectionCard:{padding:vendorSpace.md,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.xl,backgroundColor:c.card},
  optionalCard:{padding:vendorSpace.md,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.xl,backgroundColor:fieldSurface},
  sectionHeading:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:vendorSpace.sm},
  sectionIcon:{width:40,height:40,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.md,backgroundColor:c.mint},
  sectionCopy:{flex:1,gap:3},
  sectionTitleRow:{flexDirection:'row',alignItems:'center',gap:6},
  sectionNumber:{fontSize:9,fontWeight:'900',letterSpacing:.5,color:c.green},
  sectionTitle:{fontSize:14,fontWeight:'900',color:c.ink},
  sectionDetail:{fontSize:10,lineHeight:15,color:c.muted},
  fieldInput:{height:50,borderRadius:vendorRadius.md,borderColor:c.line,backgroundColor:fieldSurface,fontSize:13,color:c.ink},
  descriptionInput:{minHeight:92,height:'auto',textAlignVertical:'top',paddingTop:13,borderRadius:vendorRadius.md,borderColor:c.line,backgroundColor:fieldSurface,fontSize:13,color:c.ink},
  fieldLabel:{fontSize:12,fontWeight:'800',color:c.ink},
  addressGroup:{marginTop:vendorSpace.md},
  addressTitleRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:7},
  pinBadge:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:4,borderRadius:vendorRadius.pill,backgroundColor:c.mint},
  pinBadgeText:{fontSize:8,fontWeight:'900',letterSpacing:.4,color:c.green},
  locationButton:{minHeight:70,flexDirection:'row',alignItems:'center',gap:10,padding:10,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.md,backgroundColor:fieldSurface},
  locationIcon:{width:38,height:38,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.sm,backgroundColor:c.card},
  locationCopy:{flex:1,gap:3},
  locationText:{fontSize:11,lineHeight:16,fontWeight:'800',color:c.ink},
  locationHelper:{fontSize:9,color:c.muted},
  locationArrow:{width:28,height:28,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.pill,backgroundColor:c.card},
  weekSummary:{minHeight:64,flexDirection:'row',alignItems:'center',gap:10,padding:10,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.md,backgroundColor:c.card},
  weekSummaryIcon:{width:38,height:38,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.sm,backgroundColor:c.mint},
  weekSummaryCopy:{flex:1,gap:3},
  weekSummaryTitle:{fontSize:12,fontWeight:'900',color:c.ink},
  weekSummaryDetail:{fontSize:10,color:c.muted},
  editHoursButton:{minHeight:34,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:9,borderRadius:vendorRadius.sm,backgroundColor:c.mint},
  editHoursText:{fontSize:10,fontWeight:'900',color:c.green},
  weekDots:{flexDirection:'row',justifyContent:'space-between',marginTop:12,paddingHorizontal:5},
  weekDotItem:{alignItems:'center',gap:5},
  weekDotLabel:{fontSize:9,fontWeight:'800',color:c.muted},
  weekDot:{width:7,height:7,borderRadius:4,backgroundColor:c.green},
  weekDotClosed:{backgroundColor:c.line},
  hoursOverlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(5,15,10,.52)'},
  hoursBackdrop:{position:'absolute',top:0,right:0,bottom:0,left:0},
  hoursSheet:{paddingHorizontal:vendorSpace.lg,paddingTop:10,paddingBottom:vendorSpace.xl,borderTopLeftRadius:vendorRadius.xl,borderTopRightRadius:vendorRadius.xl,backgroundColor:c.paper},
  sheetHandle:{width:38,height:4,alignSelf:'center',marginBottom:vendorSpace.md,borderRadius:vendorRadius.pill,backgroundColor:c.line},
  sheetHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  sheetTitleCopy:{gap:3},
  sheetEyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.1,color:c.green},
  sheetTitle:{fontSize:21,fontWeight:'900',letterSpacing:-.3,color:c.ink},
  sheetClose:{width:38,height:38,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.md,backgroundColor:c.card,borderWidth:1,borderColor:c.line},
  sheetPrompt:{marginTop:vendorSpace.md,fontSize:11,fontWeight:'700',color:c.muted},
  dayChoices:{gap:8,paddingVertical:10},
  dayChoice:{minWidth:42,minHeight:50,alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:7,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.md,backgroundColor:c.card},
  dayChoiceSelected:{borderColor:c.green,backgroundColor:c.mint},
  dayChoiceLabel:{fontSize:10,fontWeight:'800',color:c.muted},
  dayChoiceLabelSelected:{color:c.green},
  choiceDot:{width:6,height:6,borderRadius:3,backgroundColor:c.green},
  choiceDotClosed:{backgroundColor:c.line},
  selectedDayCard:{marginTop:vendorSpace.sm,padding:vendorSpace.md,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.card},
  selectedDayHeading:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:vendorSpace.sm},
  selectedDayCopy:{gap:3},
  selectedDayName:{fontSize:15,fontWeight:'900',color:c.ink},
  selectedDayHint:{fontSize:10,color:c.muted},
  dayToggle:{paddingHorizontal:11,paddingVertical:7,borderRadius:vendorRadius.pill,backgroundColor:c.mint},
  dayToggleClosed:{backgroundColor:c.line},
  dayToggleText:{fontSize:10,fontWeight:'900',color:c.green},
  dayToggleTextClosed:{color:c.muted},
  hoursRow:{flexDirection:'row',gap:vendorSpace.sm},
  timeInput:{height:44,borderRadius:vendorRadius.md,borderColor:c.line,backgroundColor:c.paper,fontSize:14,fontWeight:'800',color:c.ink,textAlign:'center'},
  timeHint:{marginTop:8,fontSize:9,color:c.muted},
  doneHoursButton:{minHeight:48,marginTop:vendorSpace.md,borderRadius:vendorRadius.md},
  terms:{minHeight:48,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.md,backgroundColor:c.card},
  checkbox:{width:21,height:21,alignItems:'center',justifyContent:'center',borderWidth:1.5,borderColor:c.line,borderRadius:6,backgroundColor:c.card},
  checkboxChecked:{borderColor:c.green,backgroundColor:c.green},
  termsText:{fontSize:11,fontWeight:'700',color:c.ink},
  errorBox:{flexDirection:'row',alignItems:'flex-start',gap:8,padding:12,borderWidth:1,borderColor:c.isDark?'#75423b':'#f0c3ba',borderRadius:vendorRadius.md,backgroundColor:c.isDark?'#392a27':'#fff3ef'},
  error:{flex:1,color:c.isDark?'#f0877a':'#a44232',fontSize:11,lineHeight:16},
  submitButton:{minHeight:52,marginTop:vendorSpace.xs,borderRadius:vendorRadius.md},
  cancelButton:{minHeight:46,borderRadius:vendorRadius.md},
  });
};
