import { AppTextInput as TextInput } from '@makanza/mobile-ui';
import { AppText as Text } from '@makanza/mobile-ui';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type TextInputProps } from 'react-native';
import { Ionicons } from './AppIcon';

export default function FormField({label,dark=false,secureTextEntry,...props}:{label:string;dark?:boolean}&TextInputProps){const [visible,setVisible]=useState(false);return <View style={s.wrap}><Text style={[s.label,dark&&s.textDark]}>{label}</Text><View><TextInput {...props} secureTextEntry={secureTextEntry&&!visible} placeholderTextColor={dark?'#99a69a':'#98a097'} style={[s.input,secureTextEntry&&s.passwordInput,dark&&s.inputDark,props.style]}/>{secureTextEntry&&<Pressable accessibilityRole="button" accessibilityLabel={`${visible?'Hide':'Show'} ${label.toLowerCase()}`} accessibilityState={{checked:visible}} onPress={()=>setVisible(value=>!value)} style={s.visibility}><Ionicons name={visible?'eye-off-outline':'eye-outline'} size={19} color={dark?'#b5bcb3':'#69766a'}/></Pressable>}</View></View>}
const s=StyleSheet.create({wrap:{marginTop:12},label:{fontSize:13,fontWeight:'700',color:'#27382d',marginBottom:7},input:{height:51,borderRadius:0,borderWidth:1,borderColor:'#9aa99f',backgroundColor:'white',paddingHorizontal:14,fontSize:16,color:'#192b23'},passwordInput:{paddingRight:48},visibility:{position:'absolute',right:7,top:0,bottom:0,width:38,alignItems:'center',justifyContent:'center'},inputDark:{backgroundColor:'#18251c',borderColor:'#2a382f',color:'#edf3e9'},textDark:{color:'#edf3e9'}});
