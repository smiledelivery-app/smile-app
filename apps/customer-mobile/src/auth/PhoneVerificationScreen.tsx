import { AppText as Text } from '@makanza/mobile-ui';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import FormField from '../components/FormField';
import AuthLayout,{authTextStyles as t} from './AuthLayout';

type Props={dark:boolean;phone:string;channel:'sms'|'whatsapp';code:string;error:string;busy:boolean;onCode:(value:string)=>void;onVerify:()=>void;onResend:()=>Promise<boolean>;onBack:()=>void;onTheme:()=>void};
export default function PhoneVerificationScreen(p:Props){
  const [seconds,setSeconds]=useState(60);
  useEffect(()=>{if(seconds<=0)return;const timer=setTimeout(()=>setSeconds(value=>value-1),1000);return()=>clearTimeout(timer);},[seconds]);
  return <AuthLayout dark={p.dark} onTheme={p.onTheme}>
    <Text style={[t.kicker,p.dark&&t.mutedDark]}>VERIFY YOUR PHONE</Text>
    <Text style={[t.title,p.dark&&t.textDark]}>Enter your code.</Text>
    <Text style={[t.body,p.dark&&t.mutedDark]}>We sent a verification code by {p.channel==='sms'?'SMS':'WhatsApp'} to {p.phone}. Enter it below to finish creating your account.</Text>
    <FormField dark={p.dark} label="Verification code" value={p.code} onChangeText={value=>p.onCode(value.replace(/\D/g,'').slice(0,10))} placeholder="6-digit code" keyboardType="number-pad" maxLength={10} autoComplete="one-time-code"/>
    {p.error?<Text accessibilityRole="alert" style={t.error}>{p.error}</Text>:null}
    <Pressable accessibilityRole="button" disabled={p.busy||p.code.length<4} onPress={p.onVerify} style={[t.primary,(p.busy||p.code.length<4)&&{opacity:.55}]}><Text style={t.primaryText}>{p.busy?'Verifying…':'Verify phone and create account'}</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={p.busy||seconds>0} onPress={()=>void p.onResend().then(sent=>{if(sent)setSeconds(60);})}><Text style={[t.link,p.dark&&t.textDark]}>{seconds>0?`Resend code in ${seconds}s`:p.channel==='sms'?'Resend SMS code':'Resend WhatsApp code'}</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={p.onBack} style={t.backLink}><Text style={[t.link,p.dark&&t.textDark]}>Back to signup</Text></Pressable>
  </AuthLayout>;
}
