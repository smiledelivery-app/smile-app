import { AppText as Text } from '@makanza/mobile-ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { Session } from '@makanza/mobile-core';
import { api } from '../services/api';
import { Ionicons } from '../components/AppIcon';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import type { AppColors } from '../theme/colors';
import { uploadMediaAsset } from '../utils/upload-media';
import { vendorRadius, vendorSpace, vendorType } from '../theme/vendor';

type Page='main'|'edit'|'addresses'|'favorites'|'password'|'settings'|'help'|'about'|'privacy'|'delete'|'application';
type Address={id:string;label:string;line1:string;city:string};
type BankOption={name:string;code:string};
type RiderApplicationDraft={dateOfBirth:string;nin:string;ninDocumentPublicId:string;ninDocumentVersion:string;ninDocumentName:string;profileImagePublicId:string;profileImageUrl:string;plateNumber:string;residentialAddress:string;guarantorName:string;guarantorNin:string;guarantorAddress:string;accountNumber:string;bankCode:string};
const dateFromInput=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const [year,month,day]=value.split('-').map(Number);const date=new Date(year,month-1,day);return date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day?null:date;};
const dateInputValue=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export default function RiderProfileScreen(p:{token:string;user:Session['user'];colors:AppColors;dark:boolean;busy:string;autoRefresh:boolean;newsletter:boolean;status:string;applicationError:string;applicationNotice:string;profileImageUrl?:string|null;vehicleType:string;serviceArea:string;termsAccepted:boolean;riderApplication:RiderApplicationDraft;onRiderApplicationChange:(key:keyof RiderApplicationDraft,value:string)=>void;locationSharing:boolean;onTheme:()=>void;onAutoRefresh:(v:boolean)=>void;onNewsletter:(v:boolean)=>void;onSignOut:()=>void;onAccountDeleted:()=>void;onVehicle:(v:string)=>void;onArea:(v:string)=>void;onTerms:()=>void;onApply:()=>void;onProfileSaved:(name:string,phone:string)=>void}){
  const [page,setPage]=useState<Page>('main');const [name,setName]=useState(p.user.name);const [phone,setPhone]=useState(p.user.phone??'');const [currentPassword,setCurrentPassword]=useState('');const [newPassword,setNewPassword]=useState('');const [addresses,setAddresses]=useState<Address[]>([]);const [label,setLabel]=useState('');const [line1,setLine1]=useState('');const [city,setCity]=useState('');const [loading,setLoading]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [banks,setBanks]=useState<BankOption[]>([]);const [bankPicker,setBankPicker]=useState(false);const [bankSearch,setBankSearch]=useState('');const [datePicker,setDatePicker]=useState(false);const [datePickerView,setDatePickerView]=useState<'days'|'months'|'years'>('days');const [yearSearch,setYearSearch]=useState('');const [calendarMonth,setCalendarMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));const [documentBusy,setDocumentBusy]=useState(false);const insets=useSafeAreaInsets();const c=p.colors;const s={...styles(c),
    screen:{width:'100%' as const,flex:1,backgroundColor:c.paper},
    fixedHeader:{width:'100%' as const,paddingHorizontal:vendorSpace.lg,paddingTop:vendorSpace.md,paddingBottom:vendorSpace.sm,backgroundColor:c.paper},
    content:{width:'100%' as const,paddingHorizontal:vendorSpace.lg,paddingTop:vendorSpace.xs,paddingBottom:vendorSpace.xxl,alignItems:'stretch' as const},
    back:{alignSelf:'flex-start' as const,flexDirection:'row' as const,alignItems:'center' as const,gap:4,paddingHorizontal:12,paddingVertical:8,marginBottom:vendorSpace.md,borderRadius:vendorRadius.pill,backgroundColor:c.cream},
    backText:{fontSize:12,fontWeight:'800' as const,color:c.green},
    eyebrow:{fontSize:vendorType.label,fontWeight:'900' as const,letterSpacing:1.1,color:c.green},
    title:{fontSize:vendorType.display,fontWeight:'900' as const,letterSpacing:-.6,color:c.ink,marginTop:4},
    headerSubtitle:{fontSize:12,lineHeight:18,color:c.muted,marginTop:4},
    identity:{width:'100%' as const,alignSelf:'stretch' as const,padding:vendorSpace.md,marginTop:vendorSpace.sm,borderRadius:vendorRadius.xl,borderWidth:1,borderColor:c.line,backgroundColor:c.card},
    identityTop:{flexDirection:'row' as const,alignItems:'center' as const,gap:12},
    avatar:{width:58,height:58,borderRadius:vendorRadius.lg,alignItems:'center' as const,justifyContent:'center' as const,backgroundColor:c.green,overflow:'hidden' as const},
    avatarImage:{width:'100%' as const,height:'100%' as const},
    avatarText:{fontSize:24,fontWeight:'900' as const,color:'white'},
    identityNameBlock:{flex:1,minWidth:0},
    name:{fontSize:17,fontWeight:'900' as const,color:c.ink},
    identityRole:{fontSize:11,fontWeight:'700' as const,color:c.muted,marginTop:4},
    riderStatus:{flexDirection:'row' as const,alignItems:'center' as const,gap:5,paddingHorizontal:8,paddingVertical:6,borderRadius:vendorRadius.pill},
    riderStatusGood:{backgroundColor:c.mint},
    riderStatusPending:{backgroundColor:c.cream},
    statusDot:{width:6,height:6,borderRadius:3},
    statusDotGood:{backgroundColor:c.green},
    statusDotPending:{backgroundColor:'#ba8b33'},
    riderStatusText:{fontSize:8,fontWeight:'900' as const},
    riderStatusTextGood:{color:c.green},
    riderStatusTextPending:{color:'#8a6723'},
    identityDivider:{height:1,backgroundColor:c.line,marginVertical:vendorSpace.md},
    identityContact:{flexDirection:'row' as const,alignItems:'center' as const,gap:9,marginTop:8},
    contactIcon:{width:29,height:29,borderRadius:vendorRadius.sm,alignItems:'center' as const,justifyContent:'center' as const,backgroundColor:c.cream},
    identityContactText:{flex:1,fontSize:12,fontWeight:'700' as const,color:c.ink},
    editProfile:{width:'100%' as const,minHeight:40,flexDirection:'row' as const,alignItems:'center' as const,justifyContent:'space-between' as const,paddingHorizontal:12,marginTop:vendorSpace.md,borderRadius:vendorRadius.md,backgroundColor:c.mint},
    editProfileText:{fontSize:11,fontWeight:'900' as const,color:c.green},
    section:{fontSize:10,fontWeight:'900' as const,letterSpacing:1.1,color:c.muted,marginTop:vendorSpace.xl,marginBottom:vendorSpace.sm},
    group:{width:'100%' as const,gap:8},
    row:{width:'100%' as const,minHeight:70,flexDirection:'row' as const,alignItems:'center' as const,gap:11,padding:11,borderRadius:vendorRadius.lg,borderWidth:1,borderColor:c.line,backgroundColor:c.card},
    rowIcon:{width:40,height:40,borderRadius:vendorRadius.md,alignItems:'center' as const,justifyContent:'center' as const,backgroundColor:c.cream},
    rowCopy:{flex:1,minWidth:0},
    rowText:{fontSize:12,fontWeight:'900' as const,color:c.ink},
    rowDetail:{fontSize:10,lineHeight:15,color:c.muted,marginTop:3},
    rowArrow:{width:29,height:29,borderRadius:vendorRadius.pill,alignItems:'center' as const,justifyContent:'center' as const,backgroundColor:c.cream},
    summary:{width:'100%' as const,flexDirection:'row' as const,alignItems:'center' as const,gap:11,padding:13,marginTop:vendorSpace.md,borderRadius:vendorRadius.lg,borderWidth:1,borderColor:c.line,backgroundColor:c.card},
    summaryIcon:{width:39,height:39,borderRadius:vendorRadius.md,alignItems:'center' as const,justifyContent:'center' as const,backgroundColor:c.mint},
    summaryCopy:{flex:1},
    summaryTitle:{fontSize:12,fontWeight:'900' as const,color:c.ink},
    summaryDetail:{fontSize:10,color:c.muted,marginTop:4},
    locationIndicator:{width:9,height:9,borderRadius:5,backgroundColor:c.line},
    locationIndicatorOn:{backgroundColor:c.green},
    deleteAction:{width:'100%' as const,minHeight:68,flexDirection:'row' as const,alignItems:'center' as const,gap:10,padding:11,marginTop:vendorSpace.xl,borderRadius:vendorRadius.lg,borderWidth:1,borderColor:c.isDark?'#58332d':'#f1d8d2',backgroundColor:c.isDark?'#241b19':'#fff8f6'},
    actionDangerIcon:{width:38,height:38,borderRadius:vendorRadius.md,alignItems:'center' as const,justifyContent:'center' as const,backgroundColor:c.isDark?'#392a20':'#fdf0ed'},
    deleteActionText:{fontSize:12,fontWeight:'900' as const,color:c.isDark?'#f0877a':'#a34232'},
    logout:{minHeight:50,flexDirection:'row' as const,alignItems:'center' as const,justifyContent:'center' as const,gap:9,marginTop:9,borderRadius:vendorRadius.md,borderWidth:1,borderColor:c.line,backgroundColor:c.card},
    logoutText:{fontSize:12,fontWeight:'900' as const,color:c.ink},
    version:{fontSize:9,fontWeight:'800' as const,letterSpacing:1,color:c.muted,textAlign:'center' as const,marginTop:vendorSpace.lg},
    copy:{fontSize:12,lineHeight:19,color:c.muted,marginBottom:6},
    readonly:{fontSize:12,color:c.muted,padding:12,marginTop:8,borderRadius:vendorRadius.md,backgroundColor:c.cream},
    button:{marginTop:vendorSpace.md},
    uploadBox:{width:'100%' as const,padding:vendorSpace.md,marginTop:vendorSpace.md,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.card},
    applicationHero:{width:'100%' as const,flexDirection:'row' as const,alignItems:'center' as const,gap:12,padding:vendorSpace.md,marginTop:vendorSpace.sm,borderRadius:vendorRadius.xl,backgroundColor:c.isDark?'#194c3a':c.green},
    applicationHeroIcon:{width:44,height:44,alignItems:'center' as const,justifyContent:'center' as const,borderRadius:vendorRadius.md,backgroundColor:'rgba(255,255,255,.14)'},
    applicationHeroCopy:{flex:1},
    applicationHeroTitle:{fontSize:14,fontWeight:'900' as const,color:'white'},
    applicationHeroText:{fontSize:10,lineHeight:15,color:'rgba(255,255,255,.78)',marginTop:4},
    applicationSection:{width:'100%' as const,padding:vendorSpace.md,marginTop:vendorSpace.md,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.card},
    photoUpload:{width:'100%' as const,flexDirection:'row' as const,alignItems:'center' as const,gap:13,padding:vendorSpace.md,marginTop:vendorSpace.md,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.card},
    photoPlaceholder:{width:64,height:64,alignItems:'center' as const,justifyContent:'center' as const,borderRadius:vendorRadius.lg,backgroundColor:c.mint,overflow:'hidden' as const},
    photoCopy:{flex:1},
    photoTitle:{fontSize:12,fontWeight:'900' as const,color:c.ink},
    photoDetail:{fontSize:10,lineHeight:15,color:c.muted,marginTop:4},
    photoAction:{minHeight:36,justifyContent:'center' as const,paddingHorizontal:11,borderWidth:1,borderColor:c.green,borderRadius:vendorRadius.pill},
    photoActionText:{fontSize:10,fontWeight:'900' as const,color:c.green},
    vehicleChoices:{flexDirection:'row' as const,flexWrap:'wrap' as const,gap:8,marginTop:10},
    vehicleChoice:{paddingVertical:10,paddingHorizontal:13,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.pill,backgroundColor:c.card},
    vehicleChoiceSelected:{borderColor:c.green,backgroundColor:c.mint},
    vehicleChoiceText:{fontSize:11,fontWeight:'800' as const,color:c.ink},
    vehicleChoiceTextSelected:{color:c.green},
    bankSelect:{width:'100%' as const,minHeight:50,marginTop:12,paddingHorizontal:13,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.sm,backgroundColor:c.card,flexDirection:'row' as const,alignItems:'center' as const,justifyContent:'space-between' as const},
    bankSelectText:{fontSize:12,fontWeight:'700' as const,color:c.ink},
    modalBackdrop:{flex:1,justifyContent:'flex-end' as const,backgroundColor:'rgba(0,0,0,.42)'},
    modal:{maxHeight:'82%' as const,padding:vendorSpace.lg,paddingBottom:vendorSpace.xl,backgroundColor:c.paper,borderTopLeftRadius:vendorRadius.xl,borderTopRightRadius:vendorRadius.xl},
    modalHead:{flexDirection:'row' as const,alignItems:'center' as const,justifyContent:'space-between' as const,gap:12,marginBottom:12},
    modalTitle:{fontSize:18,fontWeight:'900' as const,color:c.ink},
    dateField:{width:'100%' as const,minHeight:51,marginTop:12,paddingHorizontal:14,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.sm,backgroundColor:c.card,flexDirection:'row' as const,alignItems:'center' as const,justifyContent:'space-between' as const},
    dateFieldText:{fontSize:14,color:c.ink},
    calendarWeek:{width:'100%' as const,flexDirection:'row' as const,justifyContent:'space-around' as const,marginTop:8},
    calendarWeekday:{width:'13%' as const,textAlign:'center' as const,fontSize:11,fontWeight:'800' as const,color:c.muted},
    calendarGrid:{width:'100%' as const,flexDirection:'row' as const,flexWrap:'wrap' as const,justifyContent:'flex-start' as const},
    calendarDay:{width:'14.28%' as const,height:44,alignItems:'center' as const,justifyContent:'center' as const,borderRadius:vendorRadius.pill},
    calendarDayText:{fontSize:13,fontWeight:'700' as const,color:c.ink},
    calendarDaySelected:{backgroundColor:c.green},
    calendarDaySelectedText:{color:'white'},
    calendarDayDisabled:{opacity:.35},
    calendarActions:{flexDirection:'row' as const,justifyContent:'flex-end' as const,marginTop:8},
    calendarActionText:{paddingHorizontal:14,paddingVertical:10,fontSize:13,fontWeight:'800' as const,color:c.green},
    calendarPeriodHeader:{flexDirection:'row' as const,justifyContent:'space-between' as const,alignItems:'center' as const,gap:6,marginVertical:8},
    calendarPeriodControls:{flexDirection:'row' as const,alignItems:'center' as const,gap:6},
    calendarPeriodButton:{paddingHorizontal:12,paddingVertical:8,borderRadius:vendorRadius.pill,backgroundColor:c.cream},
    calendarPeriodButtonActive:{backgroundColor:c.mint},
    calendarPeriodText:{fontSize:14,fontWeight:'900' as const,color:c.ink},
    calendarPeriodTextActive:{color:c.green},
    calendarPeriodGrid:{width:'100%' as const,flexDirection:'row' as const,flexWrap:'wrap' as const,justifyContent:'flex-start' as const},
    calendarMonthOption:{width:'33.33%' as const,minHeight:52,alignItems:'center' as const,justifyContent:'center' as const,borderRadius:vendorRadius.md},
    calendarYearOption:{width:'33.33%' as const,minHeight:46,alignItems:'center' as const,justifyContent:'center' as const,borderRadius:vendorRadius.md},
    calendarPeriodOptionSelected:{backgroundColor:c.mint},
    calendarPeriodOptionText:{fontSize:13,fontWeight:'800' as const,color:c.ink},
    calendarPeriodOptionTextSelected:{color:c.green},
    calendarYearList:{maxHeight:300},
    bankSearch:{minHeight:48,flexDirection:'row' as const,alignItems:'center' as const,gap:9,paddingHorizontal:13,marginBottom:8,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.sm,backgroundColor:c.card},
    bankSearchInput:{flex:1,minWidth:0,paddingVertical:10,fontSize:13,color:c.ink},
    bankOption:{minHeight:50,flexDirection:'row' as const,alignItems:'center' as const,justifyContent:'space-between' as const,borderBottomWidth:1,borderBottomColor:c.line,paddingVertical:9},
    terms:{flexDirection:'row' as const,alignItems:'center' as const,gap:9,marginTop:vendorSpace.md,padding:12,borderRadius:vendorRadius.md,backgroundColor:c.card},
    check:{fontSize:21,color:c.green},
    address:{width:'100%' as const,padding:vendorSpace.md,marginTop:8,borderRadius:vendorRadius.md,backgroundColor:c.card,borderWidth:1,borderColor:c.line},
    deleteLink:{fontSize:11,color:c.isDark?'#f0877a':'#a34232',fontWeight:'800' as const,marginTop:8},
    info:{alignItems:'center' as const,gap:8,padding:vendorSpace.xl,marginTop:vendorSpace.sm,borderRadius:vendorRadius.xl,borderWidth:1,borderColor:c.line,backgroundColor:c.card},
    setting:{width:'100%' as const,flexDirection:'row' as const,alignItems:'center' as const,padding:vendorSpace.md,borderRadius:vendorRadius.lg,borderWidth:1,borderColor:c.line,backgroundColor:c.card},
    error:{color:c.isDark?'#f0877a':'#a44232',fontSize:12,marginTop:12},
    notice:{color:c.green,fontSize:12,marginTop:12},
  };const appField=(key:keyof RiderApplicationDraft,value:string)=>p.onRiderApplicationChange(key,value);
  const openDatePicker=()=>{const selected=dateFromInput(p.riderApplication.dateOfBirth)??new Date();setCalendarMonth(new Date(selected.getFullYear(),selected.getMonth(),1));setDatePickerView('days');setYearSearch('');setDatePicker(true);};
  useEffect(()=>{if(page!=='addresses')return;setLoading(true);setError('');void api.get<Address[]>('/addresses',p.token).then(setAddresses).catch(e=>setError(e instanceof Error?e.message:'Could not load saved addresses.')).finally(()=>setLoading(false));},[page,p.token]);
  useEffect(()=>{if(page!=='application'||banks.length)return;void api.get<BankOption[]>('/rider/payout-banks',p.token).then(setBanks).catch(e=>setNotice(`${e instanceof Error?e.message:'Could not load supported banks.'} You can still submit your application and add payout details later from Wallet.`));},[page,p.token,banks.length]);
  const uploadNin=async()=>{setError('');try{const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted)throw new Error('Allow photo library access to upload your NIN copy.');const picked=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false,quality:.9});if(picked.canceled||!picked.assets[0])return;setDocumentBusy(true);const asset=picked.assets[0];const signature=await api.post<{cloudName:string;apiKey:string;timestamp:number;folder:string;signature:string;type:string;resourceType:string}>('/rider/media/sign-nin',{},p.token);const response=await uploadMediaAsset(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/${signature.resourceType}/upload`,asset,`nin-${Date.now()}.jpg`,{api_key:signature.apiKey,timestamp:String(signature.timestamp),folder:signature.folder,type:signature.type,signature:signature.signature});const result=await response.json().catch(()=>null) as {public_id?:string;version?:number;error?:{message?:string}}|null;if(!response.ok||!result?.public_id||!result.version)throw new Error(result?.error?.message??'Could not upload your NIN copy securely.');appField('ninDocumentPublicId',result.public_id);appField('ninDocumentVersion',String(result.version));appField('ninDocumentName',asset.fileName??'NIN copy uploaded');}catch(reason){setError(reason instanceof Error?reason.message:'Could not upload the NIN copy.');}finally{setDocumentBusy(false);}};
  const uploadProfileImage=async()=>{setError('');try{const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted)throw new Error('Allow photo library access to choose a profile image.');const picked=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.85});if(picked.canceled||!picked.assets[0])return;setDocumentBusy(true);const asset=picked.assets[0];const signature=await api.post<{cloudName:string;apiKey:string;timestamp:number;folder:string;signature:string}>('/rider/media/sign-profile-image',{},p.token);const response=await uploadMediaAsset(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/image/upload`,asset,`rider-profile-${Date.now()}.jpg`,{api_key:signature.apiKey,timestamp:String(signature.timestamp),folder:signature.folder,signature:signature.signature});const result=await response.json().catch(()=>null) as {public_id?:string;secure_url?:string;error?:{message?:string}}|null;if(!response.ok||!result?.public_id||!result.secure_url)throw new Error(result?.error?.message??'Could not upload your rider profile image.');appField('profileImagePublicId',result.public_id);appField('profileImageUrl',result.secure_url);}catch(reason){setError(reason instanceof Error?reason.message:'Could not upload the rider profile image.');}finally{setDocumentBusy(false);}};
  const back=()=>{setError('');setNotice('');setPage('main');};
  const saveProfile=async()=>{setBusy(true);setError('');try{const saved=await api.patch<{name:string;phone:string|null}>('/auth/profile',{name:name.trim(),phone:phone.trim()||null},p.token);p.onProfileSaved(saved.name,saved.phone??'');setNotice('Profile updated.');back();}catch(e){setError(e instanceof Error?e.message:'Could not update your profile.');}finally{setBusy(false);}};
  const savePassword=async()=>{setBusy(true);setError('');try{await api.post('/auth/password',{currentPassword,newPassword},p.token);setCurrentPassword('');setNewPassword('');setNotice('Password updated.');back();}catch(e){setError(e instanceof Error?e.message:'Could not update your password.');}finally{setBusy(false);}};
  const addAddress=async()=>{setBusy(true);setError('');try{const saved=await api.post<Address>('/addresses',{label:label.trim(),line1:line1.trim(),city:city.trim()},p.token);setAddresses(current=>[saved,...current]);setLabel('');setLine1('');setCity('');}catch(e){setError(e instanceof Error?e.message:'Could not save this address.');}finally{setBusy(false);}};
  const deleteAccount=()=>{const remove=()=>{setBusy(true);setError('');void api.delete('/auth/account',p.token,{password:currentPassword}).then(p.onAccountDeleted).catch(e=>setError(e instanceof Error?e.message:'Could not delete your account.')).finally(()=>setBusy(false));};if(Platform.OS==='web'){if(window.confirm('This permanently removes your Smile account access.'))remove();return;}Alert.alert('Delete account?','This permanently removes your Smile account access.',[{text:'Cancel',style:'cancel'},{text:'Delete account',style:'destructive',onPress:remove}]);};
  const title:Record<Page,string>={main:'Your account',edit:'Edit profile',addresses:'Saved addresses',favorites:'Favourites',password:'Change password',settings:'Settings',help:'Help & support',about:'About Smile',privacy:'Privacy',delete:'Delete account',application:'Rider application'};
  const subtitles:Record<Page,string>={main:'Your rider profile, preferences, and support.',edit:'Keep your contact details current for important updates.',addresses:'Manage saved places for a smoother delivery experience.',favorites:'Your saved places will be ready when you need them.',password:'Choose a strong password to protect your account.',settings:'Personalize your Smile rider experience.',help:'Get help with your rider account and deliveries.',about:'Local delivery, powered by your community.',privacy:'Learn how your rider information is used.',delete:'Review the impact before permanently deleting your account.',application:'Manage the information used to review your rider application.'};
  const rowDetails:Partial<Record<Page,string>>={edit:'Name and contact details',application:'Identity, vehicle and payout details',addresses:'Home, work and other places',favorites:'Your saved places',password:'Update your sign-in credentials',settings:'Appearance and notifications',help:'Get help with your account',about:'Learn about Smile',privacy:'How your data is used',delete:'Permanently remove your account'};
  const row=(labelText:string,icon:string,target:Page)=> <Pressable key={target} accessibilityRole="button" onPress={()=>{setError('');setNotice('');setPage(target);}} style={s.row}><View style={s.rowIcon}><Ionicons name={icon} size={19} color={c.green}/></View><View style={s.rowCopy}><Text style={s.rowText}>{labelText}</Text><Text style={s.rowDetail}>{rowDetails[target]}</Text></View><View style={s.rowArrow}><Ionicons name="chevron-forward" size={16} color={c.muted}/></View></Pressable>;
  const applicationDob=dateFromInput(p.riderApplication.dateOfBirth);const today=new Date();today.setHours(0,0,0,0);const currentYear=today.getFullYear();
  const monthYear=calendarMonth.getFullYear();const monthIndex=calendarMonth.getMonth();const monthFirstDay=(new Date(monthYear,monthIndex,1).getDay()+6)%7;const monthDays=new Date(monthYear,monthIndex+1,0).getDate();
  const calendarDays:Array<number|null>=Array.from({length:Math.ceil((monthFirstDay+monthDays)/7)*7},(_,index)=>{const day=index-monthFirstDay+1;return day>=1&&day<=monthDays?day:null;});
  const birthYears=Array.from({length:currentYear-1900+1},(_,index)=>currentYear-index);const filteredBirthYears=birthYears.filter(year=>String(year).includes(yearSearch));
  const canSubmitApplication=!!p.termsAccepted&&['BICYCLE','MOTORCYCLE','TRICYCLE','CAR'].includes(p.vehicleType)&&p.serviceArea.trim().length>=2&&!!applicationDob&&applicationDob<=today&&/^\d{11}$/.test(p.riderApplication.nin)&&!!p.riderApplication.ninDocumentPublicId&&Number.isInteger(Number(p.riderApplication.ninDocumentVersion))&&Number(p.riderApplication.ninDocumentVersion)>0&&Number(p.riderApplication.ninDocumentVersion)<=2_147_483_647&&!!p.riderApplication.profileImagePublicId&&!!p.riderApplication.profileImageUrl&&p.riderApplication.residentialAddress.trim().length>=8&&(p.vehicleType==='BICYCLE'||p.riderApplication.plateNumber.trim().length>=3)&&p.riderApplication.guarantorName.trim().length>=2&&/^\d{11}$/.test(p.riderApplication.guarantorNin)&&p.riderApplication.guarantorAddress.trim().length>=8;
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS==='ios'?'padding':'height'}><View style={s.fixedHeader}>
    {page!=='main'&&<Pressable accessibilityRole="button" onPress={back} style={s.back}><Ionicons name="chevron-back" size={20} color={c.green}/><Text style={s.backText}>Profile</Text></Pressable>}
    <Text style={s.eyebrow}>{page==='main'?'RIDER ACCOUNT':'ACCOUNT & PREFERENCES'}</Text>
    <Text style={s.title}>{title[page]}</Text>
    <Text style={s.headerSubtitle}>{subtitles[page]}</Text>
  </View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    {page==='main'?<>
      <View style={s.identity}>
        <View style={s.identityTop}>
          <View style={s.avatar}>{p.profileImageUrl||p.riderApplication.profileImageUrl?<Image source={{uri:p.profileImageUrl||p.riderApplication.profileImageUrl}} style={s.avatarImage}/>:<Text style={s.avatarText}>{p.user.name.trim().slice(0,1).toUpperCase()}</Text>}</View>
          <View style={s.identityNameBlock}><Text numberOfLines={1} style={s.name}>{p.user.name}</Text><Text style={s.identityRole}>Smile delivery rider</Text></View>
          <View style={[s.riderStatus,p.status==='APPROVED'?s.riderStatusGood:s.riderStatusPending]}><View style={[s.statusDot,p.status==='APPROVED'?s.statusDotGood:s.statusDotPending]}/><Text style={[s.riderStatusText,p.status==='APPROVED'?s.riderStatusTextGood:s.riderStatusTextPending]}>{p.status.replaceAll('_',' ')}</Text></View>
        </View>
        <View style={s.identityDivider}/>
        <View style={s.identityContact}><View style={s.contactIcon}><Ionicons name="call-outline" size={15} color={c.green}/></View><Text style={s.identityContactText}>{p.user.phone||'Add a phone number'}</Text></View>
        <View style={s.identityContact}><View style={s.contactIcon}><Ionicons name="mail-outline" size={15} color={c.green}/></View><Text style={s.identityContactText}>{p.user.email||'No email added'}</Text></View>
        <Pressable accessibilityRole="button" onPress={()=>setPage('edit')} style={s.editProfile}><Text style={s.editProfileText}>Edit profile</Text><Ionicons name="arrow-forward" size={16} color={c.green}/></Pressable>
      </View>
      <View style={s.summary}><View style={s.summaryIcon}><Ionicons name="navigate-outline" size={19} color={c.green}/></View><View style={s.summaryCopy}><Text style={s.summaryTitle}>Location sharing</Text><Text style={s.summaryDetail}>{p.locationSharing?'Sharing while the app is open':'Not currently sharing your location'}</Text></View><View style={[s.locationIndicator,p.locationSharing&&s.locationIndicatorOn]}/></View>
      <Text style={s.section}>YOUR RIDER ACCOUNT</Text><View style={s.group}>{row('Rider application','bicycle-outline','application')}{row('Saved addresses','location-outline','addresses')}{row('Favourites','star-outline','favorites')}{row('Change password','lock-closed-outline','password')}</View>
      <Text style={s.section}>PREFERENCES & SUPPORT</Text><View style={s.group}>{row('Settings','settings-outline','settings')}{row('Help & support','help-circle-outline','help')}{row('About Smile','information-circle-outline','about')}{row('Privacy','shield-checkmark-outline','privacy')}</View>
      <Pressable accessibilityRole="button" onPress={()=>setPage('delete')} style={s.deleteAction}><View style={s.actionDangerIcon}><Ionicons name="trash-outline" size={18} color={c.isDark?'#f0877a':'#a34232'}/></View><View style={s.rowCopy}><Text style={s.deleteActionText}>Delete account</Text><Text style={s.rowDetail}>Permanently remove your Smile account</Text></View><Ionicons name="chevron-forward" size={16} color={c.muted}/></Pressable>
      <Pressable accessibilityRole="button" onPress={p.onSignOut} style={s.logout}><Ionicons name="log-out-outline" size={19} color={c.ink}/><Text style={s.logoutText}>Log out</Text></Pressable>
      <Text style={s.version}>SMILE · RIDER · VERSION 0.1.0</Text>
    </>:null}
    {page==='edit'&&<><Text style={s.copy}>Keep your contact details up to date for your rider account.</Text><FormField label="Full name" value={name} onChangeText={setName} dark={c.isDark}/><FormField label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" dark={c.isDark}/><Text style={s.readonly}>Email address  ·  {p.user.email||'Not set'}</Text><PrimaryButton title={busy?'Saving…':'Save changes'} disabled={busy||name.trim().length<2} onPress={()=>void saveProfile()} style={s.button}/></>}
    {page==='application'&&<>
      <View style={s.applicationHero}>
        <View style={s.applicationHeroIcon}><Ionicons name="bicycle-outline" size={23} color="white"/></View>
        <View style={s.applicationHeroCopy}><Text style={s.applicationHeroTitle}>Become a Smile rider</Text><Text style={s.applicationHeroText}>Complete your application details for a safe, smooth review.</Text></View>
      </View>
      <Text style={[s.copy,{marginTop:vendorSpace.md}]}>Complete every field and upload both requested images. A vehicle plate is not needed for a bicycle.</Text>
      <Text style={s.section}>PROFILE PHOTO</Text>
      <View style={s.photoUpload}>
        <View style={s.photoPlaceholder}>{p.riderApplication.profileImageUrl?<Image source={{uri:p.riderApplication.profileImageUrl}} style={s.avatarImage}/>:<Ionicons name="person-outline" size={25} color={c.green}/>}</View>
        <View style={s.photoCopy}><Text style={s.photoTitle}>Profile photo — required</Text><Text style={s.photoDetail}>{p.riderApplication.profileImageUrl?'Photo added. Choose another to replace it.':'Choose a clear, recent photo of your face to submit your application.'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={p.riderApplication.profileImageUrl?'Choose a different profile photo':'Choose profile photo'} disabled={documentBusy} onPress={()=>void uploadProfileImage()} style={s.photoAction}><Text style={s.photoActionText}>{documentBusy?'Uploading…':p.riderApplication.profileImageUrl?'Change photo':'Choose photo'}</Text></Pressable>
      </View>
      <Text style={s.section}>PERSONAL DETAILS</Text>
      <View style={s.applicationSection}>
        <Text style={s.rowText}>Date of birth (required)</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={p.riderApplication.dateOfBirth?`Date of birth, ${p.riderApplication.dateOfBirth}`:'Choose date of birth'} onPress={openDatePicker} style={s.dateField}><Text style={[s.dateFieldText,!p.riderApplication.dateOfBirth&&{color:c.muted}]}>{p.riderApplication.dateOfBirth||'Choose your date of birth'}</Text><Ionicons name="calendar-outline" size={19} color={c.green}/></Pressable>
        <FormField label="Your National Identification Number (NIN) — 11 digits, required" value={p.riderApplication.nin} onChangeText={v=>appField('nin',v.replace(/\D/g,'').slice(0,11))} placeholder="Enter your 11-digit NIN" keyboardType="number-pad" maxLength={11} dark={c.isDark} style={{borderRadius:vendorRadius.sm}}/>
        <View style={s.uploadBox}><Text style={s.rowText}>NIN document copy (required)</Text><Text style={s.copy}>{p.riderApplication.ninDocumentName||'Upload a clear image of your NIN slip or card.'}</Text><PrimaryButton title={documentBusy?'Uploading securely…':p.riderApplication.ninDocumentPublicId?'Replace NIN document':'Upload NIN document'} secondary disabled={documentBusy} onPress={()=>void uploadNin()} style={s.button}/></View>
        <FormField label="Your home address — house number, street, area, and city (required)" value={p.riderApplication.residentialAddress} onChangeText={v=>appField('residentialAddress',v)} placeholder="For example, 12 Main Street, Yaba, Lagos" multiline dark={c.isDark} style={{borderRadius:vendorRadius.sm}}/>
      </View>
      <Text style={s.section}>VEHICLE & SERVICE AREA</Text>
      <View style={s.applicationSection}>
        <Text style={s.rowText}>Delivery vehicle (required)</Text>
        <View style={s.vehicleChoices}>{(['BICYCLE','MOTORCYCLE','TRICYCLE','CAR'] as const).map(vehicle=><Pressable key={vehicle} accessibilityRole="radio" accessibilityState={{selected:p.vehicleType===vehicle}} onPress={()=>p.onVehicle(vehicle)} style={[s.vehicleChoice,p.vehicleType===vehicle&&s.vehicleChoiceSelected]}><Text style={[s.vehicleChoiceText,p.vehicleType===vehicle&&s.vehicleChoiceTextSelected]}>{vehicle==='BICYCLE'?'Bicycle':vehicle==='MOTORCYCLE'?'Motorbike':vehicle==='TRICYCLE'?'Tricycle':'Car'}</Text></Pressable>)}</View>
        {p.vehicleType!==''&&p.vehicleType!=='BICYCLE'&&<FormField label="Vehicle registration plate number (required)" value={p.riderApplication.plateNumber} onChangeText={v=>appField('plateNumber',v.toUpperCase())} placeholder="For example, ABC 123 XY" autoCapitalize="characters" dark={c.isDark} style={{borderRadius:vendorRadius.sm}}/>}
        <FormField label="Preferred delivery area — neighbourhood or city (required)" value={p.serviceArea} onChangeText={p.onArea} placeholder="Where would you like to deliver? For example, Yaba, Lagos" dark={c.isDark} style={{borderRadius:vendorRadius.sm}}/>
      </View>
      <Text style={s.section}>GUARANTOR</Text>
      <View style={s.applicationSection}>
        <FormField label="Guarantor’s full legal name (required)" value={p.riderApplication.guarantorName} onChangeText={v=>appField('guarantorName',v)} placeholder="Enter their first and last name" dark={c.isDark} style={{borderRadius:vendorRadius.sm}}/>
        <FormField label="Guarantor’s National Identification Number (NIN) — 11 digits (required)" value={p.riderApplication.guarantorNin} onChangeText={v=>appField('guarantorNin',v.replace(/\D/g,'').slice(0,11))} placeholder="Enter their 11-digit NIN" keyboardType="number-pad" maxLength={11} dark={c.isDark} style={{borderRadius:vendorRadius.sm}}/>
        <FormField label="Guarantor’s home address — house number, street, area, and city (required)" value={p.riderApplication.guarantorAddress} onChangeText={v=>appField('guarantorAddress',v)} placeholder="Enter their full residential address" multiline dark={c.isDark} style={{borderRadius:vendorRadius.sm}}/>
      </View>
      <Text style={s.section}>PAYOUT ACCOUNT</Text>
      <View style={s.applicationSection}>
        <Text style={s.copy}>Optional for application. Set up and verify a bank account in Wallet before your first withdrawal. If bank verification is unavailable, you can still submit now and add it later.</Text>
        <Text style={s.rowText}>Payout bank (optional)</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={banks.find(bank=>bank.code===p.riderApplication.bankCode)?.name??'Choose payout bank'} onPress={()=>{setBankSearch('');setBankPicker(true);}} style={s.bankSelect}><Text style={[s.bankSelectText,!p.riderApplication.bankCode&&{color:c.muted}]}>{banks.find(bank=>bank.code===p.riderApplication.bankCode)?.name??'Choose your bank'}</Text><Ionicons name="chevron-down" size={18} color={c.green}/></Pressable>
        <FormField label="Payout bank account number — 10 digits (optional)" value={p.riderApplication.accountNumber} onChangeText={v=>appField('accountNumber',v.replace(/\D/g,'').slice(0,10))} placeholder="Enter the 10-digit account number" keyboardType="number-pad" maxLength={10} dark={c.isDark} style={{borderRadius:vendorRadius.sm}}/>
      </View>
      {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
      {p.applicationError?<Text accessibilityRole="alert" style={s.error}>{p.applicationError}</Text>:null}
      {p.applicationNotice?<Text style={s.notice}>{p.applicationNotice}</Text>:null}
      <Pressable style={s.terms} accessibilityRole="checkbox" accessibilityState={{checked:p.termsAccepted}} onPress={p.onTerms}><Text style={s.check}>{p.termsAccepted?'☑':'□'}</Text><Text style={s.copy}>I accept the rider terms and platform policies.</Text></Pressable>
      <PrimaryButton title={p.busy==='application'?'Submitting…':'Submit rider application'} disabled={p.busy==='application'||documentBusy||!canSubmitApplication} onPress={p.onApply} style={s.button}/>
      <Modal visible={bankPicker} transparent animationType="slide" onRequestClose={()=>setBankPicker(false)}>
        <View style={s.modalBackdrop}>
          <Pressable onPress={()=>setBankPicker(false)} style={{position:'absolute',top:0,right:0,bottom:0,left:0}}/>
          <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1,justifyContent:'flex-end'}}>
            <Pressable style={[s.modal,{maxHeight:'90%',paddingBottom:Math.max(insets.bottom+vendorSpace.lg,vendorSpace.xl)}]} onPress={event=>event.stopPropagation()}>
              <View style={s.modalHead}><Text style={s.modalTitle}>Choose commercial bank</Text><Pressable accessibilityRole="button" accessibilityLabel="Close bank selector" onPress={()=>setBankPicker(false)}><Ionicons name="close" size={22} color={c.ink}/></Pressable></View>
              <View style={s.bankSearch}><Ionicons name="search" size={18} color={c.muted}/><TextInput accessibilityLabel="Search banks" value={bankSearch} onChangeText={setBankSearch} placeholder="Search bank name or code" placeholderTextColor={c.muted} style={s.bankSearchInput}/>{bankSearch.length>0&&<Pressable accessibilityRole="button" accessibilityLabel="Clear bank search" onPress={()=>setBankSearch('')}><Ionicons name="close-circle" size={18} color={c.muted}/></Pressable>}</View>
              <ScrollView keyboardShouldPersistTaps="handled">{banks.filter(bank=>`${bank.name} ${bank.code}`.toLowerCase().includes(bankSearch.trim().toLowerCase())).map(bank=><Pressable key={bank.code} style={s.bankOption} onPress={()=>{appField('bankCode',bank.code);setBankSearch('');setBankPicker(false);}}><Text style={s.rowText}>{bank.name}</Text>{bank.code===p.riderApplication.bankCode&&<Ionicons name="checkmark" size={20} color={c.green}/>}</Pressable>)}{banks.length>0&&!banks.some(bank=>`${bank.name} ${bank.code}`.toLowerCase().includes(bankSearch.trim().toLowerCase()))&&<Text style={s.copy}>No matching banks.</Text>}</ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <Modal visible={datePicker} transparent animationType="slide" onRequestClose={()=>setDatePicker(false)}><View style={s.modalBackdrop}>
        <Pressable onPress={()=>setDatePicker(false)} style={{position:'absolute',top:0,right:0,bottom:0,left:0}}/>
        <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1,justifyContent:'flex-end'}}>
        <Pressable style={[s.modal,{maxHeight:'90%',paddingBottom:Math.max(insets.bottom+vendorSpace.lg,vendorSpace.xl)}]} onPress={event=>event.stopPropagation()}>
        <View style={s.modalHead}><Text style={s.modalTitle}>Date of birth</Text><Pressable accessibilityRole="button" accessibilityLabel="Close date picker" onPress={()=>setDatePicker(false)}><Ionicons name="close" size={22} color={c.ink}/></Pressable></View>
        <Text style={s.copy}>Select your date of birth. Future dates are unavailable.</Text>
        <View style={s.calendarPeriodHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={()=>setCalendarMonth(month=>new Date(month.getFullYear(),month.getMonth()-1,1))}><Ionicons name="chevron-back" size={21} color={c.green}/></Pressable>
          <View style={s.calendarPeriodControls}>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose birth month" accessibilityState={{selected:datePickerView==='months'}} onPress={()=>setDatePickerView('months')} style={[s.calendarPeriodButton,datePickerView==='months'&&s.calendarPeriodButtonActive]}><Text style={[s.calendarPeriodText,datePickerView==='months'&&s.calendarPeriodTextActive]}>{calendarMonth.toLocaleDateString(undefined,{month:'long'})}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose birth year" accessibilityState={{selected:datePickerView==='years'}} onPress={()=>{setYearSearch('');setDatePickerView('years');}} style={[s.calendarPeriodButton,datePickerView==='years'&&s.calendarPeriodButtonActive]}><Text style={[s.calendarPeriodText,datePickerView==='years'&&s.calendarPeriodTextActive]}>{monthYear}</Text></Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={monthYear===currentYear&&monthIndex===today.getMonth()} onPress={()=>setCalendarMonth(month=>new Date(month.getFullYear(),month.getMonth()+1,1))}><Ionicons name="chevron-forward" size={21} color={monthYear===currentYear&&monthIndex===today.getMonth()?c.muted:c.green}/></Pressable>
        </View>
        {datePickerView==='days'&&<>
          <View style={s.calendarWeek}>{['M','T','W','T','F','S','S'].map((day,index)=><Text key={`${day}-${index}`} style={s.calendarWeekday}>{day}</Text>)}</View>
          <View style={s.calendarGrid}>{calendarDays.map((day,index)=>{
            if(day===null)return <View key={`empty-${index}`} style={s.calendarDay}/>;
            const date=new Date(monthYear,monthIndex,day);const disabled=date>today;
            const isSelected=!!applicationDob&&applicationDob.getFullYear()===monthYear&&applicationDob.getMonth()===monthIndex&&applicationDob.getDate()===day;
            return <Pressable key={day} accessibilityRole="button" accessibilityLabel={date.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})} accessibilityState={{selected:isSelected,disabled}} disabled={disabled} onPress={()=>{appField('dateOfBirth',dateInputValue(date));setDatePicker(false);}} style={[s.calendarDay,isSelected&&s.calendarDaySelected,disabled&&s.calendarDayDisabled]}><Text style={[s.calendarDayText,isSelected&&s.calendarDaySelectedText]}>{day}</Text></Pressable>;
          })}</View>
        </>}
        {datePickerView==='months'&&<View style={s.calendarPeriodGrid}>{Array.from({length:12},(_,month)=>{const selected=month===monthIndex;const disabled=monthYear===currentYear&&month>today.getMonth();return <Pressable key={month} accessibilityRole="button" accessibilityLabel={`Choose ${new Date(2000,month,1).toLocaleDateString(undefined,{month:'long'})}`} accessibilityState={{selected,disabled}} disabled={disabled} onPress={()=>{setCalendarMonth(current=>new Date(current.getFullYear(),month,1));setDatePickerView('days');}} style={[s.calendarMonthOption,selected&&s.calendarPeriodOptionSelected,disabled&&s.calendarDayDisabled]}><Text style={[s.calendarPeriodOptionText,selected&&s.calendarPeriodOptionTextSelected]}>{new Date(2000,month,1).toLocaleDateString(undefined,{month:'short'})}</Text></Pressable>;})}</View>}
        {datePickerView==='years'&&<>
          <View style={s.bankSearch}><Ionicons name="search" size={18} color={c.muted}/><TextInput accessibilityLabel="Filter birth year" value={yearSearch} onChangeText={value=>setYearSearch(value.replace(/\D/g,'').slice(0,4))} placeholder="Filter by year" placeholderTextColor={c.muted} keyboardType="number-pad" maxLength={4} style={s.bankSearchInput}/>{yearSearch.length>0&&<Pressable accessibilityRole="button" accessibilityLabel="Clear year filter" onPress={()=>setYearSearch('')}><Ionicons name="close-circle" size={18} color={c.muted}/></Pressable>}</View>
          <ScrollView style={s.calendarYearList} keyboardShouldPersistTaps="handled"><View style={s.calendarPeriodGrid}>{filteredBirthYears.map(year=>{const selected=year===monthYear;return <Pressable key={year} accessibilityRole="button" accessibilityLabel={`Choose birth year ${year}`} accessibilityState={{selected}} onPress={()=>{setCalendarMonth(current=>new Date(year,current.getMonth(),1));setDatePickerView('months');}} style={[s.calendarYearOption,selected&&s.calendarPeriodOptionSelected]}><Text style={[s.calendarPeriodOptionText,selected&&s.calendarPeriodOptionTextSelected]}>{year}</Text></Pressable>;})}</View>{filteredBirthYears.length===0&&<Text style={s.copy}>No matching years.</Text>}</ScrollView>
        </>}
        <View style={s.calendarActions}><Pressable accessibilityRole="button" onPress={()=>setDatePicker(false)}><Text style={s.calendarActionText}>Cancel</Text></Pressable></View>
        </Pressable>
        </KeyboardAvoidingView>
      </View></Modal>
    </>}
    {page==='addresses'&&<>{loading?<ActivityIndicator color={c.green}/>:null}{addresses.map(a=><View key={a.id} style={s.address}><Text style={s.rowText}>{a.label}</Text><Text style={s.contact}>{a.line1}, {a.city}</Text><Pressable onPress={()=>void api.delete(`/addresses/${encodeURIComponent(a.id)}`,p.token).then(()=>setAddresses(current=>current.filter(x=>x.id!==a.id))).catch(e=>setError(e instanceof Error?e.message:'Could not remove address.'))}><Text style={s.deleteLink}>Remove</Text></Pressable></View>)}<Text style={s.section}>ADD AN ADDRESS</Text><FormField label="Label" value={label} onChangeText={setLabel} placeholder="Home" dark={c.isDark}/><FormField label="Street address" value={line1} onChangeText={setLine1} dark={c.isDark}/><FormField label="City" value={city} onChangeText={setCity} dark={c.isDark}/><PrimaryButton title={busy?'Saving…':'Save address'} disabled={busy||!label.trim()||line1.trim().length<3||city.trim().length<2} onPress={()=>void addAddress()} style={s.button}/>{!loading&&!addresses.length?<Text style={s.copy}>No saved addresses yet.</Text>:null}</>}
    {page==='favorites'&&<View style={s.info}><Ionicons name="star-outline" size={26} color={c.green}/><Text style={s.rowText}>No favourites yet</Text><Text style={s.copy}>Favourite kitchens will appear here when available in the rider app.</Text></View>}
    {page==='password'&&<><Text style={s.copy}>Choose a new password with at least 10 characters.</Text><FormField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry dark={c.isDark}/><FormField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry dark={c.isDark}/><PrimaryButton title={busy?'Updating…':'Update password'} disabled={busy||!currentPassword||newPassword.length<10} onPress={()=>void savePassword()} style={s.button}/></>}
    {page==='settings'&&<>
      <Text style={s.section}>APPEARANCE</Text>
      <View style={s.setting}><Ionicons name={p.dark?'moon-outline':'sunny-outline'} size={23} color={c.green}/><View style={{flex:1}}><Text style={s.rowText}>Dark mode</Text><Text style={s.contact}>{p.dark?'Dark appearance is on':'Use a darker appearance'}</Text></View><Switch value={p.dark} onValueChange={p.onTheme} trackColor={{false:c.line,true:c.green}} thumbColor={c.paper}/></View>
      <Pressable accessibilityRole="button" onPress={()=>Platform.OS==='web'?window.alert('English is currently the available app language.'):Alert.alert('Language','English is currently the available app language.')} style={s.setting}><Ionicons name="language-outline" size={23} color={c.green}/><View style={{flex:1}}><Text style={s.rowText}>Language</Text><Text style={s.contact}>English</Text></View><Ionicons name="chevron-forward" size={18} color={c.muted}/></Pressable>
      <Text style={s.section}>NOTIFICATIONS</Text>
      <SettingToggle icon="notifications-outline" title="Order updates" detail="Refresh rider offers while you're online." value={p.autoRefresh} onChange={p.onAutoRefresh} c={c}/>
      <SettingToggle icon="mail-outline" title="Newsletter" detail="Receive Smile news and occasional offers." value={p.newsletter} onChange={p.onNewsletter} c={c}/>
      <Text style={s.section}>ACCOUNT & PRIVACY</Text>{row('Privacy policy','shield-checkmark-outline','privacy')}{row('Delete account','trash-outline','delete')}
    </>}
    {page==='help'&&<Info title="Help & support" body="For help with rider access, deliveries, or your account, contact Smile support." c={c}/>}
    {page==='about'&&<Info title="About Smile" body="Smile connects neighbourhood customers, vendors, and riders for local delivery." c={c}/>}
    {page==='privacy'&&<Info title="Your privacy" body="Your profile, location, and delivery details are used to operate your rider account and fulfil deliveries. Location sharing stops when you go offline." c={c}/>}
    {page==='delete'&&<><Text style={s.copy}>Deleting your account removes access to your rider profile and other Smile services. This cannot be undone.</Text><FormField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry dark={c.isDark}/><PrimaryButton title={busy?'Deleting…':'Delete account'} disabled={busy||!currentPassword} secondary onPress={deleteAccount} style={s.button}/></>}
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}{notice?<Text style={s.notice}>{notice}</Text>:null}
  </ScrollView></KeyboardAvoidingView>;
}
function Info({title,body,c}:{title:string;body:string;c:AppColors}){return <View style={{alignItems:'center',gap:9,padding:24,marginTop:12,borderRadius:26,borderWidth:1,borderColor:c.line,backgroundColor:c.card}}><View style={{width:56,height:56,alignItems:'center',justifyContent:'center',borderRadius:18,backgroundColor:c.mint}}><Ionicons name={title==='About Smile'?'sparkles-outline':'help-circle-outline'} size={24} color={c.green}/></View><Text style={{fontSize:16,fontWeight:'900',color:c.ink,marginTop:4}}>{title}</Text><Text style={{fontSize:12,lineHeight:19,color:c.muted,textAlign:'center'}}>{body}</Text></View>}
function SettingToggle({icon,title,detail,value,onChange,c}:{icon:'notifications-outline'|'mail-outline';title:string;detail:string;value:boolean;onChange:(value:boolean)=>void;c:AppColors}){return <View style={{minHeight:74,flexDirection:'row',alignItems:'center',gap:11,padding:12,marginTop:8,borderRadius:20,borderWidth:1,borderColor:c.line,backgroundColor:c.card}}><View style={{width:39,height:39,alignItems:'center',justifyContent:'center',borderRadius:14,backgroundColor:c.cream}}><Ionicons name={icon} size={20} color={c.green}/></View><View style={{flex:1}}><Text style={{fontSize:12,fontWeight:'900',color:c.ink}}>{title}</Text><Text style={{fontSize:10,lineHeight:15,color:c.muted,marginTop:4}}>{detail}</Text></View><Switch value={value} onValueChange={onChange} trackColor={{false:c.line,true:c.green}} thumbColor={c.paper}/></View>}
const styles=(c:AppColors)=>StyleSheet.create({screen:{flex:1,backgroundColor:c.paper},fixedHeader:{paddingHorizontal:14,paddingTop:12,backgroundColor:c.paper},content:{paddingHorizontal:14,paddingTop:0,paddingBottom:30},back:{flexDirection:'row',alignItems:'center',gap:3,marginBottom:9},backText:{fontSize:13,fontWeight:'800',color:c.green},title:{fontSize:29,fontWeight:'900',color:c.ink,marginBottom:15},identity:{flexDirection:'row',alignItems:'center',gap:13,padding:12,borderRadius:0,borderWidth:1,borderColor:c.line,backgroundColor:c.card},avatar:{width:56,height:56,borderRadius:28,alignItems:'center',justifyContent:'center',backgroundColor:c.green},avatarText:{fontSize:24,fontWeight:'900',color:'white'},name:{fontSize:17,fontWeight:'900',color:c.ink},contact:{fontSize:11,color:c.muted,marginTop:4},section:{fontSize:10,fontWeight:'900',letterSpacing:1.1,color:c.muted,marginTop:21,marginBottom:7},group:{paddingHorizontal:7,borderRadius:0,borderWidth:1,borderColor:c.line,backgroundColor:c.card},row:{minHeight:55,flexDirection:'row',alignItems:'center',gap:10},rowIcon:{width:36,height:36,borderRadius:0,alignItems:'center',justifyContent:'center',backgroundColor:c.cream},rowText:{flex:1,fontSize:13,fontWeight:'800',color:c.ink},summary:{padding:14,marginTop:17,borderRadius:0,backgroundColor:c.cream},summaryTitle:{fontSize:13,fontWeight:'900',color:c.ink,marginBottom:4},logout:{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:10,borderRadius:0,backgroundColor:c.card},logoutText:{fontSize:13,fontWeight:'800',color:'#a34232'},version:{fontSize:10,letterSpacing:.8,color:c.muted,textAlign:'center',marginTop:14},copy:{fontSize:12,lineHeight:19,color:c.muted,marginBottom:6},readonly:{fontSize:12,color:c.muted,paddingVertical:13},button:{marginTop:12},uploadBox:{padding:13,marginTop:12,borderWidth:1,borderColor:c.line,backgroundColor:c.card},vehicleChoices:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:10},vehicleChoice:{paddingVertical:10,paddingHorizontal:12,borderWidth:1,borderColor:c.line,backgroundColor:c.card},vehicleChoiceSelected:{borderColor:c.green,backgroundColor:c.mint},vehicleChoiceText:{fontSize:12,fontWeight:"800",color:c.ink},vehicleChoiceTextSelected:{color:c.green},bankSelect:{minHeight:49,marginTop:12,paddingHorizontal:13,borderWidth:1,borderColor:c.line,backgroundColor:c.card,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},bankSelectText:{fontSize:13,fontWeight:"700",color:c.ink},modalBackdrop:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(0,0,0,.4)"},modal:{maxHeight:"75%",padding:18,paddingBottom:28,backgroundColor:c.paper},modalHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:12},modalTitle:{fontSize:18,fontWeight:"900",color:c.ink},bankOption:{minHeight:48,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:c.line,paddingVertical:9},terms:{flexDirection:'row',alignItems:'center',gap:9,marginTop:10},check:{fontSize:21,color:c.green},address:{padding:13,marginTop:8,borderRadius:0,backgroundColor:c.card,borderWidth:1,borderColor:c.line},deleteLink:{fontSize:11,color:'#a34232',fontWeight:'800',marginTop:8},info:{alignItems:'center',gap:8,padding:22,marginTop:15,borderRadius:0,backgroundColor:c.card},setting:{flexDirection:'row',alignItems:'center',padding:14,borderRadius:0,backgroundColor:c.card},error:{color:'#a44232',fontSize:12,marginTop:12},notice:{color:c.green,fontSize:12,marginTop:12}});
