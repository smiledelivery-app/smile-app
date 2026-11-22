import MapView, { Marker, type MapPressEvent, type Region } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';
import type { AppColors } from '../theme/colors';
import { AppText as Text } from '@makanza/mobile-ui';

type Coordinate={latitude:number;longitude:number};
type Props={point:Coordinate|null;colors:AppColors;onPick:(point:Coordinate)=>void};
const nigeriaRegion:Region={latitude:9.082,longitude:8.6753,latitudeDelta:9.8,longitudeDelta:12.2};

export default function VendorStoreMapPicker({point,colors,onPick}:Props){
  return <View style={[styles.frame,{borderColor:colors.line}]}>
    <MapView style={styles.map} initialRegion={point?{...point,latitudeDelta:.025,longitudeDelta:.025}:nigeriaRegion} onPress={(event:MapPressEvent)=>onPick(event.nativeEvent.coordinate)} showsCompass toolbarEnabled={false}>
      {point&&<Marker coordinate={point} title="Store location" pinColor={colors.green}/>}
    </MapView>
    <View pointerEvents="none" style={[styles.hint,{backgroundColor:colors.card}]}><Text style={[styles.hintText,{color:colors.ink}]}>Tap the map to set your store pin</Text></View>
  </View>;
}

const styles=StyleSheet.create({
  frame:{height:260,overflow:'hidden',borderWidth:1,borderRadius:14,marginTop:10},
  map:{width:'100%',height:'100%'},
  hint:{position:'absolute',top:10,left:10,right:10,alignSelf:'center',paddingHorizontal:12,paddingVertical:9,borderRadius:11,opacity:.96},
  hintText:{fontSize:11,fontWeight:'700',textAlign:'center'},
});
