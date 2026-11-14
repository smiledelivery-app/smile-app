import { AppTextInput as TextInput } from '@makanza/mobile-ui';
import { AppText as Text } from '@makanza/mobile-ui';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, ImageBackground, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { Ionicons } from '../components/AppIcon';
import type { Product, Vendor } from '@makanza/mobile-core';
import { distanceInKm } from '../utils/distance';

type PopularProduct={product:Product;vendor:Vendor};
type UserLocation={latitude:number;longitude:number};
type Props={vendors:Vendor[];userLocation:UserLocation|null;popularProducts:PopularProduct[];popularLoading:boolean;popularError:string;loading:boolean;error:string;query:string;dark:boolean;onQuery:(value:string)=>void;onSearch:(term?:string)=>void;onOpen:(vendor:Vendor)=>void;onRetry:()=>void};
const heroSlides=[
  'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1100&q=85',
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1100&q=85',
  'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1100&q=85',
];
type CategoryArt='all'|'restaurant'|'pharmacy'|'groceries'|'pickup'|'market';
const categories:{art:CategoryArt;name:string;term:string}[]=[
  {art:'all',name:'All',term:''},
  {art:'restaurant',name:'Restaurants',term:'restaurant'},
  {art:'pharmacy',name:'Pharmacies',term:'pharmacy'},
  {art:'groceries',name:'Groceries',term:'groceries'},
  {art:'pickup',name:'Pickup',term:'pickup'},
  {art:'market',name:'Local markets',term:'market'},
];
const searchFilters=[
  {label:'All',term:''},
  {label:'Restaurants',term:'restaurant'},
  {label:'Pharmacy',term:'pharmacy'},
  {label:'Groceries',term:'groceries'},
];

function CategoryArtwork({type}:{type:CategoryArt}){
  if(type==='all')return <Svg width={58} height={58} viewBox="0 0 40 40"><Ellipse cx="20" cy="24" rx="14" ry="9" fill="#f3dcb7"/><Ellipse cx="20" cy="23" rx="10" ry="6" fill="#fff9ed"/><Circle cx="16" cy="22" r="2" fill="#e77e58"/><Circle cx="22" cy="24" r="2" fill="#71a86b"/><Circle cx="25" cy="20" r="1.7" fill="#f0bd52"/><Path d="M19 11c2-4 6-5 9-4-1 4-4 7-9 7" fill="#78a96c"/><Path d="M20 14l5-5" stroke="#4d885a" strokeWidth="1.5"/></Svg>;
  if(type==='restaurant')return <Svg width={58} height={58} viewBox="0 0 40 40"><Path d="M6 18 20 7l14 11v16H6z" fill="#f5e5c7" stroke="#bc8955" strokeWidth="1.5" strokeLinejoin="round"/><Path d="M4 19h32l-3-7H7z" fill="#e87854" stroke="#bc8955" strokeWidth="1.5" strokeLinejoin="round"/><Path d="M4 19c2 4 5 4 7 0 2 4 5 4 7 0 2 4 5 4 7 0 2 4 5 4 7 0 2 4 4 4 5 0" fill="#6b9b70"/><Rect x="14" y="24" width="12" height="10" rx="1" fill="#fff9ed" stroke="#bc8955" strokeWidth="1"/><Path d="M20 24v10m-6-5h12" stroke="#6b9b70" strokeWidth="1.5"/></Svg>;
  if(type==='pharmacy')return <Svg width={58} height={58} viewBox="0 0 40 40"><Rect x="11" y="13" width="18" height="21" rx="4" fill="#dff0e5" stroke="#4b936a" strokeWidth="1.5"/><Rect x="14" y="8" width="12" height="6" rx="2" fill="#79b78b"/><Path d="M20 18v10m-5-5h10" stroke="#398158" strokeWidth="3" strokeLinecap="round"/><Circle cx="30" cy="10" r="4" fill="#f2c65d"/></Svg>;
  if(type==='groceries')return <Svg width={58} height={58} viewBox="0 0 40 40"><Path d="M10 15h20l-2 19H12z" fill="#f1dfbd" stroke="#c58d50" strokeWidth="1.5" strokeLinejoin="round"/><Path d="M15 16c0-5 2-8 5-8s5 3 5 8" fill="none" stroke="#8eaa6b" strokeWidth="2"/><Circle cx="17" cy="19" r="4" fill="#e87854"/><Path d="M17 15c1-3 4-3 5-2-1 2-3 3-5 2" fill="#6d9d64"/><Circle cx="25" cy="21" r="3.5" fill="#efbf52"/><Path d="M25 17c0-2 2-3 3-2-1 2-2 2-3 2" fill="#71a66c"/></Svg>;
  if(type==='pickup')return <Svg width={58} height={58} viewBox="0 0 40 40"><Circle cx="11" cy="29" r="6" fill="#fff5e5" stroke="#4b936a" strokeWidth="2"/><Circle cx="30" cy="29" r="6" fill="#fff5e5" stroke="#4b936a" strokeWidth="2"/><Path d="m11 29 6-10h7l6 10h-9l-4-6h-4m7-4h5m5 10 2-9h4" fill="none" stroke="#4b936a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><Path d="M15 17h8l2 3H15z" fill="#f1c15b"/><Circle cx="33" cy="19" r="2" fill="#e87854"/></Svg>;
  return <Svg width={58} height={58} viewBox="0 0 40 40"><Path d="M8 17h24l-2 17H10z" fill="#f5e5c7" stroke="#bc8955" strokeWidth="1.5" strokeLinejoin="round"/><Path d="M7 17l3-8h20l3 8" fill="#e5f0e2" stroke="#6b9b70" strokeWidth="1.5" strokeLinejoin="round"/><Path d="M7 17c2 4 5 4 7 0 2 4 5 4 7 0 2 4 5 4 7 0 2 4 4 4 5 0" fill="#e87854"/><Rect x="17" y="24" width="7" height="10" rx="1" fill="#fff9ed"/><Path d="M12 22h3m10 0h3" stroke="#71a66c" strokeWidth="2" strokeLinecap="round"/></Svg>;
}

