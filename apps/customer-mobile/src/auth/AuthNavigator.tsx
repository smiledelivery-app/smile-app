import { useState } from 'react';
import LoginScreen from './LoginScreen';
import SignupScreen from './SignupScreen';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import OtpVerificationScreen from './OtpVerificationScreen';
import ChangePasswordScreen from './ChangePasswordScreen';

type Route='login'|'signup'|'forgot'|'otp'|'change';
type Props={dark:boolean;busy:boolean;loginError:string;signupError:string;onLogin:(email:string,password:string)=>void;onSignup:(name:string,email:string,password:string)=>void;onGuest:()=>void;onTheme:()=>void};
export default function AuthNavigator({dark,busy,loginError,signupError,onLogin,onSignup,onGuest,onTheme}:Props){
  const [route,setRoute]=useState<Route>('login');const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [confirmation,setConfirmation]=useState('');const [code,setCode]=useState('');const [recoveryError,setRecoveryError]=useState('');
  if(route==='signup')return <SignupScreen dark={dark} name={name} email={email} password={password} error={signupError} busy={busy} onName={setName} onEmail={setEmail} onPassword={setPassword} onSubmit={()=>onSignup(name,email,password)} onLogin={()=>setRoute('login')} onTheme={onTheme}/>;
  if(route==='forgot')return <ForgotPasswordScreen dark={dark} email={email} error={recoveryError} onEmail={setEmail} onRequest={()=>setRecoveryError('Password recovery is unavailable until a secure email or SMS delivery service is configured.')} onEnterCode={()=>{setRecoveryError('');setRoute('otp');}} onBack={()=>setRoute('login')} onTheme={onTheme}/>;
  if(route==='otp')return <OtpVerificationScreen dark={dark} email={email} code={code} error={recoveryError||'Request a recovery code first. Code verification is not enabled yet.'} onCode={setCode} onVerify={()=>{setRecoveryError('Recovery code verification is not connected yet.');}} onBack={()=>setRoute('forgot')} onTheme={onTheme}/>;
  if(route==='change')return <ChangePasswordScreen dark={dark} password={password} confirmation={confirmation} error={recoveryError} onPassword={setPassword} onConfirmation={setConfirmation} onSubmit={()=>setRecoveryError('Password reset cannot be completed until recovery verification is configured.')} onBack={()=>setRoute('login')} onTheme={onTheme}/>;
  return <LoginScreen dark={dark} email={email} password={password} error={loginError} busy={busy} onEmail={setEmail} onPassword={setPassword} onSubmit={()=>onLogin(email,password)} onSignup={()=>setRoute('signup')} onForgot={()=>{setRecoveryError('');setRoute('forgot');}} onGuest={onGuest} onTheme={onTheme}/>;
}
