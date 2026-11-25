import { AppText as Text, AppTextInput as TextInput } from '@makanza/mobile-ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, View, type TextInputProps } from 'react-native';
import { api } from '../services/api';
import { Ionicons } from '../components/AppIcon';
import PrimaryButton from '../components/PrimaryButton';
import type { AppColors } from '../theme/colors';
import { vendorRadius, vendorSpace, vendorType } from '../theme/vendor';

type Address={id:string;label:string;line1:string;city:string;latitude:number|string|null;longitude:number|string|null};
export function VendorSavedAddresses({token,colors:c,onClose}:{token:string;colors:AppColors;onClose:()=>void}){
  const s=styles(c);const [rows,setRows]=useState<Address[]>([]);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [editing,setEditing]=useState<Address|null>(null);const [formOpen,setFormOpen]=useState(false);const [label,setLabel]=useState('');const [line1,setLine1]=useState('');const [city,setCity]=useState('');
  const load=async()=>{setLoading(true);setError('');try{setRows(await api.get<Address[]>('/addresses',token));}catch(e){setError(e instanceof Error?e.message:'Could not load saved addresses.');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[token]);
  const start=(row?:Address)=>{setEditing(row??null);setLabel(row?.label??'');setLine1(row?.line1??'');setCity(row?.city??'');setFormOpen(true);setError('');};
  const save=async()=>{if(label.trim().length<1||line1.trim().length<3||city.trim().length<2){setError('Enter a name, street address, and city.');return;}setBusy(true);setError('');try{const body={label:label.trim(),line1:line1.trim(),city:city.trim()};if(editing)await api.patch(`/addresses/${encodeURIComponent(editing.id)}`,body,token);else await api.post('/addresses',body,token);setEditing(null);setFormOpen(false);await load();}catch(e){setError(e instanceof Error?e.message:'Could not save this address.');}finally{setBusy(false);}};
  const remove=(row:Address)=>{const confirm=async()=>{try{await api.delete(`/addresses/${encodeURIComponent(row.id)}`,token);await load();}catch(e){setError(e instanceof Error?e.message:'Could not remove this address.');}};if(Platform.OS==='web'){if(window.confirm(`Remove ${row.label}?`))void confirm();return;}Alert.alert('Remove saved address?',`Remove ${row.label}?`,[{text:'Cancel',style:'cancel'},{text:'Remove',style:'destructive',onPress:()=>void confirm()}]);};
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={s.backdrop}><View style={s.sheet}><View style={s.grabber}/><View style={s.header}><View style={{flex:1}}><Text style={s.kicker}>YOUR PLACES</Text><Text style={s.title}>{formOpen?(editing?'Edit address':'Add an address'):'Saved addresses'}</Text><Text style={s.subtitle}>Manage delivery addresses linked to your vendor account.</Text></View><Pressable accessibilityRole="button" accessibilityLabel={formOpen?'Back to saved addresses':'Close saved addresses'} onPress={formOpen?()=>{setEditing(null);setFormOpen(false);}:onClose} style={s.close}><Ionicons name={formOpen?'chevron-back':'close'} size={21} color={c.green}/></Pressable></View>
    {formOpen?<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}><Field label="Address name" value={label} onChangeText={setLabel} placeholder="e.g. Store, Home, Work" c={c}/><Field label="Street address" value={line1} onChangeText={setLine1} placeholder="House number and street" c={c}/><Field label="City or neighbourhood" value={city} onChangeText={setCity} placeholder="City" c={c}/>{error?<Text style={s.error}>{error}</Text>:null}<PrimaryButton title={busy?'Saving address…':editing?'Save changes':'Add address'} disabled={busy} onPress={()=>void save()} style={s.button}/><PrimaryButton title="Cancel" secondary disabled={busy} onPress={()=>{setEditing(null);setFormOpen(false);}} style={s.button}/></ScrollView>:<><Pressable accessibilityRole="button" onPress={()=>start()} style={s.add}><View style={s.placeIcon}><Ionicons name="add" size={23} color={c.green}/></View><Text style={s.addText}>Add another address</Text><Ionicons name="chevron-forward" size={18} color={c.muted}/></Pressable>{loading?<ActivityIndicator color={c.green} style={{margin:24}}/>:error?<Text style={s.error}>{error}</Text>:rows.length===0?<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="location-outline" size={25} color={c.green}/></View><Text style={s.emptyTitle}>No saved addresses</Text><Text style={s.emptyCopy}>Add your store or another delivery location to keep it handy.</Text></View>:<ScrollView style={{maxHeight:430}}>{rows.map(row=><View key={row.id} style={s.addressRow}><View style={s.placeIcon}><Ionicons name="location-outline" size={20} color={c.green}/></View><View style={{flex:1}}><Text style={s.rowTitle}>{row.label}</Text><Text style={s.rowCopy}>{row.line1}, {row.city}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${row.label}`} onPress={()=>start(row)} hitSlop={8}><Ionicons name="create-outline" size={20} color={c.green}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${row.label}`} onPress={()=>remove(row)} hitSlop={8} style={{marginLeft:10}}><Ionicons name="trash-outline" size={20} color="#a34232"/></Pressable></View>)}</ScrollView>}</>}
  </View></View></Modal>;
}