function travelText(vendor:Vendor,userLocation:UserLocation|null){
  const eta=vendor.eta==='Estimate at checkout'?'ETA at checkout':vendor.eta;
  if(!userLocation||vendor.latitude==null||vendor.longitude==null)return `${eta} · distance unavailable`;
  const km=distanceInKm(userLocation,{latitude:vendor.latitude,longitude:vendor.longitude});
  return km===null?`${eta} · distance unavailable`:`${eta} · ~${km.toFixed(1)} km away`;
}

export default function HomeScreen({vendors,userLocation,popularProducts,popularLoading,popularError,loading,error,query,dark,onQuery,onSearch,onOpen,onRetry}:Props){
  const theme=dark?darkStyles:lightStyles;
  const {width:windowWidth}=useWindowDimensions();
  const heroPageWidth=windowWidth-32;
  const [activeHeroSlide,setActiveHeroSlide]=useState(0);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [selectedFilter,setSelectedFilter]=useState('');
  const heroScrollRef=useRef<ScrollView>(null);
  const featuredVendors=vendors.filter(vendor=>!vendor.demo||vendor.cuisine.toLowerCase().includes('restaurant')).slice(0,6);
  useEffect(()=>{
    const timer=setInterval(()=>{
      const next=(activeHeroSlide+1)%heroSlides.length;
      heroScrollRef.current?.scrollTo({x:next*heroPageWidth,animated:true});
      setActiveHeroSlide(next);
    },5000);
    return()=>clearInterval(timer);
  },[activeHeroSlide,heroPageWidth]);
  return <FlatList data={vendors} keyExtractor={item=>item.id} contentContainerStyle={s.list} keyboardShouldPersistTaps="handled"
    ListHeaderComponent={<>
      <View style={filterStyles.searchArea}>
        <View style={filterStyles.searchHeader}>
          <View style={[s.search,theme.surface,filterStyles.searchField]}><Ionicons name="search-outline" size={24} color={dark?'#a6d8b7':'#1d6147'}/><TextInput value={query} onChangeText={(value:string)=>{onQuery(value);setSelectedFilter('');}} onSubmitEditing={()=>onSearch(query)} placeholder="Dishes, groceries, kitchens..." placeholderTextColor={dark?'#b5bcb3':'#4f5451'} style={[s.searchInput,dark&&s.textDark]}/><Pressable accessibilityRole="button" onPress={()=>onSearch(query)}><Text style={s.searchAction}>Search</Text></Pressable></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Filter by category" accessibilityState={{expanded:filtersOpen}} onPress={()=>setFiltersOpen(open=>!open)} style={[filterStyles.toggle,dark&&filterStyles.toggleDark]}><Ionicons name="options-outline" size={18} color={dark?'#a6d8b7':'#1d6147'}/><Text style={[filterStyles.toggleText,dark&&s.textDark]}>Filter</Text></Pressable>
        </View>
        {filtersOpen&&<View style={[theme.surface,filterStyles.menu]}>{searchFilters.map(filter=><Pressable key={filter.label} accessibilityRole="button" accessibilityState={{selected:filter.term===selectedFilter}} onPress={()=>{setFiltersOpen(false);setSelectedFilter(filter.term);onQuery(filter.term);onSearch(filter.term);}} style={filterStyles.option}><Text style={[filterStyles.optionText,dark&&filterStyles.optionTextDark]}>{filter.label}</Text>{filter.term===selectedFilter&&<Ionicons name="checkmark" size={17} color={dark?'#a6d8b7':'#1d6147'}/>}</Pressable>)}</View>}
      </View>
      <View style={[s.hero,{borderRadius:0}]}>
        <ScrollView ref={heroScrollRef} horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false} onMomentumScrollEnd={event=>setActiveHeroSlide(Math.round(event.nativeEvent.contentOffset.x/heroPageWidth))}>
          {heroSlides.map((image,index)=><ImageBackground key={image} source={{uri:image}} style={[s.heroSlide,{width:heroPageWidth}]} imageStyle={[s.heroImage,{borderRadius:0}]} accessibilityLabel={`Food promotion ${index+1}`}><View style={s.shade}/></ImageBackground>)}
        </ScrollView>
        <View pointerEvents="none" style={s.heroContent}><Text style={s.kicker}>A GOOD DAY STARTS HERE</Text><Text style={s.heroTitle}>Your next favourite{'\n'}meal is close.</Text><Text style={s.heroBody}>The best of your neighbourhood, brought to your door.</Text></View>
        <View style={s.heroDots}>{heroSlides.map((image,index)=><Pressable key={image} accessibilityRole="button" accessibilityLabel={`Show hero slide ${index+1} of ${heroSlides.length}`} accessibilityState={{selected:activeHeroSlide===index}} onPress={()=>{heroScrollRef.current?.scrollTo({x:index*heroPageWidth,animated:true});setActiveHeroSlide(index);}} style={s.heroDotTouch}><View style={[s.heroDot,index===activeHeroSlide&&s.heroDotActive]}/></Pressable>)}</View>
      </View>
      <View style={s.categories}>{[0,1].map(row=><View key={row} style={s.categoryRow}>{categories.slice(row*3,row*3+3).map(category=><Pressable key={category.name} accessibilityRole="button" onPress={()=>{onQuery(category.term);onSearch(category.term);}} style={[s.category,theme.surface,{borderWidth:0}]}><CategoryArtwork type={category.art}/><Text numberOfLines={2} style={[s.categoryLabel,dark&&s.textDark]}>{category.name}</Text></Pressable>)}</View>)}</View>
      <View style={s.heading}><View><Text style={[s.headingTitle,dark&&s.textDark]}>Featured restaurants</Text><Text style={[s.headingSubtitle,dark&&s.mutedDark]}>Neighbourhood favourites, picked for you</Text></View><Pressable accessibilityRole="button" onPress={()=>onSearch('restaurant')}><Text style={s.seeAll}>SEE ALL  ›</Text></Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.featuredRow}>
        {featuredVendors.map(vendor=><Pressable key={vendor.id} accessibilityRole="button" onPress={()=>onOpen(vendor)} style={[s.featuredCard,theme.surface]}>
          <ImageBackground source={{uri:vendor.image||'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80'}} imageStyle={s.featuredImage} style={s.featuredPhoto}><View style={s.featuredShade}/><Text style={s.featuredRating}>★ {vendor.rating?.toFixed(1)??'4.8'}</Text></ImageBackground>
          <Text style={[s.featuredName,dark&&s.textDark]} numberOfLines={1}>{vendor.name}</Text><Text style={[s.featuredMeta,dark&&s.mutedDark]} numberOfLines={1}>{vendor.cuisine} · {vendor.neighborhood}</Text><Text style={s.travelMeta} numberOfLines={1}>{travelText(vendor,userLocation)}</Text>
        </Pressable>)}
      </ScrollView>
      <View style={s.heading}><View><Text style={[s.headingTitle,dark&&s.textDark]}>Popular near you</Text><Text style={[s.headingSubtitle,dark&&s.mutedDark]}>Dishes people are loving nearby</Text></View><Pressable accessibilityRole="button" onPress={()=>onSearch()}><Text style={s.seeAll}>SEE ALL  ›</Text></Pressable></View>
      {popularLoading&&!popularProducts.length?<ActivityIndicator color="#1d6147" style={{margin:12}}/>:popularProducts.length===0?<View style={s.state}><Text style={s.stateText}>{popularError||'Popular dishes will appear here when available.'}</Text></View>:<><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.popularRow}>{popularProducts.slice(0,12).map(({product,vendor})=><Pressable key={`${vendor.id}:${product.id}`} accessibilityRole="button" onPress={()=>onOpen(vendor)} style={[s.popularCard,theme.surface]}>
        {product.imageUrl?<Image source={{uri:product.imageUrl}} style={s.popularPhoto}/>:<View style={[s.popularPlaceholder,theme.soft]}><Ionicons name="restaurant-outline" size={28} color="#1d6147"/></View>}
        <Text style={[s.popularName,dark&&s.textDark]} numberOfLines={2}>{product.name}</Text><Text style={[s.popularVendor,dark&&s.mutedDark]} numberOfLines={1}>{vendor.name}</Text><Text style={s.popularTravel} numberOfLines={1}>{travelText(vendor,userLocation)}</Text><Text style={s.popularPrice}>₦{(product.priceMinor/100).toLocaleString('en-NG')}</Text>
      </Pressable>)}</ScrollView>{popularError?<Text style={s.stateText}>{popularError}</Text>:null}</>}
      <View style={s.heading}><View><Text style={[s.headingTitle,dark&&s.textDark]}>Around your area</Text><Text style={[s.headingSubtitle,dark&&s.mutedDark]}>Good food, made nearby</Text></View><Pressable accessibilityRole="button" onPress={()=>onSearch()}><Text style={s.seeAll}>SEE ALL  ›</Text></Pressable></View>
      {loading?<ActivityIndicator color="#1d6147" style={{margin:20}}/>:error?<View style={s.state}><Text style={s.stateText}>{error}</Text><Pressable onPress={onRetry}><Text style={s.seeAll}>Try again</Text></Pressable></View>:vendors.length===0?<View style={s.state}><Text style={s.stateText}>No kitchens are available in this area yet.</Text></View>:null}
    </>}
    renderItem={({item})=><Pressable accessibilityRole="button" onPress={()=>onOpen(item)} style={[s.vendorCard,theme.surface]}><Image source={{uri:item.image||'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80'}} style={s.vendorImage}/><View style={s.copy}><View style={s.vendorRow}><Text style={[s.vendorName,dark&&s.textDark]}>{item.name}</Text><Text style={s.rating}>★ {item.rating?.toFixed(1)??'4.8'}</Text></View><Text style={[s.meta,dark&&s.mutedDark]}>{item.cuisine} · {item.neighborhood}</Text><Text style={[s.meta,dark&&s.mutedDark]}>{travelText(item,userLocation)} · ₦{item.fee.toLocaleString('en-NG')} delivery</Text>{item.demo&&<Text style={s.demo}>DEMO KITCHEN</Text>}</View><Text style={s.heart}>♡</Text></Pressable>} ListFooterComponent={<View style={{height:20}}/>}/>;
}

