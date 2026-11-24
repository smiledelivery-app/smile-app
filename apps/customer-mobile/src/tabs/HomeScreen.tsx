import { AppTextInput as TextInput } from '@makanza/mobile-ui';
import { AppText as Text } from '@makanza/mobile-ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import EmptyBasketIllustration from '../components/EmptyBasketIllustration';
import type { Product, Vendor } from '@makanza/mobile-core';
import { distanceInKm } from '../utils/distance';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';
import { darkColors, lightColors } from '../theme/colors';

type PopularProduct={product:Product;vendor:Vendor};
type UserLocation={latitude:number;longitude:number};
type Props={vendors:Vendor[];userLocation:UserLocation|null;popularProducts:PopularProduct[];popularLoading:boolean;popularError:string;loading:boolean;error:string;query:string;dark:boolean;onQuery:(value:string)=>void;onSearch:(term?:string)=>void;onOpen:(vendor:Vendor)=>void;onRetry:()=>void};
type CategoryName='All'|'Restaurants'|'Pharmacy'|'Groceries'|'Pickup'|'Markets'|'Bakery'|'Drinks';
type CategoryIconName='view-grid-outline'|'silverware-fork-knife'|'medical-bag'|'basket'|'bike-fast'|'storefront-outline'|'hamburger'|'bottle-soda';
type Category={name:CategoryName;term:string;icon:CategoryIconName;lightBackground:string;darkBackground:string;lightIcon:string;darkIcon:string};
const categories:Category[]=[
  {name:'All',term:'',icon:'view-grid-outline',lightBackground:'#eaf4ee',darkBackground:'#16281e',lightIcon:'#1b5b42',darkIcon:'#87c6a0'},
  {name:'Restaurants',term:'restaurant',icon:'silverware-fork-knife',lightBackground:'#fef4e2',darkBackground:'#2d2417',lightIcon:'#b07412',darkIcon:'#f4d57c'},
  {name:'Pharmacy',term:'pharmacy',icon:'medical-bag',lightBackground:'#eff4fe',darkBackground:'#1b2436',lightIcon:'#3f67a8',darkIcon:'#a6c1f0'},
  {name:'Groceries',term:'groceries',icon:'basket',lightBackground:'#eff7ee',darkBackground:'#1c2b1e',lightIcon:'#3d783a',darkIcon:'#a8d09f'},
  {name:'Pickup',term:'pickup',icon:'bike-fast',lightBackground:'#eaf6f6',darkBackground:'#19282b',lightIcon:'#2e7577',darkIcon:'#9bd0d0'},
  {name:'Markets',term:'market',icon:'storefront-outline',lightBackground:'#fef0e4',darkBackground:'#302218',lightIcon:'#bf621a',darkIcon:'#ffd7a3'},
  {name:'Bakery',term:'bakery',icon:'hamburger',lightBackground:'#f9eefa',darkBackground:'#281c2b',lightIcon:'#854b91',darkIcon:'#d5abe0'},
  {name:'Drinks',term:'drinks',icon:'bottle-soda',lightBackground:'#eff1fe',darkBackground:'#1e2238',lightIcon:'#505ea5',darkIcon:'#adbaf4'},
];
const heroSlides=[
  {
    background:'#de6e35',
    accentPill:'rgba(255,255,255,0.22)',
    orbColor1:'rgba(255,255,255,0.14)',
    orbColor2:'rgba(0,0,0,0.06)',
    foreground:'#ffffff',
    secondary:'#fef2ea',
    inactiveDot:'rgba(255,255,255,0.45)',
    eyebrow:'THE NEIGHBOURHOOD TABLE',
    headline:'Good things,\nclose by.',
    subhead:'Meals and everyday essentials from places around you.',
  },
  {
    background:'#d6a542',
    accentPill:'rgba(20,48,34,0.12)',
    orbColor1:'rgba(255,255,255,0.25)',
    orbColor2:'rgba(20,48,34,0.06)',
    foreground:'#153625',
    secondary:'#374d41',
    inactiveDot:'rgba(21,54,37,0.3)',
    eyebrow:'MORE TO DISCOVER',
    headline:'Meals, market\nruns, and more.',
    subhead:'Explore nearby kitchens and everyday essentials in one place.',
  },
  {
    background:'#1a543e',
    accentPill:'rgba(255,255,255,0.2)',
    orbColor1:'rgba(255,255,255,0.12)',
    orbColor2:'rgba(0,0,0,0.08)',
    foreground:'#ffffff',
    secondary:'#d9e8df',
    inactiveDot:'rgba(255,255,255,0.45)',
    eyebrow:'YOUR ORDER, IN VIEW',
    headline:'Choose a kitchen.\nTrack every step.',
    subhead:'Browse nearby menus, place your order, and follow its progress.',
  },
] as const;
const money=(minor:number)=>`₦${(minor/100).toLocaleString('en-NG')}`;

