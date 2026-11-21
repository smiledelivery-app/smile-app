import { AppText as Text } from '@makanza/mobile-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { api } from '../services/api';
import type { AppColors } from '../theme/colors';
import { ScreenHeader } from '../components/ui';
import PaystackCheckoutModal from './PaystackCheckoutModal';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';

type Transaction = {
  id: string;
  amountMinor: number;
  status: string;
  provider: string;
  isDemo: boolean;
  createdAt: string;
  order: { id: string; vendor: { name: string } };
};
type Filter = 'ALL' | 'PENDING' | 'FAILED' | 'SUCCESS';
type WalletSummary={balanceMinor:number;currency:string;status:string;dva:{accountNumber:string|null;accountName:string|null;bankName:string|null;bankSlug:string|null;status:string}};
const filters: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'FAILED', label: 'Failed' },
  { id: 'SUCCESS', label: 'Success' },
];

export default function WalletScreen({ token, demoMode, colors, onSignIn }: {
  token: string | null;
  demoMode: boolean;
  colors: AppColors;
  onSignIn: () => void;
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
    return transaction.status.toUpperCase() === filter;
  }), [filter, transactions]);

  const startTopUp = async() => {
    if (!demoMode) {
      if(!token){onSignIn();return;}
      setTopUpBusy(true);setNotice('');
      try{const authorization=await api.post<{authorizationUrl:string;reference:string}>('/wallet/topup/initialize',{amountMinor:500_000},token);setCheckout({authorizationUrl:authorization.authorizationUrl,reference:authorization.reference});}
      catch(reason){setNotice(reason instanceof Error?reason.message:'Could not start wallet top-up. No payment was made.');}
      finally{setTopUpBusy(false);}
      return;
    }
    const now = new Date().toISOString();
    setBalanceMinor(value => value + 500000);
    setTransactions(rows => [{
      id: `demo-topup-${Date.now()}`, amountMinor: 500000, status: 'SUCCEEDED', provider: 'LOCAL_DEMO', isDemo: true, createdAt: now,
      order: { id: 'DEMO-TOP-UP', vendor: { name: 'Simulated wallet top-up' } },
    }, ...rows]);
    setNotice('Simulated +₦5,000 added to this preview only. No money was charged.');
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

  return <View style={s.screen}><ScreenHeader title="Wallet" subtitle="Balance, payments, and activity" icon="card-outline" colors={colors}/><ScrollView style={{flex:1}} contentContainerStyle={s.content}>
    <Text style={s.kicker}>PAYMENTS & BALANCE</Text>

    <View style={s.balanceCard}>
      <View style={s.balanceTop}>
        <View style={s.walletMark}><Ionicons name="card-outline" size={21} color="white"/></View>
        <Text style={s.balanceCaption}>WALLET BALANCE</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={balanceVisible ? 'Hide wallet balance' : 'Show wallet balance'} onPress={() => setBalanceVisible(value => !value)} style={s.eyeButton}>
          <Ionicons name={balanceVisible ? 'eye-outline' : 'eye-off-outline'} size={24} color="white"/>
        </Pressable>
      </View>
      <Text style={s.balance}>{balanceVisible ? balanceAvailable ? `₦${(balanceMinor / 100).toLocaleString('en-NG')}` : token?'Unavailable':'Sign in' : '••••••••'}</Text>
      <Text style={s.balanceNote}>{demoMode?'Demo wallet balance':balanceFromApi?'Wallet balance · NGN':token?error||'Loading your balance':'Sign in to view your balance'}</Text>
      <Pressable accessibilityRole="button" disabled={topUpBusy} onPress={startTopUp} style={[s.topUpButton,topUpBusy&&{opacity:.65}]}>
        <Ionicons name="add" size={21} color={p.primary}/>
        <Text style={s.topUpText}>{topUpBusy?'Opening Paystack...':demoMode ? 'Simulate +₦5,000' : 'Top up +₦5,000'}</Text>
      </Pressable>
    </View>

    <View style={s.dvaCard}>
      <View style={s.dvaHeading}>
        <View style={s.dvaIcon}><Ionicons name="business-outline" size={19} color={p.primary}/></View>
        <View style={{flex:1}}><Text style={s.dvaTitle}>Your dedicated bank account</Text><Text style={s.dvaSubtitle}>Transfer money into your Smile wallet</Text></View>
        {dva?.status==='ACTIVE'&&dva.accountNumber?<Text style={s.dvaReady}>READY</Text>:null}
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
      <View><Text style={s.historyTitle}>Transaction history</Text><Text style={s.historySubtitle}>Payments and refunds on your orders</Text></View>
      {token && <Pressable accessibilityRole="button" accessibilityLabel="Reload transaction history" onPress={() => {
        setLoading(true);
        setError('');
        api.get<Transaction[]>('/wallet/transactions', token)
          .then(setTransactions)
          .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load transactions.'))
          .finally(() => setLoading(false));
      }} style={s.refreshButton}><Ionicons name="refresh-outline" size={20} color={p.primary}/></Pressable>}
    </View>

    <View style={s.filters}>{filters.map(item => {
      const selected = filter === item.id;
      return <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setFilter(item.id)} style={[s.filter, selected && s.filterSelected]}>
        <Text style={[s.filterText, selected && s.filterTextSelected]}>{item.label}</Text>
      </Pressable>;
    })}</View>

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
    </View> : visibleTransactions.map(transaction => <TransactionRow key={transaction.id} transaction={transaction} colors={colors}/>)}

    <Text style={s.disclaimer}>{demoMode ? 'LOCAL PREVIEW · Sample records and simulated top-ups never represent real charges.' : 'Demo payment records are clearly marked and never represent real charges.'}</Text>
  </ScrollView>{checkout&&<PaystackCheckoutModal visible authorizationUrl={checkout.authorizationUrl} reference={checkout.reference} colors={colors} onClose={closeCheckout} onPaymentReturn={verifyTopUp}/>}</View>;
}

