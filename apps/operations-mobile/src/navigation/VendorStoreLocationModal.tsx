import { AppText as Text, AppTextInput as TextInput } from '@makanza/mobile-ui';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '../components/AppIcon';
import { api } from '../services/api';
import type { AppColors } from '../theme/colors';
import VendorStoreMapPicker from './VendorStoreMapPicker';

type Coordinate={latitude:number;longitude:number};
type PlaceSuggestion={placeId:string;description:string};
type ResolvedPlace={line1:string;city:string;latitude:number;longitude:number};
type Props={visible:boolean;token:string;address:string;point:Coordinate|null;colors:AppColors;onClose:()=>void;onSelect:(address:string,point:Coordinate)=>void};

export default function VendorStoreLocationModal({visible,token,address:initialAddress,point:initialPoint,colors,onClose,onSelect}:Props){
  const [query,setQuery]=useState(initialAddress);
  const [address,setAddress]=useState(initialAddress);
  const [point,setPoint]=useState<Coordinate|null>(initialPoint);
  const [searchEnabled,setSearchEnabled]=useState(false);
  const [suggestions,setSuggestions]=useState<PlaceSuggestion[]>([]);
  const [searching,setSearching]=useState(false);
  const [resolving,setResolving]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const s=styles(colors);

  useEffect(()=>{
    if(!visible){setQuery(initialAddress);setAddress(initialAddress);setPoint(initialPoint);setSuggestions([]);setSearchEnabled(false);setError('');return;}
    setQuery(initialAddress);setAddress(initialAddress);setSearchEnabled(false);
    setPoint(initialPoint);
  },[visible,initialAddress,initialPoint?.latitude,initialPoint?.longitude]);

  useEffect(()=>{
    const text=query.trim();
    if(!visible||!searchEnabled||text.length<3){setSuggestions([]);setSearching(false);return;}
    let active=true;
    const timer=setTimeout(()=>{
      setSearching(true);
      void api.get<PlaceSuggestion[]>(`/addresses/suggestions?q=${encodeURIComponent(text)}`,token)
        .then(rows=>{if(active)setSuggestions(rows);})
        .catch(reason=>{if(active){setSuggestions([]);setError(reason instanceof Error?reason.message:'Could not search Nigerian locations.');}})
        .finally(()=>{if(active)setSearching(false);});
    },350);
    return()=>{active=false;clearTimeout(timer);};
  },[visible,token,query,searchEnabled]);

  const selectSuggestion=async(suggestion:PlaceSuggestion)=>{
    setResolving(true);setError('');
    try{
      const place=await api.post<ResolvedPlace>('/addresses/resolve',{placeId:suggestion.placeId},token);
      const selected={latitude:place.latitude,longitude:place.longitude};
      setPoint(selected);setAddress(`${place.line1}, ${place.city}`);setQuery(suggestion.description);setSearchEnabled(false);setSuggestions([]);
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not resolve this address.');}
    finally{setResolving(false);}
  };

  const selectMapPoint=async(coordinate:Coordinate)=>{
    if(!Number.isFinite(coordinate.latitude)||!Number.isFinite(coordinate.longitude)){setError('Could not read the selected map coordinates.');return;}
    const inNigeria=coordinate.latitude>=4.2&&coordinate.latitude<=13.95&&coordinate.longitude>=2.6&&coordinate.longitude<=14.7;
    if(!inNigeria){setError('Choose a point within Nigeria.');return;}
    setBusy(true);setError('');
    try{
      const results=await Location.reverseGeocodeAsync(coordinate);
      const place=results?.[0];
      if(!place||(place.isoCountryCode?.toUpperCase()!=='NG'&&place.country?.toLowerCase()!=='nigeria'))throw new Error('Choose a point within Nigeria.');
      const line=[place.streetNumber,place.street,place.name].filter(Boolean).join(' ')||`Map pin (${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)})`;
      const city=place.city||place.district||place.region;
      if(!city)throw new Error('Could not read the area at this pin. Move the pin closer to a street.');
      setPoint({latitude:coordinate.latitude,longitude:coordinate.longitude});setAddress(`${line}, ${city}`);setQuery(`${line}, ${city}`);setSearchEnabled(false);setSuggestions([]);
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not resolve this map pin.');}
    finally{setBusy(false);}
  };

  const useCurrentLocation=async()=>{
    setBusy(true);setError('');
    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status!=='granted')throw new Error('Allow location access to set the store pin.');
      await selectMapPoint((await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced})).coords);
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not read your current location.');}
    finally{setBusy(false);}
  };

  if(!visible)return null;

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <View style={s.titleWrap}><Text style={s.kicker}>STORE LOCATION</Text><Text style={s.title}>Find your address</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close location picker" onPress={onClose} style={s.close}><Ionicons name="close" size={22} color={colors.ink}/></Pressable>
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={20} color={colors.green}/>
          <TextInput value={query} onChangeText={(value:string)=>{setQuery(value);setSearchEnabled(true);setAddress('');setError('');}} placeholder="Search street, area, or city" placeholderTextColor={colors.muted} style={s.searchInput}/>
          {(searching||resolving)&&<ActivityIndicator color={colors.green}/>}
        </View>
        {suggestions.length>0&&<View style={s.suggestions}>{suggestions.map(item=><Pressable key={item.placeId} accessibilityRole="button" onPress={()=>void selectSuggestion(item)} style={s.suggestion}><Ionicons name="location-outline" size={17} color={colors.green}/><Text style={s.suggestionText}>{item.description}</Text></Pressable>)}</View>}
        {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
        <VendorStoreMapPicker point={point} colors={colors} onPick={(coordinate:Coordinate)=>void selectMapPoint(coordinate)}/>
        <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void useCurrentLocation()} style={s.current}><Ionicons name="navigate-outline" size={17} color={colors.green}/><Text style={s.currentText}>{busy?'Getting location…':'Use current location'}</Text></Pressable>
        {address? <View style={s.selected}><Ionicons name="checkmark-circle-outline" size={18} color={colors.green}/><Text style={s.selectedText}>{address}</Text></View>:<Text style={s.helper}>Choose a search result or tap the map to set your store pin.</Text>}
        <Pressable accessibilityRole="button" disabled={!point||!address} onPress={()=>point&&address&&onSelect(address,point)} style={[s.save,(!point||!address)&&s.saveDisabled]}><Text style={s.saveText}>Use this store address</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

