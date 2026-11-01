import { Ionicons } from './AppIcon';
import { AppText as Text, AppTextInput as TextInput } from '@makanza/mobile-ui';
import { forwardRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { radius, semantic, space, typeScale } from '../theme/tokens';
import type { AppColors } from '../theme/colors';

type ButtonProps = Omit<PressableProps, 'style'> & { title: string; colors: AppColors; variant?: 'primary'|'secondary'|'ghost'|'danger'; loading?: boolean; style?: StyleProp<ViewStyle> };
export function Button({ title, colors, variant='primary', loading=false, disabled, style, ...props }: ButtonProps) {
  const c = semantic(colors);
  const tone = variant==='primary' ? [s.primary,{backgroundColor:c.primary}] : variant==='secondary' ? [s.secondary,{backgroundColor:c.surface,borderColor:c.border}] : variant==='danger' ? [s.danger,{backgroundColor:c.danger}] : s.ghost;
  const textTone = variant==='primary' || variant==='danger' ? { color: c.onPrimary } : { color: variant==='ghost' ? c.primary : c.textPrimary };
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled||loading }} disabled={disabled||loading} style={({ pressed }) => [s.button, tone, pressed&&s.pressed, (disabled||loading)&&s.disabled, style]} {...props}>
    {loading ? <ActivityIndicator color={textTone.color} /> : <Text style={[s.buttonText, textTone]}>{title}</Text>}
  </Pressable>;
}

export function IconButton({ icon, label, colors, onPress, size=44, style }: { icon: string; label: string; colors: AppColors; onPress: () => void; size?: number; style?: StyleProp<ViewStyle> }) {
  const c = semantic(colors);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={4} onPress={onPress} style={({ pressed }) => [s.iconButton, { width:size, height:size, backgroundColor:c.surfaceSubtle }, pressed&&s.pressed, style]}><Ionicons name={icon} size={21} color={c.primary} /></Pressable>;
}

export const Input = forwardRef<any, TextInputProps & { colors: AppColors; label?: string; error?: string; helper?: string }>(function Input({ colors, label, error, helper, style, ...props }, ref) {
  const c = semantic(colors);
  return <View style={s.field}>{label ? <Text style={[s.label, { color:c.textPrimary }]}>{label}</Text> : null}<TextInput ref={ref} {...props} accessibilityLabel={props.accessibilityLabel ?? label} placeholderTextColor={c.textSecondary} style={[s.input, { color:c.textPrimary, backgroundColor:c.surface, borderColor:error?c.danger:c.border }, style]} />{error ? <Text style={[s.helper, { color:c.danger }]}>{error}</Text> : helper ? <Text style={[s.helper, { color:c.textSecondary }]}>{helper}</Text> : null}</View>;
});

export function SectionHeader({ title, subtitle, action, colors, onAction }: { title:string; subtitle?:string; action?:string; colors:AppColors; onAction?:()=>void }) {
  const c=semantic(colors);
  return <View style={s.sectionHeader}><View style={s.sectionCopy}><Text style={[typeScale.headline,{color:c.textPrimary}]}>{title}</Text>{subtitle?<Text style={[typeScale.caption,{color:c.textSecondary,marginTop:3}]}>{subtitle}</Text>:null}</View>{action&&onAction?<Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}><Text style={[s.action,{color:c.primary}]}>{action}</Text></Pressable>:null}</View>;
}

export function ScreenHeader({ title, subtitle, icon, colors, eyebrow='' }: { title:string; subtitle?:string; icon?:string; colors:AppColors; eyebrow?:string }) {
  const c=semantic(colors);
  return <View style={s.screenHeader}>{icon ? <View style={[s.screenHeaderIcon,{backgroundColor:colors.isDark?'#203b2d':'#e6f0ea'}]}><Ionicons name={icon} size={22} color={c.primary}/></View> : null}<View style={s.screenHeaderCopy}>{eyebrow ? <Text style={[typeScale.label,{color:c.textSecondary,marginBottom:4}]}>{eyebrow}</Text> : null}<Text style={[typeScale.headline,{color:c.textPrimary}]}>{title}</Text>{subtitle ? <Text style={[typeScale.caption,{color:c.textSecondary,marginTop:6}]}>{subtitle}</Text> : null}</View></View>;
}