function SafeItemImage({
  productImage,
  storeImage,
  style,
  fallbackStyle,
  icon='restaurant-outline',
  iconSize=24,
  iconColor,
}:{
  productImage?:string|null;
  storeImage?:string|null;
  style:any;
  fallbackStyle:any;
  icon?:any;
  iconSize?:number;
  iconColor:string;
}){
  const [triedStore,setTriedStore]=useState(false);
  const [failed,setFailed]=useState(false);
  const productUri=productImage?.trim()||null;
  const storeUri=storeImage?.trim()||null;
  const activeUri=!failed?(!triedStore&&productUri?productUri:storeUri):null;

  if(activeUri){
    return <Image
      source={{uri:activeUri}}
      style={style}
      onError={()=>{
        if(!triedStore&&productUri&&storeUri&&productUri!==storeUri){
          setTriedStore(true);
        }else{
          setFailed(true);
        }
      }}
    />;
  }
  return <View style={fallbackStyle}>
    <Ionicons name={icon} size={iconSize} color={iconColor}/>
  </View>;
}

function travelText(vendor:Vendor,userLocation:UserLocation|null){
  const eta=vendor.eta==='Estimate at checkout'?'ETA at checkout':vendor.eta;
  if(!userLocation||vendor.latitude==null||vendor.longitude==null)return `${eta} · distance unavailable`;
  const km=distanceInKm(userLocation,{latitude:vendor.latitude,longitude:vendor.longitude});
  return km===null?`${eta} · distance unavailable`:`${eta} · about ${km.toFixed(1)} km`;
}