export function VendorPasswordScreen({colors:c,onBack,token,onSaved}:{colors:AppColors;token:string;onBack:()=>void;onSaved:()=>void}){
  const s=styles(c);const [current,setCurrent]=useState('');const [next,setNext]=useState('');const [confirm,setConfirm]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [done,setDone]=useState(false);
  const save=async()=>{setError('');if(next.length<10){setError('Use at least 10 characters for your new password.');return;}if(next!==confirm){setError('The new passwords do not match.');return;}setBusy(true);try{await api.post('/auth/password',{currentPassword:current,newPassword:next},token);setDone(true);setCurrent('');setNext('');setConfirm('');onSaved();}catch(e){setError(e instanceof Error?e.message:'Could not change your password.');}finally{setBusy(false);}};
  return <View style={s.pageScreen}><View style={s.fixedHeader}><Back onBack={onBack} c={c}/><Text style={s.kicker}>SECURITY</Text><Text style={s.title}>Change password</Text><Text style={s.subtitle}>Choose a strong password you do not use elsewhere.</Text></View><ScrollView contentContainerStyle={s.page}>{done&&<View style={s.success}><Ionicons name="checkmark-circle" size={19} color={c.green}/><Text style={s.successText}>Your password was changed.</Text></View>}<Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry c={c}/><Field label="New password" value={next} onChangeText={setNext} secureTextEntry placeholder="At least 10 characters" c={c}/><Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry c={c}/>{error?<Text style={s.error}>{error}</Text>:null}<PrimaryButton title={busy?'Updating password…':'Update password'} disabled={busy} onPress={()=>void save()} style={s.button}/></ScrollView></View>;
}

