import { AppText as Text } from '@makanza/mobile-ui';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { api } from '../services/api';
import type { AppColors } from '../theme/colors';
import { ScreenHeader } from '../components/ui';
import PaystackCheckoutModal from './PaystackCheckoutModal';

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
  const [balanceMinor, setBalanceMinor] = useState(2_345_000);
  const [balanceAvailable,setBalanceAvailable]=useState(true);
  const [balanceFromApi,setBalanceFromApi]=useState(false);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [notice, setNotice] = useState('');
  const [checkout,setCheckout]=useState<{authorizationUrl:string;reference:string}|null>(null);
  const [topUpBusy,setTopUpBusy]=useState(false);
  const s = styles(colors);

  useEffect(() => {
    if (demoMode) {
      setTransactions([
        { id: 'demo-wallet-1', amountMinor: 380000, status: 'SUCCEEDED', provider: 'LOCAL_DEMO', isDemo: true, createdAt: new Date(Date.now() - 3_600_000).toISOString(), order: { id: 'demo-order-1042', vendor: { name: 'Ada’s Kitchen' } } },
        { id: 'demo-wallet-2', amountMinor: 520000, status: 'PENDING', provider: 'LOCAL_DEMO', isDemo: true, createdAt: new Date(Date.now() - 86_400_000).toISOString(), order: { id: 'demo-order-1038', vendor: { name: 'Green Bowl' } } },
        { id: 'demo-wallet-3', amountMinor: 180000, status: 'FAILED', provider: 'LOCAL_DEMO', isDemo: true, createdAt: new Date(Date.now() - 172_800_000).toISOString(), order: { id: 'demo-order-1027', vendor: { name: 'Suya Corner' } } },
      ]);
      setBalanceMinor(2_345_000);
      setLoading(false);
      setError('');
      return;
    }
    if (!token) {
      setTransactions([]);
      setBalanceMinor(2_345_000);
      setBalanceFromApi(false);
      setBalanceAvailable(true);
      setLoading(false);
      setError('');
      return;
    }

    let active = true;
    setBalanceMinor(2_345_000);
    setBalanceFromApi(false);
    setBalanceAvailable(true);
    setLoading(true);
    setError('');
    api.get<WalletSummary>('/wallet',token)
      .then(wallet=>{if(active){setBalanceMinor(wallet.balanceMinor);setBalanceAvailable(true);setBalanceFromApi(true);}})
      .catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Could not load wallet balance.');});
    api.get<Transaction[]>('/wallet/transactions', token)
      .then(rows => { if (active) setTransactions(rows); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load transactions.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demoMode, token]);

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
    if(token)void api.get<WalletSummary>('/wallet',token).then(wallet=>{setBalanceMinor(wallet.balanceMinor);setBalanceAvailable(true);setBalanceFromApi(true);}).catch(()=>undefined);
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

  return <View style={s.screen}><ScreenHeader title="Wallet" subtitle="Balance, payments, and activity" icon="card-outline" colors={colors}/><ScrollView style={{flex:1}} contentContainerStyle={s.content}>
    <Text style={s.kicker}>PAYMENTS & BALANCE</Text>

    <View style={s.balanceCard}>
      <View style={s.balanceTop}>
        <View style={s.walletMark}><Ionicons name="card-outline" size={23} color="#d8e5df"/></View>
        <Text style={s.balanceCaption}>WALLET BALANCE</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={balanceVisible ? 'Hide wallet balance' : 'Show wallet balance'} onPress={() => setBalanceVisible(value => !value)} style={s.eyeButton}>
          <Ionicons name={balanceVisible ? 'eye-outline' : 'eye-off-outline'} size={24} color="white"/>
        </Pressable>
      </View>
      <Text style={s.balance}>{balanceVisible ? balanceAvailable ? `₦${(balanceMinor / 100).toLocaleString('en-NG')}` : 'Unavailable' : '••••••••'}</Text>
      <Text style={s.balanceNote}>{demoMode?'Demo wallet balance':balanceFromApi?'Wallet balance · NGN':token?error||'Loading your balance':'Sign in to view your balance'}</Text>
      <Pressable accessibilityRole="button" disabled={topUpBusy} onPress={startTopUp} style={[s.topUpButton,topUpBusy&&{opacity:.65}]}>
        <Ionicons name="add" size={24} color="#1d6147"/>
        <Text style={s.topUpText}>{topUpBusy?'Opening Paystack...':demoMode ? 'Simulate +₦5,000' : 'Top up +₦5,000'}</Text>
      </Pressable>
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
      }} style={s.refreshButton}><Ionicons name="refresh-outline" size={22} color={colors.green}/></Pressable>}
    </View>

    <View style={s.filters}>{filters.map(item => {
      const selected = filter === item.id;
      return <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setFilter(item.id)} style={[s.filter, selected && s.filterSelected]}>
        <Text style={[s.filterText, selected && s.filterTextSelected]}>{item.label}</Text>
      </Pressable>;
    })}</View>

    {!token&&!demoMode ? <View style={s.empty}>
      <View style={s.emptyIcon}><Ionicons name="person-outline" size={25} color={colors.green}/></View>
      <Text style={s.emptyTitle}>Sign in to see your transactions</Text>
      <Text style={s.emptyCopy}>Your payment history is private to your account.</Text>
      <Pressable accessibilityRole="button" onPress={onSignIn} style={s.signInButton}><Text style={s.signInText}>Sign in</Text></Pressable>
    </View> : loading ? <ActivityIndicator style={s.loader} color={colors.green}/> : error ? <View style={s.empty}>
      <Text style={s.emptyTitle}>Transactions unavailable</Text>
      <Text style={s.emptyCopy}>{error}</Text>
    </View> : visibleTransactions.length === 0 ? <View style={s.empty}>
      <View style={s.emptyIcon}><Ionicons name="receipt-outline" size={25} color={colors.green}/></View>
      <Text style={s.emptyTitle}>{transactions.length ? `No ${filter === 'ALL' ? '' : filter.toLowerCase() + ' '}transactions` : 'No transactions yet'}</Text>
      <Text style={s.emptyCopy}>{transactions.length ? 'Try another filter to see more activity.' : 'Your order payments will appear here when available.'}</Text>
    </View> : visibleTransactions.map(transaction => <TransactionRow key={transaction.id} transaction={transaction} colors={colors}/>)}

    <Text style={s.disclaimer}>{demoMode ? 'LOCAL PREVIEW: sample wallet records and simulated top-ups never represent real charges.' : 'Demo payment records are clearly marked and never represent real charges.'}</Text>
  </ScrollView>{checkout&&<PaystackCheckoutModal visible authorizationUrl={checkout.authorizationUrl} reference={checkout.reference} colors={colors} onClose={closeCheckout} onPaymentReturn={verifyTopUp}/>}</View>;
}