export default function HomeScreen({vendors,userLocation,popularProducts,popularLoading,popularError,loading,error,query,dark,onQuery,onSearch,onOpen,onRetry}:Props){
  const c=customerPalette(dark?darkColors:lightColors);
  const s=styles(c);
  const [selectedCategory,setSelectedCategory]=useState('');
  const [heroWidth,setHeroWidth]=useState(0);
  const [heroIndex,setHeroIndex]=useState(0);
  const heroRef=useRef<ScrollView|null>(null);
  const activeHeroSlide=heroSlides[heroIndex]??heroSlides[0];
  const featuredVendors=vendors.filter(vendor=>!vendor.demo||vendor.cuisine.toLowerCase().includes('restaurant')).slice(0,6);

  useEffect(()=>{
    if(heroWidth<=0)return;
    const timer=setInterval(()=>{
      const next=(heroIndex+1)%heroSlides.length;
      heroRef.current?.scrollTo({x:next*heroWidth,animated:true});
      setHeroIndex(next);
    },5000);
    return()=>clearInterval(timer);
  },[heroIndex,heroWidth]);

  const search=()=>onSearch(query);
  const selectCategory=(category:Category)=>{
    setSelectedCategory(category.term);
    onQuery(category.term);
    onSearch(category.term);
  };

  return <FlatList
    data={vendors}
    keyExtractor={item=>item.id}
    contentContainerStyle={s.list}
    keyboardShouldPersistTaps="handled"
    refreshing={loading}
    onRefresh={onRetry}
    ListHeaderComponent={<>
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={20} color={c.primary}/>
        <TextInput value={query} onChangeText={(value:string)=>{setSelectedCategory('');onQuery(value);}} onSubmitEditing={search} returnKeyType="search" placeholder="Dishes, shops, or cuisines" placeholderTextColor={c.muted} style={s.searchInput}/>
        {!!query&&<Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={()=>onQuery('')} hitSlop={8}><Ionicons name="close" size={19} color={c.muted}/></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel="Search nearby places" onPress={search} style={s.searchAction}><Ionicons name="arrow-forward" size={19} color="white"/></Pressable>
      </View>

      <View style={s.heroViewport} onLayout={(event:LayoutChangeEvent)=>setHeroWidth(event.nativeEvent.layout.width)}>
        {heroWidth>0&&<ScrollView
          ref={heroRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event:NativeSyntheticEvent<NativeScrollEvent>)=>setHeroIndex(Math.min(heroSlides.length-1,Math.max(0,Math.round(event.nativeEvent.contentOffset.x/heroWidth))))}
        >
          {heroSlides.map((slide,index)=><View key={index} style={[s.heroCard,{width:heroWidth,backgroundColor:slide.background}]}>
            <View style={[s.heroOrb1,{backgroundColor:slide.orbColor1}]}/>
            <View style={[s.heroOrb2,{backgroundColor:slide.orbColor2}]}/>
            <View style={[s.eyebrowBadge,{backgroundColor:slide.accentPill}]}>
              <Text style={[s.eyebrow,{color:slide.foreground}]}>{slide.eyebrow}</Text>
            </View>
            <Text style={[s.headline,{color:slide.foreground},slide.foreground==='#ffffff'&&s.whiteTextShadow]}>{slide.headline}</Text>
            <Text style={[s.subhead,{color:slide.secondary},slide.foreground==='#ffffff'&&s.whiteTextShadow]}>{slide.subhead}</Text>
            <Text style={[s.slideCount,{color:slide.secondary},slide.foreground==='#ffffff'&&s.whiteTextShadow]}>{String(index+1).padStart(2,'0')} / {String(heroSlides.length).padStart(2,'0')}</Text>
          </View>)}
        </ScrollView>}
        <View accessibilityLabel={`Slide ${heroIndex+1} of ${heroSlides.length}`} style={s.pagination}>
          {heroSlides.map((slide,index)=><Pressable
            key={slide.background}
            accessibilityRole="button"
            accessibilityLabel={`Show slide ${index+1}`}
            accessibilityState={{selected:heroIndex===index}}
            onPress={()=>{heroRef.current?.scrollTo({x:index*heroWidth,animated:true});setHeroIndex(index);}}
            style={[s.paginationDot,{backgroundColor:heroIndex===index?activeHeroSlide.foreground:activeHeroSlide.inactiveDot},heroIndex===index&&s.paginationDotActive]}
          />)}
        </View>
      </View>

      <View style={s.categoryGrid}>
        {categories.map(category=>{
          const selected=(selectedCategory===''&&category.name==='All')||selectedCategory===category.term;
          const iconColor=dark?category.darkIcon:category.lightIcon;
          return <Pressable key={category.name} accessibilityRole="button" accessibilityState={{selected}} onPress={()=>selectCategory(category)} style={s.category}>
            <View style={[s.categoryIconBox,{backgroundColor:dark?category.darkBackground:category.lightBackground},selected&&s.categorySelectedIconBox]}>
              <MaterialCommunityIcons name={category.icon} size={23} color={iconColor}/>
            </View>
            <Text style={[s.categoryText,selected&&s.categoryTextSelected]} numberOfLines={1}>{category.name}</Text>
          </Pressable>;
        })}
      </View>

      {featuredVendors.length>0&&<View style={s.section}>
        <View style={s.sectionHeading}><View><Text style={s.sectionTitle}>Neighbourhood favourites</Text><Text style={s.sectionSubtitle}>Places worth knowing</Text></View><Pressable accessibilityRole="button" onPress={()=>onSearch('restaurant')} hitSlop={8}><Text style={s.seeAll}>Explore</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.featuredList}>
          {featuredVendors.map(vendor=><Pressable key={vendor.id} accessibilityRole="button" accessibilityHint={`Opens the ${vendor.name} menu`} onPress={()=>onOpen(vendor)} style={s.featuredCard}>
            <SafeItemImage storeImage={vendor.image} style={s.featuredImage} fallbackStyle={s.imageFallback} iconColor={c.primary} iconSize={25}/>
            <View style={s.featuredDetails}>
              <View style={s.vendorTitleRow}><Text numberOfLines={1} style={s.vendorTitle}>{vendor.name}</Text><View style={s.rating}><Ionicons name="star" size={12} color={c.accent}/><Text style={s.ratingText}>{vendor.rating?.toFixed(1)??'New'}</Text></View></View>
              <Text numberOfLines={1} style={s.meta}>{vendor.cuisine} · {vendor.neighborhood}</Text>
              <Text numberOfLines={1} style={s.deliveryMeta}>{travelText(vendor,userLocation)} · {money(vendor.fee*100)} delivery</Text>
            </View>
          </Pressable>)}
        </ScrollView>
      </View>}

      <View style={s.section}>
        <View style={s.sectionHeading}><View><Text style={s.sectionTitle}>Popular near you</Text><Text style={s.sectionSubtitle}>Dishes people are enjoying</Text></View><Pressable accessibilityRole="button" onPress={()=>onSearch()} hitSlop={8}><Text style={s.seeAll}>See all</Text></Pressable></View>
        {popularLoading&&!popularProducts.length?<ActivityIndicator color={c.primary} style={s.loader}/>
        :popularProducts.length===0?popularError?<View style={s.inlineState}><Ionicons name="alert-circle-outline" size={19} color={c.danger}/><Text style={s.inlineStateText}>{popularError}</Text></View>
        :<View style={s.emptyState}><View accessibilityRole="image" accessibilityLabel="Empty basket illustration" style={s.emptyBasket}><EmptyBasketIllustration primary={c.primary} accent={c.accent}/></View><Text style={s.stateTitle}>No popular dishes yet</Text><Text style={s.stateText}>Dishes will appear here as nearby kitchens add their menus.</Text></View>
        :<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.popularList}>
          {popularProducts.slice(0,12).map(({product,vendor})=><Pressable key={`${vendor.id}:${product.id}`} accessibilityRole="button" accessibilityHint={`Browse ${vendor.name}'s menu`} onPress={()=>onOpen(vendor)} style={s.popularCard}>
            <SafeItemImage productImage={product.imageUrl} storeImage={vendor.image} style={s.popularImage} fallbackStyle={s.popularFallback} iconColor={c.primary} iconSize={24}/>
            <Text numberOfLines={1} style={s.popularName}>{product.name}</Text><Text numberOfLines={1} style={s.popularVendor}>{vendor.name}</Text><Text style={s.popularPrice}>{money(product.priceMinor)}</Text>
          </Pressable>)}
        </ScrollView>}
        {popularError&&popularProducts.length>0?<Text style={s.softError}>{popularError}</Text>:null}
      </View>

      <View style={s.sectionHeadingList}><View><Text style={s.sectionTitle}>All nearby places</Text><Text style={s.sectionSubtitle}>Browse what’s open around you</Text></View><Text style={s.count}>{vendors.length} places</Text></View>
      {loading&&!vendors.length?<ActivityIndicator color={c.primary} style={s.loader}/>
      :error&&!vendors.length?<View style={s.state}><View style={s.stateIcon}><Ionicons name="alert-circle-outline" size={22} color={c.danger}/></View><Text style={s.stateTitle}>Places didn’t load</Text><Text style={s.stateText}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={s.retry}><Text style={s.retryText}>Try again</Text></Pressable></View>
      :!vendors.length?<View style={s.state}><View accessibilityRole="image" accessibilityLabel="Empty basket illustration" style={s.emptyBasket}><EmptyBasketIllustration primary={c.primary} accent={c.accent}/></View><Text style={s.stateTitle}>No places nearby yet</Text><Text style={s.stateText}>Try another category or check back later.</Text></View>:null}
    </>}
    renderItem={({item})=><Pressable accessibilityRole="button" accessibilityHint={`Opens the ${item.name} menu`} onPress={()=>onOpen(item)} style={({pressed})=>[s.vendorRow,pressed&&s.pressed]}>
      <SafeItemImage storeImage={item.image} style={s.vendorImage} fallbackStyle={s.vendorFallback} iconColor={c.primary} icon="storefront-outline" iconSize={23}/>
      <View style={s.vendorCopy}>
        <View style={s.vendorTitleRow}><Text style={s.vendorTitle} numberOfLines={1}>{item.name}</Text><View style={s.rating}><Ionicons name="star" size={12} color={c.accent}/><Text style={s.ratingText}>{item.rating?.toFixed(1)??'New'}</Text></View></View>
        <Text style={s.meta} numberOfLines={1}>{item.cuisine} · {item.neighborhood}</Text>
        <Text style={s.deliveryMeta} numberOfLines={1}>{travelText(item,userLocation)} · {money(item.fee*100)} delivery</Text>
        {item.demo&&<Text style={s.demoTag}>DEMO KITCHEN</Text>}
      </View>
      <Ionicons name="chevron-forward" size={19} color={c.muted}/>
    </Pressable>}
    ListFooterComponent={<View style={s.footer}/>}
  />;
}