const styles=(c:AppColors)=>StyleSheet.create({
  screen:{flex:1,backgroundColor:c.paper},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:14,borderBottomWidth:1,borderBottomColor:c.line},
  titleWrap:{gap:3},
  kicker:{fontSize:9,fontWeight:'900',letterSpacing:1.2,color:c.green},
  title:{fontSize:18,fontWeight:'900',color:c.ink},
  close:{width:40,height:40,alignItems:'center',justifyContent:'center',borderRadius:13,backgroundColor:c.cream},
  content:{padding:18,paddingBottom:30},
  searchBox:{minHeight:48,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:12,borderWidth:1,borderColor:c.line,borderRadius:13,backgroundColor:c.card},
  searchInput:{flex:1,minHeight:44,color:c.ink,fontSize:13},
  suggestions:{marginTop:5,borderWidth:1,borderColor:c.line,borderRadius:12,backgroundColor:c.card},
  suggestion:{minHeight:44,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:11,borderBottomWidth:1,borderBottomColor:c.line},
  suggestionText:{flex:1,color:c.ink,fontSize:11,lineHeight:16},
  error:{marginTop:8,color:c.isDark?'#f0877a':'#a44232',fontSize:12,lineHeight:17},
  current:{minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:10,borderWidth:1,borderColor:c.line,borderRadius:12,backgroundColor:c.card},
  currentText:{fontSize:11,fontWeight:'800',color:c.green},
  selected:{flexDirection:'row',alignItems:'flex-start',gap:8,marginTop:12,padding:12,borderRadius:12,backgroundColor:c.cream},
  selectedText:{flex:1,fontSize:11,lineHeight:17,fontWeight:'700',color:c.ink},
  helper:{marginTop:12,color:c.muted,fontSize:11,lineHeight:17},
  save:{minHeight:48,alignItems:'center',justifyContent:'center',marginTop:14,borderRadius:13,backgroundColor:c.green},
  saveDisabled:{opacity:.45},
  saveText:{fontSize:12,fontWeight:'900',color:'#fff'},
});
