import { AppText as Text } from '@makanza/mobile-ui';
import type { CancellationReason } from '@makanza/mobile-ui';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { Product, ProductAddon, VendorOrder } from '@makanza/mobile-core';
import { api } from '../services/api';
import { formatMoney } from '../utils/format';
import type { AppColors } from '../theme/colors';
import type { VendorTab } from './RoleTabBar';
import PrimaryButton from '../components/PrimaryButton';
import FormField from '../components/FormField';
import OrderCard from '../vendor/OrderCard';
import RoleTabBar from './RoleTabBar';
import { VendorStoreProfileForm, type VendorProfile } from './VendorStoreProfileForm';
import StoreMediaPicker from './StoreMediaPicker';
import VendorWalletScreen from '../vendor/VendorWalletScreen';
import { Ionicons } from '../components/AppIcon';
import { OperationsInfoScreen, VendorPasswordScreen, VendorSavedAddresses, VendorSettingsScreen } from './VendorAccountScreens';
import OperationsNotificationsScreen, { type OperationsNotification } from './OperationsNotificationsScreen';
import { appendMediaAsset, createUploadFormData } from '../utils/upload-media';
import { vendorRadius, vendorSpace, vendorType } from '../theme/vendor';

type VendorProduct=Product&{available:boolean;addons:ProductAddon[]};
type ProductAddonDraft={id?:string;name:string;price:string};
type VendorUserProfile={name:string;email:string;phone:string|null};
type Props={token:string;authorized:boolean;orders:VendorOrder[];busyId:string;loading:boolean;error:string;colors:AppColors;notifications:OperationsNotification[];unreadNotifications:number;notificationsLoading:boolean;notificationsError:string;notificationsOpen?:boolean;onCloseNotifications?:()=>void;onReloadNotifications:()=>void;onReadNotification:(item:OperationsNotification)=>void;onReadAllNotifications:()=>void;onReload:()=>void;onOrderAction:(id:string,status:string,reason?:string)=>void;onVerifyPickup:(id:string,code:string)=>void;onCancelOrder:(id:string,reason:CancellationReason,details:string)=>void;onSignOut:()=>void;onAuthorized:()=>void;onStoreName:(name:string)=>void;onToggleTheme:()=>void;onIndexChange?:(isIndex:boolean)=>void};