const styles=(c:ReturnType<typeof customerPalette>)=>StyleSheet.create({
  list:{paddingBottom:customerSpace.lg,backgroundColor:c.canvas},
  heroViewport:{marginHorizontal:customerSpace.lg,marginTop:customerSpace.lg,marginBottom:customerSpace.sm,borderRadius:customerRadius.lg,overflow:'hidden',borderWidth:1,borderColor:c.border,shadowColor:'#000',shadowOffset:{width:0,height:3},shadowOpacity:.06,shadowRadius:8,elevation:2},
  heroCard:{height:164,justifyContent:'center',paddingHorizontal:customerSpace.lg,paddingVertical:customerSpace.sm,overflow:'hidden',position:'relative'},
  heroOrb1:{position:'absolute',top:-32,right:-24,width:160,height:160,borderRadius:80},
  heroOrb2:{position:'absolute',bottom:-36,right:50,width:110,height:110,borderRadius:55},
  eyebrowBadge:{alignSelf:'flex-start',paddingHorizontal:8,paddingVertical:3,borderRadius:customerRadius.pill,marginBottom:2},
  eyebrow:{fontSize:9,lineHeight:13,fontWeight:'900',letterSpacing:1.2},
  headline:{fontSize:28,lineHeight:32,fontWeight:'900',letterSpacing:-1,marginTop:4},
  subhead:{maxWidth:270,fontSize:11,lineHeight:16,marginTop:5},
  whiteTextShadow:{textShadowColor:'rgba(0,0,0,.15)',textShadowOffset:{width:0,height:1},textShadowRadius:3},
  slideCount:{position:'absolute',right:customerSpace.lg,bottom:customerSpace.md,fontSize:9,fontWeight:'900',letterSpacing:1},
  pagination:{position:'absolute',bottom:customerSpace.md,left:customerSpace.lg,flexDirection:'row',alignItems:'center',gap:6},
  paginationDot:{width:6,height:6,borderRadius:3},
  paginationDotActive:{width:18},
  searchRow:{minHeight:54,flexDirection:'row',alignItems:'center',gap:10,paddingLeft:14,paddingRight:6,marginHorizontal:customerSpace.lg,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.md,backgroundColor:c.surface},
  searchInput:{flex:1,minWidth:0,height:50,fontSize:14,color:c.ink},
  searchAction:{width:42,height:42,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:c.primary},
  categoryGrid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:10,paddingHorizontal:customerSpace.lg,paddingTop:customerSpace.md,paddingBottom:customerSpace.lg},
  category:{width:'23%',minHeight:76,alignItems:'center',justifyContent:'flex-start',gap:6},
  categoryIconBox:{width:50,height:50,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.md,borderWidth:1,borderColor:c.border},
  categorySelectedIconBox:{borderColor:c.primary,borderWidth:2,shadowColor:c.primary,shadowOffset:{width:0,height:2},shadowOpacity:.15,shadowRadius:4,elevation:2},
  categoryText:{fontSize:10,fontWeight:'700',color:c.ink,textAlign:'center'},
  categoryTextSelected:{color:c.primary,fontWeight:'900'},
  section:{marginTop:customerSpace.md},
  sectionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,paddingHorizontal:customerSpace.lg,marginBottom:customerSpace.md},
  sectionHeadingList:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:8,paddingHorizontal:customerSpace.lg,paddingTop:customerSpace.section,paddingBottom:customerSpace.sm},
  sectionTitle:{fontSize:20,lineHeight:25,fontWeight:'900',letterSpacing:-.6,color:c.ink},
  sectionSubtitle:{fontSize:11,lineHeight:16,color:c.muted,marginTop:3},
  seeAll:{fontSize:12,fontWeight:'800',color:c.primary},
  featuredList:{paddingHorizontal:customerSpace.lg,gap:11},
  featuredCard:{width:250,overflow:'hidden',borderWidth:1,borderColor:c.border,borderRadius:customerRadius.lg,backgroundColor:c.surface},
  featuredImage:{width:'100%',height:124,backgroundColor:c.surfaceAlt},
  imageFallback:{width:'100%',height:124,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
  featuredDetails:{padding:12},
  vendorTitleRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  vendorTitle:{flex:1,fontSize:14,lineHeight:19,fontWeight:'800',color:c.ink},
  rating:{flexDirection:'row',alignItems:'center',gap:3},
  ratingText:{fontSize:10,fontWeight:'800',color:c.ink},
  meta:{fontSize:10,lineHeight:15,color:c.muted,marginTop:4},
  deliveryMeta:{fontSize:10,lineHeight:15,fontWeight:'700',color:c.primary,marginTop:5},
  popularList:{paddingHorizontal:customerSpace.lg,gap:10},
  popularCard:{width:148,padding:8,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.md,backgroundColor:c.surface},
  popularImage:{width:'100%',height:94,borderRadius:customerRadius.sm,backgroundColor:c.surfaceAlt},
  popularFallback:{width:'100%',height:94,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
  popularName:{fontSize:12,lineHeight:16,fontWeight:'800',color:c.ink,marginTop:8},
  popularVendor:{fontSize:10,lineHeight:14,color:c.muted,marginTop:2},
  popularPrice:{fontSize:11,lineHeight:15,fontWeight:'900',color:c.primary,marginTop:6},
  inlineState:{flexDirection:'row',alignItems:'center',gap:9,padding:14,marginHorizontal:customerSpace.lg,borderRadius:customerRadius.md,backgroundColor:c.surfaceAlt},
  inlineStateText:{flex:1,fontSize:11,lineHeight:16,color:c.muted},
  softError:{fontSize:10,lineHeight:15,color:c.danger,marginHorizontal:customerSpace.lg,marginTop:8},
  count:{fontSize:10,lineHeight:15,color:c.muted},
  vendorRow:{minHeight:98,flexDirection:'row',alignItems:'center',gap:12,padding:11,marginHorizontal:customerSpace.lg,marginTop:9,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.md,backgroundColor:c.surface},
  vendorImage:{width:72,height:72,borderRadius:customerRadius.sm,backgroundColor:c.surfaceAlt},
  vendorFallback:{width:72,height:72,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
  vendorCopy:{flex:1,minWidth:0},
  demoTag:{fontSize:8,lineHeight:12,fontWeight:'900',letterSpacing:.7,color:c.accent,marginTop:5},
  pressed:{opacity:.82},
  loader:{margin:20},
  state:{alignItems:'center',padding:22,marginHorizontal:customerSpace.lg,marginTop:8,borderRadius:customerRadius.lg,backgroundColor:c.surface},
  stateIcon:{width:42,height:42,borderRadius:customerRadius.md,alignItems:'center',justifyContent:'center',backgroundColor:c.accentSoft},
  emptyState:{alignItems:'center',padding:18,marginHorizontal:customerSpace.lg,borderRadius:customerRadius.md,backgroundColor:c.surfaceAlt},
  emptyBasket:{width:52,height:52,alignItems:'center',justifyContent:'center',borderRadius:customerRadius.md,backgroundColor:c.primarySoft},
  stateTitle:{fontSize:14,lineHeight:19,fontWeight:'800',color:c.ink,marginTop:10},
  stateText:{fontSize:11,lineHeight:17,color:c.muted,textAlign:'center',marginTop:4},
  retry:{minHeight:40,justifyContent:'center',paddingHorizontal:16,borderRadius:customerRadius.sm,backgroundColor:c.primary,marginTop:12},
  retryText:{fontSize:11,fontWeight:'800',color:'white'},
  footer:{height:18},
});
