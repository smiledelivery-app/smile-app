import { AppTextInput as TextInput } from '@makanza/mobile-ui';
import { AppText as Text } from '@makanza/mobile-ui';
import { isRunningInExpoGo } from 'expo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, FlatList, Image, ImageBackground, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as NativeSecureStore from 'expo-secure-store';
import { ApiError, type CustomerOrder, type NotificationInbox, type NotificationInboxItem, type Product, type Session, type Vendor } from '@makanza/mobile-core';
import type { CancellationReason } from '@makanza/mobile-ui';
import OnboardingScreen from '../onboarding/OnboardingScreen';
import FontSplashScreen from '../components/FontSplashScreen';
import ProfileScreen from '../tabs/ProfileScreen';
import AuthNavigator from '../auth/AuthNavigator';
import HomeScreen from '../tabs/HomeScreen';
import SearchScreen from '../tabs/SearchScreen';
import OrdersScreen from '../tabs/OrdersScreen';
import WalletScreen from '../tabs/WalletScreen';
import TabBar from '../components/TabBar';
import { api } from '../services/api';
import { formatMoney as money, makeIdempotencyKey } from '../utils/format';
import { darkColors, lightColors, type AppColors } from '../theme/colors';
import type { CustomerScreen } from './types';
import VendorMenuScreen from '../screens/VendorMenuScreen';
import CartScreen from '../screens/CartScreen';
import type { CartLine } from '../types/cart';
import AddressPickerModal, { type SavedAddress } from '../screens/AddressPickerModal';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import WalletActivityScreen from '../screens/WalletActivityScreen';
import PasswordSettingsScreen from '../settings/PasswordSettingsScreen';
import PreferencesScreen from '../settings/PreferencesScreen';
import { AccountInfoScreen, DeleteAccountScreen, EditProfileScreen, FavoritesScreen, type AccountProfile } from '../screens/AccountScreens';
import { mobileEnv } from '../config/env';
import { demoLocation, demoOrders, demoVendors } from '../demo/demoData';

const SecureStore={
  getItemAsync:async(key:string)=>Platform.OS==='web'
    ?typeof window==='undefined'?null:window.localStorage.getItem(key)
    :NativeSecureStore.getItemAsync(key),
  setItemAsync:async(key:string,value:string)=>{
    if(Platform.OS==='web'){if(typeof window!=='undefined')window.localStorage.setItem(key,value);return;}
    await NativeSecureStore.setItemAsync(key,value);
  },
  deleteItemAsync:async(key:string)=>{
    if(Platform.OS==='web'){if(typeof window!=='undefined')window.localStorage.removeItem(key);return;}
    await NativeSecureStore.deleteItemAsync(key);
  },
};

type PopularProduct={product:Product;vendor:Vendor};
const demoRecentSearches=['Suya','Green Bowl','Yaba'];
const createNoticeStyles=(colors:AppColors)=>StyleSheet.create({
  position:{position:'absolute',left:16,right:16,bottom:18,zIndex:20,elevation:8},
  aboveTabBar:{bottom:82},
  toast:{minHeight:58,flexDirection:'row',alignItems:'center',gap:10,padding:10,borderRadius:16,borderWidth:1,borderColor:colors.line,backgroundColor:colors.card,shadowColor:'#000',shadowOpacity:.12,shadowRadius:12,shadowOffset:{width:0,height:5}},
  icon:{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:colors.mint},
  message:{flex:1,fontSize:13,lineHeight:19,fontWeight:'600',color:colors.ink},
  dismiss:{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:colors.cream},
});

