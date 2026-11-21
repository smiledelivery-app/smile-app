import { AppTextInput as TextInput } from '@makanza/mobile-ui';
import { AppText as Text } from '@makanza/mobile-ui';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { BackHeader } from '../components/ui';
import { api } from '../services/api';
import type { AppColors } from '../theme/colors';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';

type Props={token:string;colors:AppColors;onBack:()=>void};
export default function PasswordSettingsScreen({token,colors:c,onBack}:Props){
  const [current,setCurrent]=useState('');
  const [next,setNext]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [done,setDone]=useState(false);
  const s=styles(c);
  const save=async()=>{
    setError('');
    if(next.length<10){setError('Use at least 10 characters for your new password.');return;}
    if(next!==confirm){setError('The new passwords do not match.');return;}
    setBusy(true);
    try{await api.post('/auth/password',{currentPassword:current,newPassword:next},token);setDone(true);setCurrent('');setNext('');setConfirm('');}
    catch(e){setError(e instanceof Error?e.message:'Could not change your password.');}
    finally{setBusy(false);}
  };
  return <View style={s.screen}>
    <BackHeader title="Change password" subtitle="Keep your account secure" colors={c} onBack={onBack}/>
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Text style={s.body}>Use a password you do not use on other sites. Changing it signs out your other sessions.</Text>
      {done&&<Text style={s.success}>Your password was changed. This device remains signed in.</Text>}
      <Field label="Current password" value={current} onChangeText={setCurrent} c={c}/>
      <Field label="New password" value={next} onChangeText={setNext} c={c}/>
      <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} c={c}/>
      {error?<Text style={s.error}>{error}</Text>:null}
      <Pressable disabled={busy} onPress={()=>void save()} style={({pressed})=>[s.button,busy&&{opacity:.6},pressed&&!busy&&{opacity:.84}]}>
        {busy?<ActivityIndicator color="white"/>:<Text style={s.buttonText}>Update password</Text>}
      </Pressable>
    </ScrollView>
  </View>;
}
function Field({label,value,onChangeText,c}:{label:string;value:string;onChangeText:(value:string)=>void;c:AppColors}){
  const [visible,setVisible]=useState(false);
  const p=customerPalette(c);
  return <View style={{marginTop:16}}>
    <Text style={{fontSize:11,fontWeight:'800',color:p.ink,marginBottom:7}}>{label}</Text>
    <View>
      <TextInput secureTextEntry={!visible} value={value} onChangeText={onChangeText} autoCapitalize="none" style={{minHeight:50,borderWidth:1,borderColor:p.border,borderRadius:customerRadius.sm,paddingHorizontal:13,paddingRight:48,color:p.ink,backgroundColor:p.surface,fontSize:14}}/>
      <Pressable accessibilityRole="button" accessibilityLabel={`${visible?'Hide':'Show'} ${label.toLowerCase()}`} onPress={()=>setVisible(current=>!current)} style={{position:'absolute',right:7,top:0,bottom:0,width:38,alignItems:'center',justifyContent:'center'}}>
        <Ionicons name={visible?'eye-off-outline':'eye-outline'} size={19} color={p.muted}/>
      </Pressable>
    </View>
  </View>;
}
const styles=(colors:AppColors)=>{
  const c=customerPalette(colors);
  return StyleSheet.create({
    screen:{flex:1,backgroundColor:c.canvas},
    page:{padding:customerSpace.lg,paddingBottom:customerSpace.xxl},
    body:{fontSize:12,lineHeight:19,color:c.muted,marginTop:5},
    button:{minHeight:50,alignItems:'center',justifyContent:'center',backgroundColor:c.primary,borderRadius:customerRadius.sm,marginTop:customerSpace.xl},
    buttonText:{fontSize:13,fontWeight:'900',color:'white'},
    error:{fontSize:11,lineHeight:17,color:c.danger,marginTop:12},
    success:{fontSize:12,lineHeight:19,color:c.primary,backgroundColor:c.primarySoft,padding:12,borderRadius:customerRadius.sm,marginTop:15},
  });
};
