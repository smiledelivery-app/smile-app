import { AppText as Text } from '@makanza/mobile-ui';
import { useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { BackHeader } from '../components/ui';
import { darkColors, lightColors } from '../theme/colors';
import type { AppColors } from '../theme/colors';
import type { Product, ProductAddon, Vendor } from '@makanza/mobile-core';
import { distanceInKm } from '../utils/distance';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';

export type Choice={addon:ProductAddon;quantity:number};
type Props={vendor:Vendor|null;products:Product[];loading:boolean;error:string;dark:boolean;userLocation:{latitude:number;longitude:number}|null;onBack:()=>void;onRetry:()=>void;onAdd:(product:Product,addons:Choice[],quantity?:number)=>void};
const money=(minor:number)=>`₦${(minor/100).toLocaleString('en-NG')}`;

export default function VendorMenuScreen({vendor,products,loading,error,dark,userLocation,onBack,onRetry,onAdd}:Props){
  const [selected,setSelected]=useState<Product|null>(null);
  const [choices,setChoices]=useState<Record<string,number>>({});
  const [quantities,setQuantities]=useState<Record<string,number>>({});
  const c=dark?darkColors:lightColors;
  const p=customerPalette(c);
  const s=styles(c);
  const price=(product:Product)=>product.priceMinor+(product.addons??[]).filter(addon=>addon.available).reduce((sum,addon)=>sum+addon.priceMinor*(choices[addon.id]??0),0);
  const vendorCoordinates=vendor?.latitude==null||vendor.longitude==null?null:{latitude:vendor.latitude,longitude:vendor.longitude};
  const km=vendorCoordinates&&userLocation?distanceInKm(userLocation,vendorCoordinates):null;
  const distance=km===null?'Set location':`${km.toFixed(1)} km`;
  const adjustQuantity=(productId:string,delta:number)=>setQuantities(current=>({...current,[productId]:Math.max(1,(current[productId]??1)+delta)}));

  return <View style={[s.screen,dark&&s.screenDark]}>
    <BackHeader title="Nearby kitchens" subtitle="Browse this kitchen menu" colors={c} onBack={onBack}/>
    <ScrollView style={{flex:1}} contentContainerStyle={s.page}>
      {vendor&&<>
        <ImageBackground source={{uri:vendor.image||'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1100&q=85'}} imageStyle={s.coverImage} style={s.cover}>
          <View style={s.shade}/><Text style={s.coverTag}>{vendor.cuisine.toUpperCase()}</Text><Text style={s.coverTitle}>{vendor.name}</Text><Text style={s.coverMeta}>{vendor.neighborhood}</Text>
        </ImageBackground>
        <View style={[s.stats,dark&&s.cardDark]}>
          <Metric s={s} color={p.primary} icon="star" label="RATING" value={vendor.rating?.toFixed(1)??'4.8'} dark={dark}/><Metric s={s} color={p.primary} icon="time-outline" label="DELIVERY" value={vendor.eta} dark={dark}/><Metric s={s} color={p.primary} icon="navigate-outline" label="DISTANCE" value={distance} dark={dark}/><Metric s={s} color={p.primary} icon="bicycle-outline" label="FEE" value={money(vendor.fee*100)} dark={dark}/>
        </View>
        <View style={s.section}><Text style={[s.sectionTitle,dark&&s.textDark]}>The menu</Text><Text style={s.sectionBody}>Made fresh by {vendor.name}</Text></View>
      </>}
      {loading?<ActivityIndicator color={p.primary} style={{margin:25}}/>:error?<View style={s.state}><Text style={s.stateText}>{error}</Text><Pressable onPress={onRetry}><Text style={s.action}>Try again</Text></Pressable></View>:products.length===0?<View style={s.state}><Text style={s.stateText}>Nothing on the menu right now. Check back soon.</Text></View>:products.map(product=>{
        const quantity=quantities[product.id]??1;
        const extras=(product.addons??[]).filter(addon=>addon.available);
        return <View key={product.id} style={[s.item,dark&&s.cardDark]}>
          <View style={s.itemTop}>
            {product.imageUrl?<Image source={{uri:product.imageUrl}} style={s.photo}/>:<View style={s.photoPlaceholder}><Ionicons name="restaurant-outline" size={24} color={p.primary}/></View>}
            <View style={s.copy}><Text style={[s.productName,dark&&s.textDark]}>{product.name}</Text><Text style={[s.description,dark&&s.mutedDark]} numberOfLines={2}>{product.description}</Text><Text style={s.price}>{money(product.priceMinor)}</Text>
              {!!extras.length&&<Pressable accessibilityRole="button" onPress={()=>{setSelected(product);setChoices({});}}><Text style={s.action}>Choose extras · from {money(product.priceMinor)}</Text></Pressable>}
            </View>
          </View>
          <View style={s.itemBottom}>
            <View style={s.quantity}><Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${product.name} quantity`} onPress={()=>adjustQuantity(product.id,-1)} style={s.qty}><Text style={s.qtyLabel}>−</Text></Pressable><Text style={[s.qtyValue,dark&&s.textDark]}>{quantity}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Increase ${product.name} quantity`} onPress={()=>adjustQuantity(product.id,1)} style={s.qty}><Text style={s.qtyLabel}>+</Text></Pressable></View>
            <Pressable accessibilityRole="button" onPress={()=>extras.length?(setSelected(product),setChoices({})) : onAdd(product,[],quantity)} style={s.add}><Text style={s.addText}>{extras.length?'Choose extras':'Add to bag'}</Text><Ionicons name="arrow-forward" size={16} color={c.green}/></Pressable>
          </View>
        </View>;
      })}
      {selected&&<View style={[s.modal,dark&&s.cardDark]}>
        <View style={s.modalHeader}><View style={{flex:1}}><Text style={[s.modalTitle,dark&&s.textDark]}>{selected.name} × {quantities[selected.id]??1}</Text><Text style={s.sectionBody}>Choose extras · priced per piece</Text></View><Pressable accessibilityRole="button" onPress={()=>setSelected(null)}><Text style={s.action}>Close</Text></Pressable></View>
        {selected.addons?.filter(addon=>addon.available).map(addon=><View key={addon.id} style={s.extraRow}><View style={{flex:1}}><Text style={[s.productName,dark&&s.textDark]}>{addon.name}</Text><Text style={s.description}>{money(addon.priceMinor)} each</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove one ${addon.name}`} style={s.qty} onPress={()=>setChoices(current=>({...current,[addon.id]:Math.max(0,(current[addon.id]??0)-1)}))}><Text style={s.qtyLabel}>−</Text></Pressable><Text style={[s.qtyValue,dark&&s.textDark]}>{choices[addon.id]??0}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Add one ${addon.name}`} style={s.qty} onPress={()=>setChoices(current=>({...current,[addon.id]:(current[addon.id]??0)+1}))}><Text style={s.qtyLabel}>+</Text></Pressable></View>)}
        <Pressable accessibilityRole="button" style={s.addConfirm} onPress={()=>{onAdd(selected,(selected.addons??[]).filter(addon=>(choices[addon.id]??0)>0).map(addon=>({addon,quantity:choices[addon.id]})),quantities[selected.id]??1);setSelected(null);}}><Text style={s.addConfirmText}>Add {quantities[selected.id]??1} · {money(price(selected)*(quantities[selected.id]??1))}</Text></Pressable>
      </View>}
    </ScrollView>
  </View>;
}

