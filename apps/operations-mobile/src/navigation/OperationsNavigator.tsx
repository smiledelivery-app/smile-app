import { AppText as Text } from '@makanza/mobile-ui';
import type { CancellationReason } from '@makanza/mobile-ui';
import { isRunningInExpoGo } from 'expo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Image, Linking, Platform, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '../components/AppIcon';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { ApiError, type NotificationInbox, type NotificationInboxItem, type RiderDelivery, type RiderOffer, type RiderProfile, type Session, type VendorOrder } from '@makanza/mobile-core';
import { api } from '../services/api';
import { darkColors, lightColors, type AppColors } from '../theme/colors';
import OnboardingScreen from '../onboarding/OnboardingScreen';
import RoleChoiceScreen from '../onboarding/RoleChoiceScreen';
import SignInScreen from '../auth/SignInScreen';
import FontSplashScreen from '../components/FontSplashScreen';
import VendorWorkspace from './VendorWorkspace';
import RiderWorkspace from './RiderWorkspace';

type WorkRole='VENDOR'|'RIDER';

// expo-secure-store is native-only. Use browser storage for the web preview so
// restoring preferences/session state never crashes the app before it renders.
const readStorage=(key:string):Promise<string|null>=>Platform.OS==='web'
  ? Promise.resolve(typeof window==='undefined'?null:window.localStorage.getItem(key))
  : SecureStore.getItemAsync(key);
const writeStorage=(key:string,value:string):Promise<void>=>Platform.OS==='web'
  ? Promise.resolve(typeof window==='undefined'?undefined:window.localStorage.setItem(key,value))
  : SecureStore.setItemAsync(key,value);
const removeStorage=(key:string):Promise<void>=>Platform.OS==='web'
  ? Promise.resolve(typeof window==='undefined'?undefined:window.localStorage.removeItem(key))
  : SecureStore.deleteItemAsync(key);

