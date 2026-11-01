import { AppTextInput as TextInput } from '@makanza/mobile-ui';
import { AppText as Text } from '@makanza/mobile-ui';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '../components/AppIcon';
import type { Vendor } from '@makanza/mobile-core';
import { darkColors, lightColors } from '../theme/colors';

type Props={
  query:string;recentSearches:string[];vendors:Vendor[];loading:boolean;error:string;dark:boolean;
  onQuery:(value:string)=>void;onSearch:(term?:string)=>void;onRecentSearch:(term:string)=>void;
  onClearRecent:()=>void;onOpen:(vendor:Vendor)=>void;onRetry:()=>void;
};

export default function SearchScreen({query,recentSearches,vendors,loading,error,dark,onQuery,onSearch,onRecentSearch,onClearRecent,onOpen,onRetry}:Props){
  const theme=dark?darkStyles:lightStyles;
  return <View style={[s.screen,theme.screen]}><View style={s.header}><View style={s.headerIcon}><Ionicons name="search-outline" size={22} color="#1d6147"/></View><View style={[s.search,theme.surface]}>
      <Ionicons name="search-outline" size={21} color="#1d6147"/>
      <TextInput value={query} onChangeText={onQuery} onSubmitEditing={()=>onSearch(query)} placeholder="Search food or kitchens" placeholderTextColor={dark?'#b5bcb3':'#4f5451'} returnKeyType="search" style={[s.input,dark&&s.darkTitle]}/>
      <Pressable onPress={()=>onSearch(query)} accessibilityRole="button"><Text style={s.go}>Go</Text></Pressable>
    </View></View>
    <View style={s.recent}>
      <View style={s.sectionHeading}>
        <Text style={s.sectionTitle}>RECENT SEARCHES</Text>
        {!!recentSearches.length&&<Pressable accessibilityRole="button" onPress={onClearRecent}><Text style={s.clear}>Clear</Text></Pressable>}
      </View>
      {recentSearches.length===0
        ?<Text style={s.emptyRecent}>Your searches will appear here.</Text>
        :recentSearches.map(term=><Pressable key={term} accessibilityRole="button" onPress={()=>onRecentSearch(term)} style={[s.recentRow,theme.surface]}>
          <MaterialCommunityIcons name="history" size={22} color="#71806f"/>
          <Text numberOfLines={1} style={[s.recentTerm,dark&&s.darkTitle]}>{term}</Text>
          <MaterialCommunityIcons name="arrow-top-left" size={22} color="#98a096"/>
        </Pressable>)}
    </View>
    <View style={s.quick}>
      <Text style={s.sectionTitle}>POPULAR NEAR YOU</Text>
      <View style={s.chips}>{['Jollof','Suya','Healthy bowls','Local'].map(item=><Pressable key={item} onPress={()=>{onQuery(item);onSearch(item);}} style={[s.chip,theme.surface]}><Text style={[s.chipText,dark&&s.darkTitle]}>{item}</Text></Pressable>)}</View>
    </View>
    {loading?<ActivityIndicator color="#1d6147" style={{margin:30}}/>:error?<View style={s.empty}><Text style={s.emptyTitle}>Search is taking a break</Text><Text style={s.emptyBody}>{error}</Text><Pressable onPress={onRetry}><Text style={s.go}>Try again</Text></Pressable></View>:vendors.length===0?<View style={s.empty}><Ionicons name="search-outline" size={37} color="#8ba46c"/><Text style={[s.emptyTitle,dark&&s.darkTitle]}>{query?'No matches yet':'Find something delicious'}</Text><Text style={s.emptyBody}>{query?'Try a different dish, kitchen, or neighbourhood.':'Search by meal, cuisine, or kitchen name.'}</Text></View>:<FlatList data={vendors} keyExtractor={item=>item.id} contentContainerStyle={s.results} keyboardShouldPersistTaps="handled" renderItem={({item})=><Pressable onPress={()=>onOpen(item)} style={[s.result,theme.surface]}><Image source={{uri:item.image||'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=500&q=80'}} style={s.image}/><View style={s.copy}><Text style={[s.vendor,dark&&s.darkTitle]}>{item.name}</Text><Text style={s.meta}>{item.cuisine} · {item.neighborhood}</Text><Text style={s.meta}>{item.eta} · delivery ₦{item.fee.toLocaleString('en-NG')}</Text></View><Ionicons name="chevron-forward" size={23} color="#b5bcb3"/></Pressable>}/>}
  </View>;
}

const s=StyleSheet.create({
  screen:{flex:1,paddingTop:12},
  header:{paddingHorizontal:18,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:10},
  headerIcon:{width:44,height:44,borderRadius:14,backgroundColor:'#e6f0ea',alignItems:'center',justifyContent:'center'},
  kicker:{fontSize:11,fontWeight:'900',letterSpacing:1.2,color:'#66805f',marginHorizontal:20},
  title:{fontSize:35,fontWeight:'800',letterSpacing:-1,color:'#1f2321',marginHorizontal:20,marginTop:8},
  search:{height:50,flex:1,minWidth:0,paddingHorizontal:13,borderRadius:15,flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:'#eaeae7'},
  input:{flex:1,minWidth:0,height:44,fontSize:13,color:'#1f2321'},
  go:{fontSize:12,fontWeight:'900',color:'#1d6147',paddingVertical:7,paddingLeft:3},
  recent:{marginHorizontal:20,marginTop:19},
  sectionHeading:{minHeight:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  sectionTitle:{fontSize:10,letterSpacing:1.1,fontWeight:'900',color:'#4f5451'},
  clear:{fontSize:11,fontWeight:'900',color:'#1d6147',paddingHorizontal:6,paddingVertical:4},
  emptyRecent:{fontSize:12,color:'#4f5451',paddingVertical:12},
  recentRow:{minHeight:42,flexDirection:'row',alignItems:'center',gap:11,paddingHorizontal:11,marginTop:7,borderRadius:12},
  recentTerm:{flex:1,fontSize:13,fontWeight:'700',color:'#35483a'},
  quick:{marginHorizontal:20,marginTop:17},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:10},
  chip:{paddingHorizontal:12,paddingVertical:8,borderRadius:16},
  chipText:{fontSize:12,color:'#35483a',fontWeight:'700'},
  results:{paddingHorizontal:16,paddingBottom:20},
  result:{flexDirection:'row',alignItems:'center',gap:11,padding:10,marginTop:10,borderRadius:16},
  image:{width:66,height:66,borderRadius:12,backgroundColor:'#f6f5f2'},
  copy:{flex:1,gap:5},
  vendor:{fontSize:15,fontWeight:'800',color:'#1f2321'},
  meta:{fontSize:11,color:'#4f5451'},
  empty:{flex:1,alignItems:'center',justifyContent:'center',padding:30},
  emptyTitle:{fontSize:19,fontWeight:'800',color:'#1f2321',marginTop:8},
  emptyBody:{fontSize:13,lineHeight:21,color:'#4f5451',textAlign:'center',marginTop:7,maxWidth:260},
  darkTitle:{color:'#eff0e7'},
  darkSubtitle:{color:'#b5bcb3'},
});
const lightStyles=StyleSheet.create({screen:{backgroundColor:'#ffffff'},surface:{backgroundColor:'white'}});
const darkStyles=StyleSheet.create({screen:{backgroundColor:'#0e1712'},surface:{backgroundColor:'#18251c'}});