function Metric({s,color,icon,label,value,dark}:{s:ReturnType<typeof styles>;color:string;icon:'star'|'time-outline'|'navigate-outline'|'bicycle-outline';label:string;value:string;dark:boolean}){return <View style={s.metric}><Ionicons name={icon} size={18} color={color}/><Text style={s.metricLabel}>{label}</Text><Text numberOfLines={1} style={[s.metricValue,dark&&s.textDark]}>{value}</Text></View>}
const styles=(colors:AppColors)=>{
  const c=customerPalette(colors);
  return StyleSheet.create({
    screen:{flex:1,backgroundColor:c.canvas},screenDark:{backgroundColor:c.canvas},page:{paddingBottom:customerSpace.xl},
    cover:{height:188,marginHorizontal:customerSpace.lg,padding:customerSpace.lg,borderRadius:customerRadius.lg,justifyContent:'flex-end',overflow:'hidden',backgroundColor:c.primary},coverImage:{borderRadius:customerRadius.lg},shade:{...StyleSheet.absoluteFill,backgroundColor:'rgba(12,25,17,.5)'},coverTag:{fontSize:9,letterSpacing:1.15,fontWeight:'900',color:'#e4eee8',marginBottom:7},coverTitle:{fontSize:28,fontWeight:'900',letterSpacing:-.7,color:'white'},coverMeta:{fontSize:11,color:'#f0f2e9',marginTop:5},
    stats:{marginHorizontal:customerSpace.lg,marginTop:10,padding:customerSpace.md,borderRadius:customerRadius.md,backgroundColor:c.surface,borderWidth:1,borderColor:c.border,flexDirection:'row',justifyContent:'space-between',gap:4},cardDark:{backgroundColor:c.surface,borderColor:c.border},metric:{flex:1,alignItems:'center',gap:4},metricLabel:{fontSize:8,fontWeight:'900',letterSpacing:.5,color:c.muted},metricValue:{maxWidth:'100%',fontSize:10,fontWeight:'900',color:c.primary},
    section:{paddingHorizontal:customerSpace.lg,paddingTop:customerSpace.xl,paddingBottom:4},sectionTitle:{fontSize:21,fontWeight:'900',letterSpacing:-.4,color:c.ink},sectionBody:{fontSize:11,color:c.muted,marginTop:4},
    item:{marginHorizontal:customerSpace.lg,marginTop:9,padding:customerSpace.md,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.md,backgroundColor:c.surface},itemTop:{flexDirection:'row',alignItems:'center',gap:11},photo:{width:76,height:76,borderRadius:customerRadius.sm,backgroundColor:c.surfaceAlt},photoPlaceholder:{width:76,height:76,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},copy:{flex:1,gap:4},productName:{fontSize:14,fontWeight:'800',color:c.ink},description:{fontSize:11,lineHeight:17,color:c.muted},price:{fontSize:13,fontWeight:'900',color:c.primary},action:{fontSize:11,fontWeight:'900',color:c.primary,marginTop:3},itemBottom:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:12,paddingTop:10,borderTopWidth:1,borderColor:c.border},quantity:{flexDirection:'row',alignItems:'center',gap:10},qty:{width:38,height:38,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.sm,backgroundColor:c.primarySoft},qtyLabel:{fontSize:20,fontWeight:'900',color:c.primary},qtyValue:{minWidth:18,textAlign:'center',fontSize:14,fontWeight:'900',color:c.ink},add:{minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:13,borderRadius:customerRadius.sm,backgroundColor:c.primarySoft},addText:{fontSize:11,fontWeight:'900',color:c.primary},
    state:{padding:customerSpace.xl,alignItems:'center',gap:8},stateText:{fontSize:12,lineHeight:19,textAlign:'center',color:c.muted},textDark:{color:c.ink},mutedDark:{color:c.muted},modal:{margin:14,padding:15,borderRadius:customerRadius.lg,borderColor:c.border,borderWidth:1,backgroundColor:c.surface},modalHeader:{flexDirection:'row',alignItems:'center',marginBottom:8},modalTitle:{fontSize:18,fontWeight:'900',color:c.ink},extraRow:{minHeight:54,flexDirection:'row',alignItems:'center',gap:12,borderTopWidth:1,borderColor:c.border},addConfirm:{minHeight:49,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:c.primary,marginTop:12},addConfirmText:{fontSize:12,fontWeight:'900',color:'white'},
  });
};