export default function App(){
  const [session,setSession]=useState<Session|null>(null);
  const [colorMode,setColorMode]=useState<'light'|'dark'>('light');
  const [riderAutoRefresh,setRiderAutoRefresh]=useState(true);const [riderNewsletter,setRiderNewsletter]=useState(false);
  const [onboardingReady,setOnboardingReady]=useState(false);
  const [authReady,setAuthReady]=useState(false);
  const [preferencesReady,setPreferencesReady]=useState(false);
  const [hasOnboarded,setHasOnboarded]=useState(false);
  const [selectedRole,setSelectedRole]=useState<WorkRole|null>(null);
  const [role,setRole]=useState<WorkRole|null>(null);
  const [vendorNotificationsOpen,setVendorNotificationsOpen]=useState(false);
  const [notificationOpenSignal,setNotificationOpenSignal]=useState(0);
  const [notificationInbox,setNotificationInbox]=useState<NotificationInbox>({items:[],unreadCount:0});
  const [notificationsLoading,setNotificationsLoading]=useState(false);
  const [notificationsError,setNotificationsError]=useState('');
  const [pushToken,setPushToken]=useState('');
  const [vendorStoreName,setVendorStoreName]=useState('Your store');const [vendorOnIndex,setVendorOnIndex]=useState(true);
  const [vendorOrders,setVendorOrders]=useState<VendorOrder[]>([]);
  const [riderProfile,setRiderProfile]=useState<RiderProfile|null>(null);
  const [offers,setOffers]=useState<RiderOffer[]>([]);
  const [deliveries,setDeliveries]=useState<RiderDelivery[]>([]);
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [vehicleType,setVehicleType]=useState('');const [serviceArea,setServiceArea]=useState('');const [termsAccepted,setTermsAccepted]=useState(false);
  const [riderApplication,setRiderApplication]=useState({dateOfBirth:'',nin:'',ninDocumentPublicId:'',ninDocumentVersion:'',ninDocumentName:'',plateNumber:'',residentialAddress:'',guarantorName:'',guarantorNin:'',guarantorAddress:'',accountNumber:'',bankCode:''});
  const [completionCodes,setCompletionCodes]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(false);const [busy,setBusy]=useState('');const [error,setError]=useState('');const [notice,setNotice]=useState('');const [locationMessage,setLocationMessage]=useState('');
  const [locationSharing,setLocationSharing]=useState(false);
  const [locationPermissionNeeded,setLocationPermissionNeeded]=useState(false);
  const locationSubscription=useRef<Location.LocationSubscription|null>(null);
  const c=colorMode==='dark'?darkColors:lightColors;
  const s=createStyles(c);
  const isDark=colorMode==='dark';
  const toggleTheme=()=>{const next=isDark?'light':'dark';setColorMode(next);void writeStorage('makanza-operations-theme-v1',next).catch(()=>undefined);};
  const token=session?.token;

  useEffect(()=>{
    if(Platform.OS==='web'||isRunningInExpoGo()||process.env.EXPO_PUBLIC_ENABLE_PUSH!=='true')return;
    let active=true;
    void import('expo-notifications').then(Notifications=>{
      if(active)Notifications.setNotificationHandler({handleNotification:async()=>({shouldPlaySound:true,shouldSetBadge:true,shouldShowBanner:true,shouldShowList:true})});
    }).catch(reason=>{if(active)setNotice(reason instanceof Error?`Push notifications are unavailable: ${reason.message}`:'Push notifications are unavailable.');});
    return()=>{active=false;};
  },[]);

  useEffect(()=>{const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{if(session)return false;if(selectedRole){setSelectedRole(null);setRole(null);setError('');void removeStorage('makanza-operations-work-role-v1').catch(()=>undefined);return true;}return false;});return()=>subscription.remove();  },[session,selectedRole]);

  useEffect(()=>{let active=true;void Promise.all([readStorage('makanza-operations-theme-v1').catch(()=>null),readStorage('makanza-operations-auto-refresh-v1').catch(()=>null),readStorage('makanza-operations-newsletter-v1').catch(()=>null)]).then(([theme,refresh,newsletter])=>{if(!active)return;if(theme==='dark'||theme==='light')setColorMode(theme);if(refresh==='false')setRiderAutoRefresh(false);if(newsletter==='true')setRiderNewsletter(true);}).finally(()=>{if(active)setPreferencesReady(true);});return()=>{active=false;};},[]);
  useEffect(()=>{let active=true;void readStorage('makanza-operations-onboarding-v2').then(value=>{if(active)setHasOnboarded(value==='complete');}).catch(()=>{if(active)setHasOnboarded(false);}).finally(()=>{if(active)setOnboardingReady(true);});return()=>{active=false;};},[]);

  const stopLocationUpdates=useCallback(()=>{locationSubscription.current?.remove();locationSubscription.current=null;setLocationSharing(false);},[]);
  const loadVendorOrders=useCallback(async(currentToken:string,quiet=false)=>{if(!quiet){setLoading(true);setError('');}try{setVendorOrders(await api.get<VendorOrder[]>('/vendor/orders',currentToken));setError('');}catch(e){setError(e instanceof Error?e.message:'Could not load kitchen orders.');}finally{if(!quiet)setLoading(false);}},[]);
  const loadNotifications=useCallback(async(currentToken:string,quiet=false)=>{if(!quiet)setNotificationsLoading(true);setNotificationsError('');try{setNotificationInbox(await api.get<NotificationInbox>('/notifications',currentToken));}catch(e){setNotificationsError(e instanceof Error?e.message:'Could not load notifications.');}finally{if(!quiet)setNotificationsLoading(false);}},[]);
  const readNotification=useCallback(async(item:NotificationInboxItem)=>{const currentToken=token;if(!currentToken||item.readAt)return;try{await api.patch(`/notifications/${encodeURIComponent(item.id)}/read`,{},currentToken);setNotificationInbox(current=>({...current,unreadCount:Math.max(0,current.unreadCount-1),items:current.items.map(row=>row.id===item.id?{...row,readAt:new Date().toISOString()}:row)}));}catch(reason){setNotificationsError(reason instanceof Error?reason.message:'Could not mark notification read.');}},[token]);
  const readAllNotifications=useCallback(async()=>{if(!token)return;try{await api.patch('/notifications/read-all',{},token);const readAt=new Date().toISOString();setNotificationInbox(current=>({...current,unreadCount:0,items:current.items.map(item=>({...item,readAt}))}));}catch(reason){setNotificationsError(reason instanceof Error?reason.message:'Could not mark notifications read.');}},[token]);

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
        void loadNotifications(token);
        if(role==='VENDOR')setVendorNotificationsOpen(true);
        if(role==='RIDER')setNotificationOpenSignal(value=>value+1);
      });
    }).catch(reason=>{if(active)setNotificationsError(reason instanceof Error?`Push notifications are unavailable: ${reason.message}`:'Push notifications are unavailable.');});
    return()=>{active=false;received?.remove();response?.remove();appState.remove();};
  },[token,role,loadNotifications]);
  useEffect(()=>{if(token)void loadNotifications(token);else setNotificationInbox({items:[],unreadCount:0});},[token,loadNotifications]);
  const loadRiderData=useCallback(async(currentToken:string,quiet=false)=>{
    if(!quiet)setLoading(true);setError('');
    try{
      const profile=await api.get<RiderProfile>('/rider/profile',currentToken);
      setRiderProfile(profile);
      if(profile.status!=='APPROVED'){setOffers([]);setDeliveries([]);return;}
      const [deliveryResult,offerResult]=await Promise.allSettled([
        api.get<RiderDelivery[]>('/rider/deliveries',currentToken),
        profile.available?api.get<RiderOffer[]>('/rider/offers',currentToken):Promise.resolve([] as RiderOffer[])
      ]);
      if(deliveryResult.status==='fulfilled')setDeliveries(deliveryResult.value);else throw deliveryResult.reason;
      if(offerResult.status==='fulfilled')setOffers(offerResult.value);else throw offerResult.reason;
    }catch(e){setError(e instanceof Error?e.message:'Could not load rider information.');}
    finally{if(!quiet)setLoading(false);}
  },[]);

  useEffect(()=>{
    let active=true;
    void (async()=>{
      let savedSession:Session|null=null;
      let preferredRole:WorkRole|null=null;
      try{
        const [saved,storedRole]=await Promise.all([readStorage('makanza-ops-session'),readStorage('makanza-operations-work-role-v1')]);
        if(storedRole==='VENDOR'||storedRole==='RIDER')preferredRole=storedRole;
        if(active&&preferredRole)setSelectedRole(preferredRole);
        if(!saved)return;
        try{const parsed=JSON.parse(saved) as Session;if(!parsed?.token||!parsed.user?.roles)throw new Error('Saved account data is incomplete.');savedSession=parsed;if(!preferredRole)preferredRole=parsed.user.roles.includes('VENDOR')?'VENDOR':parsed.user.roles.includes('RIDER')?'RIDER':null;if(active&&preferredRole)setSelectedRole(preferredRole);}
        catch{await removeStorage('makanza-ops-session');if(active)setError('Saved account data was not valid. Sign in again.');return;}
        if(!savedSession)return;
        try{
          const identity=await api.get<{userId:string;roles:string[];isDemo:boolean}>('/auth/me',savedSession.token);
          if(!active)return;
          const roles=identity.roles;
          const selected=preferredRole&&roles.includes(preferredRole)?preferredRole:roles.includes('VENDOR')?'VENDOR':roles.includes('RIDER')?'RIDER':null;
          const restored={...savedSession,user:{...savedSession.user,roles,isDemo:identity.isDemo}};
          setSession(restored);setSelectedRole(selected);setRole(selected);
          if(selected)await writeStorage('makanza-operations-work-role-v1',selected).catch(()=>undefined);
          if(selected==='VENDOR')await loadVendorOrders(savedSession.token);
          if(selected==='RIDER')await loadRiderData(savedSession.token);
        }catch(error){
          if(error instanceof ApiError&&error.status===401){await removeStorage('makanza-ops-session');if(active){setSession(null);setRole(null);setSelectedRole(preferredRole);}}
          else if(active&&savedSession){const roles=savedSession.user.roles;const selected=preferredRole&&roles.includes(preferredRole)?preferredRole:roles.includes('VENDOR')?'VENDOR':roles.includes('RIDER')?'RIDER':null;setSession(savedSession);setSelectedRole(selected);setRole(selected);setError(error instanceof Error?error.message:'Could not validate your saved account.');}
        }
      }catch(error){if(active)setError(error instanceof Error?error.message:'Could not restore saved app data.');}
      finally{if(active)setAuthReady(true);}
    })();
    return()=>{active=false;};
  },[loadRiderData,loadVendorOrders]);

  // Location updates are foreground only. Going to the background stops the watcher;
  // an online rider is also marked offline until they explicitly resume in the app.
  useEffect(()=>{
    const subscription=AppState.addEventListener('change',next=>{
      if(next!=='active'){
        stopLocationUpdates();
        if(token&&riderProfile?.available){
          void api.put<{available:boolean}>('/rider/availability',{available:false},token).catch(()=>undefined);
          setRiderProfile(profile=>profile?{...profile,available:false}:profile);
          setNotice('Location sharing stopped in the background. You are offline; go online again when ready.');
        }
      }
    });
    return()=>subscription.remove();
  },[riderProfile?.available,stopLocationUpdates,token]);

  useEffect(()=>{
    if(role!=='RIDER'||!token||riderProfile?.status!=='APPROVED'||!riderAutoRefresh)return;
    const timer=setInterval(()=>{if(AppState.currentState==='active')void loadRiderData(token,true);},20000);
    return()=>clearInterval(timer);
  },[role,token,riderProfile?.status,riderProfile?.available,riderAutoRefresh,loadRiderData]);
  useEffect(()=>{if(role!=='VENDOR'||!token||!session?.user.roles.includes('VENDOR'))return;const timer=setInterval(()=>{if(AppState.currentState==='active')void loadVendorOrders(token,true);},15000);return()=>clearInterval(timer);},[role,token,loadVendorOrders,session?.user.roles]);

  const signIn=async()=>{
    setBusy('login');setError('');
    try{
      if(!selectedRole)throw new Error('Choose vendor or rider before signing in.');
      const result=await api.post<Session>('/auth/login',{email,password});
      await writeStorage('makanza-ops-session',JSON.stringify(result));setSession(result);setPassword('');
      setRole(selectedRole);
      if(selectedRole==='VENDOR'&&result.user.roles.includes('VENDOR'))void loadVendorOrders(result.token);
      if(selectedRole==='RIDER'&&result.user.roles.includes('RIDER'))void loadRiderData(result.token);
      if(!result.user.roles.includes(selectedRole))setNotice(`You are signed in. Complete the ${selectedRole==='VENDOR'?'vendor':'rider'} application to request access.`);
    }catch(e){setError(e instanceof Error?e.message:'Could not sign in.');}
    finally{setBusy('');}
  };

  const beginSignup=async(name:string,emailValue:string,phone:string,passwordValue:string,channel:'sms'|'whatsapp')=>{
    if(!selectedRole)return null;setBusy('signup');setError('');
    try{
      const result=await api.post<Session|{phone:string;channel:string;expiresAt:string}>('/auth/register',{name,email:emailValue,phone,password:passwordValue,channel});
      if('token'in result){await writeStorage('makanza-ops-session',JSON.stringify(result));setSession(result);setRole(selectedRole);setPassword('');setNotice(`Account created. Complete your ${selectedRole==='VENDOR'?'vendor':'rider'} application to request access.`);return null;}
      setNotice(`Verification code sent by ${channel==='sms'?'SMS':'WhatsApp'}.`);return result.phone;
    }catch(e){setError(e instanceof Error?e.message:'Could not start signup.');return null;}
    finally{setBusy('');}
  };

  const verifySignup=async(phone:string,code:string)=>{
    if(!selectedRole)return;setBusy('verify');setError('');
    try{const result=await api.post<Session>('/auth/register/verify',{phone,code});await writeStorage('makanza-ops-session',JSON.stringify(result));setSession(result);setRole(selectedRole);setPassword('');setNotice(`Phone verified. Complete your ${selectedRole==='VENDOR'?'vendor':'rider'} application to request access.`);}
    catch(e){setError(e instanceof Error?e.message:'Could not verify your phone.');}
    finally{setBusy('');}
  };

  const resendSignup=async(phone:string):Promise<boolean>=>{
    setBusy('verify');setError('');
    try{await api.post('/auth/register/resend',{phone});setNotice('A new verification code was sent.');return true;}
    catch(e){setError(e instanceof Error?e.message:'Could not resend the verification code.');return false;}
    finally{setBusy('');}
  };

  const updateOrder=async(orderId:string,status:string,reason?:string)=>{
    if(!token)return;setBusy(orderId);setError('');
    try{const updated=await api.post<VendorOrder>(`/vendor/orders/${encodeURIComponent(orderId)}/status`,{status,...(reason?{reason}: {})},token);setVendorOrders(rows=>rows.map(order=>order.id===orderId?updated:order));}
    catch(e){setError(e instanceof Error?e.message:'Could not update this order.');}
    finally{setBusy('');}
  };
  const verifyVendorPickup=async(orderId:string,code:string)=>{if(!token)return;if(!/^\d{6}$/.test(code)){setError('Enter the six-digit code shown in the rider app.');return;}setBusy(orderId);setError('');try{await api.post(`/vendor/orders/${encodeURIComponent(orderId)}/pickup`,{code},token);setNotice('Rider pickup verified. The rider can now continue to the customer.');await loadVendorOrders(token);}catch(e){setError(e instanceof Error?e.message:'Could not verify the rider pickup code. Ask the rider to show the code again.');}finally{setBusy('');}};
  const cancelRoleOrder=async(kind:'vendor'|'rider',orderOrDeliveryId:string,reason:CancellationReason,details:string)=>{if(!token)return;setBusy(orderOrDeliveryId);setError('');try{const path=kind==='vendor'?`/vendor/orders/${encodeURIComponent(orderOrDeliveryId)}/cancel`:`/rider/deliveries/${encodeURIComponent(orderOrDeliveryId)}/cancel`;await api.post(path,{reason,details:details||undefined},token);setNotice(kind==='vendor'?'Order cancelled and the reason was recorded.':'Delivery cancelled and the order was updated.');if(kind==='vendor')await loadVendorOrders(token);else await loadRiderData(token);}catch(e){setError(e instanceof Error?e.message:'Could not cancel this order.');}finally{setBusy('');}};

  const applyForRider=async()=>{
    if(!token)return;
    setBusy('application');setError('');
    try{
      const profile=await api.post<{id:string;status:string;available:boolean}>('/rider/onboarding',{vehicleType,serviceArea,...riderApplication,ninDocumentVersion:Number(riderApplication.ninDocumentVersion),termsAccepted:true},token);
      const updated={...session!,user:{...session!.user,roles:Array.from(new Set([...session!.user.roles,'RIDER']))}};
      await writeStorage('makanza-ops-session',JSON.stringify(updated));setSession(updated);
      setRiderProfile({...profile,vehicleType,serviceArea,location:null});setOffers([]);setDeliveries([]);setNotice('Your application was submitted for review.');
    }catch(e){setError(e instanceof Error?e.message:'Could not submit the rider application.');}
    finally{setBusy('');}
  };

  const startForegroundLocation=async()=>{
    if(!token)throw new Error('Sign in again before sharing location.');
    const permission=await Location.requestForegroundPermissionsAsync();
    if(permission.status!=='granted'){setLocationPermissionNeeded(true);throw new Error('Location permission is required for rider offers. Enable it in device settings.');}
    setLocationPermissionNeeded(false);
    const current=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
    const point={latitude:current.coords.latitude,longitude:current.coords.longitude};
    await api.put<{updatedAt:string}>('/rider/location',point,token);
    locationSubscription.current?.remove();
    locationSubscription.current=await Location.watchPositionAsync({accuracy:Location.Accuracy.Balanced,timeInterval:60000,distanceInterval:100},position=>{
      void api.put('/rider/location',{latitude:position.coords.latitude,longitude:position.coords.longitude},token).then(()=>setLocationMessage(`Updated ${new Date().toLocaleTimeString()}`)).catch(e=>setLocationMessage(e instanceof Error?e.message:'Could not send the latest location.'));
    });
    setLocationSharing(true);
    setLocationMessage(`Updated ${new Date().toLocaleTimeString()}`);
  };

  const setAvailability=async(available:boolean)=>{
    if(!token)return;
    setBusy('availability');setError('');
    try{
      if(available)await startForegroundLocation();
      const result=await api.put<{available:boolean}>('/rider/availability',{available},token);
      if(!available)stopLocationUpdates();
      setRiderProfile(profile=>profile?{...profile,available:result.available}:profile);
      setNotice(available?'You are online and can receive delivery offers.':'You are offline.');
      if(available)void loadRiderData(token);
    }catch(e){if(available)stopLocationUpdates();setError(e instanceof Error?e.message:'Could not change availability.');}
    finally{setBusy('');}
  };

  const acceptOffer=async(offer:RiderOffer)=>{
    if(!token)return;setBusy(offer.id);setError('');
    try{
      await api.post(`/rider/offers/${encodeURIComponent(offer.id)}/accept`,{},token);
      setNotice('Delivery accepted. Keep Smile open while you travel; location sharing runs only in the foreground.');
      try{await startForegroundLocation();}catch(e){setLocationMessage(e instanceof Error?e.message:'Location sharing is unavailable.');}
      await loadRiderData(token);
    }catch(e){setError(e instanceof Error?e.message:'Could not accept the offer. Refresh for the latest assignment.');await loadRiderData(token);}
    finally{setBusy('');}
  };
  const rejectOffer=async(offer:RiderOffer)=>{
    if(!token)return;setBusy(offer.id);setError('');
    try{await api.post(`/rider/offers/${encodeURIComponent(offer.id)}/reject`,{},token);setOffers(rows=>rows.filter(row=>row.id!==offer.id));}
    catch(e){setError(e instanceof Error?e.message:'Could not reject this offer. Refresh and retry.');await loadRiderData(token);}
    finally{setBusy('');}
  };
  const complete=async(delivery:RiderDelivery)=>{
    if(!token)return;const code=completionCodes[delivery.id]??'';
    if(!/^\d{6}$/.test(code)){setError('Enter the customerâ€™s six-digit delivery code.');return;}
    setBusy(delivery.id);setError('');
    try{
      await api.post(`/rider/deliveries/${encodeURIComponent(delivery.id)}/complete`,{code},token);
      setCompletionCodes(current=>({...current,[delivery.id]:''}));setNotice('Delivery complete. The customerâ€™s code was verified by the server.');
      try{await startForegroundLocation();}catch(e){setLocationMessage(e instanceof Error?e.message:'Could not resume foreground location sharing.');await api.put('/rider/availability',{available:false},token).catch(()=>undefined);setRiderProfile(profile=>profile?{...profile,available:false}:profile);}
      await loadRiderData(token);
    }catch(e){setError(e instanceof Error?e.message:'Delivery could not be completed. Check the code and delivery state.');}
    finally{setBusy('');}
  };

  const signOut=async()=>{
    const current=token;if(current&&role==='RIDER'&&riderProfile?.available)await api.put('/rider/availability',{available:false},current).catch(()=>setNotice('Could not confirm offline status because the network is unavailable.'));
    if(current&&pushToken)try{await api.delete('/notifications/devices',current,{token:pushToken});}catch(reason){setNotice(reason instanceof Error?`Push device could not be unregistered: ${reason.message}`:'Push device could not be unregistered.');}
    setPushToken('');
    stopLocationUpdates();setSession(null);setRole(null);setSelectedRole(null);setVendorOrders([]);setRiderProfile(null);setOffers([]);setDeliveries([]);await Promise.all([removeStorage('makanza-ops-session'),removeStorage('makanza-operations-work-role-v1')]);
    if(current)void api.post('/auth/logout',{},current).catch(()=>undefined);
  };
  const switchRole=(next:WorkRole)=>{if(session)return;setSelectedRole(next);setRole(next);setError('');void writeStorage('makanza-operations-work-role-v1',next).catch(()=>undefined);};
  const selectSessionWorkspace=(next:WorkRole)=>{setSelectedRole(next);setRole(next);setError('');void writeStorage('makanza-operations-work-role-v1',next).catch(()=>undefined);if(!token||!session?.user.roles.includes(next))return;if(next==='VENDOR')void loadVendorOrders(token);if(next==='RIDER')void loadRiderData(token);};

  const finishOnboarding=async(nextRole?:WorkRole)=>{setHasOnboarded(true);setOnboardingReady(true);await writeStorage('makanza-operations-onboarding-v2','complete').catch(()=>undefined);if(nextRole)switchRole(nextRole);};
  const changeRole=()=>{setSelectedRole(null);setRole(null);setError('');void removeStorage('makanza-operations-work-role-v1').catch(()=>undefined);};
  if(!onboardingReady||!authReady||!preferencesReady)return <FontSplashScreen/>;
  if(!hasOnboarded)return <OnboardingScreen dark={isDark} onTheme={toggleTheme} onComplete={()=>void finishOnboarding()} onSelectRole={next=>void finishOnboarding(next)}/>;
  if(!session&&!selectedRole)return <RoleChoiceScreen dark={isDark} onTheme={toggleTheme} onSelectRole={switchRole}/>;
  if(session&&role===null)return <RoleChoiceScreen dark={isDark} signedIn onTheme={toggleTheme} onSelectRole={selectSessionWorkspace}/>;
  if(!session&&selectedRole)return <SignInScreen role={selectedRole} dark={isDark} email={email} password={password} busy={busy} error={error} onEmail={setEmail} onPassword={setPassword} onLogin={()=>void signIn()} onSignup={beginSignup} onVerify={(phone,code)=>void verifySignup(phone,code)} onResend={resendSignup} onChangeRole={changeRole} onTheme={toggleTheme}/>;
  return <SafeAreaView style={s.safe}>
    <StatusBar barStyle={isDark?'light-content':'dark-content'} backgroundColor={c.paper} translucent={false}/>
    {role!=='RIDER'&&(role!=='VENDOR'||vendorOnIndex)&&<View style={s.header}>{role==='VENDOR'&&vendorOnIndex?<Text numberOfLines={1} style={s.storeHeaderName}>{vendorStoreName}</Text>:<View style={{flexDirection:'row',alignItems:'center',gap:7}}><Image accessibilityLabel="Smile logo" source={require('../../assets/smile-logo.png')} resizeMode="contain" style={{width:38,height:38}}/><Text style={s.ops}>OPS</Text></View>}<View style={s.headerActions}>{role==='VENDOR'&&<Pressable accessibilityRole="button" accessibilityLabel={`Vendor notifications, ${notificationInbox.unreadCount} unread`} onPress={()=>{setVendorNotificationsOpen(true);if(token)void loadNotifications(token);}}><Ionicons name="notifications-outline" size={21} color={c.green}/>{notificationInbox.unreadCount>0&&<View style={{position:'absolute',top:2,right:0,width:8,height:8,borderRadius:4,backgroundColor:'#d66b45'}}/>}</Pressable>}<Pressable accessibilityRole="button" accessibilityLabel={isDark?'Switch to light mode':'Switch to dark mode'} onPress={toggleTheme} style={s.themeToggle}><Ionicons name={isDark?'sunny-outline':'moon-outline'} size={22} color={c.green}/></Pressable>{session&&role!=='VENDOR'&&<Pressable accessibilityRole="button" onPress={()=>void signOut()}><Text style={s.signOut}>Sign out</Text></Pressable>}</View></View>}
    {session&&<>
        {role==='VENDOR'&&<VendorWorkspace token={token??''} authorized={session.user.roles.includes('VENDOR')} orders={vendorOrders} busyId={busy} loading={loading} error={error} colors={c} notifications={notificationInbox.items} unreadNotifications={notificationInbox.unreadCount} notificationsLoading={notificationsLoading} notificationsError={notificationsError} notificationsOpen={vendorNotificationsOpen} onCloseNotifications={()=>setVendorNotificationsOpen(false)} onReloadNotifications={()=>token&&void loadNotifications(token)} onReadNotification={item=>void readNotification(item)} onReadAllNotifications={()=>void readAllNotifications()} onToggleTheme={toggleTheme} onReload={()=>token&&void loadVendorOrders(token)} onOrderAction={(id,status,reason)=>void updateOrder(id,status,reason)} onVerifyPickup={(id,code)=>void verifyVendorPickup(id,code)} onCancelOrder={(id,reason,details)=>void cancelRoleOrder('vendor',id,reason,details)} onSignOut={()=>void signOut()} onStoreName={setVendorStoreName} onIndexChange={setVendorOnIndex} onAuthorized={()=>{const updated={...session,user:{...session.user,roles:Array.from(new Set([...session.user.roles,'VENDOR']))}};void writeStorage('makanza-ops-session',JSON.stringify(updated));setSession(updated);void loadVendorOrders(token??'');}}/>}
      {role==='RIDER'&&<RiderWorkspace token={token??''} user={session.user} name={session.user.name} authorized={session.user.roles.includes('RIDER')} profile={riderProfile} offers={offers} deliveries={deliveries} notifications={notificationInbox.items} unreadNotifications={notificationInbox.unreadCount} notificationsLoading={notificationsLoading} notificationsError={notificationsError} notificationsOpenSignal={notificationOpenSignal} onReloadNotifications={()=>token&&void loadNotifications(token)} onReadNotification={item=>void readNotification(item)} onReadAllNotifications={()=>void readAllNotifications()} loading={loading} busy={busy} error={error} notice={notice} locationMessage={locationMessage} locationSharing={locationSharing} locationPermissionNeeded={locationPermissionNeeded} vehicleType={vehicleType} serviceArea={serviceArea} termsAccepted={termsAccepted} riderApplication={riderApplication} onRiderApplicationChange={(key,value)=>setRiderApplication(current=>({...current,[key]:value}))} completionCodes={completionCodes} colors={c} onCancel={(id,reason,details)=>void cancelRoleOrder('rider',id,reason,details)} onReload={()=>token&&void loadRiderData(token)} onAvailability={available=>void setAvailability(available)} onAccept={offer=>void acceptOffer(offer)} onReject={offer=>void rejectOffer(offer)} onComplete={delivery=>void complete(delivery)} onCode={(id,code)=>setCompletionCodes(current=>({...current,[id]:code}))} onShareLocation={()=>void startForegroundLocation().catch(e=>setLocationMessage(e instanceof Error?e.message:'Location sharing could not start.'))} onOpenSettings={()=>void Linking.openSettings()} onVehicle={setVehicleType} onArea={setServiceArea} onTerms={()=>setTermsAccepted(value=>!value)} onApply={()=>void applyForRider()} onSignOut={()=>void signOut()} onTheme={toggleTheme} autoRefresh={riderAutoRefresh} newsletter={riderNewsletter} onAutoRefresh={value=>{setRiderAutoRefresh(value);void writeStorage('makanza-operations-auto-refresh-v1',String(value));}} onNewsletter={value=>{setRiderNewsletter(value);void writeStorage('makanza-operations-newsletter-v1',String(value));}} onProfileSaved={(name,phone)=>{const updated={...session,user:{...session.user,name,phone}};setSession(updated);void writeStorage('makanza-ops-session',JSON.stringify(updated));}}/>}
    </>}
  </SafeAreaView>;
}