function TransactionRow({ transaction, colors }: { transaction: Transaction; colors: AppColors }) {
  const p=customerPalette(colors);
  const s = styles(p);
  const status = transaction.status.toUpperCase();
  const successful = status === 'SUCCEEDED' || status === 'SUCCESS';
  const pending = status === 'PENDING';
  const icon = successful ? 'checkmark' : pending ? 'time-outline' : 'close';
  const color = successful ? p.primary : pending ? p.warning : p.danger;
  return <View style={s.transaction}>
    <View style={[s.transactionIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={21} color={color}/></View>
    <View style={s.transactionInfo}>
      <Text numberOfLines={1} style={s.vendor}>{transaction.order.vendor.name}</Text>
      <Text style={s.transactionMeta}>Order {transaction.order.id.slice(-8)} · {new Date(transaction.createdAt).toLocaleDateString()}</Text>
      <View style={s.statusRow}><Text style={[s.status, { color }]}>{status.replaceAll('_', ' ')}</Text>{transaction.isDemo && <Text style={s.demo}>DEMO</Text>}</View>
    </View>
    <Text style={s.amount}>₦{(transaction.amountMinor / 100).toLocaleString('en-NG')}</Text>
  </View>;
}

const styles = (c: ReturnType<typeof customerPalette>) => StyleSheet.create({
  screen:{flex:1,backgroundColor:c.canvas},
  content:{paddingHorizontal:customerSpace.lg,paddingTop:customerSpace.md,paddingBottom:customerSpace.xxl},
  kicker:{fontSize:10,fontWeight:'900',letterSpacing:1.2,color:c.primary},
  balanceCard:{padding:18,borderRadius:customerRadius.lg,backgroundColor:c.balance,overflow:'hidden'},
  balanceTop:{flexDirection:'row',alignItems:'center',gap:9},
  walletMark:{width:36,height:36,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.14)'},
  balanceCaption:{flex:1,fontSize:10,fontWeight:'900',letterSpacing:1,color:'#edf4e9'},
  eyeButton:{width:42,height:42,alignItems:'center',justifyContent:'center'},
  balance:{fontSize:34,lineHeight:40,fontWeight:'900',letterSpacing:-1,color:'white',marginTop:13},
  balanceNote:{fontSize:11,lineHeight:16,color:'#e4eee5',marginTop:3},
  topUpButton:{minHeight:42,alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#f0f3e8',paddingHorizontal:12,borderRadius:customerRadius.sm,marginTop:14},
  topUpText:{fontSize:11,fontWeight:'900',color:'#174b36'},
  dvaCard:{padding:15,marginTop:11,borderRadius:customerRadius.lg,borderWidth:1,borderColor:c.border,backgroundColor:c.surface},
  dvaHeading:{flexDirection:'row',alignItems:'center',gap:10},
  dvaIcon:{width:38,height:38,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
  dvaTitle:{fontSize:14,fontWeight:'900',color:c.ink},
  dvaSubtitle:{fontSize:10,lineHeight:15,color:c.muted,marginTop:3},
  dvaReady:{fontSize:9,fontWeight:'900',letterSpacing:.6,color:c.primary},
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
  historyHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:customerSpace.section},
  historyTitle:{fontSize:18,fontWeight:'900',letterSpacing:-.4,color:c.ink},
  historySubtitle:{fontSize:10,color:c.muted,marginTop:3},
  refreshButton:{width:42,height:42,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm,backgroundColor:c.surfaceAlt},
  filters:{flexDirection:'row',gap:7,marginTop:12,marginBottom:3},
  filter:{minHeight:34,justifyContent:'center',paddingHorizontal:12,borderRadius:customerRadius.pill,backgroundColor:c.surfaceAlt},
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
  transaction:{flexDirection:'row',alignItems:'center',gap:10,padding:12,marginTop:8,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.md,backgroundColor:c.surface},
  transactionIcon:{width:36,height:36,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center'},
  transactionInfo:{flex:1},
  vendor:{fontSize:12,fontWeight:'800',color:c.ink},
  transactionMeta:{fontSize:10,color:c.muted,marginTop:3},
  statusRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:5},
  status:{fontSize:9,fontWeight:'900'},
  demo:{fontSize:8,fontWeight:'900',letterSpacing:.5,color:c.warning},
  amount:{fontSize:12,fontWeight:'900',color:c.ink},
  disclaimer:{fontSize:9,lineHeight:14,color:c.muted,marginTop:15},
});