const s=StyleSheet.create({list:{paddingBottom:15},search:{height:49,marginHorizontal:16,marginTop:12,marginBottom:12,paddingHorizontal:12,borderRadius:15,flexDirection:'row',alignItems:'center',gap:9},searchInput:{flex:1,height:47,fontSize:15,color:'#1f2321'},searchAction:{fontSize:12,fontWeight:'800',color:'#1d6147',padding:7},hero:{height:205,marginHorizontal:16,borderRadius:22,overflow:'hidden',backgroundColor:'#1d6147'},heroSlide:{height:'100%',justifyContent:'center'},heroImage:{borderRadius:22},shade:{...StyleSheet.absoluteFill,backgroundColor:'rgba(18,43,32,.5)'},heroContent:{...StyleSheet.absoluteFill,zIndex:1,padding:18,justifyContent:'center'},heroDots:{position:'absolute',bottom:7,alignSelf:'center',zIndex:2,flexDirection:'row',alignItems:'center'},heroDotTouch:{width:24,height:28,alignItems:'center',justifyContent:'center'},heroDot:{width:7,height:7,borderRadius:4,backgroundColor:'rgba(255,255,255,.65)'},heroDotActive:{width:19,backgroundColor:'white'},kicker:{fontSize:10,letterSpacing:1.5,fontWeight:'900',color:'#d8e5df',marginBottom:8},heroTitle:{fontSize:31,lineHeight:36,fontWeight:'800',letterSpacing:-.8,color:'white'},heroBody:{fontSize:12,lineHeight:18,color:'#f0f2e9',marginTop:7,maxWidth:240},categories:{paddingHorizontal:16,marginTop:14,rowGap:8},categoryRow:{flexDirection:'row',gap:8},category:{flex:1,minWidth:0,height:84,borderRadius:12,borderWidth:1,borderColor:'#e4e9e3',flexDirection:'column',alignItems:'center',justifyContent:'center',paddingHorizontal:6,gap:3},categoryLabel:{fontSize:10,lineHeight:13,color:'#4f5451',fontWeight:'700',flexShrink:1,textAlign:'center'},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginHorizontal:18,marginTop:20,marginBottom:1},headingTitle:{fontSize:22,fontWeight:'800',letterSpacing:-.5,color:'#1f2321'},headingSubtitle:{fontSize:12,color:'#4f5451',marginTop:3},seeAll:{fontSize:11,letterSpacing:.6,fontWeight:'900',color:'#1d6147'},featuredRow:{paddingHorizontal:16,paddingTop:10,gap:11},featuredCard:{width:Dimensions.get('window').width*.6,padding:9,borderRadius:17,backgroundColor:'white'},featuredPhoto:{height:104,borderRadius:12,overflow:'hidden',justifyContent:'flex-start',alignItems:'flex-end',padding:8,backgroundColor:'#1d6147'},featuredImage:{borderRadius:12},featuredShade:{...StyleSheet.absoluteFill,backgroundColor:'rgba(18,43,32,.18)'},featuredRating:{fontSize:11,fontWeight:'900',color:'#4f5451',backgroundColor:'white',paddingHorizontal:7,paddingVertical:4,borderRadius:10,overflow:'hidden'},featuredName:{fontSize:15,fontWeight:'900',color:'#1f2321',marginTop:8},featuredMeta:{fontSize:10,color:'#4f5451',marginTop:4},travelMeta:{fontSize:9.5,color:'#1d6147',fontWeight:'800',marginTop:3},popularRow:{paddingHorizontal:16,paddingTop:10,gap:9},popularCard:{width:Dimensions.get('window').width*.32,padding:8,borderRadius:15,backgroundColor:'white'},popularPhoto:{width:'100%',height:74,borderRadius:10,backgroundColor:'#f6f5f2'},popularPlaceholder:{width:'100%',height:74,borderRadius:10,alignItems:'center',justifyContent:'center'},popularName:{fontSize:11,fontWeight:'900',color:'#1f2321',marginTop:7,minHeight:26},popularVendor:{fontSize:9,color:'#4f5451',marginTop:2},popularTravel:{fontSize:8.5,color:'#1d6147',fontWeight:'800',marginTop:2},popularPrice:{fontSize:11,fontWeight:'900',color:'#1d6147',marginTop:5},vendorCard:{marginHorizontal:16,marginTop:11,padding:10,borderRadius:17,flexDirection:'row',alignItems:'center',gap:11},vendorImage:{width:84,height:84,borderRadius:13,backgroundColor:'#f6f5f2'},copy:{flex:1,gap:5},vendorRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:4},vendorName:{fontSize:15,fontWeight:'800',color:'#1f2321',flexShrink:1},rating:{fontSize:11,fontWeight:'800',color:'#4f5451'},meta:{fontSize:11,color:'#4f5451'},demo:{fontSize:9,fontWeight:'900',letterSpacing:.8,color:'#4f5451'},heart:{fontSize:24,color:'#b5bcb3'},state:{padding:25,alignItems:'center',gap:9},stateText:{fontSize:13,lineHeight:21,textAlign:'center',color:'#4f5451'},textDark:{color:'#eff0e7'},mutedDark:{color:'#b5bcb3'}});
const lightStyles=StyleSheet.create({surface:{backgroundColor:'white'},soft:{backgroundColor:'#f1f2e9'}});
const darkStyles=StyleSheet.create({surface:{backgroundColor:'#18251c',borderWidth:0},soft:{backgroundColor:'#1b2b20'}});
const filterStyles=StyleSheet.create({
  searchArea:{position:'relative',marginHorizontal:16,marginTop:12,marginBottom:12,zIndex:10},
  searchHeader:{flexDirection:'row',alignItems:'center',gap:8},
  searchField:{flex:1,marginHorizontal:0,marginTop:0,marginBottom:0},
  toggle:{minWidth:88,minHeight:40,paddingHorizontal:12,borderRadius:0,borderWidth:0,backgroundColor:'#f1f2e9',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,flexShrink:0},
  toggleDark:{backgroundColor:'#24352a'},
  toggleText:{fontSize:11,fontWeight:'800',color:'#1d6147'},
  menu:{position:'absolute',top:54,right:0,zIndex:11,width:200,paddingVertical:5,borderRadius:0,borderWidth:0,elevation:0,shadowOpacity:0},
  option:{minHeight:42,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  optionText:{fontSize:13,fontWeight:'700',color:'#1d6147'},
  optionTextDark:{color:'#eff0e7'},
});
