import { AppText as Text } from '@makanza/mobile-ui';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { BackHeader } from '../components/ui';
import { api } from '../services/api';
import type { AppColors } from '../theme/colors';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';

type Transaction={id:string;amountMinor:number;status:string;provider:string;isDemo:boolean;createdAt:string;order:{id:string;vendor:{name:string}}};

export default function WalletActivityScreen({token,colors:c,onBack}:{token:string;colors:AppColors;onBack:()=>void}){
  const [rows,setRows]=useState<Transaction[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const p=customerPalette(c);
  const s=styles(p);
  const load=useCallback(async()=>{
    setLoading(true);
    setError('');
    try{setRows(await api.get<Transaction[]>('/wallet/transactions',token));}
    catch(reason){setError(reason instanceof Error?reason.message:'Could not load payment activity.');}
    finally{setLoading(false);}
  },[token]);
  useEffect(()=>{void load();},[load]);
  return <View style={s.screen}>
    <BackHeader title="Payment activity" subtitle="Charges and refunds on your orders" colors={c} onBack={onBack}/>
    <ScrollView contentContainerStyle={s.page}>
      <View style={s.heading}><View><Text style={s.eyebrow}>WALLET RECORDS</Text><Text style={s.title}>Transactions</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Refresh payment activity" onPress={()=>void load()} style={s.refresh}><Ionicons name="refresh-outline" size={19} color={p.primary}/></Pressable></View>
      {loading?<ActivityIndicator color={p.primary} style={s.loader}/>
      :error?<View style={s.state}><View style={[s.stateIcon,{backgroundColor:p.accentSoft}]}><Ionicons name="alert-circle-outline" size={22} color={p.danger}/></View><Text style={s.emptyTitle}>Activity unavailable</Text><Text style={s.body}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>void load()} style={s.retry}><Text style={s.retryText}>Try again</Text></Pressable></View>
      :rows.length===0?<View style={s.state}><View style={s.stateIcon}><Ionicons name="receipt-outline" size={22} color={p.primary}/></View><Text style={s.emptyTitle}>No activity yet</Text><Text style={s.body}>Order charges and refunds will appear here when available.</Text></View>
      :rows.map(row=>{
        const status=row.status.toUpperCase();
        const successful=['SUCCEEDED','SUCCESS'].includes(status);
        const pending=status==='PENDING';
        const statusColor=successful?p.primary:pending?p.warning:p.danger;
        return <View key={row.id} style={s.card}>
          <View style={s.cardTop}><View style={[s.transactionIcon,{backgroundColor:successful?p.primarySoft:pending?p.accentSoft:p.accentSoft}]}><Ionicons name={successful?'checkmark':pending?'time-outline':'close'} size={18} color={statusColor}/></View><View style={s.copy}><Text numberOfLines={1} style={s.vendor}>{row.order.vendor.name}</Text><Text style={s.meta}>Order {row.order.id.slice(-8)} · {new Date(row.createdAt).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</Text></View><Text style={s.amount}>₦{(row.amountMinor/100).toLocaleString('en-NG')}</Text></View>
          <View style={s.cardBottom}><Text style={[s.status,{color:statusColor}]}>{status.replaceAll('_',' ')}</Text>{row.isDemo&&<Text style={s.demo}>DEMO · NO REAL CHARGE</Text>}</View>
        </View>;
      })}
    </ScrollView>
  </View>;
}

const styles=(c:ReturnType<typeof customerPalette>)=>StyleSheet.create({
  screen:{flex:1,backgroundColor:c.canvas},
  page:{paddingHorizontal:customerSpace.lg,paddingTop:customerSpace.md,paddingBottom:customerSpace.xxl},
  heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:customerSpace.sm},
  eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.1,color:c.primary},
  title:{fontSize:23,fontWeight:'900',letterSpacing:-.6,color:c.ink,marginTop:4},
  refresh:{width:42,height:42,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm,backgroundColor:c.surfaceAlt},
  loader:{margin:28},
  card:{padding:12,marginTop:8,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.md,backgroundColor:c.surface},
  cardTop:{flexDirection:'row',alignItems:'center',gap:10},
  transactionIcon:{width:36,height:36,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm},
  copy:{flex:1,minWidth:0},
  vendor:{fontSize:12,fontWeight:'800',color:c.ink},
  meta:{fontSize:9,lineHeight:14,color:c.muted,marginTop:3},
  amount:{fontSize:12,fontWeight:'900',color:c.ink},
  cardBottom:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:10,paddingTop:9,borderTopWidth:1,borderTopColor:c.border},
  status:{fontSize:9,fontWeight:'900'},
  demo:{fontSize:8,fontWeight:'900',letterSpacing:.5,color:c.warning},
  state:{alignItems:'center',padding:22,marginTop:customerSpace.xl,borderRadius:customerRadius.lg,backgroundColor:c.surface},
  stateIcon:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.md,backgroundColor:c.primarySoft},
  emptyTitle:{fontSize:14,fontWeight:'900',color:c.ink,marginTop:10},
  body:{fontSize:11,lineHeight:17,color:c.muted,textAlign:'center',marginTop:5},
  retry:{minHeight:40,justifyContent:'center',paddingHorizontal:16,borderRadius:customerRadius.sm,backgroundColor:c.primary,marginTop:12},
  retryText:{fontSize:11,fontWeight:'900',color:'white'},
});
