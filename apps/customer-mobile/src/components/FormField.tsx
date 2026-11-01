import { AppTextInput as TextInput } from '@makanza/mobile-ui';
import { AppText as Text } from '@makanza/mobile-ui';
import { StyleSheet, View, type TextInputProps } from 'react-native';
import { radius, semantic, space, typeScale } from '../theme/tokens';
import { darkColors, lightColors } from '../theme/colors';

export default function FormField({label,dark=false,...props}:{label:string;dark?:boolean}&TextInputProps){const c=semantic(dark?darkColors:lightColors);return <View style={s.wrap}><Text style={[s.label,{color:c.textPrimary}]}>{label}</Text><TextInput {...props} accessibilityLabel={props.accessibilityLabel??label} placeholderTextColor={c.textSecondary} style={[s.input,{borderColor:c.border,backgroundColor:c.surface,color:c.textPrimary},props.style]}/></View>}
const s=StyleSheet.create({wrap:{marginTop:space.md},label:{...typeScale.label,marginBottom:space.sm},input:{minHeight:50,borderRadius:radius.md,borderWidth:1,paddingHorizontal:space.md,fontSize:15}});
