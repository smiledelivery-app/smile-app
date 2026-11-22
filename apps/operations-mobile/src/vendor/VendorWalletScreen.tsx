import { AppText as Text } from '@makanza/mobile-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import type { AppColors } from '../theme/colors';
import { api } from '../services/api';
import { formatMoney } from '../utils/format';
import { vendorRadius, vendorSpace, vendorType } from '../theme/vendor';

type Bank={name:string;code:string};
type WalletTransaction={id:string;type:string;direction:string;status:string;amountMinor:number;balanceAfter:number;reference:string;orderId:string|null;createdAt:string};
type VendorWallet={vendorStatus:string;balanceMinor:number;currency:string;status:string;dva:{accountNumber:string|null;accountName:string|null;bankName:string|null;status:string};payoutAccount:{accountLast4:string|null;accountName:string|null;bankName:string|null;bankCode:string|null;status:string};transactions:WalletTransaction[]};
type HistoryFilter='ALL'|'PENDING'|'SUCCESS'|'FAILED';
const historyFilters:HistoryFilter[]=['ALL','PENDING','SUCCESS','FAILED'];

export default function VendorWalletScreen({token,colors:c}:{token:string;colors:AppColors}){
  const s=styles(c);const [wallet,setWallet]=useState<VendorWallet|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [visible,setVisible]=useState(true);const [dvaRetryBusy,setDvaRetryBusy]=useState(false);const [dvaRetryError,setDvaRetryError]=useState('');
  const [banks,setBanks]=useState<Bank[]>([]);const [payoutModal,setPayoutModal]=useState(false);const [bankModal,setBankModal]=useState(false);const [bankLoading,setBankLoading]=useState(false);const [bank,setBank]=useState<Bank|null>(null);const [accountNumber,setAccountNumber]=useState('');const [accountBusy,setAccountBusy]=useState(false);const [withdrawModal,setWithdrawModal]=useState(false);const [withdrawAmount,setWithdrawAmount]=useState('');const [withdrawBusy,setWithdrawBusy]=useState(false);
  const [historyFilter,setHistoryFilter]=useState<HistoryFilter>('ALL');

  const load=useCallback(async(quiet=false)=>{if(!quiet)setLoading(true);setError('');try{setWallet(await api.get<VendorWallet>('/vendor/wallet',token));}catch(e){setError(e instanceof Error?e.message:'Could not load your vendor wallet.');}finally{if(!quiet)setLoading(false);}},[token]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{if(wallet?.dva.status!=='PENDING')return;const timer=setInterval(()=>void load(true),8000);return()=>clearInterval(timer);},[wallet?.dva.status,load]);
  useEffect(()=>{if(wallet?.payoutAccount.bankCode&&wallet.payoutAccount.bankName)setBank({code:wallet.payoutAccount.bankCode,name:wallet.payoutAccount.bankName});},[wallet?.payoutAccount.bankCode,wallet?.payoutAccount.bankName]);

  const openBanks=async()=>{setBankModal(true);if(banks.length)return;setBankLoading(true);try{setBanks(await api.get<Bank[]>('/vendor/wallet/banks',token));}catch(e){setError(e instanceof Error?e.message:'Could not load supported banks.');setBankModal(false);}finally{setBankLoading(false);}};
  const savePayoutAccount=async()=>{if(!bank||!/^\d{10}$/.test(accountNumber)){setError('Choose a bank and enter its 10 digit NUBAN account number.');return;}setAccountBusy(true);setError('');setNotice('');try{const saved=await api.put<{accountLast4:string;accountName:string;bankName:string;bankCode:string;status:string}>('/vendor/wallet/payout-account',{accountNumber,bankCode:bank.code},token);setNotice('Verified account: '+saved.accountName+' - '+saved.bankName+'.');setAccountNumber('');setPayoutModal(false);setBankModal(false);await load(true);}catch(e){setError(e instanceof Error?e.message:'Could not verify this bank account.');}finally{setAccountBusy(false);}};
  const withdraw=async()=>{const amountMinor=Math.round(Number(withdrawAmount)*100);if(!Number.isSafeInteger(amountMinor)||amountMinor<10000){setError('Enter a valid withdrawal amount of at least NGN 100.');return;}if(!wallet||amountMinor>wallet.balanceMinor){setError('The withdrawal amount is greater than your available balance.');return;}setWithdrawBusy(true);setError('');setNotice('');try{const result=await api.post<{status:string;reference:string;balanceMinor:number}>('/vendor/wallet/withdraw',{amountMinor,idempotencyKey:makeUuid()},token);setNotice(result.status==='SUCCEEDED'?'Your withdrawal was sent.':'Your withdrawal is processing. Reference '+result.reference.slice(-8)+'.');setWithdrawAmount('');setWithdrawModal(false);await load(true);}catch(e){setError(e instanceof Error?e.message:'Could not start this withdrawal.');await load(true);}finally{setWithdrawBusy(false);}};
  const retryDva=async()=>{setDvaRetryBusy(true);setDvaRetryError('');try{await api.post('/wallet/dva/retry',{},token);await load(true);}catch(e){setDvaRetryError(e instanceof Error?e.message:'Could not retry dedicated account setup.');}finally{setDvaRetryBusy(false);}};

  const accountReady=wallet?.payoutAccount.status==='VERIFIED';const canWithdraw=wallet?.vendorStatus==='APPROVED';
  const history=useMemo(()=>{
    const rows=wallet?.transactions??[];
    if(historyFilter==='ALL')return rows;
    if(historyFilter==='SUCCESS')return rows.filter(row=>['SUCCEEDED','SUCCESS','COMPLETED'].includes(row.status.toUpperCase()));
    if(historyFilter==='PENDING')return rows.filter(row=>['PENDING','PROCESSING','REFUND_PENDING'].includes(row.status.toUpperCase()));
    return rows.filter(row=>['FAILED','REVERSED','CANCELLED','DECLINED'].includes(row.status.toUpperCase()));
  },[wallet?.transactions,historyFilter]);
  return <View style={s.screen}><View style={s.fixedHeader}><View style={s.headingRow}><View><Text style={s.kicker}>STORE FINANCES</Text><Text style={s.title}>Wallet</Text><Text style={s.subtitle}>Your earnings, deposits, and payouts.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Refresh wallet" onPress={()=>void load()} style={s.refresh}><Ionicons name="refresh-outline" size={21} color={c.green}/></Pressable></View></View><ScrollView contentContainerStyle={s.page}>
    {error?<View accessibilityRole="alert" style={s.errorBox}><Text style={s.error}>{error}</Text></View>:null}
    {notice?<View style={s.notice}><Text style={s.noticeText}>{notice}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={()=>setNotice('')}><Ionicons name="close" size={19} color={c.green}/></Pressable></View>:null}
    {loading&&!wallet?<ActivityIndicator style={{margin:28}} color={c.green}/>:wallet&&<>
      <View style={s.balanceCard}>
        <View pointerEvents="none" style={s.balanceOrb}/>
        <View style={s.balanceTop}>
          <View style={s.walletMark}><Ionicons name="wallet-outline" size={22} color="#e5efdc"/></View>
          <View style={s.balanceHeading}><Text style={s.balanceCaption}>AVAILABLE BALANCE</Text><Text style={s.balanceCurrency}>SMILE BUSINESS · NGN</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={visible?'Hide balance':'Show balance'} onPress={()=>setVisible(v=>!v)} style={s.balanceEye}><Ionicons name={visible?'eye-outline':'eye-off-outline'} size={20} color="white"/></Pressable>
        </View>
        <Text style={s.balance}>{visible?formatMoney(wallet.balanceMinor):'••••••••'}</Text>
        <Text style={s.balanceNote}>Earnings settle after completed deliveries</Text>
        <View style={s.balanceFoot}><View style={s.balanceStatus}><View style={s.balanceStatusDot}/><Text style={s.balanceStatusText}>Wallet active</Text></View><View style={s.balanceSecure}><Ionicons name="shield-checkmark-outline" size={14} color="#d9e5df"/><Text style={s.balanceSecureText}>Secured</Text></View></View>
      </View>

      <View style={s.quickActions}>
        <Pressable accessibilityRole="button" onPress={()=>setWithdrawModal(true)} disabled={!canWithdraw||!accountReady||(wallet.balanceMinor<10000)} style={[s.quickAction,s.quickActionPrimary,(!canWithdraw||!accountReady||(wallet.balanceMinor<10000))&&s.quickActionDisabled]}>
          <View style={s.quickActionIconPrimary}><Ionicons name="arrow-up-outline" size={20} color="white"/></View>
          <Text style={s.quickActionPrimaryText}>Withdraw</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={()=>{setError('');setBankModal(false);setPayoutModal(true);}} style={s.quickAction}>
          <View style={s.quickActionIcon}><Ionicons name="card-outline" size={20} color={c.green}/></View>
          <Text style={s.quickActionText}>{accountReady?'Bank account':'Add account'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={()=>void load()} style={s.quickAction}>
          <View style={s.quickActionIcon}><Ionicons name="refresh-outline" size={20} color={c.green}/></View>
          <Text style={s.quickActionText}>Refresh</Text>
        </Pressable>
      </View>

      <View style={s.card}><View style={s.sectionTop}><View style={s.sectionIcon}><Ionicons name="business-outline" size={20} color={c.green}/></View><View style={s.flex}><Text style={s.sectionTitle}>Paystack deposit account</Text><Text style={s.copy}>Automatic dedicated account for your wallet.</Text></View><View style={[s.statusPill,wallet.dva.status==='ACTIVE'&&wallet.dva.accountNumber?s.statusGood:s.statusWait]}><Text style={s.statusText}>{wallet.dva.status==='ACTIVE'&&wallet.dva.accountNumber?'Ready':wallet.dva.status==='FAILED'?'Setup failed':'Setting up'}</Text></View></View>{wallet.dva.accountNumber?<View style={s.accountNumber}><Text style={s.accountLabel}>{wallet.dva.bankName??'Dedicated account'}</Text><Text selectable style={s.number}>{wallet.dva.accountNumber}</Text><Text selectable style={s.copy}>{wallet.dva.accountName??'Smile vendor wallet'}</Text></View>:<Text style={s.copyStrong}>{wallet.dva.status==='FAILED'?'Your dedicated account could not be created. Check your profile has a valid email and phone number, then retry.':'Paystack is setting up your dedicated account. This screen updates automatically.'}</Text>}{wallet.dva.status==='FAILED'&&<PrimaryButton title={dvaRetryBusy?'Retrying…':'Retry account setup'} secondary disabled={dvaRetryBusy} onPress={()=>void retryDva()} style={s.button} />}{dvaRetryError?<Text style={s.error}>{dvaRetryError}</Text>:null}</View>

      <View style={s.historyHeading}><View><Text style={s.sectionTitle}>Account history</Text><Text style={s.copy}>Earnings and withdrawals</Text></View><Text style={s.historyCount}>{history.length} {history.length===1?'record':'records'}</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.historyFilterScroller} contentContainerStyle={s.historyFilters}>
        {historyFilters.map(filter=>{
          const selected=historyFilter===filter;
          return <Pressable key={filter} accessibilityRole="button" accessibilityState={{selected}} onPress={()=>setHistoryFilter(filter)} style={[s.historyFilter,selected&&s.historyFilterSelected]}><Text style={[s.historyFilterText,selected&&s.historyFilterTextSelected]}>{filter==='SUCCESS'?'Success':filter.charAt(0)+filter.slice(1).toLowerCase()}</Text></Pressable>;
        })}
      </ScrollView>
      {history.length?history.map(row=><TransactionRow key={row.id} row={row} colors={c}/>):<View style={s.empty}><View style={[s.emptyIcon,{width:56,height:56,borderRadius:0}]}><Ionicons name="receipt-outline" size={27} color={c.green}/></View><Text style={s.emptyTitle}>No {historyFilter==='ALL'?'wallet':historyFilter.toLowerCase()} activity</Text><Text style={[s.copy,{textAlign:'center',marginTop:4}]}>Transactions matching this filter will appear here.</Text></View>}
    </>}
  </ScrollView>
  <Modal visible={payoutModal} transparent animationType="slide" onRequestClose={()=>{setPayoutModal(false);setBankModal(false);}}><View style={s.modalBackdrop}><View style={s.modal}><View style={s.modalHead}><View><Text style={s.modalTitle}>{bankModal?'Choose a bank':accountReady?'Update withdrawal account':'Set up withdrawal account'}</Text><Text style={s.copy}>{bankModal?'Nigerian banks supported by Paystack':'Verify a Nigerian bank account for payouts.'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={bankModal?'Back to withdrawal account':'Close withdrawal account setup'} onPress={()=>bankModal?setBankModal(false):setPayoutModal(false)}><Ionicons name={bankModal?'chevron-back':'close'} size={24} color={c.ink}/></Pressable></View>{bankModal?(bankLoading?<ActivityIndicator style={{margin:28}} color={c.green}/>:banks.length?<ScrollView style={{maxHeight:390}}>{banks.map(item=><Pressable key={item.code} accessibilityRole="button" onPress={()=>{setBank(item);setBankModal(false);}} style={s.bankOption}><Text style={s.bankName}>{item.name}</Text>{bank?.code===item.code&&<Ionicons name="checkmark-circle" size={20} color={c.green}/>}</Pressable>)}</ScrollView>:<View style={s.empty}><View style={[s.emptyIcon,{width:56,height:56,borderRadius:0}]}><Ionicons name="business-outline" size={27} color={c.green}/></View><Text style={s.emptyTitle}>No banks to show</Text><Text style={[s.copy,{textAlign:'center'}]}>Refresh and try loading the supported banks again.</Text></View>):<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:8}}><Pressable accessibilityRole="button" onPress={()=>void openBanks()} style={s.selectBank}><Text style={bank?s.selectBankValue:s.selectBankPlaceholder}>{bank?.name??wallet?.payoutAccount.bankName??'Choose your bank'}</Text><Ionicons name="chevron-down" size={19} color={c.green}/></Pressable><FormField label="10 digit account number" value={accountNumber} onChangeText={value=>setAccountNumber(value.replace(/\D/g,'').slice(0,10))} placeholder={accountReady?'Enter the new account number':'Enter NUBAN'} keyboardType="number-pad" maxLength={10} dark={c.isDark}/>{error?<Text style={s.error}>{error}</Text>:null}<PrimaryButton title={accountBusy?'Verifying account...':accountReady?'Verify & update bank':'Verify & save bank'} onPress={()=>void savePayoutAccount()} disabled={accountBusy||bankLoading} style={s.button}/></ScrollView>}</View></View></Modal>
  <Modal visible={withdrawModal} transparent animationType="slide" onRequestClose={()=>setWithdrawModal(false)}><View style={s.modalBackdrop}><View style={s.modal}><View style={s.modalHead}><View><Text style={s.modalTitle}>Withdraw funds</Text><Text style={s.copy}>Available balance: {formatMoney(wallet?.balanceMinor??0)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close withdrawal" onPress={()=>setWithdrawModal(false)}><Ionicons name="close" size={24} color={c.ink}/></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:8}}>{wallet?.payoutAccount.status==='VERIFIED'&&<Text style={s.copyStrong}>{wallet.payoutAccount.bankName} - account ending {wallet.payoutAccount.accountLast4}</Text>}<FormField label="Amount" value={withdrawAmount} onChangeText={setWithdrawAmount} placeholder="e.g. 5000" keyboardType="decimal-pad" dark={c.isDark}/>{!canWithdraw?<Text style={s.hint}>Withdrawals unlock after your store is approved.</Text>:!accountReady&&<Text style={s.hint}>Set up and verify your withdrawal account first.</Text>}{error?<Text style={s.error}>{error}</Text>:null}<PrimaryButton title={withdrawBusy?'Requesting payout...':'Withdraw to bank'} onPress={()=>void withdraw()} disabled={!canWithdraw||!accountReady||withdrawBusy||(wallet?.balanceMinor??0)<10000} style={s.button}/></ScrollView></View></View></Modal>
  </View>;
}

