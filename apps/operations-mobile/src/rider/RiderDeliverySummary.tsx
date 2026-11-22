import { AppText as Text } from '@makanza/mobile-ui';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { RiderDelivery } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';
import { Ionicons } from '../components/AppIcon';
import { vendorRadius, vendorSpace } from '../theme/vendor';

type Period='Today'|'Yesterday'|'This week'|'Last week'|'This month'|'Last month'|'Last 6 months'|'This year'|'Last year';
type HistoryDelivery=RiderDelivery&{createdAt?:string;assignedAt?:string|null;pickedUpAt?:string|null;deliveredAt?:string|null};
const periods:Period[]=['Today','Yesterday','This week','Last week','This month','Last month','Last 6 months','This year','Last year'];
function periodBounds(period:Period,now=new Date()){const start=new Date(now);start.setHours(0,0,0,0);const end=new Date(now);if(period==='Today')return[start,end] as const;if(period==='Yesterday'){start.setDate(start.getDate()-1);end.setTime(start.getTime());end.setDate(end.getDate()+1);end.setMilliseconds(-1);return[start,end] as const;}if(period==='This week'){start.setDate(start.getDate()-(start.getDay()+6)%7);return[start,end] as const;}if(period==='Last week'){start.setDate(start.getDate()-(start.getDay()+6)%7-7);end.setTime(start.getTime());end.setDate(end.getDate()+7);end.setMilliseconds(-1);return[start,end] as const;}if(period==='This month'){start.setDate(1);return[start,end] as const;}if(period==='Last month'){start.setDate(1);start.setMonth(start.getMonth()-1);end.setTime(start.getTime());end.setMonth(end.getMonth()+1);end.setMilliseconds(-1);return[start,end] as const;}if(period==='Last 6 months'){start.setMonth(start.getMonth()-6);return[start,end] as const;}if(period==='This year'){start.setMonth(0,1);return[start,end] as const;}start.setFullYear(start.getFullYear()-1,0,1);end.setTime(start.getTime());end.setFullYear(end.getFullYear()+1);end.setMilliseconds(-1);return[start,end] as const;}
const dateFor=(delivery:HistoryDelivery)=>delivery.deliveredAt??delivery.createdAt??null;
const screenStyles=(c:AppColors)=>({...styles(c),...deliveryStyles(c)});
const deliveryStyles=(c:AppColors)=>StyleSheet.create({
  fixedHeader:{width:'100%',paddingHorizontal:vendorSpace.lg,paddingTop:vendorSpace.md,paddingBottom:vendorSpace.sm},
  content:{width:'100%',paddingHorizontal:vendorSpace.lg,paddingTop:vendorSpace.sm,paddingBottom:vendorSpace.xxl,gap:vendorSpace.md,alignItems:'stretch'},
  header:{width:'100%',flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:vendorSpace.md},
  headerCopy:{flex:1,minWidth:0},
  eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.3},
  title:{fontSize:28,fontWeight:'900',letterSpacing:-.6,marginTop:4},
  subtitle:{fontSize:11,lineHeight:17,marginTop:5},
  back:{width:42,height:42,borderRadius:vendorRadius.md,borderWidth:1,borderColor:c.line,backgroundColor:c.card},
  filterButton:{width:'100%',minHeight:44,alignSelf:'stretch',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,paddingHorizontal:13,borderRadius:vendorRadius.md,borderWidth:1,borderColor:c.line,backgroundColor:c.card},
  filterText:{flex:1,fontSize:11,fontWeight:'800'},
  overview:{width:'100%',alignSelf:'stretch',padding:vendorSpace.lg,borderRadius:vendorRadius.xl,backgroundColor:c.isDark?'#194c3a':c.green},
  card:{width:'100%',alignSelf:'stretch',padding:vendorSpace.md,gap:vendorSpace.sm,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.xl,backgroundColor:c.card},
  cardTop:{width:'100%',flexDirection:'row',alignItems:'center',gap:10},
  cardIcon:{width:42,height:42,borderRadius:vendorRadius.md,backgroundColor:c.mint},
  cardTitle:{flex:1,minWidth:0,fontSize:13,fontWeight:'900'},
  value:{fontSize:28,fontWeight:'900',letterSpacing:-.5,marginTop:4},
  rangeHead:{width:'100%',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,marginTop:2},
  rangeLabel:{fontSize:10,fontWeight:'700'},
  section:{fontSize:9,fontWeight:'900',letterSpacing:1.2,marginTop:vendorSpace.sm,marginBottom:vendorSpace.xs},
  overviewTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  overviewEyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.2,color:'rgba(255,255,255,.72)'},
  overviewIcon:{width:38,height:38,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.md,backgroundColor:'rgba(255,255,255,.13)'},
  overviewMetrics:{flexDirection:'row',alignItems:'center',gap:13,marginTop:vendorSpace.md},
  overviewCount:{fontSize:42,lineHeight:48,fontWeight:'900',letterSpacing:-1.2,color:'white'},
  overviewCopy:{flex:1},
  overviewLabel:{fontSize:14,fontWeight:'900',color:'white'},
  overviewPeriod:{fontSize:10,color:'rgba(255,255,255,.74)',marginTop:4},
  overviewLink:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:vendorSpace.md,marginTop:vendorSpace.md,borderTopWidth:1,borderTopColor:'rgba(255,255,255,.18)'},
  overviewLinkText:{fontSize:11,fontWeight:'900',color:'white'},
  listOverview:{flexDirection:'row',alignItems:'center',gap:11,padding:vendorSpace.md,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.card},
  listOverviewIcon:{width:40,height:40,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.md,backgroundColor:c.mint},
  listOverviewCopy:{flex:1},
  listOverviewTitle:{fontSize:12,fontWeight:'900',color:c.ink},
  listOverviewDetail:{fontSize:10,color:c.muted,marginTop:4},
  untrackedNote:{flexDirection:'row',alignItems:'center',gap:6,paddingTop:7},
  untrackedText:{flex:1,fontSize:10,lineHeight:15,color:c.muted},
  rangeTrack:{height:6,borderRadius:vendorRadius.pill,backgroundColor:c.cream},
  rangeFill:{height:6,borderRadius:vendorRadius.pill,backgroundColor:c.green},
  rangeEnds:{marginTop:1},
  rangeEnd:{fontSize:9,fontWeight:'700'},
  empty:{width:'100%',alignItems:'center',padding:vendorSpace.xl,marginTop:vendorSpace.sm,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.xl,backgroundColor:c.card},
  emptyIcon:{width:48,height:48,borderRadius:vendorRadius.md,backgroundColor:c.mint},
  emptyTitle:{fontSize:15,fontWeight:'900',marginTop:12},
  copy:{fontSize:11,lineHeight:18,marginTop:5},
  retry:{fontSize:12,fontWeight:'900',marginTop:10},
  detailCard:{width:'100%',alignSelf:'stretch',padding:vendorSpace.md,gap:vendorSpace.md,borderRadius:vendorRadius.xl,borderWidth:1,borderColor:c.line,backgroundColor:c.card},
  detailHero:{width:'100%',flexDirection:'row',alignItems:'center',gap:12,padding:vendorSpace.md,borderRadius:vendorRadius.lg,backgroundColor:c.isDark?'#194c3a':c.green},
  detailHeroIcon:{width:43,height:43,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.md,backgroundColor:'rgba(255,255,255,.15)'},
  detailHeroCopy:{flex:1},
  detailHeroTitle:{fontSize:14,fontWeight:'900',color:'white'},
  detailHeroDate:{fontSize:10,color:'rgba(255,255,255,.8)',marginTop:4},
  detailSection:{paddingTop:vendorSpace.sm,gap:6,borderTopWidth:1,borderTopColor:c.line},
  detailLabel:{fontSize:9,fontWeight:'900',letterSpacing:1.1,color:c.muted},
  detailTitle:{fontSize:12,fontWeight:'800',color:c.ink,marginTop:3},
  routeCard:{width:'100%',padding:vendorSpace.md,borderWidth:1,borderColor:c.line,borderRadius:vendorRadius.lg,backgroundColor:c.paper},
  routeRow:{flexDirection:'row',alignItems:'flex-start',gap:10},
  pickupDot:{width:11,height:11,marginTop:4,borderRadius:6,borderWidth:3,borderColor:c.green,backgroundColor:c.card},
  dropoffDot:{width:11,height:11,marginTop:4,borderRadius:3,backgroundColor:c.green},
  routeConnector:{height:18,marginLeft:5,borderLeftWidth:1,borderStyle:'dashed',borderColor:c.line},
  routeCopy:{flex:1},
  detailItem:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,paddingVertical:9,borderBottomWidth:1,borderBottomColor:c.line},
  detailItemName:{flex:1,fontSize:11,fontWeight:'700',color:c.ink},
  detailItemQuantity:{fontSize:11,fontWeight:'900',color:c.green},
  timeline:{gap:9,padding:vendorSpace.md,borderRadius:vendorRadius.lg,backgroundColor:c.paper},
  timelineRow:{flexDirection:'row',alignItems:'center',gap:9},
  timelineDot:{width:7,height:7,borderRadius:4,backgroundColor:c.green},
  timelineLabel:{flex:1,fontSize:10,fontWeight:'700',color:c.ink},
  timelineTime:{fontSize:10,color:c.muted},
  unavailableNote:{flexDirection:'row',alignItems:'center',gap:8,padding:10,borderRadius:vendorRadius.md,backgroundColor:c.cream},
  delivery:{width:'100%',flexDirection:'row',alignItems:'center',gap:11,padding:vendorSpace.md,borderRadius:vendorRadius.lg,borderWidth:1,borderColor:c.line,backgroundColor:c.card},
  deliveryIcon:{width:42,height:42,borderRadius:vendorRadius.md,backgroundColor:c.mint},
  deliveryTitle:{fontSize:12,fontWeight:'900',color:c.ink},
  inlineError:{fontSize:11,lineHeight:17,color:c.isDark?'#f0877a':'#a44232'},
  modalBackdrop:{width:'100%',flex:1,justifyContent:'flex-end',alignItems:'stretch',backgroundColor:'rgba(0,0,0,.48)'},
  modal:{width:'100%',maxHeight:'85%',alignSelf:'stretch',paddingHorizontal:vendorSpace.lg,paddingTop:vendorSpace.sm,paddingBottom:vendorSpace.xl,borderTopLeftRadius:vendorRadius.xl,borderTopRightRadius:vendorRadius.xl,backgroundColor:c.paper},
  sheetHandle:{width:38,height:4,alignSelf:'center',marginBottom:vendorSpace.md,borderRadius:vendorRadius.pill,backgroundColor:c.line},
  modalHeader:{width:'100%',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:vendorSpace.md,marginBottom:vendorSpace.sm},
  modalHeadingCopy:{flex:1,minWidth:0},
  modalEyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.1,color:c.green},
  modalTitle:{fontSize:20,fontWeight:'900',color:c.ink,marginTop:4},
  modalDescription:{fontSize:11,lineHeight:17,color:c.muted,marginBottom:vendorSpace.md},
  modalClose:{width:38,height:38,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.pill,borderWidth:1,borderColor:c.line,backgroundColor:c.card},
  periodList:{width:'100%',flexGrow:0},
  periodListContent:{width:'100%',gap:vendorSpace.xs,paddingBottom:vendorSpace.md},
  period:{width:'100%',minHeight:52,flexDirection:'row',alignItems:'center',gap:vendorSpace.sm,paddingHorizontal:10,borderRadius:vendorRadius.md,borderWidth:1,borderColor:c.line,backgroundColor:c.card},
  periodIcon:{width:34,height:34,alignItems:'center',justifyContent:'center',borderRadius:vendorRadius.sm,backgroundColor:c.cream},
  periodIconActive:{backgroundColor:c.mint},
  periodText:{flex:1,fontSize:12,fontWeight:'700',color:c.ink},
  periodTextActive:{fontWeight:'900',color:c.green},
});

