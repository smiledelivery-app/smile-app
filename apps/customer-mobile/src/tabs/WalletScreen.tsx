import { AppText as Text, AppTextInput as TextInput } from '@makanza/mobile-ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { api } from '../services/api';
import type { AppColors } from '../theme/colors';
import { ScreenHeader } from '../components/ui';
import PaystackCheckoutModal from './PaystackCheckoutModal';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';
import { formatOrderNumber } from '../utils/format';

type Transaction = {
  id: string;
  amountMinor: number;
  status: string;
  provider: string;
  direction?: 'CREDIT' | 'DEBIT';
  type?: string;
  title?: string;
  subtitle?: string | null;
  isDemo: boolean;
  createdAt: string;
  order?: { id?: string|null; displayNumber?: number|null; vendor?: { name?: string|null }|null }|null;
};
type Filter = 'ALL' | 'PENDING' | 'FAILED' | 'SUCCESS' | 'REFUNDED';
type WalletSummary={balanceMinor:number;currency:string;status:string;dva:{accountNumber:string|null;accountName:string|null;bankName:string|null;bankSlug:string|null;status:string}};
const filters: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'FAILED', label: 'Failed' },
  { id: 'SUCCESS', label: 'Success' },
  { id: 'REFUNDED', label: 'Refunded' },
];

