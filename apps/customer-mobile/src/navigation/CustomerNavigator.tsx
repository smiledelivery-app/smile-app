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
import { customerPalette, customerRadius } from '../theme/customer';
import type { CustomerScreen } from './types';
import VendorMenuScreen from '../screens/VendorMenuScreen';
import CartScreen from '../screens/CartScreen';
import OrderPaymentModal from '../screens/OrderPaymentModal';
import type { CartLine } from '../types/cart';
import AddressPickerModal, { type SavedAddress } from '../screens/AddressPickerModal';
import PaystackCheckoutModal from '../tabs/PaystackCheckoutModal';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import WalletActivityScreen from '../screens/WalletActivityScreen';
import PasswordSettingsScreen from '../settings/PasswordSettingsScreen';
import PreferencesScreen from '../settings/PreferencesScreen';
import { AccountInfoScreen, DeleteAccountScreen, EditProfileScreen, FavoritesScreen, type AccountProfile, type FavoriteProduct } from '../screens/AccountScreens';
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
const selectedAddressStorageKey=(userId:string)=>Platform.OS==='web'?`makanza-customer-selected-address-v1:${userId}`:`makanza-customer-selected-address-v1-${userId}`;
const isFavoriteProduct=(value:unknown):value is FavoriteProduct=>{
  if(!value||typeof value!=='object')return false;
  const row=value as Record<string,unknown>;
  const productVendor=row.vendor;
  if(!productVendor||typeof productVendor!=='object')return false;
  const vendor=productVendor as Record<string,unknown>;
  return typeof row.id==='string'&&typeof row.name==='string'&&(typeof row.imageUrl==='string'||row.imageUrl===null)&&typeof row.priceMinor==='number'
    &&typeof vendor.id==='string'&&typeof vendor.name==='string'&&typeof vendor.cuisine==='string'&&typeof vendor.neighborhood==='string'
    &&typeof vendor.eta==='string'&&typeof vendor.fee==='number'&&(typeof vendor.rating==='number'||vendor.rating===null)
    &&typeof vendor.image==='string'&&typeof vendor.open==='boolean'&&typeof vendor.demo==='boolean';
};
const hasDeliveryCoordinates=(place:SavedAddress|null|undefined):place is SavedAddress&{latitude:number|string;longitude:number|string}=>place?.latitude!==null&&place?.latitude!==undefined&&place.longitude!==null&&place.longitude!==undefined&&Number.isFinite(Number(place.latitude))&&Number.isFinite(Number(place.longitude));
const logPhoneVerificationError=(event:string,error:unknown)=>{
  if(error instanceof ApiError)console.error(event,{status:error.status,code:error.code,providerResponse:error.details??null});
  else console.error(event,{errorType:error instanceof Error?error.name:'unknown'});
};
const createNoticeStyles=(colors:AppColors)=>{
  const c=customerPalette(colors);
  return StyleSheet.create({
    position:{position:'absolute',left:16,right:16,bottom:18,zIndex:20,elevation:8},
    aboveTabBar:{bottom:82},
    toast:{minHeight:58,flexDirection:'row',alignItems:'center',gap:10,padding:10,borderRadius:14,borderWidth:1,borderColor:c.border,backgroundColor:c.surface,shadowColor:'#000',shadowOpacity:.12,shadowRadius:12,shadowOffset:{width:0,height:5}},
    icon:{width:36,height:36,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
    message:{flex:1,fontSize:12,lineHeight:18,fontWeight:'600',color:c.ink},
    dismiss:{width:36,height:36,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:c.surfaceAlt},
  });
};

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
  const [cartVisible,setCartVisible]=useState(false);
  const [openCartAfterAddress,setOpenCartAfterAddress]=useState(false);
  const [pendingPaymentOrder,setPendingPaymentOrder]=useState<{id:string;totalMinor:number}|null>(null);
  const [paymentPickerVisible,setPaymentPickerVisible]=useState(false);
  const [paymentError,setPaymentError]=useState('');
  const [orderCheckout,setOrderCheckout]=useState<{orderId:string;authorizationUrl:string;reference:string}|null>(null);
  const [activeVendor,setActiveVendor]=useState<Vendor|null>(null);
  const [screen,setScreenState]=useState<CustomerScreen>('home');
  const screenHistory=useRef<CustomerScreen[]>([]);
  const setScreen=(next:CustomerScreen)=>setScreenState(current=>{if(current!==next)screenHistory.current.push(current);return next;});
  const goBack=()=>setScreenState(()=>screenHistory.current.pop()??'home');
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [cartAddedNotice,setCartAddedNotice]=useState('');
  const [query,setQuery]=useState('');
  const [recentSearches,setRecentSearches]=useState<string[]>(mobileEnv.demoMode?demoRecentSearches:[]);
  const [favoriteVendorIds,setFavoriteVendorIds]=useState<string[]>(mobileEnv.demoMode?['demo-vendor-ada','demo-vendor-green']:[]);
  const [favoriteProducts,setFavoriteProducts]=useState<FavoriteProduct[]>([]);
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
  const palette=customerPalette(colors);
  const styles=createStyles(colors);
  const toastStyles=createNoticeStyles(colors);
  const isDark=colorMode==='dark';
  const homeLocation=useMemo(()=>hasDeliveryCoordinates(selectedAddress)
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
      if(cartVisible){setCartVisible(false);return true;}
      if(addressPicker){setAddressPicker(false);if(screen==='addresses')goBack();return true;}
      if(screen==='home'){BackHandler.exitApp();return true;}
      goBack();
      return true;
    });
    return()=>subscription.remove();
  },[screen,addressPicker,cartVisible]);

  useEffect(()=>{
    let active=true;
    void Promise.all([
      SecureStore.getItemAsync('makanza-customer-theme-v1').catch(()=>null),
      SecureStore.getItemAsync('makanza-customer-auto-refresh-v1').catch(()=>null),
      SecureStore.getItemAsync('makanza-customer-newsletter-v1').catch(()=>null),
      SecureStore.getItemAsync('makanza-customer-favorites-v1').catch(()=>null),
      SecureStore.getItemAsync('makanza-customer-favorite-products-v1').catch(()=>null),
      SecureStore.getItemAsync('makanza-customer-recent-searches-v1').catch(()=>null),
    ]).then(async([theme,refresh,newsletterValue,favorites,savedProducts,recent])=>{
      if(!active)return;
      if(theme==='dark'||theme==='light')setColorMode(theme);
      if(refresh==='false')setAutoRefresh(false);
      if(newsletterValue==='true')setNewsletter(true);
      try{
        if(favorites===null){
          if(mobileEnv.demoMode)await SecureStore.setItemAsync('makanza-customer-favorites-v1',JSON.stringify(['demo-vendor-ada','demo-vendor-green']));
        }else{
          const parsed:unknown=JSON.parse(favorites);
          if(Array.isArray(parsed)&&parsed.every(item=>typeof item==='string'))setFavoriteVendorIds(parsed);
        }
        if(savedProducts!==null){
          const parsed:unknown=JSON.parse(savedProducts);
          if(Array.isArray(parsed)&&parsed.every(isFavoriteProduct))setFavoriteProducts(parsed);
          else throw new Error('Saved product favourites are invalid.');
        }
      }catch{if(active)setNotice('Favourites could not be loaded from this device.');}
      try{
        if(recent==='__cleared__')setRecentSearches([]);
        else if(recent===null){
          if(mobileEnv.demoMode)await SecureStore.setItemAsync('makanza-customer-recent-searches-v1',JSON.stringify(demoRecentSearches));
        }else{
          const parsed:unknown=JSON.parse(recent);
          if(Array.isArray(parsed)&&parsed.every(item=>typeof item==='string'))setRecentSearches(parsed.length?parsed.slice(0,8):mobileEnv.demoMode?demoRecentSearches:[]);
        }
      }catch{if(active)setNotice('Recent searches could not be loaded from this device.');}
    }).finally(()=>{if(active)setPreferencesReady(true);});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{SecureStore.getItemAsync('makanza-customer-onboarding-v1').then(value=>setHasOnboarded(value==='complete')).catch(()=>setHasOnboarded(false)).finally(()=>setOnboardingReady(true));},[]);
  useEffect(()=>{if(!token)return;let active=true;void api.get<AccountProfile>('/auth/profile',token).then(profile=>{if(!active)return;setSession(current=>current?{...current,user:{...current.user,name:profile.name,email:profile.email,phone:profile.phone}}:current);}).catch(reason=>{if(active)setNotice(reason instanceof Error?`Profile details unavailable: ${reason.message}`:'Profile details unavailable.');});return()=>{active=false;};},[token]);

  const loadVendors=async(search='',currentToken=session?.token)=>{setLoading(true);setError('');try{const params=search?`?q=${encodeURIComponent(search)}`:'';const rows=await api.get<Vendor[]>(`/vendors${params}`,currentToken);setVendors(rows);setVendorDataSource('api');}catch(e){setError(e instanceof Error?e.message:'Could not load kitchens.');}finally{setLoading(false);}};
  const recordRecentSearch=(term:string)=>{const normalized=term.trim();if(!normalized)return;const next=[normalized,...recentSearches.filter(item=>item.toLowerCase()!==normalized.toLowerCase())].slice(0,8);setRecentSearches(next);void SecureStore.setItemAsync('makanza-customer-recent-searches-v1',JSON.stringify(next)).catch(()=>setNotice('Recent searches could not be saved on this device.'));};
  const clearRecentSearches=()=>{setRecentSearches([]);void SecureStore.setItemAsync('makanza-customer-recent-searches-v1','__cleared__').catch(()=>setNotice('Recent searches could not be cleared from this device.'));};
  const toggleFavorite=(vendorId:string)=>{const next=favoriteVendorIds.includes(vendorId)?favoriteVendorIds.filter(id=>id!==vendorId):[...favoriteVendorIds,vendorId];setFavoriteVendorIds(next);void SecureStore.setItemAsync('makanza-customer-favorites-v1',JSON.stringify(next)).catch(()=>setNotice('Favourites could not be saved on this device.'));};
  const toggleProductFavorite=(product:Product,vendor:Vendor)=>{
    const isSaved=favoriteProducts.some(item=>item.id===product.id&&item.vendor.id===vendor.id);
    const next=isSaved
      ?favoriteProducts.filter(item=>item.id!==product.id||item.vendor.id!==vendor.id)
      :[...favoriteProducts,{id:product.id,name:product.name,imageUrl:product.imageUrl,priceMinor:product.priceMinor,vendor}];
    setFavoriteProducts(next);
    void SecureStore.setItemAsync('makanza-customer-favorite-products-v1',JSON.stringify(next)).catch(()=>setNotice('Favourites could not be saved on this device.'));
  };
  const removeProductFavorite=(productId:string,vendorId:string)=>{
    const next=favoriteProducts.filter(item=>item.id!==productId||item.vendor.id!==vendorId);
    setFavoriteProducts(next);
    void SecureStore.setItemAsync('makanza-customer-favorite-products-v1',JSON.stringify(next)).catch(()=>setNotice('Favourites could not be saved on this device.'));
  };
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
  const cancelCustomerOrder=async(orderId:string,reason:CancellationReason,details:string)=>{if(mobileEnv.demoMode){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(demoCancellationMeter.day===day&&demoCancellationMeter.count>=3){setError('You reached today’s 3 cancellation limit and cannot place another order today.');return;}setDemoCancellationMeter(current=>({day,count:(current.day===day?current.count:0)+1}));setOrders(rows=>rows.map(order=>order.id===orderId?{...order,status:'CANCELLED',events:[...order.events,{id:`demo-cancel-${Date.now()}`,status:'CANCELLED',createdAt:new Date().toISOString(),note:`Cancelled: ${details||reason.replace(/_/g,' ').toLowerCase()}`}]}:order));setNotice('Sample order cancelled locally.');return;}if(!token)return;setBusy(true);setError('');try{await api.post(`/orders/${encodeURIComponent(orderId)}/cancel`,{reason,details:details||undefined},token);setNotice('Order cancelled. Your reason was recorded.');await loadOrders(token);}catch(e){setError(e instanceof Error?e.message:'Could not cancel this order.');}finally{setBusy(false);}};
  useEffect(()=>{let active=true;if(!vendors.length){setPopularProducts([]);setPopularLoading(false);setPopularError('');return()=>{active=false;};}setPopularLoading(true);setPopularError('');Promise.all(vendors.slice(0,4).map(async vendor=>({vendor,products:await api.get<Product[]>(`/vendors/${encodeURIComponent(vendor.id)}/products`,token)}))).then(groups=>{if(active)setPopularProducts(groups.flatMap(group=>group.products.map(product=>({vendor:group.vendor,product}))));}).catch(reason=>{if(active)setPopularError(reason instanceof Error?reason.message:'Could not load popular items.');}).finally(()=>{if(active)setPopularLoading(false);});return()=>{active=false;};},[vendors]);
  useEffect(()=>{if(screen!=='orders'||!token||!autoRefresh)return;const timer=setInterval(()=>void loadOrders(token,true),10000);return()=>clearInterval(timer);},[screen,token,loadOrders,autoRefresh]);

  useEffect(()=>{let active=true;void loadVendors('',token).finally(()=>{if(active)setCatalogReady(true);});return()=>{active=false;};},[token]);
  useEffect(()=>{let active=true;void (async()=>{try{if(mobileEnv.demoMode)return;const saved=await SecureStore.getItemAsync('makanza-session');if(!saved)return;let body:Session;try{body=JSON.parse(saved) as Session;}catch{await SecureStore.deleteItemAsync('makanza-session');return;}if(!body?.token||!body.user?.roles?.includes('CUSTOMER')){await SecureStore.deleteItemAsync('makanza-session');return;}if(active){setSession(body);}try{const identity=await api.get<{userId:string;roles:string[];isDemo:boolean}>('/auth/me',body.token);if(!identity.roles.includes('CUSTOMER')){await SecureStore.deleteItemAsync('makanza-session');if(active){setSession(null);setNotice('This account does not have customer access.');}}else if(active)setSession({...body,user:{...body.user,roles:identity.roles,isDemo:identity.isDemo}});}catch(e){if(e instanceof ApiError&&e.status===401){await SecureStore.deleteItemAsync('makanza-session');if(active){setSession(null);}}else if(active)setNotice(e instanceof Error?e.message:'Could not validate your saved session. Continuing with the saved account.');}}finally{if(active)setAuthReady(true);}})();return()=>{active=false;};},[]);
  useEffect(()=>{if(!token||!session?.user.id)return;let alive=true;void (async()=>{try{const [places,saved]=await Promise.all([api.get<SavedAddress[]>('/addresses',token),SecureStore.getItemAsync(selectedAddressStorageKey(session.user.id))]);if(!alive)return;const chosen=places.find(x=>x.id===saved&&hasDeliveryCoordinates(x))??places.find(hasDeliveryCoordinates)??null;if(chosen)setSelectedAddress(chosen);}catch(e){if(alive)setNotice(e instanceof Error?`Saved places unavailable: ${e.message}`:'Saved places unavailable.');}})();return()=>{alive=false;};},[token,session?.user.id]);
  useEffect(()=>{if(!activeVendor)return;let alive=true;setProducts([]);setLoading(true);setError('');api.get<Product[]>(`/vendors/${encodeURIComponent(activeVendor.id)}/products`,token).then(rows=>{if(alive)setProducts(rows);}).catch(e=>{if(alive){const message=e instanceof Error?e.message:'Could not load this menu.';setError(message);}}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[activeVendor,token]);
  const subtotal=useMemo(()=>cart.reduce((sum,line)=>sum+(line.product.priceMinor+line.addons.reduce((a,x)=>a+x.addon.priceMinor*x.quantity,0))*line.quantity,0),[cart]);
  const saveAuthenticatedSession=async(result:Session)=>{if(!result.user.roles.includes('CUSTOMER'))throw new Error('This account does not have customer access.');await SecureStore.setItemAsync('makanza-session',JSON.stringify(result));setSession(result);setPassword('');setNotice('You are signed in.');};
  const signIn=async(emailValue:string,passwordValue:string)=>{setBusy(true);setError('');try{const result=await api.post<Session>('/auth/login',{email:emailValue,password:passwordValue});await saveAuthenticatedSession(result);}catch(e){setError(e instanceof Error?e.message:'Could not sign in.');}finally{setBusy(false);}};
  const beginSignup=async(nameValue:string,emailValue:string,phoneValue:string,passwordValue:string,channel:'sms'|'whatsapp'):Promise<string|null>=>{
    setBusy(true);setError('');
    try{
      const result=await api.post<Session|{phone:string;channel:string;expiresAt:string;providerResponse?:unknown}>('/auth/register',{name:nameValue,email:emailValue,phone:phoneValue,password:passwordValue,channel});
      if('token'in result){await saveAuthenticatedSession(result);setNotice('Development signup: phone verification was skipped.');return null;}
      if(channel==='whatsapp')console.log('[phone verification] signup API response',{channel:result.channel,expiresAt:result.expiresAt,providerResponse:result.providerResponse??null});
      setNotice(`Verification code sent by ${channel==='sms'?'SMS':'WhatsApp'}.`);
      return result.phone;
    }catch(e){if(channel==='whatsapp')logPhoneVerificationError('[phone verification] signup API error',e);setError(e instanceof Error?e.message:'Could not start phone verification.');return null;}
    finally{setBusy(false);}
  };
  const verifySignupPhone=async(phoneValue:string,codeValue:string)=>{setBusy(true);setError('');try{const result=await api.post<Session>('/auth/register/verify',{phone:phoneValue,code:codeValue});await saveAuthenticatedSession(result);}catch(e){setError(e instanceof Error?e.message:'Could not verify your phone.');}finally{setBusy(false);}};
  const resendSignupCode=async(phoneValue:string):Promise<boolean>=>{
    setBusy(true);setError('');
    try{
      const result=await api.post<{channel:string;expiresAt:string;providerResponse?:unknown}>('/auth/register/resend',{phone:phoneValue});
      if(result.channel==='whatsapp')console.log('[phone verification] resend API response',{channel:result.channel,expiresAt:result.expiresAt,providerResponse:result.providerResponse??null});
      setNotice('A new verification code was sent.');
      return true;
    }catch(e){logPhoneVerificationError('[phone verification] resend API error',e);setError(e instanceof Error?e.message:'Could not resend your verification code.');return false;}
    finally{setBusy(false);}
  };
  const add= (product:Product,addons:import('../screens/VendorMenuScreen').Choice[]=[],quantity=1)=>{if(!activeVendor)return;if(pendingPaymentOrder){setNotice('Finish payment for your current order before adding more items.');return;}if(cart.length&&cart[0].vendorId!==activeVendor.id){setNotice('Your bag is for one kitchen at a time. Finish or clear the current bag first.');return;}const key=(xs:typeof addons)=>xs.map(x=>`${x.addon.id}:${x.quantity}`).sort().join('|');setCart(lines=>{const existing=lines.find(line=>line.product.id===product.id&&key(line.addons)===key(addons));return existing?lines.map(line=>line.id===existing.id?{...line,quantity:line.quantity+quantity}:line):[...lines,{id:`${product.id}:${key(addons)}:${Date.now()}`,product,quantity,vendorId:activeVendor.id,vendorName:activeVendor.name,addons}];});setCartVisible(true);};
  const placeOrder=async()=>{
    if(!token&&!mobileEnv.demoMode){setCartVisible(false);setScreen('profile');setNotice('Sign in to continue.');return;}
    if(!cart.length)return;
    if(!hasDeliveryCoordinates(selectedAddress)){setOpenCartAfterAddress(true);setCartVisible(false);setAddressPicker(true);setNotice('Choose a location on the map before placing your order.');return;}
    if(mobileEnv.demoMode){
      const now=new Date().toISOString();
      const vendor=demoVendors.find(item=>item.id===cart[0].vendorId);
      const totalMinor=cart.reduce((sum,line)=>sum+(line.product.priceMinor+line.addons.reduce((addonsTotal,item)=>addonsTotal+item.addon.priceMinor*item.quantity,0))*line.quantity,0)+(vendor?.fee??0)*100;
      const order:CustomerOrder={id:`demo-order-${Date.now()}`,displayNumber:1043,status:'CONFIRMED',totalMinor,createdAt:now,vendor:{name:cart[0].vendorName},delivery:{status:'UNASSIGNED',assignedAt:null,riderName:null},items:cart.map((line,index)=>({id:`demo-line-${Date.now()}-${index}`,nameSnapshot:line.product.name,quantity:line.quantity,unitPriceMinor:line.product.priceMinor,addons:line.addons.map(item=>({id:item.addon.id,nameSnapshot:item.addon.name,quantity:item.quantity,unitPriceMinor:item.addon.priceMinor}))})),events:[{id:`demo-event-${Date.now()}`,status:'CONFIRMED',createdAt:now}]};
      setOrders(current=>[order,...current]);
      setCart([]);
      setCartVisible(false);
      setScreen('orders');
      setNotice('Sample order placed locally. No payment or delivery request was sent.');
      return;
    }
    setBusy(true);
    setError('');
    try{
      const order=await api.post<{id:string;totalMinor:number;status:string}>('/orders',{vendorId:cart[0].vendorId,addressId:selectedAddress.id,idempotencyKey:makeIdempotencyKey(),items:cart.map(line=>({productId:line.product.id,quantity:line.quantity,addons:line.addons.map(item=>({addonId:item.addon.id,quantity:item.quantity}))}))},token!);
      if(order.status==='CONFIRMED'){
        setCart([]);
        setCartVisible(false);
        setScreen('orders');
        setNotice('Your order is confirmed.');
        await loadOrders(token!);
        return;
      }
      setCartVisible(false);
      setPendingPaymentOrder({id:order.id,totalMinor:order.totalMinor});
      setPaymentError('');
      setPaymentPickerVisible(true);
      setNotice('Your order is ready. Choose how you would like to pay.');
    }catch(e){setError(e instanceof Error?e.message:'Could not place the order.');}
    finally{setBusy(false);}
  };
  const payForOrder=async(method:'wallet'|'paystack')=>{
    if(!token||!pendingPaymentOrder)return;
    setBusy(true);
    setPaymentError('');
    try{
      const result=await api.post<{orderId:string;status:string;method?:'wallet'|'paystack';authorizationUrl?:string;reference?:string}>(`/orders/${encodeURIComponent(pendingPaymentOrder.id)}/pay`,{method},token);
      if(method==='wallet'){
        if(result.status!=='CONFIRMED')throw new Error('Your wallet payment could not be confirmed. Please try again.');
        setPaymentPickerVisible(false);
        setPendingPaymentOrder(null);
        setCart([]);
        setScreen('orders');
        setNotice('Wallet payment complete. Your order is confirmed.');
        await loadOrders(token);
        return;
      }
      if(!result.authorizationUrl||!result.reference)throw new Error('Paystack did not return checkout details. Please try again.');
      setPaymentPickerVisible(false);
      setOrderCheckout({orderId:result.orderId,authorizationUrl:result.authorizationUrl,reference:result.reference});
    }catch(reason){setPaymentError(reason instanceof Error?reason.message:'Could not start payment. Your order is still awaiting payment.');}
    finally{setBusy(false);}
  };
  const handleOrderPaymentReturn=async(reference:string)=>{
    if(!token||!orderCheckout)return;
    const checkout=orderCheckout;
    setOrderCheckout(null);
    setPaymentPickerVisible(false);
    setScreen('orders');
    setNotice('Verifying your Paystack payment…');
    try{
      const result=await api.post<{status:string;confirmed:boolean}>(`/orders/${encodeURIComponent(checkout.orderId)}/pay/verify`,{reference},token);
      if(result.confirmed){
        setPendingPaymentOrder(null);
        setCart([]);
        setNotice('Paystack payment confirmed. Your order is ready.');
      }else setNotice('Paystack is still confirming your payment. Your order will update when verification completes.');
    }catch(reason){
      setNotice(reason instanceof Error?`Could not confirm payment yet: ${reason.message}`:'Could not confirm payment yet. Your order will update when verification completes.');
    }
    await loadOrders(token,true);
  };
  const closeOrderCheckout=()=>{
    setOrderCheckout(null);
    setPaymentPickerVisible(true);
    setPaymentError('Paystack checkout was closed. Your order is still awaiting payment.');
  };
  useEffect(()=>{
    if(!pendingPaymentOrder)return;
    if(orders.some(order=>order.id===pendingPaymentOrder.id&&order.status==='CONFIRMED')){
      setPendingPaymentOrder(null);
      setPaymentPickerVisible(false);
      setCart([]);
    }
  },[orders,pendingPaymentOrder]);
  useEffect(()=>{
    if(!orderCheckout||!token)return;
    let active=true;
    let timer:ReturnType<typeof setTimeout>|null=null;
    const checkout=orderCheckout;
    const checkPayment=async()=>{
      try{
        const result=await api.post<{status:string;confirmed:boolean}>(`/orders/${encodeURIComponent(checkout.orderId)}/pay/verify`,{reference:checkout.reference},token);
        if(!active)return;
        if(result.confirmed){
          setOrderCheckout(null);
          setPendingPaymentOrder(null);
          setPaymentPickerVisible(false);
          setCart([]);
          setScreen('orders');
          setNotice('Paystack payment confirmed. Your order is ready.');
          await loadOrders(token,true);
          return;
        }
      }catch(reason){
        if(active)setPaymentError(reason instanceof Error?`Could not check payment status: ${reason.message}`:'Could not check payment status.');
      }
      if(active)timer=setTimeout(()=>void checkPayment(),10000);
    };
    timer=setTimeout(()=>void checkPayment(),8000);
    return()=>{active=false;if(timer!==null)clearTimeout(timer);};
  },[orderCheckout,token,loadOrders]);
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
  const chooseAddress=(place:SavedAddress)=>{setSelectedAddress(place);if(session)void SecureStore.setItemAsync(selectedAddressStorageKey(session.user.id),place.id).catch(()=>setNotice('Selected address could not be saved on this device.'));};

  const finishOnboarding=async()=>{setHasOnboarded(true);setOnboardingReady(true);await SecureStore.setItemAsync('makanza-customer-onboarding-v1','complete').catch(()=>undefined);};
  if(!onboardingReady||!authReady||!preferencesReady||!catalogReady)return <FontSplashScreen/>;
  if(!hasOnboarded)return <OnboardingScreen onComplete={()=>void finishOnboarding()} onSignIn={()=>{setScreen('profile');void finishOnboarding();}}/>;
  if(!session)return <AuthNavigator dark={isDark} busy={busy} loginError={error} signupError={error} onLogin={(email,password)=>void signIn(email,password)} onSignup={beginSignup} onVerifyPhone={(phone,code)=>void verifySignupPhone(phone,code)} onResendPhone={resendSignupCode} onTheme={toggleTheme}/>;

  const primaryTab=(['home','search','orders','wallet','profile'] as const).includes(screen as 'home'|'search'|'orders'|'wallet'|'profile');
  return <SafeAreaView style={styles.safe}><StatusBar barStyle={isDark?'light-content':'dark-content'} backgroundColor={palette.canvas} translucent={false}/>{screen==='home'&&<View style={styles.header}>
    <View style={{flex:1,minWidth:0}}>
      <Text style={styles.locationCaption}>DELIVER TO</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose delivery location" style={styles.locationRow} onPress={()=>setAddressPicker(true)}>
        <Ionicons name="location-outline" size={18} color={palette.primary}/>
        <Text numberOfLines={1} style={styles.locationName}>{selectedAddress?.label??'Choose your location'}</Text>
        <Ionicons name="chevron-down" size={16} color={palette.primary}/>
      </Pressable>
    </View>
    <View style={{flexDirection:'row',alignItems:'center',gap:7,marginLeft:8}}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${notificationInbox.unreadCount} unread notifications`} onPress={()=>{setScreen('notifications');if(token)void loadNotifications(token);}} style={[styles.themeToggle,{width:44,height:44,alignItems:'center',justifyContent:'center',padding:0}]}>
        <Ionicons name="notifications-outline" size={20} color={palette.primary}/>{notificationInbox.unreadCount>0&&<View style={styles.notificationDot}/>}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={isDark?'Switch to light mode':'Switch to dark mode'} onPress={toggleTheme} style={[styles.themeToggle,{width:44,height:44,alignItems:'center',justifyContent:'center',padding:0}]}>
        <Ionicons name={isDark?'sunny-outline':'moon-outline'} size={20} color={palette.primary}/>
      </Pressable>
    </View>
  </View>}
    {screen==='home'&&<HomeScreen vendors={vendors} userLocation={homeLocation} popularProducts={popularProducts} popularLoading={popularLoading} popularError={popularError} loading={loading} error={error} query={query} dark={isDark} onQuery={setQuery} onSearch={(term)=>{const searchTerm=term??query;recordRecentSearch(searchTerm);setScreen('search');void loadVendors(searchTerm);}} onOpen={openVendor} onRetry={()=>void loadVendors(query)}/>}
    {screen==='search'&&<SearchScreen query={query} recentSearches={recentSearches} vendors={vendors} loading={loading&&vendors.length===0} error={error} dark={isDark} onQuery={setQuery} onSearch={(term)=>{const searchTerm=term??query;recordRecentSearch(searchTerm);void loadVendors(searchTerm);}} onRecentSearch={term=>{setQuery(term);recordRecentSearch(term);void loadVendors(term);}} onClearRecent={clearRecentSearches} onOpen={openVendor} onRetry={()=>void loadVendors(query)}/> }
    {screen==='wallet'&&<WalletScreen token={token??null} demoMode={mobileEnv.demoMode} colors={colors} onSignIn={()=>setScreen('profile')} onHistory={()=>setScreen('wallet-activity')}/>}
    {screen==='menu'&&<VendorMenuScreen vendor={activeVendor} products={products} loading={loading&&products.length===0} error={error} dark={isDark} userLocation={homeLocation} favoriteVendor={!!activeVendor&&favoriteVendorIds.includes(activeVendor.id)} favoriteProductIds={favoriteProducts.filter(item=>item.vendor.id===activeVendor?.id).map(item=>item.id)} cartCount={cart.reduce((n,l)=>n+l.quantity,0)} cartTotalMinor={subtotal} onOpenCart={()=>setCartVisible(true)} onBack={goBack} onRetry={()=>activeVendor&&setActiveVendor({...activeVendor})} onAdd={add} onToggleVendorFavorite={()=>activeVendor&&toggleFavorite(activeVendor.id)} onToggleProductFavorite={product=>activeVendor&&toggleProductFavorite(product,activeVendor)}/>}
    <CartScreen visible={cartVisible} onClose={()=>setCartVisible(false)} lines={cart} subtotal={subtotal} address={selectedAddress?`${selectedAddress.line1}, ${selectedAddress.city}`:''} locationLabel={selectedAddress?.label??'Choose a delivery location'} hasPinnedLocation={hasDeliveryCoordinates(selectedAddress)} busy={busy} error={error} hasAccount={!!session||mobileEnv.demoMode} dark={isDark} demoMode={mobileEnv.demoMode} pendingPayment={!!pendingPaymentOrder} onPickAddress={()=>{setOpenCartAfterAddress(true);setCartVisible(false);setAddressPicker(true);}} onQuantity={(lineId,delta)=>setCart(lines=>lines.flatMap(line=>line.id===lineId?line.quantity+delta<=0?[]:[{...line,quantity:line.quantity+delta}]:[line]))} onPlaceOrder={()=>void placeOrder()} onContinuePayment={()=>{setCartVisible(false);setPaymentError('');setPaymentPickerVisible(true);}} onBrowse={()=>setCartVisible(false)} onSignIn={()=>{setCartVisible(false);setScreen('profile');}}/>
    {screen==='orders'&&<OrdersScreen orders={orders} loading={loading} error={error} hasAccount={!!session||mobileEnv.demoMode} dark={isDark} onRetry={()=>token&&void loadOrders(token)} onSignIn={()=>setScreen('profile')} onOpen={order=>{setDetailOrder(order);setScreen('order-detail');}} onCancel={(id,reason,details)=>void cancelCustomerOrder(id,reason,details)} onPayOrder={order=>{setPendingPaymentOrder({id:order.id,totalMinor:order.totalMinor});setPaymentError('');setPaymentPickerVisible(true);}}/>}
    {screen==='notifications'&&<NotificationsScreen items={notificationInbox.items} unreadCount={notificationInbox.unreadCount} loading={notificationsLoading} error={notificationsError} hasAccount={!!session} colors={colors} onRetry={()=>token&&void loadNotifications(token)} onSignIn={()=>setScreen('profile')} onOpen={item=>void openNotification(item)} onReadAll={()=>void markAllNotificationsRead()} onBack={goBack}/>}
    {screen==='order-detail'&&detailOrder&&<OrderDetailScreen order={orders.find(x=>x.id===detailOrder.id)??detailOrder} colors={colors} token={token??null} demoMode={mobileEnv.demoMode} onBack={goBack}/>}
    {screen==='wallet-activity'&&token&&<WalletActivityScreen token={token} colors={colors} onBack={goBack}/>}
    {screen==='password'&&token&&<PasswordSettingsScreen token={token} colors={colors} onBack={goBack}/>}
    {screen==='preferences'&&<PreferencesScreen colors={colors} dark={isDark} autoRefresh={autoRefresh} newsletter={newsletter} onBack={goBack} onTheme={toggleTheme} onAutoRefresh={value=>{setAutoRefresh(value);void SecureStore.setItemAsync('makanza-customer-auto-refresh-v1',String(value));}} onNewsletter={value=>{setNewsletter(value);void SecureStore.setItemAsync('makanza-customer-newsletter-v1',String(value));}} onPrivacy={()=>setScreen('privacy')} onDeleteAccount={()=>setScreen('delete-account')}/>}
    {screen==='profile-edit'&&session&&<EditProfileScreen session={session} colors={colors} demoMode={false} onBack={goBack} onSaved={saveProfile}/>}
    {screen==='profile-edit'&&!session&&mobileEnv.demoMode&&<EditProfileScreen session={profileSession} colors={colors} demoMode onBack={goBack} onSaved={saveProfile}/>}
    {screen==='profile-edit'&&!session&&!mobileEnv.demoMode&&<AccountInfoScreen kind="account-required" colors={colors} onBack={goBack}/>}
    {screen==='favorites'&&<FavoritesScreen colors={colors} vendors={vendors} favoriteIds={favoriteVendorIds} products={favoriteProducts} onBack={goBack} onOpen={openVendor} onToggleVendor={toggleFavorite} onToggleProduct={removeProductFavorite}/>}
    {(screen==='help'||screen==='about'||screen==='privacy')&&<AccountInfoScreen kind={screen} colors={colors} onBack={goBack}/>}
    {screen==='delete-account'&&token&&<DeleteAccountScreen token={token} colors={colors} onBack={goBack} onDeleted={()=>void completeAccountDeletion()}/>}
    {screen==='delete-account'&&!token&&<AccountInfoScreen kind="account-required" colors={colors} onBack={goBack}/>}
    {screen==='password'&&!token&&<AccountInfoScreen kind="account-required" colors={colors} onBack={goBack}/>}
    {screen==='profile'&&<ProfileScreen session={profileSession} colors={colors} guest={!session} onSignIn={()=>setScreen('profile')} onSignOut={()=>void signOut()} onEdit={()=>setScreen('profile-edit')} onPreferences={()=>setScreen('preferences')} onPassword={()=>setScreen('password')} onAddresses={()=>{setScreen('addresses');setAddressPicker(true);}} onFavorites={()=>setScreen('favorites')} onWallet={()=>setScreen('wallet')} onHelp={()=>setScreen('help')} onAbout={()=>setScreen('about')}/>}
    {primaryTab&&<TabBar active={screen as 'home'|'search'|'orders'|'wallet'|'profile'} dark={isDark} onChange={tab=>{setScreen(tab);if(tab==='orders'&&token)void loadOrders(token);if(tab==='home')void loadVendors();}}/>}
    <AddressPickerModal visible={addressPicker} token={token??null} colors={colors} manageMode={screen==='addresses'} onClose={()=>{setAddressPicker(false);if(openCartAfterAddress){setOpenCartAfterAddress(false);setCartVisible(true);}else if(screen==='addresses')goBack();}} onSelect={place=>{chooseAddress(place);if(openCartAfterAddress){setOpenCartAfterAddress(false);setCartVisible(true);}else if(screen==='addresses')goBack();}} onSignIn={()=>{setAddressPicker(false);setOpenCartAfterAddress(false);setScreen('profile');}}/>
    {pendingPaymentOrder&&token&&<OrderPaymentModal visible={paymentPickerVisible} token={token} amountMinor={pendingPaymentOrder.totalMinor} busy={busy} error={paymentError} colors={colors} onClose={()=>setPaymentPickerVisible(false)} onPay={method=>void payForOrder(method)}/>}
    {orderCheckout&&<PaystackCheckoutModal visible authorizationUrl={orderCheckout.authorizationUrl} reference={orderCheckout.reference} colors={colors} subtitle={`Pay for order ${orderCheckout.orderId.slice(-8)}`} confirmationMessage="Your order will be confirmed after Paystack verifies the payment." onClose={closeOrderCheckout} onPaymentReturn={reference=>void handleOrderPaymentReturn(reference)}/>}
    {notice?<View pointerEvents="box-none" accessibilityLiveRegion="polite" style={[toastStyles.position,primaryTab&&toastStyles.aboveTabBar]}>
      <View style={toastStyles.toast}>
        {notice===cartAddedNotice?<Pressable accessibilityRole="button" accessibilityHint="Opens your bag" onPress={()=>{setNotice('');setCartAddedNotice('');setCartVisible(true);}} style={{flex:1,flexDirection:'row',alignItems:'center',gap:10}}>
          <View style={toastStyles.icon}><Ionicons name="information-circle-outline" size={21} color={palette.primary}/></View>
          <Text style={toastStyles.message}>{notice}</Text>
        </Pressable>:<>
          <View style={toastStyles.icon}><Ionicons name="information-circle-outline" size={21} color={palette.primary}/></View>
          <Text style={toastStyles.message}>{notice}</Text>
        </>}
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" onPress={()=>{setNotice('');setCartAddedNotice('');}} style={toastStyles.dismiss}><Ionicons name="close" size={19} color={colors.muted}/></Pressable>
      </View>
    </View>:null}
  </SafeAreaView>;
}

const createStyles=(colors:AppColors)=>{
  const c=customerPalette(colors);
  return StyleSheet.create({
    safe:{flex:1,backgroundColor:c.canvas},
    header:{minHeight:68,paddingHorizontal:16,backgroundColor:c.canvas,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
    locationCaption:{fontSize:9,letterSpacing:1,color:c.muted,fontWeight:'900'},
    locationRow:{flexDirection:'row',alignItems:'center',gap:5,marginTop:3},
    locationName:{fontSize:13,color:c.ink,fontWeight:'800',flexShrink:1},
    themeToggle:{paddingHorizontal:8,paddingVertical:7,borderRadius:customerRadius.md,backgroundColor:c.surfaceAlt},
    notificationDot:{position:'absolute',right:5,top:3,width:8,height:8,borderRadius:4,backgroundColor:c.accent,borderWidth:1,borderColor:c.canvas},
  });
};