export default function VendorWorkspace(p:Props){
  const [tab,setTabState]=useState<VendorTab>('overview');const tabHistory=useRef<VendorTab[]>([]);const setTab=(next:VendorTab)=>{if(next!==tab){if(next==='overview')tabHistory.current=[];else tabHistory.current=[...tabHistory.current.slice(-19),tab];setTabState(next);}p.onIndexChange?.(next==='overview');};const [profile,setProfile]=useState<VendorProfile|null>(null);const [profileLoading,setProfileLoading]=useState(p.authorized);const [editingStore,setEditingStore]=useState(false);const [account,setAccount]=useState<VendorUserProfile|null>(null);const [editingProfile,setEditingProfile]=useState(false);const [profileDraft,setProfileDraft]=useState({name:'',phone:''});const [profileSaving,setProfileSaving]=useState(false);const [accountScreen,setAccountScreen]=useState<'password'|'settings'|'help'|'about'|'privacy'|null>(null);const [addressesOpen,setAddressesOpen]=useState(false);
  const [products,setProducts]=useState<VendorProduct[]>([]);const [productsLoading,setProductsLoading]=useState(false);const [productsError,setProductsError]=useState('');const [formOpen,setFormOpen]=useState(false);const [editingProduct,setEditingProduct]=useState<string|null>(null);const [saving,setSaving]=useState(false);const [mediaBusy,setMediaBusy]=useState(false);const [notice,setNotice]=useState('');const [draft,setDraft]=useState({name:'',description:'',category:'',price:'',stock:'',imageUrl:''});const [addonDrafts,setAddonDrafts]=useState<ProductAddonDraft[]>([]);const c=p.colors;const s=styles(c);const approved=profile?.status==='APPROVED';
  const [pendingReviewDismissed,setPendingReviewDismissed]=useState(false);
  useEffect(()=>{const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{if(p.notificationsOpen){p.onCloseNotifications?.();return true;}if(addressesOpen){setAddressesOpen(false);return true;}if(accountScreen){setAccountScreen(null);return true;}if(editingProfile){setEditingProfile(false);return true;}if(editingStore){setEditingStore(false);return true;}if(formOpen){resetProductForm();return true;}const previous=tabHistory.current.pop();if(previous){setTabState(previous);p.onIndexChange?.(previous==='overview');return true;}return false;});return()=>subscription.remove();},[p.notificationsOpen,p.onCloseNotifications,p.onIndexChange,addressesOpen,accountScreen,editingProfile,editingStore,formOpen]);
  const loadProfile=async()=>{if(!p.authorized)return;setProfileLoading(true);try{const loaded=await api.get<VendorProfile>('/vendor/profile',p.token);setProfile(loaded);p.onStoreName(loaded.name);const user=await api.get<VendorUserProfile>('/auth/profile',p.token);setAccount(user);setProfileDraft({name:user.name,phone:user.phone??''});}catch(e){setProductsError(e instanceof Error?e.message:'Could not load account details.');}finally{setProfileLoading(false);}};
  const loadCatalog=async()=>{setProductsLoading(true);setProductsError('');try{setProducts(await api.get<VendorProduct[]>('/vendor/products',p.token));}catch(e){setProductsError(e instanceof Error?e.message:'Could not load products.');}finally{setProductsLoading(false);}};
  useEffect(()=>{void loadProfile();},[p.token,p.authorized]);
  useEffect(()=>{if(tab==='products'&&(approved||profile?.status==='PENDING_REVIEW'))void loadCatalog();},[tab,p.token,approved,profile?.status]);
  const resetProductForm=()=>{setDraft({name:'',description:'',category:'',price:'',stock:'',imageUrl:''});setAddonDrafts([]);setEditingProduct(null);setFormOpen(false);};
  const startProductEdit=(product:VendorProduct)=>{setDraft({name:product.name,description:product.description??'',category:product.category,price:(product.priceMinor/100).toFixed(2),stock:product.stock===null?'':String(product.stock),imageUrl:product.imageUrl??''});setAddonDrafts(product.addons.map(addon=>({id:addon.id,name:addon.name,price:(addon.priceMinor/100).toFixed(2)})));setEditingProduct(product.id);setFormOpen(true);setProductsError('');};
  const pickProductImage=async()=>{setProductsError('');try{const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.82});if(result.canceled)return;const asset=result.assets[0];if(!asset)return;setMediaBusy(true);const signature=await api.post<{cloudName:string;apiKey:string;timestamp:number;folder:string;signature:string}>('/vendor/media/sign',{},p.token);const data=createUploadFormData();await appendMediaAsset(data,asset,`product-${Date.now()}.jpg`);data.append('api_key',signature.apiKey);data.append('timestamp',String(signature.timestamp));data.append('folder',signature.folder);data.append('signature',signature.signature);const response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/image/upload`,{method:'POST',body:data});const uploaded=await response.json().catch(()=>null) as {secure_url?:string;error?:{message?:string}}|null;if(!response.ok||!uploaded?.secure_url)throw new Error(uploaded?.error?.message??'Could not upload this image. Try another photo.');setDraft(current=>({...current,imageUrl:uploaded.secure_url!}));}catch(e){setProductsError(e instanceof Error?e.message:'Could not choose or upload the product image.');}finally{setMediaBusy(false);}};
  const saveProduct=async()=>{const priceMinor=Math.round(Number(draft.price)*100);const stock=draft.stock.trim()?Number(draft.stock):null;const parsedAddons=addonDrafts.map(addon=>({id:addon.id,name:addon.name.trim(),priceMinor:Math.round(Number(addon.price)*100)}));if(!draft.name.trim()||!draft.category.trim()||!Number.isSafeInteger(priceMinor)||priceMinor<=0|| (stock!==null&&(!Number.isSafeInteger(stock)||stock<0))){setProductsError('Enter a product name, category, valid price, and whole-number stock.');return;}if(parsedAddons.some(addon=>addon.name.length<2||!Number.isSafeInteger(addon.priceMinor)||addon.priceMinor<1)||parsedAddons.length>20){setProductsError('Each extra needs a name and positive price. A product can have up to 20 extras.');return;}if(mediaBusy){setProductsError('Wait for the image upload to finish.');return;}setSaving(true);setProductsError('');try{const payload={name:draft.name.trim(),description:draft.description.trim(),category:draft.category.trim(),priceMinor,stock,imageUrl:draft.imageUrl.trim()||null};let productId=editingProduct;if(productId)await api.patch(`/vendor/products/${encodeURIComponent(productId)}`,payload,p.token);else{const created=await api.post<{id:string}>('/vendor/products',payload,p.token);productId=created.id;}for(const addon of parsedAddons){const addonPayload={name:addon.name,priceMinor:addon.priceMinor};if(addon.id)await api.patch(`/vendor/products/${encodeURIComponent(productId)}/addons/${encodeURIComponent(addon.id)}`,addonPayload,p.token);else await api.post(`/vendor/products/${encodeURIComponent(productId)}/addons`,addonPayload,p.token);}resetProductForm();setNotice(editingProduct?'Product details updated.':'Product added to your store.');await loadCatalog();}catch(e){setProductsError(e instanceof Error?e.message:'Could not save this product.');}finally{setSaving(false);}};
  const saveProfile=async()=>{if(profileDraft.name.trim().length<2||profileDraft.phone.trim().length<7){setProductsError('Enter your name and a valid phone number.');return;}setProfileSaving(true);setProductsError('');try{const updated=await api.patch<VendorUserProfile>('/auth/profile',{name:profileDraft.name.trim(),phone:profileDraft.phone.trim()},p.token);setAccount(updated);setProfileDraft({name:updated.name,phone:updated.phone??''});setEditingProfile(false);setNotice('Profile updated.');}catch(e){setProductsError(e instanceof Error?e.message:'Could not update your profile.');}finally{setProfileSaving(false);}};
  const deleteProduct=(product:VendorProduct)=>{const remove=()=>{void (async()=>{setProductsError('');try{await api.delete(`/vendor/products/${encodeURIComponent(product.id)}`,p.token);setNotice(`${product.name} removed from your menu.`);await loadCatalog();}catch(e){setProductsError(e instanceof Error?e.message:'Could not delete this product.');}})();};if(Platform.OS==='web'){if(window.confirm(`${product.name} will be removed from your active menu. Existing order records will be kept.`))remove();return;}Alert.alert('Delete product?',`${product.name} will be removed from your active menu. Existing order records will be kept.`,[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:remove}]);};
  const toggleProduct=async(product:VendorProduct)=>{try{await api.patch(`/vendor/products/${encodeURIComponent(product.id)}`,{available:!product.available},p.token);await loadCatalog();}catch(e){setProductsError(e instanceof Error?e.message:'Could not update this product.');}};

  const pendingReview=profile?.status==='PENDING_REVIEW';
  if(p.notificationsOpen)return <OperationsNotificationsScreen role="Vendor" items={p.notifications} unreadCount={p.unreadNotifications} loading={p.notificationsLoading} error={p.notificationsError} colors={c} onBack={()=>p.onCloseNotifications?.()} onRefresh={p.onReloadNotifications} onReadAll={p.onReadAllNotifications} onOpen={item=>{p.onReadNotification(item);p.onCloseNotifications?.();setTab('orders');}}/>;
  if(profileLoading)return <View style={s.loading}><ActivityIndicator color={c.green}/></View>;
  if(!p.authorized||(!approved&&!pendingReview)||editingStore)return <View style={s.flex}><ScrollView style={s.flex} contentContainerStyle={s.content}>{p.authorized&&profile?.status!=='APPROVED'&&!pendingReviewDismissed&&<View style={s.review}><View style={s.reviewHeader}><Text style={s.reviewTitle}>Store application · {profile?.status?.replaceAll('_',' ').toLowerCase()??'not submitted'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dismiss application review notice" onPress={()=>setPendingReviewDismissed(true)} hitSlop={8}><Ionicons name="close" size={18} color={c.muted}/></Pressable></View><Text style={s.copy}>Complete your store details. We will review your business before products can go live.</Text></View>}<VendorStoreProfileForm token={p.token} profile={profile} authorized={p.authorized} colors={c} onAuthorized={p.onAuthorized} onSaved={next=>{setProfile(next);p.onStoreName(next.name);setEditingStore(false);setNotice('Store details saved.');}} onCancel={profile?()=>setEditingStore(false):undefined}/>{notice?<Text style={s.success}>{notice}</Text>:null}</ScrollView>{p.authorized&&(approved||pendingReview)&&<RoleTabBar role="VENDOR" active="account" onSelect={()=>setEditingStore(false)} colors={c}/>}</View>;

  if(accountScreen==='password')return <VendorPasswordScreen token={p.token} colors={c} onBack={()=>setAccountScreen(null)} onSaved={()=>setNotice('Password changed.')}/>;
  if(accountScreen==='settings')return <VendorSettingsScreen role="Vendor" colors={c} dark={c.isDark} onTheme={p.onToggleTheme} onBack={()=>setAccountScreen(null)} onPrivacy={()=>setAccountScreen('privacy')} onHelp={()=>setAccountScreen('help')} onAbout={()=>setAccountScreen('about')}/>;
  if(accountScreen==='help'||accountScreen==='about'||accountScreen==='privacy')return <OperationsInfoScreen kind={accountScreen} role="Vendor" colors={c} onBack={()=>setAccountScreen('settings')}/>;

  if(tab==='wallet')return <View style={s.flex}><VendorWalletScreen token={p.token} colors={c}/><RoleTabBar role="VENDOR" active={tab} onSelect={value=>setTab(value as VendorTab)} colors={c}/></View>;

  const fixedEyebrow=tab==='orders'?'STORE QUEUE':tab==='products'?'YOUR MENU':tab==='account'?'YOUR WORKSPACE':'STORE OPERATIONS';const fixedTitle=tab==='orders'?'Orders':tab==='products'?'Products & extras':tab==='account'?'Profile':'Overview';const fixedBody=tab==='orders'?'Accept orders, prepare them, and verify rider pickup.':tab==='products'?'List each thing you sell and set a separate price for every extra.':tab==='account'?'Manage your personal details and your store.':'Manage incoming orders and your store menu.';
  return <View style={s.flex}>{tab!=='overview'&&<View style={s.fixedHeader}><Heading eyebrow={fixedEyebrow} title={fixedTitle} body={fixedBody} c={c} onRefresh={tab==='orders'?p.onReload:undefined}/></View>}<ScrollView key={tab} style={s.flex} contentContainerStyle={s.content}>{pendingReview&&!pendingReviewDismissed&&<View style={s.review}><View style={s.reviewHeader}><Text style={s.reviewTitle}>Application pending review</Text><Pressable accessibilityRole="button" accessibilityLabel="Dismiss application review notice" onPress={()=>setPendingReviewDismissed(true)} hitSlop={8}><Ionicons name="close" size={18} color={c.muted}/></Pressable></View><Text style={s.copy}>You can prepare your menu and explore the workspace while we review your application. Orders and payouts activate after approval.</Text></View>}
    {tab==='overview'&&<><Heading eyebrow="STORE OPERATIONS" title="Overview" body="Manage incoming orders and your store menu." c={c}/><View style={s.hero}><Text style={s.heroTitle}>{profile?.name??'Your store'}</Text><View style={s.metrics}><Metric label="NEW" value={p.orders.filter(o=>o.status==='CONFIRMED').length} c={c}/><Metric label="PREPARING" value={p.orders.filter(o=>['ACCEPTED_BY_VENDOR','PREPARING'].includes(o.status)).length} c={c}/><Metric label="ORDERS" value={p.orders.length} c={c}/></View></View><View style={s.titleRow}><Text style={s.title}>Needs your attention</Text><Pressable accessibilityRole="button" onPress={()=>setTab('orders')}><Text style={s.link}>All orders ›</Text></Pressable></View>{p.orders.filter(o=>['CONFIRMED','ACCEPTED_BY_VENDOR','PREPARING'].includes(o.status)).slice(0,3).map(order=><OrderCard key={order.id} order={order} busy={p.busyId===order.id} colors={c} onAction={p.onOrderAction} onVerifyPickup={p.onVerifyPickup} onCancel={p.onCancelOrder}/>)}{!p.orders.some(o=>['CONFIRMED','ACCEPTED_BY_VENDOR','PREPARING'].includes(o.status))&&<Empty title="You're all caught up" body="New store orders will appear here." c={c}/>}</>}
    {tab==='orders'&&<>{p.loading?<ActivityIndicator style={s.loader} color={c.green}/>:p.error?<Empty title="Orders unavailable" body={p.error} c={c}/>:p.orders.length?p.orders.map(order=><OrderCard key={order.id} order={order} busy={p.busyId===order.id} colors={c} onAction={p.onOrderAction} onVerifyPickup={p.onVerifyPickup} onCancel={p.onCancelOrder}/>):<Empty title="No orders yet" body="Orders from customers will appear here." c={c}/>}</>}
    {tab==='products'&&<><PrimaryButton title={formOpen?'Close product form':'＋ Add a product'} onPress={()=>{if(formOpen)resetProductForm();else{setProductsError('');setAddonDrafts([]);setFormOpen(true);}}} style={s.button}/>{formOpen&&<View style={s.card}><Text style={s.formTitle}>{editingProduct?'Edit product':'Add a product'}</Text><FormField label="Product name" value={draft.name} onChangeText={name=>setDraft(v=>({...v,name}))} placeholder="e.g. Jollof rice" dark={c.isDark}/><FormField label="Category" value={draft.category} onChangeText={category=>setDraft(v=>({...v,category}))} placeholder="Rice" dark={c.isDark}/><FormField label="Price (₦)" value={draft.price} onChangeText={price=>setDraft(v=>({...v,price}))} placeholder="500" keyboardType="decimal-pad" dark={c.isDark}/><FormField label="Stock (optional)" value={draft.stock} onChangeText={stock=>setDraft(v=>({...v,stock}))} placeholder="Leave blank if not tracked" keyboardType="number-pad" dark={c.isDark}/><FormField label="Description" value={draft.description} onChangeText={description=>setDraft(v=>({...v,description}))} placeholder="Describe the product" multiline dark={c.isDark}/><StoreMediaPicker variant="logo" label="Product photo" helper="A clear square photo helps customers choose" uri={draft.imageUrl} busy={mediaBusy} colors={c} onPick={()=>void pickProductImage()} onRemove={()=>setDraft(v=>({...v,imageUrl:""}))}/><View style={s.inlineExtras}><Text style={s.formTitle}>Optional extras</Text><Text style={s.copy}>Add choices such as extra chicken or plantain with their own prices.</Text>{addonDrafts.map((addon,index)=><View key={addon.id??`new-${index}`} style={s.inlineAddon}><FormField label="Extra name" value={addon.name} onChangeText={name=>setAddonDrafts(items=>items.map((item,i)=>i===index?{...item,name}:item))} placeholder="e.g. Extra chicken" dark={c.isDark}/><FormField label="Price (NGN)" value={addon.price} onChangeText={price=>setAddonDrafts(items=>items.map((item,i)=>i===index?{...item,price}:item))} placeholder="500" keyboardType="decimal-pad" dark={c.isDark}/>{!addon.id&&<Pressable onPress={()=>setAddonDrafts(items=>items.filter((_,i)=>i!==index))} style={s.pill}><Text style={s.deleteText}>Remove extra</Text></Pressable>}</View>)}{addonDrafts.length<20&&<PrimaryButton title="+ Add an extra" secondary onPress={()=>setAddonDrafts(items=>[...items,{name:"",price:""}])} style={s.button}/>}</View><PrimaryButton title={saving?'Saving…':editingProduct?'Save changes':'Add product'} onPress={()=>void saveProduct()} disabled={saving||mediaBusy} style={s.button}/><PrimaryButton title="Cancel" secondary onPress={resetProductForm} disabled={saving} style={s.button}/></View>}{notice?<Text style={s.success}>{notice}</Text>:null}{productsError?<Text style={s.error}>{productsError}</Text>:null}{productsLoading?<ActivityIndicator style={s.loader} color={c.green}/>:products.map(product=><ProductRow key={product.id} product={product} token={p.token} colors={c} onRefresh={()=>void loadCatalog()} onToggle={()=>void toggleProduct(product)} onEdit={()=>startProductEdit(product)} onDelete={()=>deleteProduct(product)}/>)}{!productsLoading&&!productsError&&!products.length&&!formOpen&&<Empty title="Your catalog is empty" body="Add rice, chicken, plantain, drinks, and any other items you sell." c={c}/>}</>}
    {tab==='account'&&<>
      <View style={s.accountHero}>
        <View pointerEvents="none" style={s.accountHeroGlow}/>
        <View style={s.accountHeroTop}>
          {profile?.logoUrl?<Image source={{uri:profile.logoUrl}} style={s.storeAvatar}/>:<View style={s.storeAvatarFallback}><Ionicons name="storefront-outline" size={24} color={c.green}/></View>}
          <View style={s.accountHeroCopy}>
            <View style={s.accountOwnerRow}><View style={s.storeStatusDot}/><Text style={s.accountOwnerEyebrow}>VENDOR ACCOUNT</Text></View>
            <Text numberOfLines={1} style={s.accountStoreName}>{profile?.name??'Your store'}</Text>
            <Text numberOfLines={1} style={s.accountOwner}>{account?.name??profile?.ownerName??'Vendor account'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit vendor profile" onPress={()=>setEditingProfile(true)} style={s.accountEditButton}><Ionicons name="create-outline" size={18} color="white"/></Pressable>
        </View>
        <View style={s.accountHeroDivider}/>
        <View style={s.accountStats}>
          <View style={s.accountStat}><Text style={s.accountStatValue}>{p.orders.filter(order=>order.status==='CONFIRMED').length}</Text><Text style={s.accountStatLabel}>NEW ORDERS</Text></View>
          <View style={s.accountStat}><Text style={s.accountStatValue}>{p.orders.filter(order=>['ACCEPTED_BY_VENDOR','PREPARING'].includes(order.status)).length}</Text><Text style={s.accountStatLabel}>PREPARING</Text></View>
          <View style={s.accountStat}><Text style={s.accountStatValue}>{profile?.status==='APPROVED'?'LIVE':'REVIEW'}</Text><Text style={s.accountStatLabel}>STORE STATUS</Text></View>
        </View>
      </View>

      <View style={s.accountQuickGrid}>
        <Pressable accessibilityRole="button" onPress={()=>setEditingStore(true)} style={s.accountQuickTile}>
          <View style={s.accountQuickIcon}><Ionicons name="storefront-outline" size={20} color={c.green}/></View>
          <View style={s.accountQuickCopy}><Text style={s.accountQuickTitle}>Store</Text><Text style={s.accountQuickDetail}>Details & hours</Text></View>
          <Ionicons name="chevron-forward" size={16} color={c.muted}/>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={()=>setTab('wallet')} style={s.accountQuickTile}>
          <View style={s.accountQuickIcon}><Ionicons name="wallet-outline" size={20} color={c.green}/></View>
          <View style={s.accountQuickCopy}><Text style={s.accountQuickTitle}>Wallet</Text><Text style={s.accountQuickDetail}>Payouts & balance</Text></View>
          <Ionicons name="chevron-forward" size={16} color={c.muted}/>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={()=>setAddressesOpen(true)} style={s.accountQuickTile}>
          <View style={s.accountQuickIcon}><Ionicons name="location-outline" size={20} color={c.green}/></View>
          <View style={s.accountQuickCopy}><Text style={s.accountQuickTitle}>Addresses</Text><Text style={s.accountQuickDetail}>Pickup locations</Text></View>
          <Ionicons name="chevron-forward" size={16} color={c.muted}/>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={()=>setAccountScreen('password')} style={s.accountQuickTile}>
          <View style={s.accountQuickIcon}><Ionicons name="shield-checkmark-outline" size={20} color={c.green}/></View>
          <View style={s.accountQuickCopy}><Text style={s.accountQuickTitle}>Security</Text><Text style={s.accountQuickDetail}>Password & access</Text></View>
          <Ionicons name="chevron-forward" size={16} color={c.muted}/>
        </Pressable>
      </View>

      <Text style={s.accountSection}>ACCOUNT</Text>
      <View style={s.accountGroup}>
        <ProfileAction icon="person-outline" title="Edit profile" c={c} onPress={()=>setEditingProfile(true)}/>
        <ProfileAction icon="storefront-outline" title="Edit store details" c={c} onPress={()=>setEditingStore(true)}/>
        <ProfileAction icon="lock-closed-outline" title="Change password" c={c} onPress={()=>setAccountScreen('password')} last/>
      </View>
      {editingProfile&&<View style={s.card}>
        <Text style={s.formTitle}>Personal details</Text>
        <Text style={s.copy}>Used for important updates about your store and orders.</Text>
        <FormField label="Full name" value={profileDraft.name} onChangeText={name=>setProfileDraft(v=>({...v,name}))} placeholder="Your full name" dark={c.isDark}/>
        <FormField label="Phone number" value={profileDraft.phone} onChangeText={phone=>setProfileDraft(v=>({...v,phone}))} placeholder="+234…" keyboardType="phone-pad" dark={c.isDark}/>
        <FormField label="Email address" value={account?.email??''} editable={false} dark={c.isDark}/>
        {productsError?<Text style={s.error}>{productsError}</Text>:null}
        <PrimaryButton title={profileSaving?'Saving…':'Save profile'} onPress={()=>void saveProfile()} disabled={profileSaving} style={s.button}/>
        <PrimaryButton title="Cancel" secondary onPress={()=>setEditingProfile(false)} disabled={profileSaving} style={s.button}/>
      </View>}
      <Text style={s.accountSection}>PREFERENCES & SUPPORT</Text>
      <View style={s.accountGroup}>
        <ProfileAction icon="settings-outline" title="Settings" c={c} onPress={()=>setAccountScreen('settings')}/>
        <ProfileAction icon="help-circle-outline" title="Help & support" c={c} onPress={()=>setAccountScreen('help')}/>
        <ProfileAction icon="information-circle-outline" title="About Smile" c={c} onPress={()=>setAccountScreen('about')} last/>
      </View>
      {productsError&&!editingProfile?<Text style={s.error}>{productsError}</Text>:null}
      {notice?<Text style={s.success}>{notice}</Text>:null}
      <Pressable accessibilityRole="button" onPress={p.onSignOut} style={s.logout}><Ionicons name="log-out-outline" size={18} color={c.isDark?'#f0877a':'#a34232'}/><Text style={s.logoutText}>Log out</Text></Pressable>
    </>}
  </ScrollView><RoleTabBar role="VENDOR" active={tab} onSelect={value=>setTab(value as VendorTab)} colors={c}/>{addressesOpen&&<VendorSavedAddresses token={p.token} colors={c} onClose={()=>setAddressesOpen(false)}/>}</View>;
}


function ProductRow({product,token,colors:c,onRefresh,onToggle,onEdit,onDelete}:{product:VendorProduct;token:string;colors:AppColors;onRefresh:()=>void;onToggle:()=>void;onEdit:()=>void;onDelete:()=>void}){
  const [open,setOpen]=useState(false);const [name,setName]=useState('');const [price,setPrice]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const s=styles(c);
  const add=async()=>{const priceMinor=Math.round(Number(price)*100);if(name.trim().length<2||!Number.isSafeInteger(priceMinor)||priceMinor<1){setError('Enter an extra name and valid price.');return;}setBusy(true);setError('');try{await api.post(`/vendor/products/${encodeURIComponent(product.id)}/addons`,{name:name.trim(),priceMinor},token);setName('');setPrice('');onRefresh();}catch(e){setError(e instanceof Error?e.message:'Could not add this extra.');}finally{setBusy(false);}};
  const toggleAddon=async(addon:ProductAddon)=>{await api.patch(`/vendor/products/${encodeURIComponent(product.id)}/addons/${encodeURIComponent(addon.id)}`,{available:!addon.available},token).then(onRefresh).catch(e=>setError(e instanceof Error?e.message:'Could not update this extra.'));};
  return <View style={s.product}>
    <View style={s.productTop}>
      {product.imageUrl?<Image source={{uri:product.imageUrl}} resizeMode="cover" style={s.productImage}/>:<View style={s.productImageFallback}><Ionicons name="restaurant-outline" size={23} color={c.green}/></View>}
      <View style={s.productInfo}>
        <Text numberOfLines={1} style={s.productName}>{product.name}</Text>
        <Text style={s.copy}>{product.category} · {formatMoney(product.priceMinor)}</Text>
        {product.stock!==null&&<Text style={s.stockText}>{product.stock} in stock</Text>}
        {product.description?<Text numberOfLines={2} style={s.copy}>{product.description}</Text>:null}
      </View>
      <Pressable accessibilityRole="switch" accessibilityState={{checked:product.available}} accessibilityLabel={`${product.available?'Pause':'Enable'} ${product.name}`} onPress={onToggle} style={[s.availability,product.available?s.available:s.paused]}>
        <View style={[s.availabilityDot,product.available?s.availableDot:s.pausedDot]}/>
        <Text style={[s.availabilityText,product.available?s.availableText:s.pausedText]}>{product.available?'Live':'Paused'}</Text>
      </Pressable>
    </View>
    <View style={s.productActions}>
      <Pressable accessibilityRole="button" onPress={onEdit} style={s.productAction}><Ionicons name="create-outline" size={16} color={c.green}/><Text style={s.productActionText}>Edit</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen(value=>!value)} style={s.productAction}><Ionicons name="cube-outline" size={16} color={c.green}/><Text style={s.productActionText}>Extras{product.addons.length?` · ${product.addons.length}`:''}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onDelete} style={s.productAction}><Ionicons name="trash-outline" size={16} color={c.isDark?'#f0877a':'#a34232'}/><Text style={s.deleteText}>Delete</Text></Pressable>
    </View>
    {open&&<View style={s.extras}>
      <Text style={s.extrasTitle}>Product extras</Text>
      {product.addons.length?product.addons.map(addon=><View key={addon.id} style={s.addonRow}><View style={{flex:1}}><Text style={s.addonName}>{addon.name}</Text><Text style={s.copy}>{formatMoney(addon.priceMinor)} each</Text></View><Pressable accessibilityRole="switch" accessibilityState={{checked:addon.available}} onPress={()=>void toggleAddon(addon)} style={[s.extraToggle,addon.available&&s.extraToggleActive]}><Text style={[s.extraToggleText,addon.available&&s.extraToggleTextActive]}>{addon.available?'Available':'Paused'}</Text></Pressable></View>):<Text style={s.copy}>No extras added yet.</Text>}
      <View style={s.addExtraForm}><FormField label="Extra name" value={name} onChangeText={setName} placeholder="e.g. Extra chicken" dark={c.isDark}/><FormField label="Price per extra (₦)" value={price} onChangeText={setPrice} placeholder="500" keyboardType="decimal-pad" dark={c.isDark}/>{error?<Text style={s.error}>{error}</Text>:null}<PrimaryButton title={busy?'Saving…':'Add extra'} disabled={busy} onPress={()=>void add()} style={s.button}/></View>
    </View>}
  </View>;
}
function ProfileAction({icon,title,onPress,c,last=false}:{icon:string;title:string;onPress:()=>void;c:AppColors;last?:boolean}){
  const s=styles(c);
  const detail=title==='Edit profile'?'Your personal contact details':title==='Edit store details'?'Business information and operating hours':title==='Saved addresses'?'Store delivery locations':title==='Change password'?'Keep your account secure':title==='Settings'?'Appearance and app preferences':title==='Help & support'?'Get help with your workspace':'Learn about Smile Operations';
  return <Pressable accessibilityRole="button" accessibilityHint={`Opens ${title.toLowerCase()}`} onPress={onPress} style={({pressed})=>[s.profileAction,!last&&s.profileActionDivider,pressed&&{opacity:.72}]}>
    <View style={s.profileActionIcon}><Ionicons name={icon} size={18} color={c.green}/></View>
    <View style={s.profileActionCopy}><Text style={s.profileActionTitle}>{title}</Text><Text style={s.profileActionDetail}>{detail}</Text></View>
    <Ionicons name="chevron-forward" size={18} color={c.muted}/>
  </Pressable>;
}
function Metric({label,value,c}:{label:string;value:number;c:AppColors}){return <View style={styles(c).metric}><Text style={styles(c).metricValue}>{value}</Text><Text style={styles(c).metricLabel}>{label}</Text></View>}
function Heading({eyebrow,title,body,c,onRefresh}:{eyebrow:string;title:string;body:string;c:AppColors;onRefresh?:()=>void}){const s=styles(c);return <View style={s.heading}><Text style={s.eyebrow}>{eyebrow}</Text><View style={s.headingRow}><Text style={s.headingTitle}>{title}</Text>{onRefresh&&<Pressable accessibilityRole="button" accessibilityLabel="Refresh orders" hitSlop={10} onPress={onRefresh} style={s.refresh}><Ionicons name="refresh-outline" size={19} color={c.green}/></Pressable>}</View><Text style={s.headingBody}>{body}</Text></View>}
function Empty({title,body,c}:{title:string;body:string;c:AppColors}){const icon=title.toLowerCase().includes('unavailable')?'alert-circle-outline':title.toLowerCase().includes('caught up')?'checkmark-circle-outline':'file-tray-outline';const s=styles(c);return <View style={s.empty}><View style={s.emptyIcon}><Ionicons name={icon} size={25} color={c.green}/></View><Text style={s.emptyTitle}>{title}</Text><Text style={s.emptyBody}>{body}</Text></View>}
const styles=(c:AppColors)=>StyleSheet.create({
  flex:{flex:1},
  loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:c.paper},
  fixedHeader:{paddingHorizontal:vendorSpace.lg,paddingTop:vendorSpace.md,backgroundColor:c.paper},
  content:{padding:vendorSpace.lg,gap:vendorSpace.md,paddingBottom:vendorSpace.xxl},
  heading:{marginBottom:vendorSpace.xs},
  eyebrow:{color:c.green,fontSize:vendorType.label,fontWeight:'900',letterSpacing:1.2},
  headingRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:5},
  headingTitle:{color:c.ink,fontSize:vendorType.display,fontWeight:'900',letterSpacing:-.8},
  headingBody:{color:c.muted,fontSize:vendorType.body,lineHeight:19,marginTop:4},
  refresh:{width:40,height:40,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.md,backgroundColor:c.card,borderWidth:1,borderColor:c.line},
  hero:{padding:vendorSpace.lg,backgroundColor:c.isDark?'#194c3a':c.green,borderRadius:vendorRadius.xl,overflow:'hidden'},
  heroTitle:{color:'white',fontSize:22,fontWeight:'900',letterSpacing:-.4},
  metrics:{flexDirection:'row',alignItems:'stretch',marginTop:vendorSpace.lg,paddingVertical:vendorSpace.md,borderRadius:vendorRadius.md,backgroundColor:'rgba(255,255,255,.11)'},
  metric:{flex:1,alignItems:'center',justifyContent:'center'},
  metricValue:{color:'white',fontWeight:'900',fontSize:24},
  metricLabel:{color:'#d9e5d1',fontWeight:'800',fontSize:8,letterSpacing:.6,marginTop:2},
  titleRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:vendorSpace.sm},
  title:{color:c.ink,fontSize:vendorType.title,fontWeight:'900'},
  link:{color:c.green,fontSize:12,fontWeight:'900'},
  button:{minHeight:48,paddingHorizontal:14,marginTop:vendorSpace.sm,borderRadius:vendorRadius.sm},
  loader:{margin:28},
  review:{padding:vendorSpace.md,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.md,backgroundColor:c.cream},
  reviewHeader:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:vendorSpace.sm},
  reviewTitle:{fontSize:14,fontWeight:'900',color:c.ink},
  copy:{color:c.muted,fontSize:12,lineHeight:18},
  success:{padding:11,borderRadius:vendorRadius.sm,backgroundColor:c.mint,color:c.green,fontSize:12,fontWeight:'800'},
  card:{padding:vendorSpace.md,marginTop:vendorSpace.sm,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.card},
  formTitle:{fontSize:17,fontWeight:'900',color:c.ink,marginBottom:4},
  product:{padding:vendorSpace.md,marginTop:vendorSpace.sm,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.card},
  productTop:{flexDirection:'row',alignItems:'flex-start',gap:vendorSpace.sm},
  productImage:{width:64,height:64,borderRadius:vendorRadius.md,backgroundColor:c.cream},
  productImageFallback:{width:64,height:64,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.md,backgroundColor:c.cream},
  productInfo:{flex:1,minWidth:0,gap:3},
  productName:{color:c.ink,fontSize:14,fontWeight:'900'},
  stockText:{fontSize:10,fontWeight:'700',color:c.muted},
  availability:{minHeight:30,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:8,borderRadius:vendorRadius.pill},
  available:{backgroundColor:c.mint},
  paused:{backgroundColor:c.cream},
  availabilityDot:{width:6,height:6,borderRadius:3},
  availableDot:{backgroundColor:c.green},
  pausedDot:{backgroundColor:c.muted},
  availabilityText:{fontSize:9,fontWeight:'900'},
  availableText:{color:c.green},
  pausedText:{color:c.muted},
  productActions:{flexDirection:'row',alignItems:'center',gap:8,marginTop:vendorSpace.md,paddingTop:vendorSpace.sm,borderTopWidth:1,borderTopColor:c.line},
  productAction:{flex:1,minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:4,borderRadius:vendorRadius.sm,backgroundColor:c.cream},
  productActionText:{fontSize:10,fontWeight:'800',color:c.ink},
  deleteText:{color:c.isDark?'#f0877a':'#a34232',fontSize:10,fontWeight:'900'},
  extras:{width:'100%',marginTop:vendorSpace.md,paddingTop:vendorSpace.md,borderTopWidth:1,borderColor:c.line},
  extrasTitle:{fontSize:13,fontWeight:'900',color:c.ink,marginBottom:vendorSpace.xs},
  addonRow:{flexDirection:'row',alignItems:'center',gap:vendorSpace.sm,paddingVertical:vendorSpace.sm,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:c.line},
  addonName:{fontSize:12,fontWeight:'800',color:c.ink},
  extraToggle:{minHeight:36,justifyContent:'center',paddingHorizontal:10,borderRadius:vendorRadius.pill,backgroundColor:c.cream},
  extraToggleActive:{backgroundColor:c.mint},
  extraToggleText:{fontSize:9,fontWeight:'800',color:c.muted},
  extraToggleTextActive:{color:c.green},
  addExtraForm:{marginTop:vendorSpace.sm,paddingTop:vendorSpace.md,borderTopWidth:1,borderTopColor:c.line},
  inlineExtras:{width:'100%',marginTop:vendorSpace.lg,paddingTop:vendorSpace.md,borderTopWidth:1,borderColor:c.line},
  inlineAddon:{paddingVertical:vendorSpace.sm,borderBottomWidth:1,borderColor:c.line},
  pill:{alignSelf:'flex-start',backgroundColor:c.cream,padding:10,borderRadius:vendorRadius.sm},
  error:{color:c.isDark?'#f0877a':'#a34232',fontSize:12,lineHeight:17,marginTop:vendorSpace.sm},
  accountSection:{fontSize:9,fontWeight:'900',letterSpacing:1.2,color:c.green,marginTop:vendorSpace.sm,marginBottom:-vendorSpace.xs},
  accountGroup:{paddingHorizontal:vendorSpace.sm,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.card,overflow:'hidden'},
  accountHero:{position:'relative',overflow:'hidden',padding:vendorSpace.lg,borderRadius:vendorRadius.xl,backgroundColor:c.isDark?'#194c3a':c.green},
  accountHeroGlow:{position:'absolute',top:-95,right:-35,width:210,height:210,borderRadius:105,backgroundColor:'rgba(255,255,255,.07)'},
  accountHeroTop:{flexDirection:'row',alignItems:'center',gap:vendorSpace.sm},
  storeAvatar:{width:58,height:58,borderRadius:vendorRadius.lg,borderWidth:1,borderColor:'rgba(255,255,255,.28)',backgroundColor:'rgba(255,255,255,.12)'},
  storeAvatarFallback:{width:58,height:58,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.lg,borderWidth:1,borderColor:'rgba(255,255,255,.28)',backgroundColor:'rgba(255,255,255,.12)'},
  accountHeroCopy:{flex:1,minWidth:0},
  accountOwnerRow:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:4},
  accountOwnerEyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1,color:'#d8e5df'},
  accountStoreName:{fontSize:20,lineHeight:24,fontWeight:'900',letterSpacing:-.4,color:'white'},
  accountOwner:{fontSize:10,color:'#d8e5df',marginTop:3},
  accountEditButton:{width:40,height:40,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.md,borderWidth:1,borderColor:'rgba(255,255,255,.18)',backgroundColor:'rgba(255,255,255,.12)'},
  accountHeroDivider:{height:1,backgroundColor:'rgba(255,255,255,.16)',marginVertical:vendorSpace.md},
  accountStats:{flexDirection:'row',alignItems:'stretch'},
  accountStat:{flex:1,alignItems:'center',justifyContent:'center'},
  accountStatValue:{fontSize:15,fontWeight:'900',color:'white'},
  accountStatLabel:{fontSize:8,fontWeight:'900',letterSpacing:.5,color:'#d8e5df',marginTop:3,textAlign:'center'},
  storeStatusDot:{width:6,height:6,borderRadius:3,backgroundColor:'#b9e6c6'},
  accountQuickGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},
  accountQuickTile:{width:'48.6%',minHeight:74,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:10,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.card},
  accountQuickIcon:{width:38,height:38,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.md,backgroundColor:c.mint},
  accountQuickCopy:{flex:1,minWidth:0},
  accountQuickTitle:{fontSize:12,fontWeight:'900',color:c.ink},
  accountQuickDetail:{fontSize:9,lineHeight:13,color:c.muted,marginTop:2},
  profileAction:{minHeight:62,paddingHorizontal:4,flexDirection:'row',alignItems:'center',gap:vendorSpace.sm},
  profileActionDivider:{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:c.line},
  profileActionIcon:{width:37,height:37,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.md,backgroundColor:c.cream},
  profileActionCopy:{flex:1},
  profileActionTitle:{color:c.ink,fontSize:12,fontWeight:'900'},
  profileActionDetail:{color:c.muted,fontSize:10,marginTop:3},
  logout:{minHeight:48,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8,marginTop:vendorSpace.md,marginBottom:vendorSpace.sm,borderRadius:vendorRadius.md,backgroundColor:c.isDark?'#392a20':'#fdf0ed'},
  logoutText:{fontSize:12,fontWeight:'900',color:c.isDark?'#f0877a':'#a34232'},
  empty:{alignItems:'center',padding:vendorSpace.xl,marginTop:vendorSpace.sm,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.card},
  emptyIcon:{width:48,height:48,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.md,backgroundColor:c.cream},
  emptyTitle:{color:c.ink,fontWeight:'900',fontSize:15,textAlign:'center',marginTop:vendorSpace.sm},
  emptyBody:{color:c.muted,fontSize:12,lineHeight:18,marginTop:5,textAlign:'center'},
});