function TransactionRow({row,colors:c}:{row:WalletTransaction;colors:AppColors}){
  const s=styles(c);
  const earning=row.direction==='CREDIT';
  const status=row.status.toUpperCase();
  const statusColor=['SUCCEEDED','SUCCESS','COMPLETED'].includes(status)?c.green:['PENDING','PROCESSING'].includes(status)?'#9a6a18':c.isDark?'#f0877a':'#a34232';
  const statusBackground=['SUCCEEDED','SUCCESS','COMPLETED'].includes(status)?c.mint:['PENDING','PROCESSING'].includes(status)?c.cream:c.isDark?'#392a20':'#fdf0ed';
  const title=row.type==='ORDER_EARNING'?'Order earning':row.type==='WITHDRAWAL'?'Bank withdrawal':row.type==='WITHDRAWAL_REVERSAL'?'Withdrawal returned':row.type.replaceAll('_',' ').toLowerCase();
  return <View style={s.transaction}>
    <View style={[s.txIcon,earning?s.txIn:s.txOut]}><Ionicons name={earning?'arrow-down-left':'arrow-up-right'} size={19} color={earning?c.green:c.isDark?'#f0877a':'#a34232'}/></View>
    <View style={s.txCopy}>
      <Text style={s.txTitle}>{title}</Text>
      <Text style={s.copy}>{row.orderId?`Order ${row.orderId.slice(-8)}`:new Date(row.createdAt).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</Text>
      <View style={[s.txStatusBadge,{backgroundColor:statusBackground}]}><View style={[s.txStatusDot,{backgroundColor:statusColor}]}/><Text style={[s.txStatus,{color:statusColor}]}>{status.replaceAll('_',' ').toLowerCase()}</Text></View>
    </View>
    <Text style={[s.txAmount,!earning&&s.txDebit]}>{earning?'+':'−'}{formatMoney(row.amountMinor)}</Text>
  </View>;
}

function makeUuid(){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,letter=>{const value=Math.floor(Math.random()*16);return(letter==='x'?value:(value&3)|8).toString(16);});}