function TransactionRow({ transaction, colors }: { transaction: Transaction; colors: AppColors }) {
  const s = styles(colors);
  const status = transaction.status.toUpperCase();
  const successful = status === 'SUCCEEDED' || status === 'SUCCESS';
  const pending = status === 'PENDING';
  const icon = successful ? 'checkmark' : pending ? 'time-outline' : 'close';
  const color = successful ? '#28865b' : pending ? '#b17a25' : '#b84b42';
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

const styles = (c: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.paper },
  content: { paddingHorizontal: 19, paddingTop: 25, paddingBottom: 32 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: c.green },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1, color: c.ink, marginTop: 7, marginBottom: 18 },
  balanceCard: { padding: 18, borderRadius: 22, backgroundColor: c.green, overflow: 'hidden' },
  balanceTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  walletMark: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.14)' },
  balanceCaption: { flex: 1, fontSize: 11, fontWeight: '900', letterSpacing: 1, color: '#e5efdc' },
  eyeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  balance: { fontSize: 34, fontWeight: '900', letterSpacing: -.5, color: 'white', marginTop: 15 },
  balanceNote: { fontSize: 12, lineHeight: 18, color: '#e5efdc', marginTop: 4 },
  topUpButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#d8e5df', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, marginTop: 16 },
  topUpText: { fontSize: 12, fontWeight: '900', color: '#1d6147' },
  notice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 12, marginTop: 12, borderRadius: 12, backgroundColor: c.cream },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18, color: c.green },
  historyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25 },
  historyTitle: { fontSize: 19, fontWeight: '900', color: c.ink },
  historySubtitle: { fontSize: 12, color: c.muted, marginTop: 3 },
  refreshButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.cream },
  filters: { flexDirection: 'row', gap: 8, marginTop: 15, marginBottom: 5 },
  filter: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, backgroundColor: c.cream },
  filterSelected: { backgroundColor: c.green },
  filterText: { fontSize: 11, fontWeight: '800', color: c.muted },
  filterTextSelected: { color: 'white' },
  loader: { margin: 30 },
  empty: { alignItems: 'center', padding: 20, marginTop: 14, borderRadius: 17, backgroundColor: c.card },
  emptyIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cream },
  emptyTitle: { fontSize: 15, fontWeight: '900', color: c.ink, marginTop: 10, textAlign: 'center' },
  emptyCopy: { fontSize: 12, lineHeight: 18, color: c.muted, marginTop: 4, textAlign: 'center' },
  signInButton: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 11, backgroundColor: c.green, marginTop: 12 },
  signInText: { fontSize: 12, fontWeight: '900', color: 'white' },
  transaction: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginTop: 9, borderRadius: 15, backgroundColor: c.card },
  transactionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  transactionInfo: { flex: 1 },
  vendor: { fontSize: 13, fontWeight: '800', color: c.ink },
  transactionMeta: { fontSize: 11, color: c.muted, marginTop: 3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  status: { fontSize: 10, fontWeight: '900' },
  demo: { fontSize: 9, fontWeight: '900', letterSpacing: .5, color: '#97751b' },
  amount: { fontSize: 13, fontWeight: '900', color: c.ink },
  disclaimer: { fontSize: 11, lineHeight: 17, color: c.muted, marginTop: 16 },
});
