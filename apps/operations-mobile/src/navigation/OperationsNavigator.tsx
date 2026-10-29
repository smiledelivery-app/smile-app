import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { ApiError, type RiderDelivery, type RiderOffer, type RiderProfile, type Session, type VendorOrder } from '@makanza/mobile-core';
import { api } from '../services/api';
import { darkColors, lightColors, type AppColors } from '../theme/colors';
import OnboardingScreen from '../onboarding/OnboardingScreen';
import SignInScreen from '../auth/SignInScreen';
import VendorWorkspace from './VendorWorkspace';
import RiderWorkspace from './RiderWorkspace';
import PublicTabsPreview from './PublicTabsPreview';
import { BrowseTabsContext } from './BrowseTabsContext';
import { mobileEnv } from '../config/env';

type WorkRole='VENDOR'|'RIDER';

export default function App(){
  const [session,setSession]=useState<Session|null>(null);
  const [colorMode,setColorMode]=useState<'light'|'dark'>('light');
  const [onboardingReady,setOnboardingReady]=useState(false);
  const [hasOnboarded,setHasOnboarded]=useState(false);
  const [role,setRole]=useState<WorkRole|null>(null);
  const [browsingTabs,setBrowsingTabs]=useState(mobileEnv.demoMode);
  const [vendorOrders,setVendorOrders]=useState<VendorOrder[]>([]);
  const [riderProfile,setRiderProfile]=useState<RiderProfile|null>(null);
  const [offers,setOffers]=useState<RiderOffer[]>([]);
  const [deliveries,setDeliveries]=useState<RiderDelivery[]>([]);
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [vehicleType,setVehicleType]=useState('');const [serviceArea,setServiceArea]=useState('');const [termsAccepted,setTermsAccepted]=useState(false);
  const [completionCodes,setCompletionCodes]=useState<Record<string,string>>({});
  const [pickupCodes,setPickupCodes]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(false);const [busy,setBusy]=useState('');const [error,setError]=useState('');const [notice,setNotice]=useState('');const [locationMessage,setLocationMessage]=useState('');
  const [locationSharing,setLocationSharing]=useState(false);
  const [locationPermissionNeeded,setLocationPermissionNeeded]=useState(false);
  const locationSubscription=useRef<Location.LocationSubscription|null>(null);
  const c=colorMode==='dark'?darkColors:lightColors;
  const s=createStyles(c);
  const isDark=colorMode==='dark';
  const toggleTheme=()=>{const next=isDark?'light':'dark';setColorMode(next);void SecureStore.setItemAsync('makanza-operations-theme-v1',next).catch(()=>undefined);};
  const token=session?.token;

  useEffect(()=>{SecureStore.getItemAsync('makanza-operations-theme-v1').then(value=>{if(value==='dark'||value==='light')setColorMode(value);}).catch(()=>undefined);},[]);
  useEffect(()=>{SecureStore.getItemAsync('makanza-operations-onboarding-v1').then(value=>setHasOnboarded(value==='complete')).catch(()=>setHasOnboarded(false)).finally(()=>setOnboardingReady(true));},[]);

  const stopLocationUpdates=useCallback(()=>{locationSubscription.current?.remove();locationSubscription.current=null;setLocationSharing(false);},[]);
  const loadVendorOrders=useCallback(async(currentToken:string,quiet=false)=>{if(!quiet){setLoading(true);setError('');}try{setVendorOrders(await api.get<VendorOrder[]>('/vendor/orders',currentToken));setError('');}catch(e){setError(e instanceof Error?e.message:'Could not load kitchen orders.');}finally{if(!quiet)setLoading(false);}},[]);
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
    SecureStore.getItemAsync('makanza-ops-session').then(async saved=>{
      if(mobileEnv.demoMode)return;
      if(!saved)return;
      try{
        const stored=JSON.parse(saved) as Session;
        const identity=await api.get<{userId:string;roles:string[]}>('/auth/me',stored.token);
        setSession({...stored,user:{...stored.user,roles:identity.roles}});
        if(identity.roles.includes('VENDOR')){setRole('VENDOR');void loadVendorOrders(stored.token);}
        else if(identity.roles.includes('RIDER')){setRole('RIDER');void loadRiderData(stored.token);}
        else setRole(null);
      }catch(e){if(e instanceof ApiError&&e.status===401)await SecureStore.deleteItemAsync('makanza-ops-session');else setError(e instanceof Error?e.message:'Could not restore your session.');}
    });
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
    if(role!=='RIDER'||!token||riderProfile?.status!=='APPROVED')return;
    const timer=setInterval(()=>{if(AppState.currentState==='active')void loadRiderData(token,true);},20000);
    return()=>clearInterval(timer);
  },[role,token,riderProfile?.status,riderProfile?.available,loadRiderData]);
  useEffect(()=>{if(role!=='VENDOR'||!token||!session?.user.roles.includes('VENDOR'))return;const timer=setInterval(()=>{if(AppState.currentState==='active')void loadVendorOrders(token,true);},15000);return()=>clearInterval(timer);},[role,token,loadVendorOrders,session?.user.roles]);

  const signIn=async()=>{
    setBusy('login');setError('');
    try{
      const result=await api.post<Session>('/auth/login',{email,password});
      await SecureStore.setItemAsync('makanza-ops-session',JSON.stringify(result));setSession(result);setPassword('');
      if(result.user.roles.includes('VENDOR')){setRole('VENDOR');void loadVendorOrders(result.token);}
      else if(result.user.roles.includes('RIDER')){setRole('RIDER');void loadRiderData(result.token);}
      else{setRole(null);setNotice('Choose whether you want to set up a store or apply as a rider.');}
    }catch(e){setError(e instanceof Error?e.message:'Could not sign in.');}
    finally{setBusy('');}
  };

  const updateOrder=async(orderId:string,status:string)=>{
    if(!token)return;setBusy(orderId);setError('');
    try{const updated=await api.post<VendorOrder>(`/vendor/orders/${encodeURIComponent(orderId)}/status`,{status},token);setVendorOrders(rows=>rows.map(order=>order.id===orderId?updated:order));}
    catch(e){setError(e instanceof Error?e.message:'Could not update this order.');}
    finally{setBusy('');}
  };

  const applyForRider=async()=>{
    if(!token)return;
    setBusy('application');setError('');
    try{
      const profile=await api.post<{id:string;status:string;available:boolean}>('/rider/onboarding',{vehicleType,serviceArea,termsAccepted:true},token);
      const updated={...session!,user:{...session!.user,roles:Array.from(new Set([...session!.user.roles,'RIDER']))}};
      await SecureStore.setItemAsync('makanza-ops-session',JSON.stringify(updated));setSession(updated);
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
  const pickup=async(delivery:RiderDelivery,code:string)=>{
    if(!token)return;setBusy(delivery.id);setError('');
    try{await api.post(`/rider/deliveries/${encodeURIComponent(delivery.id)}/pickup`,{code},token);setPickupCodes(current=>({...current,[delivery.id]:''}));setNotice('Vendor pickup code verified. The delivery is now on the way to the customer.');await loadRiderData(token);}
    catch(e){setError(e instanceof Error?e.message:'Could not confirm pickup. Refresh the delivery.');await loadRiderData(token);}
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
    stopLocationUpdates();setSession(null);setRole(null);setVendorOrders([]);setRiderProfile(null);setOffers([]);setDeliveries([]);await SecureStore.deleteItemAsync('makanza-ops-session');
    if(current)void api.post('/auth/logout',{},current).catch(()=>undefined);
  };
  const switchRole=(next:WorkRole)=>{setRole(next);setError('');if(next==='VENDOR'&&token)void loadVendorOrders(token);if(next==='RIDER'&&token){if(session?.user.roles.includes('RIDER'))void loadRiderData(token);else setRiderProfile(null);}};

  const finishOnboarding=async()=>{setHasOnboarded(true);setOnboardingReady(true);await SecureStore.setItemAsync('makanza-operations-onboarding-v1','complete').catch(()=>undefined);};
  if(!onboardingReady)return <SafeAreaView style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:c.paper}}><ActivityIndicator color={c.green}/></SafeAreaView>;
  if(!hasOnboarded)return <OnboardingScreen dark={isDark} onTheme={toggleTheme} onComplete={()=>void finishOnboarding()}/>;
  if(!session&&browsingTabs)return <SafeAreaView style={s.safe}><StatusBar barStyle={isDark?'light-content':'dark-content'} backgroundColor={c.paper}/><View style={s.header}><Text style={s.brand}><Text style={s.mark}>m</Text> smile <Text style={s.ops}>OPS</Text></Text><View style={s.headerActions}><Pressable accessibilityRole="button" accessibilityLabel={isDark?'Switch to light mode':'Switch to dark mode'} onPress={toggleTheme} style={s.themeToggle}><Ionicons name={isDark?'sunny-outline':'moon-outline'} size={22} color={c.green}/></Pressable><Pressable accessibilityRole="link" onPress={()=>setBrowsingTabs(false)}><Text style={s.signOut}>Sign in</Text></Pressable></View></View><PublicTabsPreview colors={c} onBackToSignIn={()=>setBrowsingTabs(false)}/></SafeAreaView>;
  return <BrowseTabsContext.Provider value={()=>setBrowsingTabs(true)}><SafeAreaView style={s.safe}>
    <StatusBar barStyle={isDark?'light-content':'dark-content'} backgroundColor={c.paper}/>
    <View style={s.header}><Text style={s.brand}><Text style={s.mark}>m</Text> smile <Text style={s.ops}>OPS</Text></Text><View style={s.headerActions}><Pressable accessibilityRole="button" accessibilityLabel={isDark?'Switch to light mode':'Switch to dark mode'} onPress={toggleTheme} style={s.themeToggle}><Ionicons name={isDark?'sunny-outline':'moon-outline'} size={22} color={c.green}/></Pressable>{session&&<Pressable accessibilityRole="button" onPress={()=>void signOut()}><Text style={s.signOut}>Sign out</Text></Pressable>}</View></View>
    {!session?<SignInScreen dark={isDark} email={email} password={password} busy={busy==='login'} error={error} onEmail={setEmail} onPassword={setPassword} onSubmit={()=>void signIn()}/>:<>
      {role===null&&<View style={s.login}><Text style={s.eyebrow}>CHOOSE YOUR WORKSPACE</Text><Text style={s.title}>How will you use Smile?</Text><Text style={s.subtitle}>You can apply as a store or rider. Each application is reviewed before operational tools unlock.</Text><Pressable style={s.button} onPress={()=>setRole('VENDOR')}><Text style={s.buttonText}>Set up a store</Text></Pressable><Pressable style={[s.button,s.buttonSecondary,{marginTop:10}]} onPress={()=>setRole('RIDER')}><Text style={[s.buttonText,s.buttonSecondaryText]}>Apply to ride</Text></Pressable></View>}
      {session.user.roles.includes('VENDOR')&&session.user.roles.includes('RIDER')&&<View style={s.roleSwitch}>{(['VENDOR','RIDER'] as WorkRole[]).map(item=><Pressable key={item} onPress={()=>switchRole(item)} style={[s.roleTab,role===item&&s.roleTabActive]}><Text style={[s.roleTabText,role===item&&s.roleTabTextActive]}>{item==='VENDOR'?'Vendor':'Rider'}</Text></Pressable>)}</View>}
      {role==='VENDOR'&&<VendorWorkspace token={token??''} authorized={session.user.roles.includes('VENDOR')} orders={vendorOrders} busyId={busy} loading={loading} error={error} colors={c} onReload={()=>token&&void loadVendorOrders(token)} onOrderAction={(id,status)=>void updateOrder(id,status)} onRequestRiderAccess={()=>switchRole('RIDER')} onSignOut={()=>void signOut()} onAuthorized={()=>{const updated={...session,user:{...session.user,roles:Array.from(new Set([...session.user.roles,'VENDOR']))}};void SecureStore.setItemAsync('makanza-ops-session',JSON.stringify(updated));setSession(updated);void loadVendorOrders(token??'');}}/>}
      {role==='RIDER'&&<RiderWorkspace token={token??''} authorized={session.user.roles.includes('RIDER')} profile={riderProfile} offers={offers} deliveries={deliveries} loading={loading} busy={busy} error={error} notice={notice} locationMessage={locationMessage} locationSharing={locationSharing} locationPermissionNeeded={locationPermissionNeeded} vehicleType={vehicleType} serviceArea={serviceArea} termsAccepted={termsAccepted} completionCodes={completionCodes} pickupCodes={pickupCodes} colors={c} onReload={()=>token&&void loadRiderData(token)} onAvailability={available=>void setAvailability(available)} onAccept={offer=>void acceptOffer(offer)} onReject={offer=>void rejectOffer(offer)} onPickup={(delivery,code)=>void pickup(delivery,code)} onPickupCode={(id,code)=>setPickupCodes(current=>({...current,[id]:code}))} onComplete={delivery=>void complete(delivery)} onCode={(id,code)=>setCompletionCodes(current=>({...current,[id]:code}))} onShareLocation={()=>void startForegroundLocation().catch(e=>setLocationMessage(e instanceof Error?e.message:'Location sharing could not start.'))} onOpenSettings={()=>void Linking.openSettings()} onVehicle={setVehicleType} onArea={setServiceArea} onTerms={()=>setTermsAccepted(value=>!value)} onApply={()=>void applyForRider()} onSignOut={()=>void signOut()}/>}
    </>}
  </SafeAreaView></BrowseTabsContext.Provider>;
}

