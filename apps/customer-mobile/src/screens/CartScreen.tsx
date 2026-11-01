import { AppTextInput as TextInput } from '@makanza/mobile-ui';
import { AppText as Text } from '@makanza/mobile-ui';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BackHeader } from '../components/ui';
import { Ionicons } from '../components/AppIcon';
import type { CartLine } from '../types/cart';
import { darkColors, lightColors, type AppColors } from '../theme/colors';

type Props={lines:CartLine[];subtotal:number;address:string;city:string;busy:boolean;error:string;hasAccount:boolean;dark:boolean;onAddress:(value:string)=>void;onCity:(value:string)=>void;onQuantity:(lineId:string,delta:number)=>void;onPlaceOrder:()=>void;onBrowse:()=>void;onSignIn:()=>void;onPickAddress:()=>void};
const money=(minor:number)=>`₦${(minor/100).toLocaleString('en-NG')}`;

export default function CartScreen(p:Props){
  const c=p.dark?darkColors:lightColors; const s=styles(c); const count=p.lines.reduce((sum,line)=>sum+line.quantity,0);
  return <View style={s.screen}>
    <BackHeader title="Your bag" subtitle={count?`${count} ${count===1?'item':'items'} ready for checkout`:'Review your order before checkout'} colors={c} onBack={p.onBrowse}/>
    <ScrollView style={{flex:1}} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      {p.lines.length===0?<View style={s.empty}>
        <View style={s.emptyIcon}><Ionicons name="basket-outline" size={30} color={c.green}/></View>
        <Text style={s.emptyTitle}>Your bag is empty</Text><Text style={s.muted}>Find something lovely from a kitchen nearby.</Text>
        <Pressable accessibilityRole="button" onPress={p.onBrowse} style={s.browse}><Text style={s.browseText}>Explore kitchens</Text><Ionicons name="arrow-forward" size={18} color="white"/></Pressable>
      </View>:<>
        <View style={s.vendorHeading}><View style={s.vendorIcon}><Ionicons name="storefront-outline" size={20} color={c.green}/></View><View style={s.vendorCopy}><Text style={s.kicker}>ORDERING FROM</Text><Text style={s.vendor}>{p.lines[0].vendorName}</Text></View><Ionicons name="checkmark-circle-outline" size={21} color={c.green}/></View>
        <View style={s.itemsCard}>{p.lines.map((line,index)=>{
          const unit=line.product.priceMinor+line.addons.reduce((sum,x)=>sum+x.addon.priceMinor*x.quantity,0);
          return <View key={line.id} style={[s.line,index<p.lines.length-1&&s.lineDivider]}>
            <View style={s.itemIcon}><Ionicons name="restaurant-outline" size={19} color={c.green}/></View>
            <View style={s.copy}><Text style={s.itemName}>{line.product.name}</Text>
              {line.addons.map(x=><Text key={x.addon.id} style={s.addon}>+ {x.quantity} × {x.addon.name}</Text>)}
              <Text style={s.unitPrice}>{money(unit)} each</Text><Text style={s.lineTotal}>{money(unit*line.quantity)}</Text>
            </View>
            <View style={s.quantity}><Pressable accessibilityRole="button" accessibilityLabel={`Remove one ${line.product.name}`} onPress={()=>p.onQuantity(line.id,-1)} style={s.qtyButton}><Text style={s.qtyText}>−</Text></Pressable><Text style={s.qty}>{line.quantity}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Add one ${line.product.name}`} onPress={()=>p.onQuantity(line.id,1)} style={s.qtyButton}><Text style={s.qtyText}>+</Text></Pressable></View>
          </View>;
        })}</View>

        <View style={s.summary}><View style={s.summaryLine}><Text style={s.summaryLabel}>Food subtotal</Text><Text style={s.summaryValue}>{money(p.subtotal)}</Text></View><View style={s.feeNote}><Ionicons name="information-circle-outline" size={17} color={c.muted}/><Text style={s.feeText}>Delivery fee and final total are confirmed at checkout.</Text></View></View>

        <View style={s.sectionHeading}><View style={s.sectionIcon}><Ionicons name="location-outline" size={19} color={c.green}/></View><View><Text style={s.sectionTitle}>Delivery details</Text><Text style={s.sectionSub}>Where should we bring your order?</Text></View></View>
        <Pressable accessibilityRole="button" onPress={p.onPickAddress} style={({pressed})=>[s.saved,pressed&&s.pressed]}><View style={s.savedIcon}><Ionicons name="map-outline" size={20} color={c.green}/></View><Text style={s.savedText}>Choose a saved place or use current location</Text><Ionicons name="chevron-forward" size={19} color={c.muted}/></Pressable>
        <Text style={s.label}>Street address</Text><TextInput value={p.address} onChangeText={p.onAddress} placeholder="House number and street" placeholderTextColor={c.muted} style={s.input}/>
        <Text style={s.label}>City</Text><TextInput value={p.city} onChangeText={p.onCity} placeholder="City" placeholderTextColor={c.muted} style={s.input}/>
        {p.error?<View style={s.errorBox}><Ionicons name="alert-circle-outline" size={18} color="#a34232"/><Text style={s.error}>{p.error}</Text></View>:null}
        <Pressable accessibilityRole="button" disabled={p.busy} onPress={p.hasAccount?p.onPlaceOrder:p.onSignIn} style={({pressed})=>[s.checkout,p.busy&&s.disabled,pressed&&!p.busy&&s.pressed]}><Text style={s.checkoutText}>{p.busy?'Placing your order…':p.hasAccount?'Review and place order':'Sign in to continue'}</Text><Ionicons name="arrow-forward" size={19} color="white"/></Pressable>
        <Text style={s.note}>Development checkout is isolated and does not charge money.</Text>
      </>}
    </ScrollView>
  </View>;
}

const styles=(c:AppColors)=>StyleSheet.create({
  screen:{flex:1,backgroundColor:c.paper},page:{padding:18,paddingTop:16,paddingBottom:36},
  empty:{flex:1,minHeight:380,alignItems:'center',justifyContent:'center',padding:25},emptyIcon:{width:68,height:68,borderRadius:23,alignItems:'center',justifyContent:'center',backgroundColor:c.mint},emptyTitle:{fontSize:21,fontWeight:'900',color:c.ink,marginTop:16},muted:{fontSize:12,lineHeight:19,color:c.muted,textAlign:'center',marginTop:6},browse:{minHeight:46,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,paddingHorizontal:17,borderRadius:14,backgroundColor:c.green,marginTop:18},browseText:{fontSize:13,fontWeight:'900',color:'white'},
  vendorHeading:{flexDirection:'row',alignItems:'center',gap:11,padding:14,borderRadius:17,backgroundColor:c.card,borderWidth:1,borderColor:c.line,marginBottom:11},vendorIcon:{width:40,height:40,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:c.mint},vendorCopy:{flex:1},kicker:{fontSize:9,fontWeight:'900',letterSpacing:1.1,color:c.muted},vendor:{fontSize:15,fontWeight:'900',color:c.ink,marginTop:3},
  itemsCard:{paddingHorizontal:13,borderRadius:18,borderWidth:1,borderColor:c.line,backgroundColor:c.card},line:{minHeight:106,flexDirection:'row',alignItems:'center',gap:10,paddingVertical:13},lineDivider:{borderBottomWidth:1,borderBottomColor:c.line},itemIcon:{width:38,height:38,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:c.cream},copy:{flex:1},itemName:{fontSize:13,fontWeight:'900',color:c.ink},addon:{fontSize:10,lineHeight:15,color:c.muted,marginTop:3},unitPrice:{fontSize:10,color:c.muted,marginTop:4},lineTotal:{fontSize:12,fontWeight:'900',color:c.green,marginTop:2},quantity:{flexDirection:'row',alignItems:'center',gap:8},qtyButton:{width:30,height:30,borderRadius:11,backgroundColor:c.mint,alignItems:'center',justifyContent:'center'},qtyText:{fontSize:20,lineHeight:23,color:c.green,fontWeight:'800'},qty:{minWidth:14,fontSize:13,fontWeight:'900',color:c.ink,textAlign:'center'},
  summary:{padding:15,borderRadius:17,backgroundColor:c.cream,marginTop:12},summaryLine:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},summaryLabel:{fontSize:13,fontWeight:'800',color:c.ink},summaryValue:{fontSize:16,fontWeight:'900',color:c.green},feeNote:{flexDirection:'row',alignItems:'center',gap:7,marginTop:10},feeText:{flex:1,fontSize:10,lineHeight:15,color:c.muted},
  sectionHeading:{flexDirection:'row',alignItems:'center',gap:10,marginTop:23,marginBottom:10},sectionIcon:{width:37,height:37,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:c.mint},sectionTitle:{fontSize:15,fontWeight:'900',color:c.ink},sectionSub:{fontSize:10,color:c.muted,marginTop:3},saved:{minHeight:56,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:11,borderWidth:1,borderColor:c.line,borderRadius:15,backgroundColor:c.card},savedIcon:{width:34,height:34,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:c.cream},savedText:{flex:1,fontSize:11,fontWeight:'800',color:c.green},label:{fontSize:11,fontWeight:'900',color:c.ink,marginTop:14,marginBottom:6},input:{height:48,borderWidth:1,borderColor:c.line,borderRadius:13,paddingHorizontal:13,backgroundColor:c.card,fontSize:14,color:c.ink},errorBox:{flexDirection:'row',alignItems:'center',gap:8,padding:11,borderRadius:12,backgroundColor:c.isDark?'#3b211d':'#fcece8',marginTop:11},error:{flex:1,fontSize:12,lineHeight:18,color:'#a34232'},checkout:{minHeight:53,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:9,borderRadius:15,backgroundColor:c.green,marginTop:17},checkoutText:{fontSize:14,fontWeight:'900',color:'white'},note:{fontSize:10,lineHeight:16,textAlign:'center',color:c.muted,marginTop:10},pressed:{opacity:.75},disabled:{opacity:.5},
});