const styles=(c:AppColors)=>StyleSheet.create({
  screen:{flex:1,backgroundColor:c.paper},
  fixedHeader:{paddingHorizontal:vendorSpace.lg,paddingTop:vendorSpace.md,backgroundColor:c.paper},
  page:{paddingHorizontal:vendorSpace.lg,paddingTop:vendorSpace.sm,paddingBottom:vendorSpace.xxl},
  headingRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:vendorSpace.md},
  kicker:{fontSize:vendorType.label,fontWeight:'900',letterSpacing:1.1,color:c.green},
  title:{fontSize:vendorType.display,fontWeight:'900',letterSpacing:-.6,color:c.ink,marginTop:4},
  subtitle:{fontSize:12,color:c.muted,marginTop:3},
  refresh:{width:42,height:42,borderRadius:vendorRadius.md,backgroundColor:c.cream,alignItems:'center',justifyContent:'center'},
  balanceCard:{position:'relative',overflow:'hidden',padding:vendorSpace.lg,borderRadius:vendorRadius.xl,backgroundColor:c.isDark?'#194c3a':c.green,marginBottom:vendorSpace.sm},
  balanceOrb:{position:'absolute',top:-105,right:-45,width:220,height:220,borderRadius:110,backgroundColor:'rgba(255,255,255,.07)'},
  balanceTop:{flexDirection:'row',alignItems:'center',gap:9},
  walletMark:{width:40,height:40,borderRadius:vendorRadius.md,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.14)'},
  balanceHeading:{flex:1},
  balanceCaption:{fontSize:9,fontWeight:'900',letterSpacing:1,color:'#e5efdc'},
  balanceCurrency:{fontSize:8,fontWeight:'800',letterSpacing:.5,color:'#cddbd1',marginTop:3},
  balanceEye:{width:38,height:38,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.pill,backgroundColor:'rgba(255,255,255,.12)'},
  balance:{fontSize:34,fontWeight:'900',letterSpacing:-.5,color:'white',marginTop:vendorSpace.md},
  balanceNote:{fontSize:10,color:'#d8e5df',marginTop:3},
  balanceFoot:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,paddingTop:vendorSpace.sm,marginTop:vendorSpace.md,borderTopWidth:1,borderTopColor:'rgba(255,255,255,.16)'},
  balanceStatus:{flexDirection:'row',alignItems:'center',gap:6},
  balanceStatusDot:{width:6,height:6,borderRadius:3,backgroundColor:'#b9e6c6'},
  balanceStatusText:{fontSize:9,fontWeight:'900',color:'#edf4e9'},
  balanceSecure:{flexDirection:'row',alignItems:'center',gap:4},
  balanceSecureText:{fontSize:9,fontWeight:'800',color:'#d9e5df'},
  quickActions:{flexDirection:'row',gap:8,marginTop:8,marginBottom:4},
  quickAction:{flex:1,minHeight:76,alignItems:'center',justifyContent:'center',gap:7,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.card},
  quickActionPrimary:{borderColor:c.green,backgroundColor:c.green},
  quickActionDisabled:{opacity:.5},
  quickActionIconPrimary:{width:34,height:34,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.pill,backgroundColor:'rgba(255,255,255,.14)',borderWidth:1,borderColor:'rgba(255,255,255,.12)'},
  quickActionIcon:{width:34,height:34,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.pill,backgroundColor:c.mint},
  quickActionPrimaryText:{fontSize:10,fontWeight:'900',color:'white'},
  quickActionText:{fontSize:10,fontWeight:'900',color:c.ink},
  card:{padding:vendorSpace.md,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.card,marginTop:vendorSpace.sm},
  sectionTop:{flexDirection:'row',alignItems:'center',gap:10},
  sectionIcon:{width:40,height:40,borderRadius:vendorRadius.md,alignItems:'center',justifyContent:'center',backgroundColor:c.cream},
  cardAction:{width:42,height:42,borderRadius:vendorRadius.md,alignItems:'center',justifyContent:'center',backgroundColor:c.cream,borderWidth:1,borderColor:c.line},
  flex:{flex:1},
  sectionTitle:{fontSize:14,fontWeight:'900',color:c.ink},
  copy:{fontSize:11,lineHeight:17,color:c.muted,marginTop:3},
  copyStrong:{fontSize:12,lineHeight:18,color:c.ink,marginTop:13},
  statusPill:{paddingHorizontal:9,paddingVertical:6,borderRadius:vendorRadius.pill},
  statusGood:{backgroundColor:c.mint},
  statusWait:{backgroundColor:c.cream},
  statusText:{fontSize:9,fontWeight:'900',color:c.green},
  accountNumber:{marginTop:vendorSpace.md,padding:vendorSpace.md,borderRadius:vendorRadius.md,backgroundColor:c.cream},
  accountLabel:{fontSize:9,fontWeight:'900',letterSpacing:1,color:c.muted},
  number:{fontSize:22,fontWeight:'900',letterSpacing:1.3,color:c.ink,marginTop:5},
  button:{minHeight:48,marginTop:vendorSpace.md,borderRadius:vendorRadius.sm},
  verifiedName:{fontSize:12,fontWeight:'800',color:c.ink,marginTop:vendorSpace.sm},
  selectBank:{minHeight:50,paddingHorizontal:13,borderWidth:1,borderColor:c.isDark?c.line:'#cbd8cf',borderRadius:vendorRadius.sm,backgroundColor:c.card,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:14},
  selectBankValue:{fontSize:13,fontWeight:'700',color:c.ink},
  selectBankPlaceholder:{fontSize:13,color:c.muted},
  hint:{fontSize:10,lineHeight:16,color:c.muted,marginTop:8},
  historyHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:vendorSpace.xl,marginBottom:5},
  historyCount:{fontSize:10,fontWeight:'800',color:c.muted},
  historyFilterScroller:{flexGrow:0,marginTop:8,marginBottom:2},
  historyFilters:{flexDirection:'row',gap:7,paddingRight:8},
  historyFilter:{minHeight:36,justifyContent:'center',paddingHorizontal:14,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.pill,backgroundColor:c.card},
  historyFilterSelected:{borderColor:c.green,backgroundColor:c.green},
  historyFilterText:{fontSize:10,fontWeight:'800',color:c.muted},
  historyFilterTextSelected:{color:'white'},
  empty:{alignItems:'center',padding:vendorSpace.xl,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.card,marginTop:vendorSpace.sm},
  emptyIcon:{width:48,height:48,borderRadius:vendorRadius.md,backgroundColor:c.cream,alignItems:'center',justifyContent:'center'},
  emptyTitle:{fontSize:14,fontWeight:'900',color:c.ink,marginTop:10},
  transaction:{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.md,backgroundColor:c.card,marginTop:8},
  txIcon:{width:39,height:39,borderRadius:vendorRadius.md,alignItems:'center',justifyContent:'center'},
  txIn:{backgroundColor:c.mint},
  txOut:{backgroundColor:c.isDark?'#392a20':'#fdf0ed'},
  txCopy:{flex:1,minWidth:0},
  txTitle:{fontSize:12,fontWeight:'900',color:c.ink},
  txStatusBadge:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:7,paddingVertical:4,marginTop:5,borderRadius:vendorRadius.pill},
  txStatusDot:{width:5,height:5,borderRadius:3},
  txStatus:{fontSize:9,fontWeight:'800'},
  txAmount:{fontSize:12,fontWeight:'900',color:c.green},
  txDebit:{color:c.ink},
  notice:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,padding:12,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.md,backgroundColor:c.mint,marginBottom:10},
  noticeText:{flex:1,fontSize:11,lineHeight:16,color:c.green},
  errorBox:{padding:11,borderWidth:1,borderColor:c.isDark?'#58332d':'#f1d8d2',borderRadius:vendorRadius.md,backgroundColor:c.isDark?'#392a20':'#fdf0ed',marginBottom:10},
  error:{fontSize:11,lineHeight:16,color:c.isDark?'#f0877a':'#a44232'},
  modalBackdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.42)'},
  modal:{maxHeight:'82%',padding:vendorSpace.lg,paddingBottom:vendorSpace.xl,backgroundColor:c.paper,borderTopLeftRadius:vendorRadius.xl,borderTopRightRadius:vendorRadius.xl},
  modalHead:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:12},
  modalTitle:{fontSize:18,fontWeight:'900',color:c.ink},
  bankOption:{minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:c.line,paddingVertical:9},
  bankName:{fontSize:12,fontWeight:'700',color:c.ink},
});
