import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '@makanza/mobile-ui';
import type { AppColors } from '../theme/colors';

type Coordinate={latitude:number;longitude:number};
type Props={point:Coordinate|null;colors:AppColors;onPick:(point:Coordinate)=>void};

export default function VendorStoreMapPicker({colors}:Props){
  return <View style={[styles.frame,{backgroundColor:colors.cream,borderColor:colors.line}]}>
    <Text style={[styles.copy,{color:colors.muted}]}>Map pin selection is available in the iOS and Android vendor app. Search for a Nigerian address above.</Text>
  </View>;
}

const styles=StyleSheet.create({
  frame:{minHeight:90,alignItems:'center',justifyContent:'center',padding:16,borderWidth:1,borderRadius:14,marginTop:10},
  copy:{fontSize:12,lineHeight:18,textAlign:'center'},
});
