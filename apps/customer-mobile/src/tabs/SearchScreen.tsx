import { AppTextInput as TextInput } from '@makanza/mobile-ui';
import { AppText as Text } from '@makanza/mobile-ui';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { ScreenHeader } from '../components/ui';
import type { Vendor } from '@makanza/mobile-core';
import { darkColors, lightColors } from '../theme/colors';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';

type Props={
  query:string;recentSearches:string[];vendors:Vendor[];loading:boolean;error:string;dark:boolean;
  onQuery:(value:string)=>void;onSearch:(term?:string)=>void;onRecentSearch:(term:string)=>void;
  onClearRecent:()=>void;onOpen:(vendor:Vendor)=>void;onRetry:()=>void;
};
const popularSearches=['Jollof rice','Suya','Healthy bowls','Groceries'];

export default function SearchScreen({query,recentSearches,vendors,loading,error,dark,onQuery,onSearch,onRecentSearch,onClearRecent,onOpen,onRetry}:Props){
  const colors=dark?darkColors:lightColors;
  const c=customerPalette(colors);
  const s=styles(c);
  return <View style={s.screen}>
    <ScreenHeader title="Explore" subtitle="Find a favourite around you" icon="search-outline" colors={colors}/>
    <View style={s.searchBox}>
      <Ionicons name="search-outline" size={20} color={c.primary}/>
      <TextInput value={query} onChangeText={onQuery} onSubmitEditing={()=>onSearch(query)} placeholder="Dishes, shops, or cuisines" placeholderTextColor={c.muted} returnKeyType="search" style={s.input}/>
      {!!query&&<Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={()=>onQuery('')} hitSlop={8}><Ionicons name="close" size={19} color={c.muted}/></Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={()=>onSearch(query)} style={s.searchButton}><Ionicons name="arrow-forward" size={18} color="white"/></Pressable>
    </View>
    <ScrollView style={s.content} keyboardShouldPersistTaps="handled">
      {recentSearches.length>0&&<View style={s.section}>
        <View style={s.sectionHeading}><Text style={s.sectionTitle}>Recent searches</Text><Pressable accessibilityRole="button" onPress={onClearRecent} hitSlop={8}><Text style={s.action}>Clear</Text></Pressable></View>
        <View style={s.chips}>{recentSearches.map(term=><Pressable key={term} accessibilityRole="button" onPress={()=>onRecentSearch(term)} style={s.chip}><Ionicons name="time-outline" size={14} color={c.muted}/><Text style={s.chipText}>{term}</Text></Pressable>)}</View>
      </View>}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Popular searches</Text>
        <View style={s.chips}>{popularSearches.map(term=><Pressable key={term} accessibilityRole="button" onPress={()=>{onQuery(term);onSearch(term);}} style={s.chip}><Text style={s.chipText}>{term}</Text><Ionicons name="arrow-top-left" size={14} color={c.muted}/></Pressable>)}</View>
      </View>
      <View style={s.resultsHeading}>
        <View><Text style={s.sectionTitle}>{query.trim()?`Results for “${query.trim()}”`:'Nearby places'}</Text><Text style={s.subtitle}>{vendors.length} {vendors.length===1?'place':'places'} to explore</Text></View>
      </View>
      {loading&&!vendors.length?<ActivityIndicator color={c.primary} style={s.loader}/>
      :error&&!vendors.length?<View style={s.state}><View style={s.stateIcon}><Ionicons name="alert-circle-outline" size={22} color={c.danger}/></View><Text style={s.stateTitle}>Search is unavailable</Text><Text style={s.stateText}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={s.retry}><Text style={s.retryText}>Try again</Text></Pressable></View>
      :!vendors.length?<View style={s.state}><View style={s.stateIcon}><Ionicons name="search-outline" size={22} color={c.primary}/></View><Text style={s.stateTitle}>{query.trim()?'No matches yet':'No places nearby yet'}</Text><Text style={s.stateText}>{query.trim()?'Try another dish, shop, or neighbourhood.':'Try a popular search to discover places around you.'}</Text></View>
      :<FlatList data={vendors} keyExtractor={item=>item.id} scrollEnabled={false} renderItem={({item})=><Pressable accessibilityRole="button" accessibilityHint={`Opens the ${item.name} menu`} onPress={()=>onOpen(item)} style={({pressed})=>[s.result,pressed&&s.pressed]}>
        {item.image?<Image source={{uri:item.image}} style={s.image}/>:<View style={s.imageFallback}><Ionicons name="storefront-outline" size={21} color={c.primary}/></View>}
        <View style={s.copy}>
          <View style={s.resultTop}><Text numberOfLines={1} style={s.name}>{item.name}</Text><View style={s.rating}><Ionicons name="star" size={12} color={c.accent}/><Text style={s.ratingText}>{item.rating?.toFixed(1)??'New'}</Text></View></View>
          <Text style={s.meta} numberOfLines={1}>{item.cuisine} · {item.neighborhood}</Text>
          <Text style={s.delivery} numberOfLines={1}>{item.eta} · delivery ₦{item.fee.toLocaleString('en-NG')}</Text>
          {item.demo&&<Text style={s.demo}>DEMO KITCHEN</Text>}
        </View><Ionicons name="chevron-forward" size={18} color={c.muted}/>
      </Pressable>}/>}
    </ScrollView>
  </View>;
}

const styles=(c:ReturnType<typeof customerPalette>)=>StyleSheet.create({
  screen:{flex:1,backgroundColor:c.canvas},
  searchBox:{minHeight:54,flexDirection:'row',alignItems:'center',gap:10,paddingLeft:14,paddingRight:6,marginHorizontal:customerSpace.lg,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.md,backgroundColor:c.surface},
  input:{flex:1,minWidth:0,height:50,fontSize:14,color:c.ink},
  searchButton:{width:42,height:42,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:c.primary},
  content:{flex:1},
  section:{marginTop:customerSpace.xl,paddingHorizontal:customerSpace.lg},
  sectionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10},
  sectionTitle:{fontSize:16,lineHeight:21,fontWeight:'800',letterSpacing:-.3,color:c.ink},
  action:{fontSize:11,fontWeight:'800',color:c.primary},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:10},
  chip:{minHeight:36,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:11,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.pill,backgroundColor:c.surface},
  chipText:{fontSize:11,fontWeight:'700',color:c.ink},
  resultsHeading:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginTop:customerSpace.section,paddingHorizontal:customerSpace.lg,paddingBottom:customerSpace.sm},
  subtitle:{fontSize:11,color:c.muted,marginTop:3},
  loader:{margin:28},
  state:{alignItems:'center',padding:22,marginHorizontal:customerSpace.lg,marginTop:8,borderRadius:customerRadius.lg,backgroundColor:c.surface},
  stateIcon:{width:42,height:42,borderRadius:customerRadius.md,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
  stateTitle:{fontSize:14,fontWeight:'800',color:c.ink,marginTop:10},
  stateText:{fontSize:11,lineHeight:17,color:c.muted,textAlign:'center',marginTop:5},
  retry:{minHeight:40,justifyContent:'center',paddingHorizontal:16,borderRadius:customerRadius.sm,backgroundColor:c.primary,marginTop:12},
  retryText:{fontSize:11,fontWeight:'800',color:'white'},
  result:{minHeight:92,flexDirection:'row',alignItems:'center',gap:11,padding:10,marginHorizontal:customerSpace.lg,marginTop:8,borderWidth:1,borderColor:c.border,borderRadius:customerRadius.md,backgroundColor:c.surface},
  image:{width:68,height:68,borderRadius:customerRadius.sm,backgroundColor:c.surfaceAlt},
  imageFallback:{width:68,height:68,borderRadius:customerRadius.sm,alignItems:'center',justifyContent:'center',backgroundColor:c.primarySoft},
  copy:{flex:1,minWidth:0},
  resultTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:7},
  name:{flex:1,fontSize:13,fontWeight:'800',color:c.ink},
  rating:{flexDirection:'row',alignItems:'center',gap:3},
  ratingText:{fontSize:10,fontWeight:'800',color:c.ink},
  meta:{fontSize:10,lineHeight:14,color:c.muted,marginTop:4},
  delivery:{fontSize:10,lineHeight:14,fontWeight:'700',color:c.primary,marginTop:4},
  demo:{fontSize:8,lineHeight:12,fontWeight:'900',letterSpacing:.6,color:c.accent,marginTop:4},
  pressed:{opacity:.78},
});