export default function RiderDeliverySummary({deliveries,loading,error,colors:c,onRetry}:{deliveries:RiderDelivery[];loading:boolean;error:string;colors:AppColors;onRetry:()=>void}){
  const [period,setPeriod]=useState<Period>('Today');const [filterOpen,setFilterOpen]=useState(false);const [detail,setDetail]=useState<'summary'|'orders'|'distance'|'earnings'>('summary');const [selectedOrder,setSelectedOrder]=useState<HistoryDelivery|null>(null);const s=screenStyles(c);
  const complete=useMemo(()=>{const [from,to]=periodBounds(period);return (deliveries as HistoryDelivery[]).filter(d=>d.status==='DELIVERED'&&dateFor(d)!==null&&new Date(dateFor(d)!).getTime()>=from.getTime()&&new Date(dateFor(d)!).getTime()<=to.getTime());},[deliveries,period]);
  const title=selectedOrder?'Delivery details':detail==='orders'?'Completed deliveries':detail==='distance'?'Routes & distance':detail==='earnings'?'Earnings':'Delivery summary';
  const subtitle=selectedOrder?'A clear record of the completed order and delivery route.':detail==='summary'?`Your completed work for ${period.toLowerCase()}.`:detail==='orders'?`${complete.length} completed ${complete.length===1?'delivery':'deliveries'} for ${period.toLowerCase()}.`:detail==='distance'?'Review route distance for the selected period.':'Review rider earnings for the selected period.';
  return <View style={s.screen}>
    <View style={s.fixedHeader}><View style={s.header}><View style={s.headerCopy}><Text style={s.eyebrow}>DELIVERY ACTIVITY</Text><Text style={s.title}>{title}</Text><Text style={s.subtitle}>{subtitle}</Text></View>{(detail!=='summary'||selectedOrder)&&<Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={()=>selectedOrder?setSelectedOrder(null):setDetail('summary')} style={s.back}><Ionicons name="chevron-back" size={20} color={c.green}/></Pressable>}</View></View>
    <ScrollView contentContainerStyle={s.content}>
      {!selectedOrder&&<Pressable accessibilityRole="button" accessibilityLabel={`Date filter: ${period}`} onPress={()=>setFilterOpen(true)} style={s.filterButton}><Ionicons name="calendar-outline" size={18} color={c.green}/><Text style={s.filterText}>{period}</Text><Ionicons name="chevron-down" size={17} color={c.muted}/></Pressable>}
      {loading&&!deliveries.length?<ActivityIndicator style={{margin:30}} color={c.green}/> : error&&!deliveries.length?<View style={s.empty}><Text style={s.emptyTitle}>Delivery summary unavailable</Text><Text style={s.copy}>{error}</Text><Pressable onPress={onRetry}><Text style={s.retry}>Try again</Text></Pressable></View> : selectedOrder?<DeliveryDetails delivery={selectedOrder} c={c}/> : detail==='summary'?<>
        <DeliveryOverview period={period} count={complete.length} onOpen={()=>setDetail('orders')} c={c}/>
        <Text style={s.section}>PERFORMANCE</Text>
        <SummaryCard title="Distance covered" value="Not available" range="10–100 km" ratio={null} icon="navigate-outline" onPress={()=>setDetail('distance')} c={c}/>
        <SummaryCard title="Earnings" value="Not available" range="For selected period" ratio={null} icon="wallet-outline" onPress={()=>setDetail('earnings')} c={c}/>
      </>:detail==='orders'?<>
        <View style={s.listOverview}><View style={s.listOverviewIcon}><Ionicons name="receipt-outline" size={20} color={c.green}/></View><View style={s.listOverviewCopy}><Text style={s.listOverviewTitle}>{complete.length} completed {complete.length===1?'delivery':'deliveries'}</Text><Text style={s.listOverviewDetail}>Showing results for {period.toLowerCase()}</Text></View></View>
        {complete.length?complete.map(d=><DeliveryRow key={d.id} delivery={d} c={c} onPress={()=>setSelectedOrder(d)}/>):<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="receipt-outline" size={24} color={c.green}/></View><Text style={s.emptyTitle}>No completed orders</Text><Text style={s.copy}>Completed deliveries will appear here for {period.toLowerCase()}.</Text></View>}
      </>:detail==='distance'?<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="navigate-outline" size={24} color={c.green}/></View><Text style={s.emptyTitle}>Distance data unavailable</Text><Text style={s.copy}>The delivery records don’t store completed route distances yet.</Text></View>
      :<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="wallet-outline" size={24} color={c.green}/></View><Text style={s.emptyTitle}>Earnings data unavailable</Text><Text style={s.copy}>Rider earnings aren’t recorded in the delivery API yet.</Text></View>}
      {error&&deliveries.length>0?<Text style={s.inlineError}>{error}</Text>:null}
    </ScrollView>
    <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={()=>setFilterOpen(false)}>
      <Pressable style={s.modalBackdrop} onPress={()=>setFilterOpen(false)}>
        <Pressable style={s.modal} onPress={event=>event.stopPropagation()}>
          <View style={s.sheetHandle}/>
          <View style={s.modalHeader}>
            <View style={s.modalHeadingCopy}><Text style={s.modalEyebrow}>DELIVERY ACTIVITY</Text><Text style={s.modalTitle}>Choose a period</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close period filter" onPress={()=>setFilterOpen(false)} style={s.modalClose}><Ionicons name="close" size={20} color={c.ink}/></Pressable>
          </View>
          <Text style={s.modalDescription}>Show your completed deliveries for:</Text>
          <ScrollView style={s.periodList} contentContainerStyle={s.periodListContent} showsVerticalScrollIndicator={false}>
            {periods.map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:period===value}} onPress={()=>{setPeriod(value);setFilterOpen(false);}} style={[s.period,period===value&&s.periodActive]}><View style={[s.periodIcon,period===value&&s.periodIconActive]}><Ionicons name={value.includes('week')||value.includes('Week')?'calendar-outline':'time-outline'} size={17} color={period===value?c.green:c.muted}/></View><Text style={[s.periodText,period===value&&s.periodTextActive]}>{value}</Text>{period===value&&<Ionicons name="checkmark-circle" size={20} color={c.green}/>}</Pressable>)}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  </View>;
}

