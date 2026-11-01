import { AppText as Text } from '@makanza/mobile-ui';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

export default function PrimaryButton({title,onPress,disabled=false,secondary=false,style}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean;style?:StyleProp<ViewStyle>}){return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button,secondary&&s.secondary,disabled&&s.disabled,style]}><Text style={[s.text,secondary&&s.secondaryText]}>{title}</Text></Pressable>}
const s=StyleSheet.create({button:{minHeight:44,paddingHorizontal:14,borderRadius:13,backgroundColor:'#176b4d',alignItems:'center',justifyContent:'center'},secondary:{backgroundColor:'#ffffff',borderWidth:1,borderColor:'#d5e5da'},text:{fontSize:13,fontWeight:'800',color:'white'},secondaryText:{color:'#176b4d'},disabled:{opacity:.5}});
