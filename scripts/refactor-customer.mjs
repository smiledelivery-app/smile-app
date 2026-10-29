import fs from 'node:fs';

const path='apps/customer-mobile/src/navigation/CustomerNavigator.tsx';
let source=fs.readFileSync(path,'utf8');
source=source.replace("import AccountScreen from '../tabs/ProfileScreen';","import AccountScreen from '../tabs/ProfileScreen';\nimport SearchScreen from '../tabs/SearchScreen';\nimport WalletScreen from '../tabs/WalletScreen';\nimport type { CustomerScreen } from './types';");
source=source.replace("const [screen,setScreen]=useState<'discover'|'menu'|'bag'|'orders'|'account'>('discover');","const [screen,setScreen]=useState<CustomerScreen>('home');");
source=source.replaceAll("'discover'","'home'").replaceAll("'account'","'profile'");
source=source.replace('const createStyles=(colors:typeof lightColors)=>','const createStyles=(colors:typeof lightColors|typeof darkColors)=>');
source=source.replace("  const [hasOnboarded,setHasOnboarded]=useState(false);","  const [hasOnboarded,setHasOnboarded]=useState(false);\n  const [authReady,setAuthReady]=useState(false);\n  const [guestMode,setGuestMode]=useState(false);");

const effectStart=source.indexOf("  useEffect(()=>{void loadVendors();SecureStore.getItemAsync('makanza-session')");
const effectEnd=source.indexOf("\n  useEffect(()=>{if(!activeVendor)",effectStart);
if(effectStart<0||effectEnd<0)throw new Error('Could not locate customer session restore effect.');
source=source.slice(0,effectStart)+`  useEffect(()=>{void loadVendors();void (async()=>{try{const saved=await SecureStore.getItemAsync('makanza-session');if(!saved)return;try{const body=JSON.parse(saved) as Session;await api.get<{userId:string;roles:string[]}>('/auth/me',body.token);if(body.user.roles.includes('CUSTOMER'))setSession(body);else{await SecureStore.deleteItemAsync('makanza-session');setNotice('This account does not have customer access.');}}catch(e){if(e instanceof ApiError&&e.status===401)await SecureStore.deleteItemAsync('makanza-session');else setNotice(e instanceof Error?e.message:'Could not restore your session.');}}finally{setAuthReady(true);}})();},[]);`+source.slice(effectEnd);
source=source.replace("const signIn=async()=>{setBusy(true);setError('');try{const result=await api.post<Session>(`/auth/${mode==='register'?'register':'login'}`,mode==='register'?{name,email,password}:{email,password});","const signIn=async(authMode:'login'|'register'=mode)=>{setBusy(true);setError('');try{const result=await api.post<Session>(`/auth/${authMode==='register'?'register':'login'}`,authMode==='register'?{name,email,password}:{email,password});");
source=source.replace('setSession(result);setPassword(\'\');','setSession(result);setGuestMode(false);setPassword(\'\');');
source=source.replace('setSession(null);setOrders([]);','setSession(null);setGuestMode(false);setOrders([]);');

const gateStart=source.indexOf('  if(!onboardingReady)');
const gateEnd=source.indexOf('\n\n  return <SafeAreaView',gateStart);
if(gateStart<0||gateEnd<0)throw new Error('Could not locate customer entry gates.');
const gates=`  if(!onboardingReady||!authReady)return <SafeAreaView style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.paper}}><ActivityIndicator color={colors.green}/></SafeAreaView>;
  if(!hasOnboarded)return <OnboardingScreen onComplete={()=>void finishOnboarding()} onExplore={()=>{setGuestMode(true);void finishOnboarding();}} onSignIn={()=>{setScreen('profile');void finishOnboarding();}}/>;
  if(!session&&!guestMode)return <AccountScreen session={null} mode={mode} name={name} email={email} password={password} error={error} busy={busy} dark={isDark} onName={setName} onEmail={setEmail} onPassword={setPassword} onToggleMode={()=>{setMode(mode==='login'?'register':'login');setError('');}} onSubmit={()=>void signIn()} onSignOut={()=>void signOut()} onToggleTheme={toggleTheme}/>;`;
source=source.slice(0,gateStart)+gates+source.slice(gateEnd);
fs.writeFileSync(path,source);