const createStyles=(c:AppColors)=>StyleSheet.create({safe:{flex:1,backgroundColor:c.paper},headerActions:{flexDirection:'row',alignItems:'center',gap:9},storeHeaderName:{flex:1,fontSize:18,fontWeight:'900',color:c.ink,marginRight:8},themeToggle:{paddingHorizontal:9,paddingVertical:7,borderRadius:0,backgroundColor:c.card},themeText:{fontSize:11,fontWeight:'800',color:c.green},flex:{flex:1},header:{height:62,paddingHorizontal:18,backgroundColor:c.cream,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},brand:{fontSize:23,fontWeight:'800',color:c.ink,letterSpacing:-.6},mark:{backgroundColor:c.green,color:c.lime,borderRadius:0,overflow:'hidden',paddingHorizontal:7,fontFamily:'serif'},ops:{fontSize:11,color:c.orange,letterSpacing:1.2},signOut:{fontSize:13,color:c.green,fontWeight:'700'},login:{padding:23,justifyContent:'center',flexGrow:1},eyebrow:{fontSize:11,letterSpacing:1.4,color:'#527452',fontWeight:'800',marginBottom:12},title:{fontSize:35,lineHeight:42,fontWeight:'700',letterSpacing:-1,color:c.ink},subtitle:{fontSize:15,lineHeight:22,color:c.muted,marginTop:8,marginBottom:15},label:{fontSize:13,color:c.ink,fontWeight:'700',marginTop:12,marginBottom:6},inputGroup:{marginTop:4},input:{height:45,borderColor:c.isDark?c.line:'#9aa99f',borderWidth:1,borderRadius:0,paddingHorizontal:12,backgroundColor:c.card,fontSize:15,color:c.ink},button:{minHeight:41,paddingHorizontal:14,borderRadius:0,backgroundColor:c.green,justifyContent:'center',alignItems:'center'},buttonText:{fontSize:13,fontWeight:'800',color:c.isDark?'#17231b':'white'},buttonSecondary:{backgroundColor:c.card,borderWidth:1,borderColor:c.line},buttonSecondaryText:{color:c.green},disabled:{opacity:.5},error:{fontSize:13,lineHeight:21,color:'#a44232',marginVertical:10},hero:{padding:20,backgroundColor:c.isDark?'#194c3a':c.green,borderBottomLeftRadius: 0,borderBottomRightRadius: 0},refresh:{backgroundColor:'rgba(255,255,255,.14)',paddingHorizontal:11,paddingVertical:8,borderRadius:0},refreshText:{fontSize:12,color:c.lime,fontWeight:'800'},vendorEyebrow:{fontSize:11,letterSpacing:1.4,color:'#d5ef81',fontWeight:'800',marginBottom:8},vendorHeroTitle:{fontSize:32,lineHeight:38,fontWeight:'800',letterSpacing:-1,color:'white'},vendorHeroSubtitle:{fontSize:13,lineHeight:19,color:'#e5ecdf',marginTop:8,marginBottom:14},metrics:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'rgba(255,255,255,.10)',paddingVertical:12,paddingHorizontal:10,borderRadius:0,marginTop:7},metric:{flex:1,alignItems:'center'},metricValue:{fontSize:24,fontWeight:'800',color:'white'},metricLabel:{fontSize:9,letterSpacing:.7,fontWeight:'800',color:'#d9e5d1',marginTop:2},metricDivider:{width:1,height:28,backgroundColor:'rgba(255,255,255,.2)'},switchLink:{fontSize:12,color:c.lime,fontWeight:'700',marginTop:13},roleSwitch:{height:48,flexDirection:'row',borderBottomWidth:1,borderBottomColor:c.line},roleTab:{flex:1,alignItems:'center',justifyContent:'center'},roleTabActive:{borderBottomWidth:2,borderBottomColor:c.green},roleTabText:{fontSize:15,color:c.muted},roleTabTextActive:{fontWeight:'700',color:c.green},state:{padding:20,alignItems:'center',justifyContent:'center',gap:8},stateTitle:{fontSize:17,fontWeight:'700',color:c.ink},list:{padding:13,gap:10},orderCard:{padding:14,gap:11,borderWidth:0,borderColor:'transparent',borderRadius:0,backgroundColor:c.card,borderBottomWidth:1,borderBottomColor:c.line,shadowOpacity:0,elevation:0},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},orderId:{fontSize:15,fontWeight:'700',color:c.ink},status:{fontSize:11,color:c.green,backgroundColor:c.cream,paddingHorizontal:8,paddingVertical:5,borderRadius:0,textTransform:'capitalize'},items:{fontSize:13,lineHeight:21,color:c.muted},date:{fontSize:11,color:c.muted,flex:1},total:{fontSize:13,fontWeight:'700',color:c.green},actions:{flexDirection:'row',gap:8,justifyContent:'flex-end',marginTop:8},rider:{padding:16,gap:13,paddingBottom:30},riderHero:{minHeight:154,padding:19,borderRadius:0,backgroundColor:c.isDark?'#194c3a':c.green,flexDirection:'row',alignItems:'center',justifyContent:'space-between',overflow:'hidden'},riderEyebrow:{fontSize:11,letterSpacing:1.3,color:c.lime,fontWeight:'800',marginBottom:8},riderTitle:{fontSize:28,lineHeight:34,fontWeight:'800',letterSpacing:-.7,color:'white'},riderLead:{fontSize:12,color:'#e4ebdc',marginTop:7},riderOrbit:{width:70,height:70,borderRadius:0,backgroundColor:'rgba(213,239,129,.17)',alignItems:'center',justifyContent:'center',marginRight:2},riderOrbitIcon:{fontSize:43,color:c.lime,fontWeight:'700'},riderIntroRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:2},notice:{padding:16,borderRadius:0,backgroundColor:c.cream,borderWidth:1,borderColor:c.line},noticeTitle:{fontSize:17,fontWeight:'700',color:c.ink,marginBottom:7},muted:{fontSize:12,lineHeight:19,color:c.muted},terms:{flexDirection:'row',alignItems:'center',gap:9,marginTop:15},checkbox:{fontSize:24,color:c.green},termsText:{fontSize:13,color:c.ink,flex:1},riderSummary:{padding:15,borderRadius:0,borderWidth:0,borderColor:'transparent',backgroundColor:c.card,borderBottomWidth:1,borderBottomColor:c.line,gap:10},onlinePill:{paddingHorizontal:9,paddingVertical:5,borderRadius:0,backgroundColor:'#f1f2ed'},onlinePillActive:{backgroundColor:'#e9f3d7'},onlineText:{fontSize:10,fontWeight:'800',color:c.muted},onlineTextActive:{color:c.green},locationText:{fontSize:11,color:c.muted},sectionTitle:{fontSize:17,fontWeight:'700',color:c.ink,marginVertical:5},deliveryCard:{padding:16,gap:10,marginTop:10,borderWidth:0,borderColor:'transparent',borderRadius:0,backgroundColor:c.card,borderBottomWidth:1,borderBottomColor:c.line,shadowOpacity:0,elevation:0},offerCard:{padding:16,gap:10,marginTop:10,borderWidth:0,borderColor:'transparent',borderRadius:0,backgroundColor:c.card,borderBottomWidth:1,borderBottomColor:c.line,shadowOpacity:0,elevation:0},offerExpires:{fontSize:11,color:'#9a6836'},empty:{padding:18,alignItems:'center',gap:6,backgroundColor:c.cream,borderRadius:0}});