export default function App(){
  const [session,setSession]=useState<Session|null>(null);
  const [demoProfile,setDemoProfile]=useState<Session['user']>({id:'demo-customer',name:'Demo Customer',email:'demo@smile.app',phone:'+234 800 000 0000',roles:['CUSTOMER']});
  const [vendors,setVendors]=useState<Vendor[]>([]);
  const [vendorDataSource,setVendorDataSource]=useState<'mock'|'api'>('api');
  const [popularProducts,setPopularProducts]=useState<PopularProduct[]>([]);
  const [popularLoading,setPopularLoading]=useState(false);
  const [popularError,setPopularError]=useState('');
  const [products,setProducts]=useState<Product[]>([]);
  const [orders,setOrders]=useState<CustomerOrder[]>(mobileEnv.demoMode?demoOrders:[]);
  const [notificationInbox,setNotificationInbox]=useState<NotificationInbox>({items:[],unreadCount:0});
  const [notificationsLoading,setNotificationsLoading]=useState(false);
  const [notificationsError,setNotificationsError]=useState('');
  const [pushToken,setPushToken]=useState('');
  const [cart,setCart]=useState<CartLine[]>([]);
  const [activeVendor,setActiveVendor]=useState<Vendor|null>(null);
  const [screen,setScreenState]=useState<CustomerScreen>('home');
  const screenHistory=useRef<CustomerScreen[]>([]);
  const setScreen=(next:CustomerScreen)=>setScreenState(current=>{if(current!==next)screenHistory.current.push(current);return next;});
  const goBack=()=>setScreenState(()=>screenHistory.current.pop()??'home');
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [address,setAddress]=useState('');const [city,setCity]=useState('Lagos');
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const [query,setQuery]=useState('');
  const [recentSearches,setRecentSearches]=useState<string[]>(mobileEnv.demoMode?demoRecentSearches:[]);
  const [favoriteVendorIds,setFavoriteVendorIds]=useState<string[]>(mobileEnv.demoMode?['demo-vendor-ada','demo-vendor-green']:[]);
  const [newsletter,setNewsletter]=useState(false);
  const [colorMode,setColorMode]=useState<'light'|'dark'>('light');
  const [onboardingReady,setOnboardingReady]=useState(false);
  const [hasOnboarded,setHasOnboarded]=useState(false);
  const [authReady,setAuthReady]=useState(false);
  const [preferencesReady,setPreferencesReady]=useState(false);
  const [catalogReady,setCatalogReady]=useState(false);
  const [selectedAddress,setSelectedAddress]=useState<SavedAddress|null>(null);
  const [addressPicker,setAddressPicker]=useState(false);
  const [detailOrder,setDetailOrder]=useState<CustomerOrder|null>(null);
  const [demoCancellationMeter,setDemoCancellationMeter]=useState({day:'',count:0});
  const [autoRefresh,setAutoRefresh]=useState(true);
  const colors=colorMode==='dark'?darkColors:lightColors;
  const styles=createStyles(colors);
  const toastStyles=createNoticeStyles(colors);
  const isDark=colorMode==='dark';
  const homeLocation=useMemo(()=>selectedAddress?.latitude!==null&&selectedAddress?.latitude!==undefined&&selectedAddress.longitude!==null&&selectedAddress.longitude!==undefined
    ?{latitude:Number(selectedAddress.latitude),longitude:Number(selectedAddress.longitude)}
    :mobileEnv.demoMode?demoLocation:null,[selectedAddress]);
  const toggleTheme=()=>{const next=isDark?'light':'dark';setColorMode(next);void SecureStore.setItemAsync('makanza-customer-theme-v1',next).catch(()=>undefined);};
  const token=session?.token;
  const profileSession:Session=session??(mobileEnv.demoMode
    ?{token:'',expiresAt:'',user:demoProfile}
    :{token:'',expiresAt:'',user:{id:'guest',name:'Guest',email:null,phone:null,roles:[]}});

  useEffect(()=>{
    if(Platform.OS==='web'||isRunningInExpoGo()||process.env.EXPO_PUBLIC_ENABLE_PUSH!=='true')return;
    let active=true;
    void import('expo-notifications').then(Notifications=>{
      if(active)Notifications.setNotificationHandler({handleNotification:async()=>({shouldPlaySound:true,shouldSetBadge:true,shouldShowBanner:true,shouldShowList:true})});
    }).catch(reason=>{if(active)setNotice(reason instanceof Error?`Push notifications are unavailable: ${reason.message}`:'Push notifications are unavailable.');});
    return()=>{active=false;};
  },[]);

  useEffect(()=>{
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(addressPicker){setAddressPicker(false);if(screen==='addresses')goBack();return true;}
      if(screen==='home'){BackHandler.exitApp();return true;}
      goBack();
      return true;
    });
    return()=>subscription.remove();
  },[screen,addressPicker]);

  useEffect(()=>{let active=true;void Promise.all([SecureStore.getItemAsync('makanza-customer-theme-v1').catch(()=>null),SecureStore.getItemAsync('makanza-customer-auto-refresh-v1').catch(()=>null),SecureStore.getItemAsync('makanza-customer-newsletter-v1').catch(()=>null),SecureStore.getItemAsync('makanza-customer-favorites-v1').catch(()=>null),SecureStore.getItemAsync('makanza-customer-recent-searches-v1').catch(()=>null)]).then(async([theme,refresh,newsletterValue,favorites,recent])=>{if(!active)return;if(theme==='dark'||theme==='light')setColorMode(theme);if(refresh==='false')setAutoRefresh(false);if(newsletterValue==='true')setNewsletter(true);try{if(favorites===null){if(mobileEnv.demoMode)await SecureStore.setItemAsync('makanza-customer-favorites-v1',JSON.stringify(['demo-vendor-ada','demo-vendor-green']));}else{const parsed:unknown=JSON.parse(favorites);if(Array.isArray(parsed)&&parsed.every(item=>typeof item==='string'))setFavoriteVendorIds(parsed);}}catch{if(active)setNotice('Favourites could not be loaded from this device.');}try{if(recent==='__cleared__')setRecentSearches([]);else if(recent===null){if(mobileEnv.demoMode)await SecureStore.setItemAsync('makanza-customer-recent-searches-v1',JSON.stringify(demoRecentSearches));}else{const parsed:unknown=JSON.parse(recent);if(Array.isArray(parsed)&&parsed.every(item=>typeof item==='string'))setRecentSearches(parsed.length?parsed.slice(0,8):mobileEnv.demoMode?demoRecentSearches:[]);}}catch{if(active)setNotice('Recent searches could not be loaded from this device.');}}).finally(()=>{if(active)setPreferencesReady(true);});return()=>{active=false;};},[]);
  useEffect(()=>{SecureStore.getItemAsync('makanza-customer-onboarding-v1').then(value=>setHasOnboarded(value==='complete')).catch(()=>setHasOnboarded(false)).finally(()=>setOnboardingReady(true));},[]);
  useEffect(()=>{if(!token)return;let active=true;void api.get<AccountProfile>('/auth/profile',token).then(profile=>{if(!active)return;setSession(current=>current?{...current,user:{...current.user,name:profile.name,email:profile.email,phone:profile.phone}}:current);}).catch(reason=>{if(active)setNotice(reason instanceof Error?`Profile details unavailable: ${reason.message}`:'Profile details unavailable.');});return()=>{active=false;};},[token]);

  const loadVendors=async(search='',currentToken=session?.token)=>{setLoading(true);setError('');try{const params=search?`?q=${encodeURIComponent(search)}`:'';const rows=await api.get<Vendor[]>(`/vendors${params}`,currentToken);setVendors(rows);setVendorDataSource('api');}catch(e){setError(e instanceof Error?e.message:'Could not load kitchens.');}finally{setLoading(false);}};
  const recordRecentSearch=(term:string)=>{const normalized=term.trim();if(!normalized)return;const next=[normalized,...recentSearches.filter(item=>item.toLowerCase()!==normalized.toLowerCase())].slice(0,8);setRecentSearches(next);void SecureStore.setItemAsync('makanza-customer-recent-searches-v1',JSON.stringify(next)).catch(()=>setNotice('Recent searches could not be saved on this device.'));};
  const clearRecentSearches=()=>{setRecentSearches([]);void SecureStore.setItemAsync('makanza-customer-recent-searches-v1','__cleared__').catch(()=>setNotice('Recent searches could not be cleared from this device.'));};
  const toggleFavorite=(vendorId:string)=>{const next=favoriteVendorIds.includes(vendorId)?favoriteVendorIds.filter(id=>id!==vendorId):[...favoriteVendorIds,vendorId];setFavoriteVendorIds(next);void SecureStore.setItemAsync('makanza-customer-favorites-v1',JSON.stringify(next)).catch(()=>setNotice('Favourites could not be saved on this device.'));};
  const saveProfile=(profile:AccountProfile)=>{if(!session){if(mobileEnv.demoMode)setDemoProfile(current=>({...current,name:profile.name,email:profile.email,phone:profile.phone}));return;}const next={...session,user:{...session.user,name:profile.name,email:profile.email,phone:profile.phone}};setSession(next);void SecureStore.setItemAsync('makanza-session',JSON.stringify(next)).catch(()=>setNotice('Profile saved, but this device could not update the saved session.'));};
  const completeAccountDeletion=async()=>{await SecureStore.deleteItemAsync('makanza-session');setSession(null);setSelectedAddress(null);setScreen('profile');setNotice('Your Smile account has been deleted.');};
  const loadOrders=useCallback(async(currentToken:string,quiet=false)=>{if(!quiet){setLoading(true);setError('');}try{setOrders(await api.get<CustomerOrder[]>('/orders',currentToken));setError('');}catch(e){setError(e instanceof Error?e.message:'Could not load your orders.');}finally{if(!quiet)setLoading(false);}},[]);
  const loadNotifications=useCallback(async(currentToken:string,quiet=false)=>{if(!quiet)setNotificationsLoading(true);setNotificationsError('');try{setNotificationInbox(await api.get<NotificationInbox>('/notifications',currentToken));}catch(e){setNotificationsError(e instanceof Error?e.message:'Could not load notifications.');}finally{if(!quiet)setNotificationsLoading(false);}},[]);
  const markNotificationRead=async(item:NotificationInboxItem)=>{if(!token||item.readAt)return;try{await api.patch(`/notifications/${encodeURIComponent(item.id)}/read`,{},token);setNotificationInbox(current=>({...current,unreadCount:Math.max(0,current.unreadCount-1),items:current.items.map(row=>row.id===item.id?{...row,readAt:new Date().toISOString()}:row)}));}catch(e){setNotice(e instanceof Error?`Could not mark notification read: ${e.message}`:'Could not mark notification read.');}};
  const markAllNotificationsRead=async()=>{if(!token)return;try{await api.patch('/notifications/read-all',{},token);const readAt=new Date().toISOString();setNotificationInbox(current=>({...current,unreadCount:0,items:current.items.map(item=>({...item,readAt}))}));}catch(e){setNotificationsError(e instanceof Error?e.message:'Could not mark notifications read.');}};
  useEffect(()=>{
    if(!token||Platform.OS==='web'||isRunningInExpoGo()||process.env.EXPO_PUBLIC_ENABLE_PUSH!=='true')return;
    let active=true;
    void (async()=>{
      try{
        const Notifications=await import('expo-notifications');
        if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('default',{name:'Smile updates',importance:Notifications.AndroidImportance.MAX});
        let permission=await Notifications.getPermissionsAsync();
        if(!permission.granted)permission=await Notifications.requestPermissionsAsync();
        if(!permission.granted)return;
        const projectId=process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
        if(!projectId)throw new Error('Set EXPO_PUBLIC_EAS_PROJECT_ID in the mobile app build environment.');
        const deviceToken=(await Notifications.getExpoPushTokenAsync({projectId})).data;
        await api.post('/notifications/devices',{token:deviceToken,platform:Platform.OS==='ios'?'ios':'android'},token);
        if(active)setPushToken(deviceToken);
      }catch(reason){if(active)setNotice(reason instanceof Error?`Push notifications are unavailable: ${reason.message}`:'Push notifications are unavailable.');}
    })();
    return()=>{active=false;};
  },[token]);
  useEffect(()=>{
    if(!token)return;
    const appState=AppState.addEventListener('change',state=>{if(state==='active')void loadNotifications(token,true);});
    if(Platform.OS==='web'||isRunningInExpoGo()||process.env.EXPO_PUBLIC_ENABLE_PUSH!=='true')return()=>appState.remove();
    let active=true;
    let received:{remove:()=>void}|undefined;
    let response:{remove:()=>void}|undefined;
    void import('expo-notifications').then(Notifications=>{
      if(!active)return;
      received=Notifications.addNotificationReceivedListener(()=>void loadNotifications(token,true));
      response=Notifications.addNotificationResponseReceivedListener(()=>{
        setScreen('notifications');
        void loadNotifications(token);
      });
    }).catch(reason=>{if(active)setNotificationsError(reason instanceof Error?`Push notifications are unavailable: ${reason.message}`:'Push notifications are unavailable.');});
    return()=>{active=false;received?.remove();response?.remove();appState.remove();};
  },[token,loadNotifications]);
  useEffect(()=>{if(token)void loadNotifications(token,true);else setNotificationInbox({items:[],unreadCount:0});},[token,loadNotifications]);
  useEffect(()=>{if(screen==='notifications'&&token)void loadNotifications(token);},[screen,token,loadNotifications]);
  const cancelCustomerOrder=async(orderId:string,reason:CancellationReason,details:string)=>{if(mobileEnv.demoMode){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(demoCancellationMeter.day===day&&demoCancellationMeter.count>=3){setError('You reached today’s 3 cancellation limit and cannot place another order today.');return;}setDemoCancellationMeter(current=>({day,count:(current.day===day?current.count:0)+1}));setOrders(rows=>rows.map(order=>order.id===orderId?{...order,status:'CANCELLED',events:[...order.events,{id:`demo-cancel-${Date.now()}`,status:'CANCELLED',createdAt:new Date().toISOString(),note:`Cancelled: ${details||reason.replaceAll('_',' ').toLowerCase()}`}]}:order));setNotice('Sample order cancelled locally.');return;}if(!token)return;setBusy(true);setError('');try{await api.post(`/orders/${encodeURIComponent(orderId)}/cancel`,{reason,details:details||undefined},token);setNotice('Order cancelled. Your reason was recorded.');await loadOrders(token);}catch(e){setError(e instanceof Error?e.message:'Could not cancel this order.');}finally{setBusy(false);}};
  useEffect(()=>{let active=true;if(!vendors.length){setPopularProducts([]);setPopularLoading(false);setPopularError('');return()=>{active=false;};}setPopularLoading(true);setPopularError('');Promise.all(vendors.slice(0,4).map(async vendor=>({vendor,products:await api.get<Product[]>(`/vendors/${encodeURIComponent(vendor.id)}/products`,token)}))).then(groups=>{if(active)setPopularProducts(groups.flatMap(group=>group.products.map(product=>({vendor:group.vendor,product}))));}).catch(reason=>{if(active)setPopularError(reason instanceof Error?reason.message:'Could not load popular items.');}).finally(()=>{if(active)setPopularLoading(false);});return()=>{active=false;};},[vendors]);
  useEffect(()=>{if(screen!=='orders'||!token||!autoRefresh)return;const timer=setInterval(()=>void loadOrders(token,true),10000);return()=>clearInterval(timer);},[screen,token,loadOrders,autoRefresh]);

  useEffect(()=>{let active=true;void loadVendors('',token).finally(()=>{if(active)setCatalogReady(true);});return()=>{active=false;};},[token]);
  useEffect(()=>{let active=true;void (async()=>{try{if(mobileEnv.demoMode)return;const saved=await SecureStore.getItemAsync('makanza-session');if(!saved)return;let body:Session;try{body=JSON.parse(saved) as Session;}catch{await SecureStore.deleteItemAsync('makanza-session');return;}if(!body?.token||!body.user?.roles?.includes('CUSTOMER')){await SecureStore.deleteItemAsync('makanza-session');return;}if(active){setSession(body);}try{const identity=await api.get<{userId:string;roles:string[];isDemo:boolean}>('/auth/me',body.token);if(!identity.roles.includes('CUSTOMER')){await SecureStore.deleteItemAsync('makanza-session');if(active){setSession(null);setNotice('This account does not have customer access.');}}else if(active)setSession({...body,user:{...body.user,roles:identity.roles,isDemo:identity.isDemo}});}catch(e){if(e instanceof ApiError&&e.status===401){await SecureStore.deleteItemAsync('makanza-session');if(active){setSession(null);}}else if(active)setNotice(e instanceof Error?e.message:'Could not validate your saved session. Continuing with the saved account.');}}finally{if(active)setAuthReady(true);}})();return()=>{active=false;};},[]);
  useEffect(()=>{if(!token)return;let alive=true;void (async()=>{try{const [places,saved]=await Promise.all([api.get<SavedAddress[]>('/addresses',token),SecureStore.getItemAsync(`makanza-customer-selected-address-v1:${session?.user.id}`)]);if(!alive)return;const chosen=places.find(x=>x.id===saved)??places[0]??null;if(chosen){setSelectedAddress(chosen);setAddress(chosen.line1);setCity(chosen.city);}}catch(e){if(alive)setNotice(e instanceof Error?`Saved places unavailable: ${e.message}`:'Saved places unavailable.');}})();return()=>{alive=false;};},[token,session?.user.id]);
  useEffect(()=>{if(!activeVendor)return;let alive=true;setProducts([]);setLoading(true);setError('');api.get<Product[]>(`/vendors/${encodeURIComponent(activeVendor.id)}/products`,token).then(rows=>{if(alive)setProducts(rows);}).catch(e=>{if(alive){const message=e instanceof Error?e.message:'Could not load this menu.';setError(message);}}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[activeVendor,token]);
  const subtotal=useMemo(()=>cart.reduce((sum,line)=>sum+(line.product.priceMinor+line.addons.reduce((a,x)=>a+x.addon.priceMinor*x.quantity,0))*line.quantity,0),[cart]);
  const saveAuthenticatedSession=async(result:Session)=>{if(!result.user.roles.includes('CUSTOMER'))throw new Error('This account does not have customer access.');await SecureStore.setItemAsync('makanza-session',JSON.stringify(result));setSession(result);setPassword('');setNotice('You are signed in.');};
  const signIn=async(emailValue:string,passwordValue:string)=>{setBusy(true);setError('');try{const result=await api.post<Session>('/auth/login',{email:emailValue,password:passwordValue});await saveAuthenticatedSession(result);}catch(e){setError(e instanceof Error?e.message:'Could not sign in.');}finally{setBusy(false);}};
  const beginSignup=async(nameValue:string,emailValue:string,phoneValue:string,passwordValue:string,channel:'sms'|'whatsapp'):Promise<string|null>=>{setBusy(true);setError('');try{const result=await api.post<Session|{phone:string;channel:string;expiresAt:string}>('/auth/register',{name:nameValue,email:emailValue,phone:phoneValue,password:passwordValue,channel});if('token'in result){await saveAuthenticatedSession(result);setNotice('Development signup: phone verification was skipped.');return null;}setNotice(`Verification code sent by ${channel==='sms'?'SMS':'WhatsApp'}.`);return result.phone;}catch(e){setError(e instanceof Error?e.message:'Could not start phone verification.');return null;}finally{setBusy(false);}};
  const verifySignupPhone=async(phoneValue:string,codeValue:string)=>{setBusy(true);setError('');try{const result=await api.post<Session>('/auth/register/verify',{phone:phoneValue,code:codeValue});await saveAuthenticatedSession(result);}catch(e){setError(e instanceof Error?e.message:'Could not verify your phone.');}finally{setBusy(false);}};
  const resendSignupCode=async(phoneValue:string):Promise<boolean>=>{setBusy(true);setError('');try{await api.post('/auth/register/resend',{phone:phoneValue});setNotice('A new verification code was sent.');return true;}catch(e){setError(e instanceof Error?e.message:'Could not resend your verification code.');return false;}finally{setBusy(false);}};
  const add= (product:Product,addons:import('../screens/VendorMenuScreen').Choice[]=[],quantity=1)=>{if(!activeVendor)return;if(cart.length&&cart[0].vendorId!==activeVendor.id){setNotice('Your bag is for one kitchen at a time. Finish or clear the current bag first.');return;}const key=(xs:typeof addons)=>xs.map(x=>`${x.addon.id}:${x.quantity}`).sort().join('|');setCart(lines=>{const existing=lines.find(line=>line.product.id===product.id&&key(line.addons)===key(addons));return existing?lines.map(line=>line.id===existing.id?{...line,quantity:line.quantity+quantity}:line):[...lines,{id:`${product.id}:${key(addons)}:${Date.now()}`,product,quantity,vendorId:activeVendor.id,vendorName:activeVendor.name,addons}];});setNotice(`${quantity>1?`${quantity} × `:''}${product.name}${addons.length?` with ${addons.map(x=>`${x.quantity} ${x.addon.name}`).join(', ')}`:''} added.`);};
  const placeOrder=async()=>{if(!token&&!mobileEnv.demoMode){setScreen('profile');setNotice('Sign in to continue.');return;}if(!cart.length)return;if(address.trim().length<4){setNotice('Enter a delivery address first.');return;}if(mobileEnv.demoMode){const now=new Date().toISOString();const vendor=demoVendors.find(item=>item.id===cart[0].vendorId);const totalMinor=cart.reduce((sum,line)=>sum+(line.product.priceMinor+line.addons.reduce((addonsTotal,item)=>addonsTotal+item.addon.priceMinor*item.quantity,0))*line.quantity,0)+(vendor?.fee??0)*100;const order:CustomerOrder={id:`demo-order-${Date.now()}`,status:'CONFIRMED',totalMinor,createdAt:now,vendor:{name:cart[0].vendorName},delivery:{status:'UNASSIGNED',assignedAt:null,riderName:null},items:cart.map((line,index)=>({id:`demo-line-${Date.now()}-${index}`,nameSnapshot:line.product.name,quantity:line.quantity,unitPriceMinor:line.product.priceMinor,addons:line.addons.map(item=>({id:item.addon.id,nameSnapshot:item.addon.name,quantity:item.quantity,unitPriceMinor:item.addon.priceMinor}))})),events:[{id:`demo-event-${Date.now()}`,status:'CONFIRMED',createdAt:now}]};setOrders(current=>[order,...current]);setCart([]);setScreen('orders');setNotice('Sample order placed locally. No payment or delivery request was sent.');return;}setBusy(true);setError('');try{let addressId=selectedAddress?.line1===address&&selectedAddress.city===city?selectedAddress.id:null;if(!addressId){const savedAddress=await api.post<SavedAddress>('/addresses',{label:'Delivery',line1:address,city},token!);addressId=savedAddress.id;setSelectedAddress(savedAddress);}const order=await api.post<{id:string}>('/orders',{vendorId:cart[0].vendorId,addressId,idempotencyKey:makeIdempotencyKey(),items:cart.map(l=>({productId:l.product.id,quantity:l.quantity,addons:l.addons.map(x=>({addonId:x.addon.id,quantity:x.quantity}))}))},token!);setCart([]);setScreen('orders');setNotice(`Order ${order.id.slice(-8)} placed. Demo checkout does not charge money.`);await loadOrders(token!);}catch(e){setError(e instanceof Error?e.message:'Could not place the order.');}finally{setBusy(false);}};
  const openVendor=async(vendor:Vendor)=>{setActiveVendor(vendor);setProducts([]);setScreen('menu');};
  const openNotification=async(item:NotificationInboxItem)=>{
    await markNotificationRead(item);
    if(!item.orderId)return;
    let order=orders.find(row=>row.id===item.orderId);
    if(!order&&token){try{const latest=await api.get<CustomerOrder[]>('/orders',token);setOrders(latest);order=latest.find(row=>row.id===item.orderId);}catch(reason){setError(reason instanceof Error?reason.message:'Could not load this order.');}}
    if(order){setDetailOrder(order);setScreen('order-detail');}
    else setScreen('orders');
  };
  const signOut=async()=>{if(token&&pushToken)try{await api.delete('/notifications/devices',token,{token:pushToken});}catch(reason){setNotice(reason instanceof Error?`Push device could not be unregistered: ${reason.message}`:'Push device could not be unregistered.');}if(token)void api.post('/auth/logout',{},token).catch(()=>undefined);setPushToken('');await SecureStore.deleteItemAsync('makanza-session');setSession(null);setSelectedAddress(null);setOrders([]);setNotificationInbox({items:[],unreadCount:0});setNotice('You have signed out.');setScreen('home');};
  const chooseAddress=(place:SavedAddress)=>{setSelectedAddress(place);setAddress(place.line1);setCity(place.city);if(session)void SecureStore.setItemAsync(`makanza-customer-selected-address-v1:${session.user.id}`,place.id);};

  const Button=({title,onPress,secondary=false,disabled=false}:{title:string;onPress:()=>void;secondary?:boolean;disabled?:boolean})=><Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button,secondary&&styles.buttonSecondary,disabled&&styles.disabled]}><Text style={[styles.buttonText,secondary&&styles.buttonSecondaryText]}>{title}</Text></Pressable>;
  const State=({message,action}:{message:string;action?:()=>void})=><View style={styles.state}><Text style={styles.stateText}>{message}</Text>{action&&<Button title="Try again" secondary onPress={action}/>}</View>;

  const finishOnboarding=async()=>{setHasOnboarded(true);setOnboardingReady(true);await SecureStore.setItemAsync('makanza-customer-onboarding-v1','complete').catch(()=>undefined);};
  if(!onboardingReady||!authReady||!preferencesReady||!catalogReady)return <FontSplashScreen/>;
  if(!hasOnboarded)return <OnboardingScreen onComplete={()=>void finishOnboarding()} onSignIn={()=>{setScreen('profile');void finishOnboarding();}}/>;
  if(!session)return <AuthNavigator dark={isDark} busy={busy} loginError={error} signupError={error} onLogin={(email,password)=>void signIn(email,password)} onSignup={beginSignup} onVerifyPhone={(phone,code)=>void verifySignupPhone(phone,code)} onResendPhone={resendSignupCode} onTheme={toggleTheme}/>;

  const primaryTab=(['home','search','orders','wallet','profile'] as const).includes(screen as 'home'|'search'|'orders'|'wallet'|'profile');
  return <SafeAreaView style={styles.safe}><StatusBar barStyle={isDark?'light-content':'dark-content'} backgroundColor={colors.paper} translucent={false}/>  {screen==='home'&&<View style={styles.header}><View><Text style={styles.locationCaption}>DELIVERING TO</Text><Pressable accessibilityRole="button" accessibilityLabel="Choose delivery location" style={styles.locationRow} onPress={()=>setAddressPicker(true)}><Ionicons name="location-outline" size={21} color={colors.green}/><Text style={styles.locationName}>{selectedAddress?.label??'Choose your location'}</Text><Ionicons name="chevron-down" size={17} color={colors.green}/></Pressable></View><View style={{flexDirection:'row',alignItems:'center',gap:8}}><Pressable accessibilityRole="button" accessibilityLabel={`${notificationInbox.unreadCount} unread notifications`} onPress={()=>{setScreen('notifications');if(token)void loadOrders(token);}} style={styles.themeToggle}><Ionicons name="notifications-outline" size={23} color={colors.green}/>{notificationInbox.unreadCount>0&&<View style={styles.notificationDot}/>}</Pressable><Pressable accessibilityRole="button" accessibilityLabel={isDark?'Switch to light mode':'Switch to dark mode'} onPress={toggleTheme} style={styles.themeToggle}><Ionicons name={isDark?'sunny-outline':'moon-outline'} size={22} color={colors.green}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Shopping cart, ${cart.reduce((n,l)=>n+l.quantity,0)} items`} onPress={()=>setScreen('bag')} style={styles.bagButton}><Ionicons name="cart-outline" size={26} color={colors.green}/>{cart.reduce((n,l)=>n+l.quantity,0)>0&&<View style={styles.bagCount}><Text style={styles.bagCountText}>{cart.reduce((n,l)=>n+l.quantity,0)}</Text></View>}</Pressable></View></View>}
    {screen==='home'&&<HomeScreen vendors={vendors} userLocation={homeLocation} popularProducts={popularProducts} popularLoading={popularLoading} popularError={popularError} loading={loading} error={error} query={query} dark={isDark} onQuery={setQuery} onSearch={(term)=>{const searchTerm=term??query;recordRecentSearch(searchTerm);setScreen('search');void loadVendors(searchTerm);}} onOpen={openVendor} onRetry={()=>void loadVendors(query)}/>}
    {screen==='search'&&<SearchScreen query={query} recentSearches={recentSearches} vendors={vendors} loading={loading&&vendors.length===0} error={error} dark={isDark} onQuery={setQuery} onSearch={(term)=>{const searchTerm=term??query;recordRecentSearch(searchTerm);void loadVendors(searchTerm);}} onRecentSearch={term=>{setQuery(term);recordRecentSearch(term);void loadVendors(term);}} onClearRecent={clearRecentSearches} onOpen={openVendor} onRetry={()=>void loadVendors(query)}/> }
    {screen==='wallet'&&<WalletScreen token={token??null} demoMode={mobileEnv.demoMode} colors={colors} onSignIn={()=>setScreen('profile')}/>}
    {screen==='menu'&&<VendorMenuScreen vendor={activeVendor} products={products} loading={loading&&products.length===0} error={error} dark={isDark} userLocation={homeLocation} onBack={goBack} onRetry={()=>activeVendor&&setActiveVendor({...activeVendor})} onAdd={add}/>} 
    {screen==='bag'&&<CartScreen lines={cart} subtotal={subtotal} address={address} city={city} busy={busy} error={error} hasAccount={!!session||mobileEnv.demoMode} dark={isDark} onAddress={v=>{setAddress(v);setSelectedAddress(a=>a?.line1===v?a:null);}} onCity={v=>{setCity(v);setSelectedAddress(a=>a?.city===v?a:null);}} onPickAddress={()=>setAddressPicker(true)} onQuantity={(lineId,delta)=>setCart(lines=>lines.flatMap(line=>line.id===lineId?line.quantity+delta<=0?[]:[{...line,quantity:line.quantity+delta}]:[line]))} onPlaceOrder={()=>void placeOrder()} onBrowse={goBack} onSignIn={()=>setScreen('profile')}/>} 
    {screen==='orders'&&<OrdersScreen orders={orders} loading={loading} error={error} hasAccount={!!session||mobileEnv.demoMode} dark={isDark} onRetry={()=>token&&void loadOrders(token)} onSignIn={()=>setScreen('profile')} onOpen={order=>{setDetailOrder(order);setScreen('order-detail');}} onCancel={(id,reason,details)=>void cancelCustomerOrder(id,reason,details)}/>}
    {screen==='notifications'&&<NotificationsScreen items={notificationInbox.items} unreadCount={notificationInbox.unreadCount} loading={notificationsLoading} error={notificationsError} hasAccount={!!session} colors={colors} onRetry={()=>token&&void loadNotifications(token)} onSignIn={()=>setScreen('profile')} onOpen={item=>void openNotification(item)} onReadAll={()=>void markAllNotificationsRead()} onBack={goBack}/>}
    {screen==='order-detail'&&detailOrder&&<OrderDetailScreen order={orders.find(x=>x.id===detailOrder.id)??detailOrder} colors={colors} token={token??null} demoMode={mobileEnv.demoMode} onBack={goBack}/>}
    {screen==='wallet-activity'&&token&&<WalletActivityScreen token={token} colors={colors} onBack={goBack}/>}
    {screen==='password'&&token&&<PasswordSettingsScreen token={token} colors={colors} onBack={goBack}/>}
    {screen==='preferences'&&<PreferencesScreen colors={colors} dark={isDark} autoRefresh={autoRefresh} newsletter={newsletter} onBack={goBack} onTheme={toggleTheme} onAutoRefresh={value=>{setAutoRefresh(value);void SecureStore.setItemAsync('makanza-customer-auto-refresh-v1',String(value));}} onNewsletter={value=>{setNewsletter(value);void SecureStore.setItemAsync('makanza-customer-newsletter-v1',String(value));}} onPrivacy={()=>setScreen('privacy')} onDeleteAccount={()=>setScreen('delete-account')}/>}
    {screen==='profile-edit'&&session&&<EditProfileScreen session={session} colors={colors} demoMode={false} onBack={goBack} onSaved={saveProfile}/>}
    {screen==='profile-edit'&&!session&&mobileEnv.demoMode&&<EditProfileScreen session={profileSession} colors={colors} demoMode onBack={goBack} onSaved={saveProfile}/>}
    {screen==='profile-edit'&&!session&&!mobileEnv.demoMode&&<AccountInfoScreen kind="account-required" colors={colors} onBack={goBack}/>}
    {screen==='favorites'&&<FavoritesScreen colors={colors} vendors={vendors} favoriteIds={favoriteVendorIds} onBack={goBack} onOpen={openVendor} onToggle={toggleFavorite}/>}
    {(screen==='help'||screen==='about'||screen==='privacy')&&<AccountInfoScreen kind={screen} colors={colors} onBack={goBack}/>}
    {screen==='delete-account'&&token&&<DeleteAccountScreen token={token} colors={colors} onBack={goBack} onDeleted={()=>void completeAccountDeletion()}/>}
    {screen==='delete-account'&&!token&&<AccountInfoScreen kind="account-required" colors={colors} onBack={goBack}/>}
    {screen==='password'&&!token&&<AccountInfoScreen kind="account-required" colors={colors} onBack={goBack}/>}
    {screen==='profile'&&<ProfileScreen session={profileSession} colors={colors} guest={!session} onSignIn={()=>setScreen('profile')} onSignOut={()=>void signOut()} onEdit={()=>setScreen('profile-edit')} onPreferences={()=>setScreen('preferences')} onPassword={()=>setScreen('password')} onAddresses={()=>{setScreen('addresses');setAddressPicker(true);}} onFavorites={()=>setScreen('favorites')} onHelp={()=>setScreen('help')} onAbout={()=>setScreen('about')}/>}
    {primaryTab&&<TabBar active={screen as 'home'|'search'|'orders'|'wallet'|'profile'} dark={isDark} onChange={tab=>{setScreen(tab);if(tab==='orders'&&token)void loadOrders(token);if(tab==='home')void loadVendors();}}/>}
    <AddressPickerModal visible={addressPicker} token={token??null} colors={colors} manageMode={screen==='addresses'} onClose={()=>{setAddressPicker(false);if(screen==='addresses')goBack();}} onSelect={place=>{chooseAddress(place);if(screen==='addresses')goBack();}} onSignIn={()=>{setAddressPicker(false);setScreen('profile');}}/>
    {notice?<View pointerEvents="box-none" accessibilityLiveRegion="polite" style={[toastStyles.position,primaryTab&&toastStyles.aboveTabBar]}>
      <View style={toastStyles.toast}>
        <View style={toastStyles.icon}><Ionicons name="information-circle-outline" size={21} color={colors.green}/></View>
        <Text style={toastStyles.message}>{notice}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" onPress={()=>setNotice('')} style={toastStyles.dismiss}><Ionicons name="close" size={19} color={colors.muted}/></Pressable>
      </View>
    </View>:null}
  </SafeAreaView>;
}

const createStyles=(colors:AppColors)=>StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},demoBanner:{minHeight:30,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,backgroundColor:colors.cream},demoBannerText:{fontSize:10,fontWeight:'900',letterSpacing:.45,color:colors.green},themeToggle:{paddingHorizontal:8,paddingVertical:7,borderRadius:12,backgroundColor:colors.cream},themeToggleText:{fontSize:11,fontWeight:'800',color:colors.green},flex:{flex:1},header:{height:68,paddingHorizontal:18,backgroundColor:colors.paper,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:colors.line},locationCaption:{fontSize:10,letterSpacing:1.1,color:colors.muted,fontWeight:'800'},locationRow:{flexDirection:'row',alignItems:'center',gap:5,marginTop:3},locationPin:{fontSize:21,color:colors.green},locationName:{fontSize:13,color:colors.ink,fontWeight:'700'},locationChevron:{fontSize:17,color:colors.green},brand:{fontSize:19,fontWeight:'900',color:colors.ink,letterSpacing:-.6},brandMark:{backgroundColor:colors.isDark?'#1d6147':colors.green,color:colors.mint,overflow:'hidden',borderRadius:7,fontFamily:'serif',paddingHorizontal:6,paddingVertical:1},brandAccent:{color:colors.accent},bagButton:{width:42,height:42,backgroundColor:'#f6f5f2',borderRadius:21,alignItems:'center',justifyContent:'center'},notificationDot:{position:'absolute',right:5,top:3,width:8,height:8,borderRadius:4,backgroundColor:colors.accent,borderWidth:1,borderColor:colors.paper},bagIcon:{fontSize:28,color:colors.green},bagCount:{position:'absolute',right:-2,top:-2,minWidth:18,height:18,borderRadius:10,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:colors.paper},bagCountText:{fontSize:11,color:'white',fontWeight:'800'},notice:{padding:10,backgroundColor:'#e6f0ea',marginHorizontal:15,marginTop:8,borderRadius:9},noticeText:{fontSize:13,color:colors.green},hero:{height:214,marginHorizontal:16,marginTop:13,padding:19,borderRadius:22,overflow:'hidden',justifyContent:'center',backgroundColor:colors.green},heroImage:{borderRadius:22},heroShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(18,43,32,.50)'},heroContent:{zIndex:1},heroKicker:{fontSize:11,letterSpacing:1.5,fontWeight:'900',color:colors.mint,marginBottom:8},heroTitle:{fontSize:31,fontWeight:'800',letterSpacing:-.9,lineHeight:36,color:'white'},heroSubtitle:{fontSize:13,lineHeight:19,color:'#f2f4e9',marginTop:6,maxWidth:250},heroPill:{alignSelf:'flex-start',backgroundColor:colors.mint,paddingHorizontal:12,paddingVertical:7,borderRadius:20,marginTop:13},heroPillText:{fontSize:11,fontWeight:'800',color:colors.green},heroEmoji:{position:'absolute',right:17,top:12,color:colors.mint,fontSize:35},searchWrap:{height:48,marginHorizontal:16,marginTop:13,marginBottom:13,paddingHorizontal:12,backgroundColor:colors.cream,borderRadius:14,flexDirection:'row',alignItems:'center',gap:9},searchIcon:{fontSize:25,color:colors.green},search:{flex:1,height:46,fontSize:15,color:colors.ink},filterIcon:{fontSize:24,color:colors.green,paddingHorizontal:5},categoryRow:{flexDirection:'row',gap:9,paddingHorizontal:16,paddingVertical:4},category:{minWidth:64,alignItems:'center',gap:5},categoryActive:{},categoryIcon:{width:46,height:46,textAlign:'center',textAlignVertical:'center',borderRadius:16,overflow:'hidden',backgroundColor:colors.cream,fontSize:25,color:colors.green},categoryText:{fontSize:11,color:colors.muted,fontWeight:'600'},categoryTextActive:{color:colors.green,fontWeight:'800'},sectionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginHorizontal:17,marginTop:20,marginBottom:3},sectionTitle:{fontSize:22,fontWeight:'800',letterSpacing:-.5,color:colors.ink},sectionSub:{fontSize:12,color:colors.muted,marginTop:3},seeAll:{fontSize:11,letterSpacing:.7,fontWeight:'800',color:colors.green},eyebrow:{fontSize:11,letterSpacing:1.3,fontWeight:'800',color:'#4f5451',marginBottom:10},title:{fontSize:37,fontWeight:'700',letterSpacing:-1.2,lineHeight:43,color:colors.ink},subtitle:{fontSize:16,lineHeight:23,color:colors.muted,marginTop:8,marginBottom:15},button:{minHeight:43,borderRadius:12,backgroundColor:colors.green,alignItems:'center',justifyContent:'center',paddingHorizontal:16,marginTop:7},buttonText:{color:colors.isDark?'#17231b':'white',fontSize:15,fontWeight:'700'},buttonSecondary:{backgroundColor:colors.card,borderWidth:1,borderColor:colors.line},buttonSecondaryText:{color:colors.green},disabled:{opacity:.55},list:{paddingBottom:10},vendorCard:{marginHorizontal:16,marginTop:12,padding:10,borderRadius:17,borderWidth:1,borderColor:colors.line,backgroundColor:colors.card,gap:11,flexDirection:'row',alignItems:'center',shadowColor:'#34462e',shadowOpacity:.05,shadowRadius:12,shadowOffset:{width:0,height:5},elevation:2},vendorImage:{width:91,height:91,borderRadius:13,backgroundColor:'#f6f5f2'},vendorCopy:{flex:1,gap:5},vendorTopLine:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:5},vendorName:{fontSize:16,fontWeight:'800',color:colors.ink,flexShrink:1},rating:{fontSize:12,fontWeight:'800',color:'#4f5451'},mutedText:{fontSize:12,lineHeight:18,color:colors.muted},vendorMeta:{flexDirection:'row',alignItems:'center',gap:5,marginTop:2},metaBadge:{fontSize:11,color:colors.muted},metaDot:{fontSize:11,color:'#aabbb1'},chevron:{fontSize:25,color:'#aabbb1',paddingHorizontal:4},demoTag:{fontSize:10,fontWeight:'800',letterSpacing:.7,color:'#4f5451'},spinner:{margin:24},state:{padding:22,alignItems:'center',gap:10},stateText:{fontSize:15,color:colors.muted,textAlign:'center',lineHeight:22},page:{padding:19,gap:12,paddingBottom:34},productCard:{flexDirection:'row',alignItems:'center',gap:12,padding:13,borderWidth:1,borderColor:colors.line,borderRadius:15,backgroundColor:colors.card,marginTop:8},productCopy:{flex:1,gap:5},productName:{fontSize:16,fontWeight:'700',color:colors.ink},price:{fontSize:15,fontWeight:'700',color:colors.green,marginTop:4},quantity:{flexDirection:'row',alignItems:'center',gap:12},qtyButton:{fontSize:25,color:colors.green,paddingHorizontal:5},total:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:12,borderTopWidth:1,borderTopColor:colors.line,marginTop:5},fieldLabel:{fontSize:13,fontWeight:'700',color:colors.ink,marginTop:7},input:{height:47,borderWidth:1,borderColor:colors.line,borderRadius:12,paddingHorizontal:12,fontSize:15,color:colors.ink,backgroundColor:colors.card},errorText:{fontSize:13,color:'#9f2f2d',marginVertical:8},switchText:{color:colors.green,fontSize:13,textAlign:'center',marginTop:16},orderCard:{padding:15,borderRadius:15,borderWidth:1,borderColor:colors.line,backgroundColor:'white',gap:9,marginTop:10},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},status:{fontSize:11,color:colors.green,textTransform:'capitalize',backgroundColor:colors.cream,padding:6,borderRadius:8}});