export function VendorDeleteAccountScreen({token,colors:c,onBack,onDeleted}:{token:string;colors:AppColors;onBack:()=>void;onDeleted:()=>void}){
  const s=styles(c);
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const remove=async()=>{
    setBusy(true);
    setError('');
    try{
      await api.delete('/auth/account',token,{password});
      onDeleted();
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Could not delete your account.');
    }finally{
      setBusy(false);
    }
  };
  const confirm=()=>{
    setError('');
    if(!password){setError('Enter your current password to continue.');return;}
    const message='Your vendor store will be closed, your personal details and saved addresses will be removed, and you will be signed out. Existing order records may be retained where required. This cannot be undone.';
    if(Platform.OS==='web'){
      if(window.confirm(`Delete your Smile account?\n\n${message}`))void remove();
      return;
    }
    Alert.alert('Delete your Smile account?',message,[
      {text:'Keep account',style:'cancel'},
      {text:'Delete account',style:'destructive',onPress:()=>void remove()},
    ]);
  };
  return <View style={s.pageScreen}>
    <View style={s.fixedHeader}>
      <Back onBack={onBack} c={c}/>
      <Text style={s.kicker}>ACCOUNT & PRIVACY</Text>
      <Text style={s.title}>Delete account</Text>
      <Text style={s.subtitle}>Review what happens before permanently closing your vendor account.</Text>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
      <View style={s.warningCard}>
        <Ionicons name="warning-outline" size={22} color={c.isDark?'#f0877a':'#a34232'}/>
        <Text style={s.warningText}>This action is permanent. Your store listing will be closed, your personal details and saved addresses will be removed, and all active sessions will end. Complete or cancel active orders first. Order and financial records may be retained where required.</Text>
      </View>
      <Field label="Current password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter your current password" c={c}/>
      {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={confirm} style={[s.dangerButton,busy&&{opacity:.6}]}>
        {busy?<ActivityIndicator color="white"/>:<Text style={s.dangerButtonText}>Permanently delete account</Text>}
      </Pressable>
    </ScrollView>
  </View>;
}

export function OperationsProfileScreen({colors:c,onBack,token,name:initialName,email:initialEmail,phone:initialPhone,onSaved}:{colors:AppColors;onBack:()=>void;token:string;name:string;email:string;phone:string|null;onSaved:(profile:VendorUserProfile)=>void}){
  const s=styles(c);const [name,setName]=useState(initialName);const [phone,setPhone]=useState(initialPhone??'');const [email,setEmail]=useState(initialEmail);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{let active=true;void api.get<VendorUserProfile>('/auth/profile',token).then(profile=>{if(active){setName(profile.name);setPhone(profile.phone??'');setEmail(profile.email);}}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Could not load your profile.');});return()=>{active=false;};},[token]);
  const save=async()=>{if(name.trim().length<2){setError('Enter a name with at least 2 characters.');return;}if(phone.trim()&&phone.trim().length<7){setError('Enter a valid phone number.');return;}setBusy(true);setError('');try{const profile=await api.patch<VendorUserProfile>('/auth/profile',{name:name.trim(),phone:phone.trim()||null},token);onSaved(profile);onBack();}catch(reason){setError(reason instanceof Error?reason.message:'Could not update your profile.');}finally{setBusy(false);}};
  return <View style={s.pageScreen}><View style={s.fixedHeader}><Back onBack={onBack} c={c}/><Text style={s.kicker}>YOUR ACCOUNT</Text><Text style={s.title}>Edit profile</Text><Text style={s.subtitle}>Keep your personal contact details up to date.</Text></View><ScrollView contentContainerStyle={s.page}><Field label="Full name" value={name} onChangeText={setName} placeholder="Your full name" c={c}/><Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="Phone number" c={c} keyboardType="phone-pad"/><Text style={s.fieldLabel}>Email address</Text><View style={s.readonly}><Text style={s.rowCopy}>{email||'No email added'}</Text></View><Text style={s.rowCopy}>Email changes are not currently available. Phone number changes require verification.</Text>{error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}<PrimaryButton title={busy?'Saving profile…':'Save changes'} disabled={busy} onPress={()=>void save()} style={s.button}/></ScrollView></View>;
}

export function OperationsInfoScreen({kind,role,colors:c,onBack}:{kind:'help'|'about'|'privacy';role:'Vendor'|'Rider';colors:AppColors;onBack:()=>void}){
  const s=styles(c);const content={
    help:{title:'Help & support',intro:`Need a hand with your ${role.toLowerCase()} workspace?`,items:[['Orders & deliveries',role==='Vendor'?'Manage customer orders from the Orders tab and check each order for its current status.':'Your assigned routes and delivery proofs are available in Deliveries.'],['Account & access','You can manage your profile, password, preferences, or delete your account from Account or Settings.'],['Contact Smile','For help with business access, payouts, rider access, or active orders, contact Smile support.']]},
    about:{title:'About Smile',intro:'Local service, delivered with a smile.',items:[['Smile Operations','Version 0.1.0'],['Your workspace',`${role} tools for managing day-to-day operations on Smile.`],['Built for local delivery','Smile connects customers, local businesses, and delivery riders.']]},
    privacy:{title:'Privacy policy',intro:'How Smile uses your account information.',items:[['Account details','Your name, email, and phone number identify your account and help Smile contact you.'],['Workspace information',role==='Vendor'?'Store details, order records, and payout setup are used to operate your vendor workspace.':'Your rider application, service area, availability, and delivery records are used to operate your rider workspace.'],['Location data','Rider location is shared only while foreground location sharing is active in the app.'],['Your choices','You can update profile details, manage app preferences, or delete your account from Account or Settings once active orders and deliveries are finished.']]},
  }[kind];
  return <ScrollView style={s.pageScreen} contentContainerStyle={s.page}><Back onBack={onBack} c={c}/><Text style={s.kicker}>{kind==='privacy'?'ACCOUNT & PRIVACY':'SMILE OPERATIONS'}</Text><Text style={s.title}>{content.title}</Text><Text style={s.subtitle}>{content.intro}</Text>{content.items.map(([title,detail])=><View key={title} style={s.infoCard}><Text style={s.rowTitle}>{title}</Text><Text style={s.rowCopy}>{detail}</Text></View>)}</ScrollView>;
}

export function VendorSettingsScreen({colors:c,onBack,dark,onTheme,onPrivacy,onHelp,onAbout,onDeleteAccount,role}:{colors:AppColors;onBack:()=>void;dark:boolean;onTheme:()=>void;onPrivacy:()=>void;onHelp:()=>void;onAbout:()=>void;onDeleteAccount:()=>void;role:'Vendor'|'Rider'}){
  const s=styles(c);return <ScrollView style={s.pageScreen} contentContainerStyle={s.page}><Back onBack={onBack} c={c}/><Text style={s.kicker}>PREFERENCES</Text><Text style={s.title}>Settings</Text><Text style={s.subtitle}>Make Smile work the way you do.</Text><Text style={s.section}>APPEARANCE</Text><View style={s.setting}><View style={s.settingIcon}><Ionicons name={dark?'moon-outline':'sunny-outline'} size={21} color={c.green}/></View><View style={{flex:1}}><Text style={s.rowTitle}>Dark mode</Text><Text style={s.rowCopy}>{dark?'Dark appearance is on':'Use a darker appearance'}</Text></View><Switch value={dark} onValueChange={onTheme} trackColor={{false:c.line,true:c.green}} thumbColor="white"/></View><Text style={s.section}>APP</Text><Pressable accessibilityRole="button" onPress={()=>Platform.OS==='web'?window.alert('English is currently the available app language.'):Alert.alert('Language','English is currently the available app language.')} style={s.setting}><View style={s.settingIcon}><Ionicons name="language-outline" size={21} color={c.green}/></View><View style={{flex:1}}><Text style={s.rowTitle}>Language</Text><Text style={s.rowCopy}>English</Text></View><Ionicons name="chevron-forward" size={20} color={c.muted}/></Pressable><Text style={s.section}>ACCOUNT & PRIVACY</Text><InfoAction icon="help-circle-outline" title="Help & support" onPress={onHelp} c={c}/><InfoAction icon="shield-checkmark-outline" title="Privacy policy" onPress={onPrivacy} c={c}/><InfoAction icon="information-circle-outline" title="About Smile" onPress={onAbout} c={c}/><InfoAction icon="trash-outline" title="Delete account" destructive onPress={onDeleteAccount} c={c}/><View style={s.info}><Ionicons name="information-circle-outline" size={20} color={c.green}/><Text style={s.rowCopy}>Smile Operations · {role} workspace · Version 0.1.0</Text></View></ScrollView>;
}

type FieldProps={label:string;c:AppColors;value:string;onChangeText:(value:string)=>void}&Pick<TextInputProps,'placeholder'|'secureTextEntry'|'keyboardType'|'maxLength'|'multiline'|'editable'>;
function Field({label,c,...props}:FieldProps){const [visible,setVisible]=useState(false);const s=styles(c);return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text><View><TextInput {...props} accessibilityLabel={label} secureTextEntry={props.secureTextEntry&&!visible} placeholderTextColor={c.muted} autoCapitalize={props.secureTextEntry?'none':'words'} style={[s.input,props.secureTextEntry&&{paddingRight:48}]}/>{props.secureTextEntry&&<Pressable accessibilityRole="button" accessibilityLabel={`${visible?'Hide':'Show'} ${label.toLowerCase()}`} onPress={()=>setVisible(current=>!current)} style={s.passwordVisibility}><Ionicons name={visible?'eye-off-outline':'eye-outline'} size={19} color={c.muted}/></Pressable>}</View></View>}
function Back({onBack,c}:{onBack:()=>void;c:AppColors}){return <Pressable accessibilityRole="button" accessibilityLabel="Back to account" onPress={onBack} style={styles(c).back}><Ionicons name="chevron-back" size={22} color={c.green}/><Text style={styles(c).backText}>Account</Text></Pressable>}
function InfoAction({icon,title,onPress,c,destructive=false}:{icon:string;title:string;onPress:()=>void;c:AppColors;destructive?:boolean}){const s=styles(c);return <Pressable accessibilityRole="button" onPress={onPress} style={[s.setting,destructive&&s.dangerSetting]}><View style={[s.settingIcon,destructive&&s.dangerSettingIcon]}><Ionicons name={icon} size={21} color={destructive?(c.isDark?'#f0877a':'#a34232'):c.green}/></View><Text style={{flex:1,color:destructive?(c.isDark?'#f0877a':'#a34232'):c.ink,fontSize:13,fontWeight:'800'}}>{title}</Text><Ionicons name="chevron-forward" size={20} color={c.muted}/></Pressable>}
type VendorUserProfile={name:string;email:string;phone:string|null};
const styles=(c:AppColors)=>StyleSheet.create({
  pageScreen:{flex:1,backgroundColor:c.paper},
  fixedHeader:{paddingHorizontal:vendorSpace.lg,paddingTop:vendorSpace.md,backgroundColor:c.paper},
  page:{paddingHorizontal:vendorSpace.lg,paddingTop:vendorSpace.sm,paddingBottom:vendorSpace.xxl},
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(12,25,17,.48)'},
  sheet:{maxHeight:'90%',backgroundColor:c.paper,borderTopLeftRadius:vendorRadius.xl,borderTopRightRadius:vendorRadius.xl,paddingHorizontal:vendorSpace.lg,paddingTop:vendorSpace.sm,paddingBottom:vendorSpace.xl},
  grabber:{width:38,height:4,borderRadius:vendorRadius.pill,backgroundColor:c.line,alignSelf:'center',marginBottom:vendorSpace.md},
  header:{flexDirection:'row',alignItems:'center',gap:vendorSpace.md,marginBottom:vendorSpace.md},
  kicker:{fontSize:vendorType.label,fontWeight:'900',letterSpacing:1.2,color:c.green,marginBottom:4},
  title:{fontSize:26,fontWeight:'900',letterSpacing:-.6,color:c.ink,marginTop:4},
  subtitle:{fontSize:12,lineHeight:18,color:c.muted,marginTop:5},
  close:{width:42,height:42,borderRadius:vendorRadius.md,backgroundColor:c.cream,alignItems:'center',justifyContent:'center'},
  add:{minHeight:58,padding:10,borderRadius:vendorRadius.md,borderWidth:1,borderColor:c.line,backgroundColor:c.card,flexDirection:'row',alignItems:'center',gap:11,marginBottom:14},
  addText:{flex:1,fontSize:13,fontWeight:'900',color:c.green},
  placeIcon:{width:40,height:40,borderRadius:vendorRadius.md,backgroundColor:c.cream,alignItems:'center',justifyContent:'center'},
  addressRow:{flexDirection:'row',alignItems:'center',gap:10,padding:12,backgroundColor:c.card,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.md,marginBottom:8},
  empty:{padding:vendorSpace.xl,alignItems:'center',borderWidth:1,borderRadius:vendorRadius.lg,borderColor:c.line,backgroundColor:c.card},
  emptyIcon:{width:54,height:54,borderRadius:vendorRadius.lg,alignItems:'center',justifyContent:'center',backgroundColor:c.cream,marginBottom:10},
  emptyTitle:{fontSize:15,fontWeight:'900',color:c.ink},
  emptyCopy:{fontSize:12,lineHeight:18,color:c.muted,textAlign:'center',marginTop:5},
  form:{paddingBottom:8},
  field:{marginTop:14},
  fieldLabel:{fontSize:11,fontWeight:'800',color:c.ink,marginBottom:6},
  input:{minHeight:49,borderWidth:1,borderColor:c.isDark?c.line:'#cbd8cf',borderRadius:vendorRadius.sm,backgroundColor:c.card,color:c.ink,paddingHorizontal:13,paddingRight:13,fontSize:14},
  passwordVisibility:{position:'absolute',right:7,top:0,bottom:0,width:38,alignItems:'center',justifyContent:'center'},
  readonly:{minHeight:46,justifyContent:'center',paddingHorizontal:13,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.sm,backgroundColor:c.cream},
  infoCard:{padding:15,marginTop:12,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.md,backgroundColor:c.card},
  rowTitle:{fontSize:13,fontWeight:'900',color:c.ink},
  rowCopy:{fontSize:11,lineHeight:17,color:c.muted,marginTop:4},
  button:{minHeight:48,marginTop:12,borderRadius:vendorRadius.sm},
  error:{fontSize:12,lineHeight:18,color:c.isDark?'#f0877a':'#a34232',marginTop:9},
  success:{flexDirection:'row',alignItems:'center',gap:8,padding:12,borderRadius:vendorRadius.md,backgroundColor:c.mint,marginTop:16},
  successText:{fontSize:12,color:c.green,fontWeight:'800'},
  back:{minHeight:42,flexDirection:'row',alignItems:'center',gap:4,alignSelf:'flex-start',marginBottom:vendorSpace.md,paddingHorizontal:10,borderRadius:vendorRadius.md,backgroundColor:c.cream},
  backText:{fontSize:12,fontWeight:'800',color:c.green},
  section:{fontSize:9,fontWeight:'900',letterSpacing:1.2,color:c.green,marginTop:vendorSpace.xl,marginBottom:8},
  setting:{minHeight:67,flexDirection:'row',alignItems:'center',gap:11,padding:11,marginBottom:8,borderRadius:vendorRadius.md,borderWidth:1,borderColor:c.line,backgroundColor:c.card},
  settingIcon:{width:39,height:39,borderRadius:vendorRadius.md,alignItems:'center',justifyContent:'center',backgroundColor:c.cream},
  dangerSetting:{borderColor:c.isDark?'#58332d':'#f1d8d2',backgroundColor:c.isDark?'#241b19':'#fff8f6',marginTop:4},
  dangerSettingIcon:{backgroundColor:c.isDark?'#392a20':'#fdf0ed'},
  warningCard:{flexDirection:'row',alignItems:'flex-start',gap:10,padding:14,marginTop:10,borderWidth:1,borderColor:c.isDark?'#58332d':'#f1d8d2',borderRadius:vendorRadius.md,backgroundColor:c.isDark?'#241b19':'#fff8f6'},
  warningText:{flex:1,fontSize:12,lineHeight:18,color:c.isDark?'#f0877a':'#a34232'},
  dangerButton:{minHeight:48,marginTop:16,borderRadius:vendorRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:'#a34232'},
  dangerButtonText:{fontSize:13,fontWeight:'900',color:'white'},
  info:{flexDirection:'row',alignItems:'center',gap:9,marginTop:12,padding:13,borderRadius:vendorRadius.md,backgroundColor:c.cream},
});
