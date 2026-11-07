import { AppTextInput as TextInput } from '@makanza/mobile-ui';
import { AppText as Text } from '@makanza/mobile-ui';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type TextInputProps } from 'react-native';
import { Ionicons } from './AppIcon';
import { radius, semantic, space, typeScale } from '../theme/tokens';
import { darkColors, lightColors } from '../theme/colors';

export default function FormField({label,dark=false,secureTextEntry,...props}:{label:string;dark?:boolean}&TextInputProps){const [visible,setVisible]=useState(false);const c=semantic(dark?darkColors:lightColors);return <View style={s.wrap}><Text style={[s.label,{color:c.textPrimary}]}>{label}</Text><View><TextInput {...props} secureTextEntry={secureTextEntry&&!visible} accessibilityLabel={props.accessibilityLabel??label} placeholderTextColor={c.textSecondary} style={[s.input,secureTextEntry&&s.passwordInput,{borderColor:c.border,backgroundColor:c.surface,color:c.textPrimary},props.style]}/>{secureTextEntry&&<Pressable accessibilityRole="button" accessibilityLabel={`${visible?'Hide':'Show'} ${label.toLowerCase()}`} accessibilityState={{checked:visible}} onPress={()=>setVisible(value=>!value)} style={s.visibility}><Ionicons name={visible?'eye-off-outline':'eye-outline'} size={19} color={c.textSecondary}/></Pressable>}</View></View>}
const s=StyleSheet.create({wrap:{marginTop:space.md},label:{...typeScale.label,marginBottom:space.sm},input:{minHeight:50,borderRadius:radius.md,borderWidth:1,paddingHorizontal:space.md,fontSize:15},passwordInput:{paddingRight:48},visibility:{position:'absolute',right:7,top:0,bottom:0,width:38,alignItems:'center',justifyContent:'center'}});