const createStyles=(c:AppColors)=>StyleSheet.create({safe:{flex:1,backgroundColor:c.paper},headerActions:{flexDirection:'row',alignItems:'center',gap:12},themeToggle:{paddingHorizontal:9,paddingVertical:7,borderRadius:12,backgroundColor:c.card},themeText:{fontSize:11,fontWeight:'800',color:c.green},flex:{flex:1},header:{height:62,paddingHorizontal:18,backgroundColor:c.cream,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},brand:{fontSize:23,fontWeight:'800',color:c.ink,letterSpacing:-.6},mark:{backgroundColor:c.green,color:c.lime,borderRadius:12,overflow:'hidden',paddingHorizontal:7,fontFamily:'serif'},ops:{fontSize:11,color:c.orange,letterSpacing:1.2},signOut:{fontSize:13,color:c.green,fontWeight:'700'},login:{padding:23,justifyContent:'center',flexGrow:1},eyebrow:{fontSize:11,letterSpacing:1.4,color:'#527452',fontWeight:'800',marginBottom:12},title:{fontSize:35,lineHeight:42,fontWeight:'700',letterSpacing:-1,color:c.ink},subtitle:{fontSize:15,lineHeight:22,color:c.muted,marginTop:8,marginBottom:15},label:{fontSize:13,color:c.ink,fontWeight:'700',marginTop:12,marginBottom:6},inputGroup:{marginTop:4},input:{height:45,borderColor:c.line,borderWidth:1,borderRadius:12,paddingHorizontal:12,backgroundColor:c.card,fontSize:15,color:c.ink},button:{minHeight:41,paddingHorizontal:14,borderRadius:10,backgroundColor:c.green,justifyContent:'center',alignItems:'center'},buttonText:{fontSize:13,fontWeight:'800',color:c.isDark?'#17231b':'white'},buttonSecondary:{backgroundColor:c.card,borderWidth:1,borderColor:c.line},buttonSecondaryText:{color:c.green},disabled:{opacity:.5},error:{fontSize:13,lineHeight:21,color:'#a44232',marginVertical:10},hero:{padding:20,backgroundColor:c.isDark?'#194c3a':c.green,borderBottomLeftRadius:24,borderBottomRightRadius:24},refresh:{backgroundColor:'rgba(255,255,255,.14)',paddingHorizontal:11,paddingVertical:8,borderRadius:12},refreshText:{fontSize:12,color:c.lime,fontWeight:'800'},vendorEyebrow:{fontSize:11,letterSpacing:1.4,color:'#d5ef81',fontWeight:'800',marginBottom:8},vendorHeroTitle:{fontSize:32,lineHeight:38,fontWeight:'800',letterSpacing:-1,color:'white'},vendorHeroSubtitle:{fontSize:13,lineHeight:19,color:'#e5ecdf',marginTop:8,marginBottom:14},metrics:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'rgba(255,255,255,.10)',paddingVertical:12,paddingHorizontal:10,borderRadius:15,marginTop:7},metric:{flex:1,alignItems:'center'},metricValue:{fontSize:24,fontWeight:'800',color:'white'},metricLabel:{fontSize:9,letterSpacing:.7,fontWeight:'800',color:'#d9e5d1',marginTop:2},metricDivider:{width:1,height:28,backgroundColor:'rgba(255,255,255,.2)'},switchLink:{fontSize:12,color:c.lime,fontWeight:'700',marginTop:13},roleSwitch:{height:48,flexDirection:'row',borderBottomWidth:1,borderBottomColor:c.line},roleTab:{flex:1,alignItems:'center',justifyContent:'center'},roleTabActive:{borderBottomWidth:2,borderBottomColor:c.green},roleTabText:{fontSize:15,color:c.muted},roleTabTextActive:{fontWeight:'700',color:c.green},state:{padding:20,alignItems:'center',justifyContent:'center',gap:8},stateTitle:{fontSize:17,fontWeight:'700',color:c.ink},list:{padding:13,gap:10},orderCard:{padding:14,backgroundColor:c.card,borderColor:c.line,borderWidth:1,borderRadius:16,gap:11},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},orderId:{fontSize:15,fontWeight:'700',color:c.ink},status:{fontSize:11,color:c.green,backgroundColor:c.cream,paddingHorizontal:8,paddingVertical:5,borderRadius:5,textTransform:'capitalize'},items:{fontSize:13,lineHeight:21,color:c.muted},date:{fontSize:11,color:c.muted,flex:1},total:{fontSize:13,fontWeight:'700',color:c.green},actions:{flexDirection:'row',gap:8,justifyContent:'flex-end',marginTop:8},rider:{padding:16,gap:13,paddingBottom:30},riderHero:{minHeight:154,padding:19,borderRadius:22,backgroundColor:c.isDark?'#194c3a':c.green,flexDirection:'row',alignItems:'center',justifyContent:'space-between',overflow:'hidden'},riderEyebrow:{fontSize:11,letterSpacing:1.3,color:c.lime,fontWeight:'800',marginBottom:8},riderTitle:{fontSize:28,lineHeight:34,fontWeight:'800',letterSpacing:-.7,color:'white'},riderLead:{fontSize:12,color:'#e4ebdc',marginTop:7},riderOrbit:{width:70,height:70,borderRadius:35,backgroundColor:'rgba(213,239,129,.17)',alignItems:'center',justifyContent:'center',marginRight:2},riderOrbitIcon:{fontSize:43,color:c.lime,fontWeight:'700'},riderIntroRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:2},notice:{padding:16,borderRadius:16,backgroundColor:c.cream,borderWidth:1,borderColor:c.line},noticeTitle:{fontSize:17,fontWeight:'700',color:c.ink,marginBottom:7},muted:{fontSize:12,lineHeight:19,color:c.muted},terms:{flexDirection:'row',alignItems:'center',gap:9,marginTop:15},checkbox:{fontSize:24,color:c.green},termsText:{fontSize:13,color:c.ink,flex:1},riderSummary:{padding:15,borderRadius:16,borderWidth:1,borderColor:c.line,backgroundColor:c.card,gap:10},onlinePill:{paddingHorizontal:9,paddingVertical:5,borderRadius:20,backgroundColor:'#f1f2ed'},onlinePillActive:{backgroundColor:'#e9f3d7'},onlineText:{fontSize:10,fontWeight:'800',color:c.muted},onlineTextActive:{color:c.green},locationText:{fontSize:11,color:c.muted},sectionTitle:{fontSize:17,fontWeight:'700',color:c.ink,marginVertical:5},deliveryCard:{padding:16,borderWidth:1,borderColor:c.line,borderRadius:19,backgroundColor:c.card,gap:10,marginTop:10},offerCard:{padding:16,borderWidth:1,borderColor:c.line,borderRadius:19,backgroundColor:c.card,gap:10,marginTop:10,shadowColor:'#203b2d',shadowOpacity:.05,shadowRadius:12,shadowOffset:{width:0,height:5},elevation:2},offerExpires:{fontSize:11,color:'#9a6836'},empty:{padding:18,alignItems:'center',gap:6,backgroundColor:c.cream,borderRadius:8}});