export function BackHeader({ title, subtitle, colors, onBack }: { title:string; subtitle?:string; colors:AppColors; onBack:()=>void }) {
  const c=semantic(colors);
  return <View style={[s.backHeader,{borderBottomColor:c.border}]}><Pressable accessibilityRole="button" accessibilityLabel={`Back from ${title}`} onPress={onBack} style={({pressed})=>[s.backButton,{backgroundColor:c.surfaceSubtle},pressed&&s.pressed]}><Ionicons name="chevron-back" size={22} color={c.primary}/></Pressable><View style={s.backCopy}><Text style={[typeScale.title,{color:c.textPrimary}]}>{title}</Text>{subtitle?<Text style={[typeScale.caption,{color:c.textSecondary,marginTop:2}]}>{subtitle}</Text>:null}</View></View>;
}

export function EmptyState({ icon='file-tray-outline', title, message, action, colors, onAction }: { icon?: string; title:string; message:string; action?:string; colors:AppColors; onAction?:()=>void }) {
  const c=semantic(colors);
  return <View style={[s.state,{backgroundColor:c.surfaceSubtle,borderColor:c.border}]}><View style={[s.stateIcon,{backgroundColor:c.primarySoft}]}><Ionicons name={icon} size={25} color={c.primary}/></View><Text style={[s.stateTitle,{color:c.textPrimary}]}>{title}</Text><Text style={[s.stateMessage,{color:c.textSecondary}]}>{message}</Text>{action&&onAction?<Button title={action} colors={colors} variant="secondary" onPress={onAction} style={{marginTop:space.md}}/>:null}</View>;
}

export function ErrorState({ message, colors, onRetry }: { message:string; colors:AppColors; onRetry:()=>void }) { return <EmptyState icon="alert-circle-outline" title="Something went wrong" message={message} action="Try again" colors={colors} onAction={onRetry}/>; }

export function Skeleton({ colors, width='100%', height=16, radiusValue=radius.sm }: { colors:AppColors; width?: number|`${number}%`; height?:number; radiusValue?:number }) { return <View accessibilityLabel="Loading" style={{width,height,borderRadius:radiusValue,backgroundColor:colors.isDark?'#244034':'#e7eee9'}}/>; }

const s=StyleSheet.create({button:{minHeight:52,paddingHorizontal:space.lg,borderRadius:radius.md,alignItems:'center',justifyContent:'center'},primary:{backgroundColor:'#1d6147'},secondary:{borderWidth:1},ghost:{backgroundColor:'transparent',minHeight:44,paddingHorizontal:space.md},danger:{backgroundColor:'#9f2f2d'},pressed:{opacity:.82},disabled:{opacity:.55},buttonText:{fontSize:15,lineHeight:20,letterSpacing:.2,textAlign:'center'},iconButton:{borderRadius:radius.md,alignItems:'center',justifyContent:'center'},field:{marginTop:space.md},label:{...typeScale.label,marginBottom:space.sm},input:{minHeight:50,borderWidth:1,borderRadius:radius.md,paddingHorizontal:space.md,fontSize:15},helper:{...typeScale.caption,marginTop:space.xs},sectionHeader:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginHorizontal:space.xl,marginTop:space.xl,marginBottom:space.sm},sectionCopy:{flex:1},screenHeader:{paddingHorizontal:space.xl,paddingVertical:space.lg,flexDirection:'row',alignItems:'center',justifyContent:'flex-start',gap:space.md},screenHeaderIcon:{width:44,height:44,borderRadius:radius.md,alignItems:'center',justifyContent:'center'},screenHeaderCopy:{flex:1},backHeader:{minHeight:76,paddingHorizontal:space.xl,paddingVertical:space.md,flexDirection:'row',alignItems:'center',gap:space.md,borderBottomWidth:1},backButton:{width:44,height:44,borderRadius:radius.md,alignItems:'center',justifyContent:'center'},backCopy:{flex:1},action:{...typeScale.label},state:{margin:space.xl,padding:space.xl,borderWidth:1,borderRadius:radius.lg,alignItems:'center'},stateIcon:{width:52,height:52,borderRadius:radius.md,alignItems:'center',justifyContent:'center',marginBottom:space.md},stateTitle:{...typeScale.headline,textAlign:'center'},stateMessage:{...typeScale.body,textAlign:'center',marginTop:space.sm,maxWidth:300}});
