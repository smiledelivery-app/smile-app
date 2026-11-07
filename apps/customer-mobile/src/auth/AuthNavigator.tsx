import { useState } from 'react';
import LoginScreen from './LoginScreen';
import SignupScreen from './SignupScreen';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import OtpVerificationScreen from './OtpVerificationScreen';
import ChangePasswordScreen from './ChangePasswordScreen';
import PhoneVerificationScreen from './PhoneVerificationScreen';

type Route='login'|'signup'|'verify-phone'|'forgot'|'otp'|'change';
type Channel='sms'|'whatsapp';
type Props={dark:boolean;busy:boolean;loginError:string;signupError:string;onLogin:(email:string,password:string)=>void;onSignup:(name:string,email:string,phone:string,password:string,channel:Channel)=>Promise<string|null>;onVerifyPhone:(phone:string,code:string)=>void;onResendPhone:(phone:string)=>Promise<boolean>;onTheme:()=>void};
export default function AuthNavigator({dark,busy,loginError,signupError,onLogin,onSignup,onVerifyPhone,onResendPhone,onTheme}:Props){
  const [route,setRoute]=useState<Route>('login');const [name,setName]=useState('');const [email,setEmail]=useState('');const [phone,setPhone]=useState('');const [password,setPassword]=useState('');const [channel,setChannel]=useState<Channel>('sms');const [verifyPhone,setVerifyPhone]=useState('');const [phoneCode,setPhoneCode]=useState('');const [confirmation,setConfirmation]=useState('');const [code,setCode]=useState('');const [recoveryError,setRecoveryError]=useState('');
  const beginSignup=async()=>{const destination=await onSignup(name,email,phone,password,channel);if(destination){setVerifyPhone(destination);setPhoneCode('');setRoute('verify-phone');}};
  if(route==='signup')return <SignupScreen dark={dark} name={name} email={email} phone={phone} password={password} channel={channel} error={signupError} busy={busy} onName={setName} onEmail={setEmail} onPhone={setPhone} onPassword={setPassword} onChannel={setChannel} onSubmit={()=>void beginSignup()} onLogin={()=>setRoute('login')} onTheme={onTheme}/>;
  if(route==='verify-phone')return <PhoneVerificationScreen dark={dark} phone={verifyPhone} channel={channel} code={phoneCode} error={signupError} busy={busy} onCode={setPhoneCode} onVerify={()=>onVerifyPhone(verifyPhone,phoneCode)} onResend={()=>onResendPhone(verifyPhone)} onBack={()=>setRoute('signup')} onTheme={onTheme}/>;
  if(route==='forgot')return <ForgotPasswordScreen dark={dark} email={email} error={recoveryError} onEmail={setEmail} onRequest={()=>setRecoveryError('Password recovery is unavailable until a secure email or SMS delivery service is configured.')} onEnterCode={()=>{setRecoveryError('');setRoute('otp');}} onBack={()=>setRoute('login')} onTheme={onTheme}/>;
  if(route==='otp')return <OtpVerificationScreen dark={dark} email={email} code={code} error={recoveryError||'Request a recovery code first. Code verification is not enabled yet.'} onCode={setCode} onVerify={()=>{setRecoveryError('Recovery code verification is not connected yet.');}} onBack={()=>setRoute('forgot')} onTheme={onTheme}/>;
  if(route==='change')return <ChangePasswordScreen dark={dark} password={password} confirmation={confirmation} error={recoveryError} onPassword={setPassword} onConfirmation={setConfirmation} onSubmit={()=>setRecoveryError('Password reset cannot be completed until recovery verification is configured.')} onBack={()=>setRoute('login')} onTheme={onTheme}/>;
  return <LoginScreen dark={dark} email={email} password={password} error={loginError} busy={busy} onEmail={setEmail} onPassword={setPassword} onSubmit={()=>onLogin(email,password)} onSignup={()=>setRoute('signup')} onForgot={()=>{setRecoveryError('');setRoute('forgot');}} onTheme={onTheme}/>;
}