function DeliveryOverview({period,count,onOpen,c}:{period:Period;count:number;onOpen:()=>void;c:AppColors}){const s=screenStyles(c);return <View style={s.overview}><View style={s.overviewTop}><Text style={s.overviewEyebrow}>{period.toUpperCase()} OVERVIEW</Text><View style={s.overviewIcon}><Ionicons name="bicycle-outline" size={20} color="white"/></View></View><View style={s.overviewMetrics}><Text style={s.overviewCount}>{count}</Text><View style={s.overviewCopy}><Text style={s.overviewLabel}>{count===1?'completed delivery':'completed deliveries'}</Text><Text style={s.overviewPeriod}>Your finished rider trips for this period</Text></View></View><Pressable accessibilityRole="button" onPress={onOpen} style={s.overviewLink}><Text style={s.overviewLinkText}>View delivery history</Text><Ionicons name="arrow-forward" size={17} color="white"/></Pressable></View>}
function SummaryCard({title,value,range,ratio,icon,onPress,c}:{title:string;value:string;range:string;ratio:number|null;icon:string;onPress:()=>void;c:AppColors}){const s=screenStyles(c);return <Pressable accessibilityRole="button" accessibilityHint={`Opens ${title.toLowerCase()} details`} onPress={onPress} style={({pressed})=>[s.card,pressed&&{opacity:.85}]}><View style={s.cardTop}><View style={s.cardIcon}><Ionicons name={icon} size={20} color={c.green}/></View><Text style={s.cardTitle}>{title}</Text><Ionicons name="arrow-forward" size={19} color={c.green}/></View><Text style={s.value}>{value}</Text><View style={s.rangeHead}><Text style={s.rangeLabel}>{range}</Text>{ratio===null&&<Text style={s.rangeUnavailable}>Not tracked</Text>}</View>{ratio===null?<View style={s.untrackedNote}><Ionicons name="information-circle-outline" size={15} color={c.muted}/><Text style={s.untrackedText}>This metric is not included in delivery records yet.</Text></View>:<><View style={s.rangeTrack}><View style={[s.rangeFill,{width:`${Math.max(ratio*100,ratio?2:0)}%`}]}/></View><View style={s.rangeEnds}><Text style={s.rangeEnd}>1</Text><Text style={s.rangeEnd}>100</Text></View></>}</Pressable>}
function DeliveryRow({delivery:d,c,onPress}:{delivery:RiderDelivery;c:AppColors;onPress:()=>void}){const s=screenStyles(c);const date=(d as HistoryDelivery).deliveredAt??(d as HistoryDelivery).createdAt;return <Pressable accessibilityRole="button" onPress={onPress} style={s.delivery}><View style={s.deliveryIcon}><Ionicons name="checkmark-circle-outline" size={20} color={c.green}/></View><View style={{flex:1}}><Text style={s.deliveryTitle}>{d.order.vendor.name}</Text><Text style={s.copy}>Order {d.order.id.slice(-8)}{date?` · ${new Date(date).toLocaleDateString('en-NG',{day:'numeric',month:'short'})}`:''}</Text><Text numberOfLines={2} style={s.copy}>{d.order.items.map(i=>`${i.quantity} × ${i.nameSnapshot}`).join(' · ')}</Text></View><Ionicons name="chevron-forward" size={18} color={c.muted}/></Pressable>}
function DeliveryDetails({delivery:d,c}:{delivery:HistoryDelivery;c:AppColors}){const s=screenStyles(c);const date=d.deliveredAt??d.createdAt;const milestones=[{label:'Assigned to you',date:d.assignedAt},{label:'Picked up',date:d.pickedUpAt},{label:'Delivered',date:d.deliveredAt}].filter(step=>step.date);return <View style={s.detailCard}><View style={s.detailHero}><View style={s.detailHeroIcon}><Ionicons name="checkmark" size={22} color="white"/></View><View style={s.detailHeroCopy}><Text style={s.detailHeroTitle}>Delivery complete</Text><Text style={s.detailHeroDate}>{date?new Date(date).toLocaleString('en-NG',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'Completion date unavailable'}</Text></View></View><View style={s.detailSection}><Text style={s.detailLabel}>ORDER REFERENCE</Text><Text style={s.detailTitle}>#{d.order.id.slice(-8).toUpperCase()}</Text><Text style={s.copy}>Delivery ID {d.id.slice(-8)}</Text></View><View style={s.routeCard}><View style={s.routeRow}><View style={s.pickupDot}/><View style={s.routeCopy}><Text style={s.detailLabel}>PICKED UP FROM</Text><Text style={s.detailTitle}>{d.order.vendor.name}</Text><Text style={s.copy}>{d.order.vendor.address}</Text></View></View><View style={s.routeConnector}/><View style={s.routeRow}><View style={s.dropoffDot}/><View style={s.routeCopy}><Text style={s.detailLabel}>DELIVERED TO</Text><Text style={s.detailTitle}>{d.order.address?`${d.order.address.line1}, ${d.order.address.city}`:'Address unavailable'}</Text></View></View></View><View style={s.detailSection}><Text style={s.detailLabel}>ORDER ITEMS</Text>{d.order.items.map(i=><View key={i.id} style={s.detailItem}><Text style={s.detailItemName}>{i.nameSnapshot}</Text><Text style={s.detailItemQuantity}>× {i.quantity}</Text></View>)}</View>{milestones.length>0&&<View style={s.timeline}><Text style={s.detailLabel}>DELIVERY TIMELINE</Text>{milestones.map(step=><View key={step.label} style={s.timelineRow}><View style={s.timelineDot}/><Text style={s.timelineLabel}>{step.label}</Text><Text style={s.timelineTime}>{new Date(step.date!).toLocaleTimeString('en-NG',{hour:'numeric',minute:'2-digit'})}</Text></View>)}</View>}<View style={s.unavailableNote}><Ionicons name="information-circle-outline" size={17} color={c.muted}/><Text style={s.copy}>Distance and rider earnings are not recorded for this order yet.</Text></View></View>}
const styles=(c:AppColors)=>StyleSheet.create({screen:{flex:1,backgroundColor:c.paper},fixedHeader:{paddingHorizontal:15,paddingTop:12,paddingBottom:8,backgroundColor:c.paper},content:{paddingHorizontal:15,paddingTop:5,paddingBottom:25,gap:12},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:1},eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.2,color:c.green},title:{fontSize:28,fontWeight:'900',color:c.ink,marginTop:3},subtitle:{fontSize:12,color:c.muted,marginTop:3},back:{width:39,height:39,alignItems:'center',justifyContent:'center',borderRadius:0,backgroundColor:c.cream},filterButton:{width:"40%",minHeight:48,alignSelf:"flex-start",flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:12,borderRadius:0,borderWidth:0,backgroundColor:c.cream},filterText:{flex:1,fontSize:13,fontWeight:'800',color:c.ink},card:{padding:13,gap:8,borderWidth:1,borderColor:c.cream,borderRadius:0,backgroundColor:c.card},cardTop:{flexDirection:'row',alignItems:'center',gap:9},cardIcon:{width:37,height:37,borderRadius:0,alignItems:'center',justifyContent:'center',backgroundColor:c.cream},cardTitle:{flex:1,fontSize:14,fontWeight:'900',color:c.ink},value:{fontSize:26,fontWeight:'900',color:c.ink,marginTop:2},rangeHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},rangeLabel:{fontSize:10,fontWeight:'800',color:c.muted},rangeUnavailable:{fontSize:9,color:c.muted},rangeTrack:{height:7,overflow:'hidden',borderRadius:0,backgroundColor:c.cream},rangeFill:{height:7,borderRadius:0,backgroundColor:c.green},rangeEnds:{flexDirection:'row',justifyContent:'space-between'},rangeEnd:{fontSize:9,color:c.muted},empty:{alignItems:'center',padding:20,marginTop:5,borderWidth:1,borderColor:c.cream,borderRadius:0,backgroundColor:c.card},emptyIcon:{width:43,height:43,borderRadius:0,alignItems:'center',justifyContent:'center',backgroundColor:c.cream},emptyTitle:{fontSize:14,fontWeight:'900',color:c.ink,marginTop:9,textAlign:'center'},copy:{fontSize:11,lineHeight:17,color:c.muted,marginTop:4},retry:{fontSize:12,fontWeight:'900',color:c.green,marginTop:8},detailCard:{padding:14,borderRadius:0,borderWidth:1,borderColor:c.cream,backgroundColor:c.card,gap:11},detailStatus:{flexDirection:'row',alignItems:'center',gap:8},detailSection:{paddingTop:10,gap:4},detailLabel:{fontSize:10,fontWeight:'900',letterSpacing:.8,color:c.muted},detailTitle:{fontSize:13,fontWeight:'800',color:c.ink},delivery:{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderRadius:0,backgroundColor:c.card,borderWidth:1,borderColor:c.cream},deliveryIcon:{width:38,height:38,borderRadius:0,alignItems:'center',justifyContent:'center',backgroundColor:c.cream},deliveryTitle:{fontSize:13,fontWeight:'900',color:c.ink},inlineError:{fontSize:11,lineHeight:17,color:'#a44232'},modalBackdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.38)'},modal:{padding:18,paddingBottom:30,borderTopLeftRadius: 0,borderTopRightRadius: 0,backgroundColor:c.paper},modalTitle:{fontSize:18,fontWeight:'900',color:c.ink,marginBottom:8},period:{minHeight:43,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:7,borderBottomWidth:1,borderBottomColor:c.line},periodActive:{backgroundColor:c.cream},periodText:{fontSize:13,color:c.ink},periodTextActive:{fontWeight:'900',color:c.green}});