export default function WalletScreen({ token, demoMode, colors, onSignIn, onHistory }: {
  token: string | null;
  demoMode: boolean;
  colors: AppColors;
  onSignIn: () => void;
  onHistory: () => void;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balanceMinor, setBalanceMinor] = useState(0);
  const [balanceAvailable,setBalanceAvailable]=useState(false);
  const [balanceFromApi,setBalanceFromApi]=useState(false);
  const [dva,setDva]=useState<WalletSummary['dva']|null>(null);
  const [dvaError,setDvaError]=useState('');
  const [dvaRetryBusy,setDvaRetryBusy]=useState(false);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [notice, setNotice] = useState('');
  const [checkout,setCheckout]=useState<{authorizationUrl:string;reference:string}|null>(null);
  const [topUpBusy,setTopUpBusy]=useState(false);
  const [topUpModalVisible,setTopUpModalVisible]=useState(false);
  const [topUpAmount,setTopUpAmount]=useState('');
  const [topUpError,setTopUpError]=useState('');
  const walletScroll=useRef<ScrollView|null>(null);
  const [transferCardOffset,setTransferCardOffset]=useState(0);
  const p=customerPalette(colors);
  const s = styles(p);

  const refreshWallet=useCallback(async()=>{
    if(!token)return;
    try{
      const wallet=await api.get<WalletSummary>('/wallet',token);
      setBalanceMinor(wallet.balanceMinor);
      setBalanceAvailable(true);
      setBalanceFromApi(true);
      setDva(wallet.dva);
      setDvaError('');
    }catch(reason){
      const message=reason instanceof Error?reason.message:'Could not load wallet details.';
      setBalanceAvailable(false);
      setError(message);
      setDvaError(message);
    }
  },[token]);

  useEffect(() => {
    if (demoMode) {
      setTransactions([
        { id: 'demo-wallet-1', amountMinor: 380000, status: 'SUCCEEDED', provider: 'LOCAL_DEMO', isDemo: true, createdAt: new Date(Date.now() - 3_600_000).toISOString(), order: { id: 'demo-order-1042', vendor: { name: 'Ada’s Kitchen' } } },
        { id: 'demo-wallet-2', amountMinor: 520000, status: 'PENDING', provider: 'LOCAL_DEMO', isDemo: true, createdAt: new Date(Date.now() - 86_400_000).toISOString(), order: { id: 'demo-order-1038', vendor: { name: 'Green Bowl' } } },
        { id: 'demo-wallet-3', amountMinor: 180000, status: 'FAILED', provider: 'LOCAL_DEMO', isDemo: true, createdAt: new Date(Date.now() - 172_800_000).toISOString(), order: { id: 'demo-order-1027', vendor: { name: 'Suya Corner' } } },
      ]);
      setBalanceMinor(2_345_000);
      setBalanceAvailable(true);
      setDva(null);
      setDvaError('');
      setLoading(false);
      setError('');
      return;
    }
    if (!token) {
      setTransactions([]);
      setBalanceMinor(0);
      setBalanceFromApi(false);
      setBalanceAvailable(false);
      setDva(null);
      setDvaError('');
      setLoading(false);
      setError('');
      return;
    }

    let active = true;
    setBalanceMinor(0);
    setBalanceFromApi(false);
    setBalanceAvailable(false);
    setDva(null);
    setDvaError('');
    setLoading(true);
    setError('');
    api.get<WalletSummary>('/wallet',token)
      .then(wallet=>{if(active){setBalanceMinor(wallet.balanceMinor);setBalanceAvailable(true);setBalanceFromApi(true);setDva(wallet.dva);}})
      .catch(reason=>{if(active){const message=reason instanceof Error?reason.message:'Could not load wallet balance.';setError(message);setDvaError(message);}});
    api.get<Transaction[]>('/wallet/transactions', token)
      .then(rows => { if (active) setTransactions(rows); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load transactions.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demoMode, token]);

  useEffect(()=>{
    if(demoMode||!token||dva?.status!=='PENDING')return;
    let active=true;
    const timer=setInterval(()=>{
      void api.get<WalletSummary>('/wallet',token)
        .then(wallet=>{if(active){setBalanceMinor(wallet.balanceMinor);setBalanceAvailable(true);setBalanceFromApi(true);setDva(wallet.dva);setDvaError('');}})
        .catch(reason=>{if(active)setDvaError(reason instanceof Error?reason.message:'Could not refresh dedicated account status.');});
    },5000);
    return()=>{active=false;clearInterval(timer);};
  },[demoMode,token,dva?.status]);

  const visibleTransactions = useMemo(() => transactions.filter(transaction => {
    if (filter === 'ALL') return true;
    if (filter === 'SUCCESS') return ['SUCCEEDED', 'SUCCESS'].includes(transaction.status.toUpperCase());
    if(filter==='PENDING')return ['PENDING','REFUND_PENDING'].includes(transaction.status.toUpperCase());
    return transaction.status.toUpperCase() === filter;
  }), [filter, transactions]);

  const openTopUpModal=()=>{
    setTopUpAmount('');
    setTopUpError('');
    setTopUpModalVisible(true);
  };

  const startTopUp = async() => {
    const amountMinor=parseTopUpAmount(topUpAmount);
    if(amountMinor===null||amountMinor<10_000||amountMinor>100_000_000){
      setTopUpError('Enter an amount from ₦100 to ₦1,000,000, with up to 2 decimal places.');
      return;
    }
    setTopUpBusy(true);
    setTopUpError('');
    setNotice('');
    if(!demoMode){
      if(!token){
        setTopUpBusy(false);
        setTopUpModalVisible(false);
        onSignIn();
        return;
      }
      try{
        const authorization=await api.post<{authorizationUrl:string;reference:string}>('/wallet/topup/initialize',{amountMinor},token);
        setCheckout({authorizationUrl:authorization.authorizationUrl,reference:authorization.reference});
        setTopUpModalVisible(false);
      }catch(reason){
        setTopUpError(reason instanceof Error?reason.message:'Could not start wallet top-up. No payment was made.');
      }finally{
        setTopUpBusy(false);
      }
      return;
    }
    const now = new Date().toISOString();
    setBalanceMinor(value => value + amountMinor);
    setTransactions(rows => [{
      id: `demo-topup-${Date.now()}`, amountMinor, status: 'SUCCEEDED', provider: 'LOCAL_DEMO', isDemo: true, createdAt: now,
      order: { id: 'DEMO-TOP-UP', vendor: { name: 'Simulated wallet top-up' } },
    }, ...rows]);
    setTopUpModalVisible(false);
    setTopUpBusy(false);
    setNotice(`Simulated +${formatNaira(amountMinor)} added to this preview only. No money was charged.`);
  };

  const closeCheckout=()=>{
    setCheckout(null);
    setNotice('Checkout closed. A successful payment will be added after Paystack confirms it.');
    if(token)void refreshWallet();
  };

  const verifyTopUp=async(reference:string)=>{
    setCheckout(null);
    if(!token)return;
    setNotice('Verifying your payment with Paystack...');
    try{
      const result=await api.post<{status:string;credited:boolean;balanceMinor?:number}>('/wallet/topup/verify',{reference},token);
      if(result.status==='success'&&result.balanceMinor!==undefined){setBalanceMinor(result.balanceMinor);setBalanceAvailable(true);setBalanceFromApi(true);setNotice('Top-up complete. Your wallet balance has been updated.');}
      else setNotice('Paystack is still confirming this payment. Your wallet will update when it is verified.');
    }catch(reason){setNotice(reason instanceof Error?`Payment returned from checkout, but confirmation is still pending: ${reason.message}`:'Payment confirmation is still pending. Check your wallet again shortly.');}
  };

  const retryDva=async()=>{
    if(!token){onSignIn();return;}
    setDvaRetryBusy(true);
    setDvaError('');
    try{
      const result=await api.post<{status:string}>('/wallet/dva/retry',{},token);
      setDva(current=>current?{...current,status:result.status}:{accountNumber:null,accountName:null,bankName:null,bankSlug:null,status:result.status});
      setNotice(result.status==='ACTIVE'?'Your dedicated account is ready.':'Account setup was restarted. This screen will update automatically.');
      await refreshWallet();
    }catch(reason){
      setDvaError(reason instanceof Error?reason.message:'Could not retry dedicated account setup.');
    }finally{
      setDvaRetryBusy(false);
    }
  };

  return <View style={s.screen}><ScreenHeader title="Wallet" subtitle="Your money, all in one place" icon="wallet-outline" colors={colors}/><ScrollView ref={walletScroll} style={{flex:1}} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
    <View style={s.balanceCard}>
      <View pointerEvents="none" style={s.balanceOrb}/>
      <View style={s.balanceTop}>
        <View style={s.walletMark}><Ionicons name="card-outline" size={21} color="white"/></View>
        <View style={s.balanceHeading}><Text style={s.balanceCaption}>AVAILABLE BALANCE</Text><Text style={s.balanceCurrency}>NGN · {demoMode?'PREVIEW':'SMILE WALLET'}</Text></View>
        <View style={s.activeBadge}><View style={s.activeDot}/><Text style={s.activeText}>{balanceAvailable?'ACTIVE':token?'CHECKING':'GUEST'}</Text></View>
      </View>
      <View style={s.balanceValueRow}>
        <Text style={s.balance}>{balanceVisible ? balanceAvailable ? `₦${(balanceMinor / 100).toLocaleString('en-NG')}` : token?'Unavailable':'Sign in' : '••••••••'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={balanceVisible ? 'Hide wallet balance' : 'Show wallet balance'} onPress={() => setBalanceVisible(value => !value)} style={s.eyeButton}>
          <Ionicons name={balanceVisible ? 'eye-outline' : 'eye-off-outline'} size={21} color="white"/>
        </Pressable>
      </View>
      <Text style={s.balanceNote}>{demoMode?'Demo wallet balance · no real funds':balanceFromApi?'Your available Smile wallet balance':token?error||'Loading your balance':'Sign in to view your balance'}</Text>
      <View style={s.balanceFooter}>
        <Pressable accessibilityRole="button" onPress={openTopUpModal} style={s.topUpButton}>
          <Ionicons name="add" size={19} color={p.primary}/>
          <Text style={s.topUpText}>Add money</Text>
        </Pressable>
        {!demoMode&&<View style={s.secureLabel}><Ionicons name="shield-checkmark-outline" size={13} color="#e4eee5"/><Text style={s.secureText}>Secure</Text></View>}
      </View>
    </View>

    <View style={s.quickActions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Add money to wallet" onPress={openTopUpModal} style={s.quickActionPrimary}>
        <View style={s.quickActionIconPrimary}><Ionicons name="add" size={20} color="white"/></View>
        <Text style={s.quickActionPrimaryText}>Add money</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="View bank transfer details" onPress={()=>walletScroll.current?.scrollTo({y:transferCardOffset,animated:true})} style={s.quickAction}>
        <View style={s.quickActionIcon}><Ionicons name="swap-horizontal-outline" size={20} color={p.primary}/></View>
        <Text style={s.quickActionText}>Transfer</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="View wallet activity" onPress={onHistory} disabled={!token} style={[s.quickAction,!token&&s.quickActionDisabled]}>
        <View style={s.quickActionIcon}><Ionicons name="receipt-outline" size={20} color={p.primary}/></View>
        <Text style={s.quickActionText}>Activity</Text>
      </Pressable>
    </View>

    <View style={s.dvaCard} onLayout={event=>setTransferCardOffset(event.nativeEvent.layout.y)}>
      <View style={s.dvaHeading}>
        <View style={s.dvaIcon}><Ionicons name="business-outline" size={19} color={p.primary}/></View>
        <View style={{flex:1}}><Text style={s.dvaTitle}>Add money by bank transfer</Text><Text style={s.dvaSubtitle}>Your personal Smile wallet account</Text></View>
        {dva?.status==='ACTIVE'&&dva.accountNumber?<View style={s.dvaReadyBadge}><View style={s.dvaReadyDot}/><Text style={s.dvaReady}>ACTIVE</Text></View>:null}
      </View>
      {demoMode?<Text style={s.dvaCopy}>Dedicated accounts are available to registered, non-demo accounts.</Text>
      :!token?<View><Text style={s.dvaCopy}>Sign in to view or set up your personal account.</Text><Pressable accessibilityRole="button" onPress={onSignIn} style={s.dvaButton}><Text style={s.dvaButtonText}>Sign in</Text></Pressable></View>
      :dva?.status==='ACTIVE'&&dva.accountNumber?<View style={s.accountDetails}>
        <Text style={s.accountLabel}>{dva.bankName??'Dedicated account'}</Text>
        <Text selectable style={s.accountNumber}>{dva.accountNumber}</Text>
        <Text selectable style={s.accountName}>{dva.accountName??'Account name unavailable'}</Text>
        <Text style={s.dvaCopy}>Use this account number for bank transfers. Funds received are credited to your Smile wallet.</Text>
      </View>
      :dva?.status==='PENDING'?<View style={s.dvaStatusRow}><ActivityIndicator color={p.primary}/><Text style={s.dvaCopy}>Your account is being set up. This screen checks for updates automatically.</Text></View>
      :dva?.status==='FAILED'?<View><Text style={s.dvaCopy}>We couldn’t set up your dedicated account. Check that your profile has a valid email and phone number, then retry. If it keeps failing, Paystack may need to enable dedicated accounts for your business.</Text><Pressable accessibilityRole="button" disabled={dvaRetryBusy} onPress={()=>void retryDva()} style={[s.dvaButton,dvaRetryBusy&&{opacity:.65}]}><Text style={s.dvaButtonText}>{dvaRetryBusy?'Retrying…':'Retry account setup'}</Text></Pressable>{dvaError?<Text style={s.dvaError}>{dvaError}</Text>:null}</View>
      :dva?.status==='ACTIVE'?<Text style={s.dvaError}>{dvaError||'Your account is active, but its details are unavailable. Please contact support.'}</Text>
      :dvaError?<Text style={s.dvaError}>{dvaError}</Text>
      :<View style={s.dvaStatusRow}><ActivityIndicator color={p.primary}/><Text style={s.dvaCopy}>Loading your account details…</Text></View>}
      {dvaError&&dva?.status==='PENDING'?<Text style={s.dvaError}>{dvaError}</Text>:null}
    </View>

    {notice ? <View accessibilityRole="alert" style={s.notice}><Text style={s.noticeText}>{notice}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={() => setNotice('')}><Ionicons name="close" size={21} color={colors.green}/></Pressable></View> : null}

    <View style={s.historyHeading}>
      <View><Text style={s.historyTitle}>Recent activity</Text><Text style={s.historySubtitle}>Payments and refunds on your orders</Text></View>
      {token && <Pressable accessibilityRole="button" accessibilityLabel="View all wallet activity" onPress={onHistory} style={s.seeAllButton}><Text style={s.seeAllText}>View all</Text><Ionicons name="chevron-forward" size={15} color={p.primary}/></Pressable>}
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroller} contentContainerStyle={s.filters}>{filters.map(item => {
      const selected = filter === item.id;
      return <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setFilter(item.id)} style={[s.filter, selected && s.filterSelected]}>
        <Text style={[s.filterText, selected && s.filterTextSelected]}>{item.label}</Text>
      </Pressable>;
    })}</ScrollView>

    {!token&&!demoMode ? <View style={s.empty}>
      <View style={s.emptyIcon}><Ionicons name="person-outline" size={23} color={p.primary}/></View>
      <Text style={s.emptyTitle}>Sign in to see your transactions</Text>
      <Text style={s.emptyCopy}>Your payment history is private to your account.</Text>
      <Pressable accessibilityRole="button" onPress={onSignIn} style={s.signInButton}><Text style={s.signInText}>Sign in</Text></Pressable>
    </View> : loading ? <ActivityIndicator style={s.loader} color={colors.green}/> : error ? <View style={s.empty}>
      <Text style={s.emptyTitle}>Transactions unavailable</Text>
      <Text style={s.emptyCopy}>{error}</Text>
    </View> : visibleTransactions.length === 0 ? <View style={s.empty}>
      <View style={s.emptyIcon}><Ionicons name="receipt-outline" size={23} color={p.primary}/></View>
      <Text style={s.emptyTitle}>{transactions.length ? `No ${filter === 'ALL' ? '' : filter.toLowerCase() + ' '}transactions` : 'No transactions yet'}</Text>
      <Text style={s.emptyCopy}>{transactions.length ? 'Try another filter to see more activity.' : 'Your order payments will appear here when available.'}</Text>
    </View> : visibleTransactions.map(transaction => {
      const status=transaction.status.toUpperCase();
      const statusInfo=statusDetails(status,p);
      const provider=transaction.provider.toLowerCase();
      const methodLabel=provider==='wallet'?'Smile wallet':provider==='bank_transfer'?'Bank transfer':provider==='paystack'?'Paystack':transaction.isDemo?'Demo checkout':'Order payment';
      const orderId=transaction.order?.id??null;
      const isTopUp=orderId==='DEMO-TOP-UP'||transaction.type==='TOPUP';
      const orderLabel=isTopUp?(transaction.subtitle??'Wallet top-up'):orderId?formatOrderNumber(transaction.order?.displayNumber,orderId):'Wallet activity';
      const vendorName=transaction.title??transaction.order?.vendor?.name??(isTopUp?'Wallet top-up':'Smile order');
      const incoming=transaction.direction?transaction.direction==='CREDIT':(status==='REFUNDED'||isTopUp);
      const amountPrefix=status==='FAILED'?'':incoming?'+':'−';
      const amountColor=incoming?p.primary:status==='PENDING'||status==='REFUND_PENDING'?p.warning:status==='FAILED'?p.muted:p.ink;
      return <View key={transaction.id} style={s.transaction}>
        <View style={[s.transactionIcon,{backgroundColor:statusInfo.background}]}><Ionicons name={incoming?'trending-up':'trending-down'} size={20} color={statusInfo.color}/></View>
        <View style={s.transactionInfo}>
          <Text numberOfLines={1} style={s.vendor}>{vendorName}</Text>
          <Text style={s.transactionMeta}>{methodLabel} · {orderLabel}</Text>
          <View style={s.statusRow}>
            <View style={[s.statusPill,{backgroundColor:statusInfo.background}]}>
              <Ionicons name={statusInfo.icon} size={12} color={statusInfo.color}/>
              <Text style={[s.status,{color:statusInfo.color}]}>{statusInfo.label}</Text>
            </View>
            <Text style={s.transactionDate}>{new Date(transaction.createdAt).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</Text>
          </View>
        </View>
        <View style={s.amountColumn}>
          <Text style={[s.amount,{color:amountColor}]}>{amountPrefix}₦{(transaction.amountMinor/100).toLocaleString('en-NG')}</Text>
          {transaction.isDemo&&<Text style={s.demo}>DEMO</Text>}
        </View>
      </View>;
    })}

    <Text style={s.disclaimer}>{demoMode ? 'LOCAL PREVIEW · Sample records and simulated top-ups never represent real charges.' : 'Demo payment records are clearly marked and never represent real charges.'}</Text>
  </ScrollView>
  <Modal visible={topUpModalVisible} transparent animationType="slide" onRequestClose={()=>{if(!topUpBusy)setTopUpModalVisible(false);}}>
    <View style={s.topUpOverlay}>
      <View style={s.topUpSheet}>
        <View style={s.topUpHeader}>
          <View style={s.topUpIcon}><Ionicons name="wallet-outline" size={21} color={p.primary}/></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close top-up form" disabled={topUpBusy} onPress={()=>setTopUpModalVisible(false)} style={s.topUpClose}><Ionicons name="close" size={20} color={p.muted}/></Pressable>
        </View>
        <Text style={s.topUpTitle}>Add money to your wallet</Text>
        <Text style={s.topUpSubtitle}>{demoMode?'Choose an amount to simulate in this preview. No payment will be made.':'Enter how much you’d like to add to your Smile wallet.'}</Text>
        <Text style={s.topUpLabel}>AMOUNT</Text>
        <View style={[s.amountInputWrap,!!topUpError&&s.amountInputInvalid]}>
          <Text style={s.currencyPrefix}>₦</Text>
          <TextInput accessibilityLabel="Top-up amount in naira" value={topUpAmount} onChangeText={(value:string)=>{setTopUpAmount(value);if(topUpError)setTopUpError('');}} placeholder="0.00" placeholderTextColor={p.muted} keyboardType="decimal-pad" returnKeyType="done" style={s.amountInput}/>
        </View>
        <Text style={s.amountHelp}>{token||demoMode?'Minimum ₦100 · Maximum ₦1,000,000':'Sign in is required to add money.'}</Text>
        {topUpError?<Text accessibilityRole="alert" style={s.topUpError}>{topUpError}</Text>:null}
        <View style={s.topUpActions}>
          <Pressable accessibilityRole="button" disabled={topUpBusy} onPress={()=>setTopUpModalVisible(false)} style={s.topUpCancel}><Text style={s.topUpCancelText}>Cancel</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={topUpBusy} onPress={()=>void startTopUp()} style={[s.topUpConfirm,topUpBusy&&{opacity:.65}]}>
            {topUpBusy?<ActivityIndicator size="small" color="white"/>:null}
            <Text style={s.topUpConfirmText}>{topUpBusy?'Preparing…':!demoMode&&!token?'Sign in to continue':demoMode?'Simulate top-up':'Continue to payment'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
  {checkout&&<PaystackCheckoutModal visible authorizationUrl={checkout.authorizationUrl} reference={checkout.reference} colors={colors} onClose={closeCheckout} onPaymentReturn={verifyTopUp}/>}</View>;
}

function statusDetails(status:string,p:ReturnType<typeof customerPalette>){
  if(status==='SUCCEEDED'||status==='SUCCESS')return{label:'Completed',icon:'checkmark-circle-outline',color:p.primary,background:p.primarySoft};
  if(status==='PENDING')return{label:'Processing',icon:'time-outline',color:p.warning,background:p.accentSoft};
  if(status==='REFUNDED')return{label:'Refunded',icon:'refresh-outline',color:p.primary,background:p.primarySoft};
  if(status==='REFUND_PENDING')return{label:'Refund pending',icon:'time-outline',color:p.warning,background:p.accentSoft};
  if(status==='FAILED')return{label:'Failed',icon:'close',color:p.danger,background:p.accentSoft};
  return{label:status.replace(/_/g,' ').toLowerCase(),icon:'information-circle-outline',color:p.muted,background:p.surfaceAlt};
}

function parseTopUpAmount(value:string):number|null{
  const normalized=value.trim();
  if(!/^\d+(?:\.\d{1,2})?$/.test(normalized))return null;
  const [whole,fraction='']=normalized.split('.');
  const amountMinor=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  return Number.isSafeInteger(amountMinor)?amountMinor:null;
}

function formatNaira(amountMinor:number):string{
  return `₦${(amountMinor/100).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

const styles = (c: ReturnType<typeof customerPalette>) => StyleSheet.create({
  screen:{flex:1,backgroundColor:c.canvas},
  content:{paddingHorizontal:customerSpace.lg,paddingTop:customerSpace.md,paddingBottom:customerSpace.xxl},
  balanceCard:{padding:18,borderRadius:customerRadius.xl,backgroundColor:c.balance,overflow:'hidden',shadowColor:'#102b1d',shadowOpacity:.14,shadowRadius:14,shadowOffset:{width:0,height:7},elevation:4},
  balanceOrb:{position:'absolute',top:-105,right:-45,width:220,height:220,borderRadius:110,backgroundColor:'rgba(255,255,255,.07)'},
  balanceTop:{flexDirection:'row',alignItems:'center',gap:9},
  walletMark:{width:42,height:42,borderRadius:customerRadius.md,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.14)'},
  balanceHeading:{flex:1,gap:3},
  balanceCaption:{fontSize:10,fontWeight:'900',letterSpacing:1,color:'#edf4e9'},
  balanceCurrency:{fontSize:9,fontWeight:'700',letterSpacing:.5,color:'#cddfd2'},
  activeBadge:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:9,paddingVertical:6,borderRadius:customerRadius.pill,backgroundColor:'rgba(255,255,255,.12)'},
  activeDot:{width:6,height:6,borderRadius:3,backgroundColor:'#b9e6c6'},
  activeText:{fontSize:8,fontWeight:'900',letterSpacing:.6,color:'#edf4e9'},
  balanceValueRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:14},
  eyeButton:{width:38,height:38,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.pill,backgroundColor:'rgba(255,255,255,.1)'},
  balance:{fontSize:36,lineHeight:43,fontWeight:'900',letterSpacing:-1.3,color:'white'},
  balanceNote:{fontSize:10,lineHeight:15,color:'#d8e8dc',marginTop:2},
  balanceFooter:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,marginTop:17,paddingTop:14,borderTopWidth:1,borderTopColor:'rgba(255,255,255,.16)'},
  topUpButton:{minHeight:42,alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#f0f3e8',paddingHorizontal:13,borderRadius:customerRadius.sm},
  topUpText:{fontSize:10,fontWeight:'900',color:'#174b36'},
  secureLabel:{flexDirection:'row',alignItems:'center',gap:4,paddingRight:2},
  secureText:{fontSize:9,fontWeight:'800',color:'#e4eee5'},
  quickActions:{flexDirection:'row',gap:8,marginTop:12},
  quickActionPrimary:{flex:1,minHeight:76,alignItems:'center',justifyContent:'center',gap:7,borderRadius:customerRadius.lg,backgroundColor:c.primary,shadowColor:c.primary,shadowOpacity:.16,shadowRadius:8,shadowOffset:{width:0,height:4},elevation:3},
  quickAction:{flex:1,minHeight:76,alignItems:'center',justifyContent:'center',gap:7,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.lg,backgroundColor:c.surface},
  quickActionDisabled:{opacity:.5},
  quickActionIconPrimary:{width:34,height:34,borderRadius:customerRadius.pill,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.16)',borderWidth:1,borderColor:'rgba(255,255,255,.12)'},
  quickActionIcon:{width:34,height:34,borderRadius:customerRadius.pill,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
  quickActionPrimaryText:{fontSize:11,fontWeight:'900',color:'white'},
  quickActionText:{fontSize:11,fontWeight:'900',color:c.ink},
  topUpOverlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(12,24,18,.52)'},
  topUpSheet:{paddingHorizontal:customerSpace.lg,paddingTop:20,paddingBottom:customerSpace.xl,borderTopLeftRadius:customerRadius.xl,borderTopRightRadius:customerRadius.xl,backgroundColor:c.surface},
  topUpHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:15},
  topUpIcon:{width:44,height:44,borderRadius:customerRadius.md,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
  topUpClose:{width:38,height:38,borderRadius:customerRadius.pill,alignItems:'center',justifyContent:'center',backgroundColor:c.surfaceAlt},
  topUpTitle:{fontSize:20,fontWeight:'900',color:c.ink},
  topUpSubtitle:{fontSize:12,lineHeight:18,color:c.muted,marginTop:6,marginBottom:20},
  topUpLabel:{fontSize:10,fontWeight:'900',letterSpacing:.7,color:c.muted,marginBottom:7},
  amountInputWrap:{minHeight:58,flexDirection:'row',alignItems:'center',paddingHorizontal:14,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.md,backgroundColor:c.canvas},
  amountInputInvalid:{borderColor:c.danger},
  currencyPrefix:{fontSize:21,fontWeight:'800',color:c.ink,marginRight:9},
  amountInput:{flex:1,minHeight:54,padding:0,fontSize:21,fontWeight:'800',color:c.ink},
  amountHelp:{fontSize:10,color:c.muted,marginTop:7},
  topUpError:{fontSize:11,lineHeight:16,color:c.danger,marginTop:8},
  topUpActions:{flexDirection:'row',gap:10,marginTop:22},
  topUpCancel:{minHeight:48,minWidth:92,alignItems:'center',justifyContent:'center',paddingHorizontal:17,borderRadius:customerRadius.md,backgroundColor:c.surfaceAlt},
  topUpCancelText:{fontSize:12,fontWeight:'800',color:c.ink},
  topUpConfirm:{flex:1,minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingHorizontal:14,borderRadius:customerRadius.md,backgroundColor:c.primary},
  topUpConfirmText:{fontSize:12,fontWeight:'900',color:'white',textAlign:'center'},
  dvaCard:{padding:15,marginTop:13,borderRadius:customerRadius.lg,borderWidth:1,borderColor:c.border,backgroundColor:c.surface},
  dvaHeading:{flexDirection:'row',alignItems:'center',gap:10},
  dvaIcon:{width:38,height:38,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
  dvaTitle:{fontSize:14,fontWeight:'900',color:c.ink},
  dvaSubtitle:{fontSize:10,lineHeight:15,color:c.muted,marginTop:3},
  dvaReadyBadge:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:8,paddingVertical:5,borderRadius:customerRadius.pill,backgroundColor:c.primarySoft},
  dvaReadyDot:{width:6,height:6,borderRadius:3,backgroundColor:c.primary},
  dvaReady:{fontSize:8,fontWeight:'900',letterSpacing:.6,color:c.primary},
  accountDetails:{padding:13,marginTop:12,borderRadius:customerRadius.md,backgroundColor:c.surfaceAlt},
  accountLabel:{fontSize:10,fontWeight:'900',letterSpacing:.7,color:c.primary},
  accountNumber:{fontSize:24,lineHeight:31,fontWeight:'900',letterSpacing:1,color:c.ink,marginTop:5},
  accountName:{fontSize:11,fontWeight:'800',color:c.ink,marginTop:3},
  dvaCopy:{flex:1,fontSize:11,lineHeight:17,color:c.muted,marginTop:9},
  dvaStatusRow:{flexDirection:'row',alignItems:'center',gap:10,marginTop:4},
  dvaButton:{minHeight:40,alignSelf:'flex-start',alignItems:'center',justifyContent:'center',paddingHorizontal:13,borderRadius:customerRadius.sm,backgroundColor:c.primary,marginTop:11},
  dvaButtonText:{fontSize:11,fontWeight:'900',color:'white'},
  dvaError:{fontSize:11,lineHeight:17,color:c.danger,marginTop:8},
  notice:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,padding:12,marginTop:11,borderRadius:customerRadius.sm,backgroundColor:c.primarySoft},
  noticeText:{flex:1,fontSize:11,lineHeight:17,color:c.primary},
  historyHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:customerSpace.xl,marginBottom:2},
  historyTitle:{fontSize:19,fontWeight:'900',letterSpacing:-.5,color:c.ink},
  historySubtitle:{fontSize:10,color:c.muted,marginTop:4},
  refreshButton:{width:40,height:40,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:c.border,borderRadius:customerRadius.sm,backgroundColor:c.surface},
  seeAllButton:{minHeight:36,flexDirection:'row',alignItems:'center',gap:2,paddingHorizontal:9,borderRadius:customerRadius.sm,backgroundColor:c.primarySoft},
  seeAllText:{fontSize:10,fontWeight:'900',color:c.primary},
  filterScroller:{flexGrow:0,marginTop:13,marginBottom:5},
  filters:{flexDirection:'row',gap:7},
  filter:{minHeight:35,justifyContent:'center',paddingHorizontal:13,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.pill,backgroundColor:c.surface},
  filterSelected:{backgroundColor:c.primary},
  filterText:{fontSize:10,fontWeight:'800',color:c.muted},
  filterTextSelected:{color:'white'},
  loader:{margin:28},
  empty:{alignItems:'center',padding:20,marginTop:12,borderRadius:customerRadius.lg,backgroundColor:c.surface},
  emptyIcon:{width:42,height:42,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
  emptyTitle:{fontSize:14,fontWeight:'900',color:c.ink,marginTop:10,textAlign:'center'},
  emptyCopy:{fontSize:11,lineHeight:17,color:c.muted,marginTop:4,textAlign:'center'},
  signInButton:{minHeight:40,justifyContent:'center',paddingHorizontal:17,borderRadius:customerRadius.sm,backgroundColor:c.primary,marginTop:12},
  signInText:{fontSize:11,fontWeight:'900',color:'white'},
  transaction:{minHeight:88,flexDirection:'row',alignItems:'center',gap:11,padding:13,marginTop:8,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.md,backgroundColor:c.surface},
  transactionIcon:{width:43,height:43,borderRadius:customerRadius.md,alignItems:'center',justifyContent:'center'},
  transactionInfo:{flex:1,minWidth:0,gap:2},
  vendor:{fontSize:12,fontWeight:'900',color:c.ink},
  transactionMeta:{fontSize:9,color:c.muted,marginTop:2},
  statusRow:{flexDirection:'row',alignItems:'center',gap:7,marginTop:5},
  statusPill:{minHeight:22,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,borderRadius:customerRadius.pill},
  status:{fontSize:8,fontWeight:'900'},
  transactionDate:{fontSize:8,color:c.muted},
  amountColumn:{alignItems:'flex-end',gap:5,paddingLeft:3},
  demo:{fontSize:8,fontWeight:'900',letterSpacing:.5,color:c.warning},
  amount:{fontSize:12,fontWeight:'900',color:c.ink},
  disclaimer:{fontSize:9,lineHeight:14,color:c.muted,textAlign:'center',marginTop:17},
});
