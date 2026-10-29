import fs from 'node:fs';

const path='apps/customer-mobile/src/navigation/CustomerNavigator.tsx';
let s=fs.readFileSync(path,'utf8');
s=s.replace("import AccountScreen from '../tabs/ProfileScreen';","import ProfileScreen from '../tabs/ProfileScreen';\nimport HomeScreen from '../tabs/HomeScreen';\nimport SearchScreen from '../tabs/SearchScreen';\nimport OrdersScreen from '../tabs/OrdersScreen';\nimport WalletScreen from '../tabs/WalletScreen';\nimport TabBar from '../components/TabBar';\nimport { api } from '../services/api';\nimport { formatMoney as money, makeIdempotencyKey } from '../utils/format';");
s=s.replace("import SearchScreen from '../tabs/SearchScreen';\nimport WalletScreen from '../tabs/WalletScreen';\nimport type { CustomerScreen } from './types';","import type { CustomerScreen } from './types';");
s=s.replace("import { ApiError, createApiClient, type CustomerOrder, type Product, type Session, type Vendor } from '@makanza/mobile-core';","import { ApiError, type CustomerOrder, type Product, type Session, type Vendor } from '@makanza/mobile-core';");
s=s.replace("const api = createApiClient(process.env.EXPO_PUBLIC_API_URL ?? '');\n",'');
s=s.replace("const money=(minor:number)=>`₦${(minor/100).toLocaleString('en-NG',{maximumFractionDigits:0})}`;\n",'');
s=s.replace("const makeIdempotencyKey=()=> 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16);});\n",'');
s=s.replace("{ '"+'\n' +"' }","{'\\n'}");

const homeStart=s.indexOf("    {screen==='home'&&");
const menuStart=s.indexOf("\n    {screen==='menu'",homeStart);
if(homeStart<0||menuStart<0)throw new Error('Could not locate Home tab view.');
const home=`    {screen==='home'&&<HomeScreen vendors={vendors} loading={loading} error={error} query={query} dark={isDark} onQuery={setQuery} onSearch={(term)=>{setScreen('search');void loadVendors(term??query);}} onOpen={openVendor} onRetry={()=>void loadVendors(query)}/>}`;
s=s.slice(0,homeStart)+home+s.slice(menuStart);
s=s.replace("    {screen==='menu'&&", "    {screen==='search'&&<SearchScreen query={query} vendors={vendors} loading={loading} error={error} dark={isDark} onQuery={setQuery} onSearch={()=>void loadVendors(query)} onOpen={openVendor} onRetry={()=>void loadVendors(query)}/> }\n    {screen==='wallet'&&<WalletScreen dark={isDark}/>}\n    {screen==='menu'&&");
const orderStart=s.indexOf("    {screen==='orders'&&");
const profileStart=s.indexOf("\n    {screen==='profile'&&",orderStart);
if(orderStart<0||profileStart<0)throw new Error('Could not locate Orders tab view.');
const orders=`    {screen==='orders'&&<OrdersScreen orders={orders} loading={loading} error={error} hasAccount={!!session} dark={isDark} onRetry={()=>token&&void loadOrders(token)} onSignIn={()=>setScreen('profile')}/>} `;
s=s.slice(0,orderStart)+orders+s.slice(profileStart);
s=s.replace("{screen==='profile'&&<AccountScreen session={session} mode={mode} name={name} email={email} password={password} error={error} busy={busy} onName={setName} onEmail={setEmail} onPassword={setPassword} onToggleMode={()=>{setMode(mode==='login'?'register':'login');setError('');}} onSubmit={()=>void signIn()} onSignOut={()=>void signOut()}/>}","{screen==='profile'&&<ProfileScreen session={session} mode={mode} name={name} email={email} password={password} error={error} busy={busy} dark={isDark} onName={setName} onEmail={setEmail} onPassword={setPassword} onToggleMode={()=>{setMode(mode==='login'?'register':'login');setError('');}} onSubmit={()=>void signIn()} onSignOut={()=>void signOut()} onContinueAsGuest={()=>setGuestMode(true)} onToggleTheme={toggleTheme}/>}");
const barStart=s.indexOf('    <View style={{height:63');
const barEnd=s.indexOf('</View>\n  </SafeAreaView>;',barStart);
if(barStart<0||barEnd<0)throw new Error('Could not locate the legacy tab bar.');
s=s.slice(0,barStart)+"    {(['home','search','orders','wallet','profile'] as const).includes(screen as 'home'|'search'|'orders'|'wallet'|'profile')&&<TabBar active={screen as 'home'|'search'|'orders'|'wallet'|'profile'} dark={isDark} onChange={tab=>{setScreen(tab);if(tab==='orders'&&token)void loadOrders(token);if(tab==='home')void loadVendors();}}/>}\n  </SafeAreaView>;"+s.slice(barEnd+'</View>\n  </SafeAreaView>;'.length);
fs.writeFileSync(path,s);
