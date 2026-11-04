import { forwardRef, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text as NativeText, TextInput as NativeTextInput, StyleSheet, View, type TextInputProps, type TextProps } from 'react-native';
import { useFonts as useExpoFonts } from 'expo-font';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  IBMPlexMono_700Bold,
} from '@expo-google-fonts/ibm-plex-mono';

export const FAM = {
  'sans-400': IBMPlexSans_400Regular,
  'sans-500': IBMPlexSans_500Medium,
  'sans-600': IBMPlexSans_600SemiBold,
  'sans-700': IBMPlexSans_700Bold,
  'sans-800': IBMPlexSans_700Bold,
  'display-600': PlusJakartaSans_600SemiBold,
  'display-700': PlusJakartaSans_700Bold,
  'display-800': PlusJakartaSans_800ExtraBold,
  'mono-500': IBMPlexMono_500Medium,
  'mono-600': IBMPlexMono_600SemiBold,
  'mono-700': IBMPlexMono_700Bold,
} as const;

export type FontKey = keyof typeof FAM;
export type FontFamily = 'sans' | 'display' | 'mono';

export function fontKey(fam: FontFamily, weight: number | string): FontKey {
  const namedWeight = weight === 'bold' ? 700 : weight === 'normal' ? 400 : 0;
  const w = typeof weight === 'string'
    ? Number(weight.replace(/\D/g, '')) || namedWeight || 400
    : weight;
  if (fam === 'display') return w >= 800 ? 'display-800' : w >= 700 ? 'display-700' : 'display-600';
  if (fam === 'mono') return w >= 700 ? 'mono-700' : w >= 600 ? 'mono-600' : 'mono-500';
  if (w >= 800) return 'sans-800';
  if (w >= 700) return 'sans-700';
  if (w >= 600) return 'sans-600';
  if (w >= 500) return 'sans-500';
  return 'sans-400';
}

export function useRafiqFonts(): { fontsLoaded: boolean; fontError: Error | null } {
  const [loaded, error] = useExpoFonts({ ...FAM });
  return { fontsLoaded: loaded, fontError: error ?? null };
}

type AppTextProps = TextProps & { family?: FontFamily };

export const AppText = forwardRef<NativeText, AppTextProps>(({ family, style, ...props }, ref) => {
  const textStyle = StyleSheet.flatten(style);
  const fontFamily = family ?? (Number(textStyle?.fontSize) >= 24 ? 'display' : 'sans');
  const fontWeight = textStyle?.fontWeight ?? '400';
  const requestedFont = fontKey(fontFamily, fontWeight);
  const normalizedStyle = textStyle ? { ...textStyle, fontWeight: undefined } : undefined;
  return <NativeText {...props} ref={ref} style={[normalizedStyle, { fontFamily: requestedFont }]}/>;
});

AppText.displayName = 'AppText';

type AppTextInputProps = TextInputProps & { family?: FontFamily };

export const AppTextInput = forwardRef<NativeTextInput, AppTextInputProps>(({ family = 'sans', style, ...props }, ref) => {
  const textStyle = StyleSheet.flatten(style);
  const fontWeight = textStyle?.fontWeight ?? '400';
  const requestedFont = fontKey(family as FontFamily, fontWeight);
  const normalizedStyle = textStyle ? { ...textStyle, fontWeight: undefined } : undefined;
  return <NativeTextInput {...props} ref={ref} style={[normalizedStyle, { fontFamily: requestedFont }]}/>;
});

export type CancellationReason='OUT_OF_STOCK'|'NOT_AVAILABLE'|'PRICE_CHANGED'|'VEHICLE_BREAKDOWN'|'NO_LONGER_INTERESTED'|'ORDERED_BY_MISTAKE'|'DELIVERY_TAKING_TOO_LONG'|'EMERGENCY'|'OTHER';
export function CancellationReasonModal({visible,role,dark=false,busy=false,onClose,onSubmit}:{visible:boolean;role:'CUSTOMER'|'VENDOR'|'RIDER';dark?:boolean;busy?:boolean;onClose:()=>void;onSubmit:(reason:CancellationReason,details:string)=>void}){
  const [reason,setReason]=useState<CancellationReason|null>(null);const [details,setDetails]=useState('');
  useEffect(()=>{if(visible){setReason(null);setDetails('');}},[visible]);
  const options:Record<typeof role,{id:CancellationReason;label:string}[]>={CUSTOMER:[{id:'NO_LONGER_INTERESTED',label:'I no longer want this order'},{id:'ORDERED_BY_MISTAKE',label:'I ordered by mistake'},{id:'DELIVERY_TAKING_TOO_LONG',label:'Delivery is taking too long'},{id:'OTHER',label:'Another reason'}],VENDOR:[{id:'OUT_OF_STOCK',label:'Item is out of stock'},{id:'NOT_AVAILABLE',label:'Item is no longer available'},{id:'PRICE_CHANGED',label:'Price has changed'},{id:'OTHER',label:'Another reason'}],RIDER:[{id:'VEHICLE_BREAKDOWN',label:'Vehicle breakdown'},{id:'EMERGENCY',label:'An emergency came up'},{id:'OTHER',label:'Another reason'}]};
  const bg=dark?'#18251c':'#fff',ink=dark?'#eff0e7':'#192b23',muted=dark?'#b5bcb3':'#69766a',line=dark?'#34473a':'#dfe5dc',green='#1d6147';
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.42)'}}><View style={{maxHeight:'88%',backgroundColor:bg,padding:20,borderTopLeftRadius:20,borderTopRightRadius:20,gap:12}}><AppText style={{fontSize:21,fontWeight:'800',color:ink}}>Why are you cancelling?</AppText><AppText style={{fontSize:13,lineHeight:19,color:muted}}>Choose a reason or write your own. Daily cancellation limits apply.</AppText><ScrollView keyboardShouldPersistTaps="handled">{options[role].map(item=><Pressable key={item.id} accessibilityRole="radio" accessibilityState={{checked:reason===item.id}} onPress={()=>setReason(item.id)} style={{padding:13,borderWidth:1,borderColor:reason===item.id?green:line,borderRadius:10,marginTop:8}}><AppText style={{fontSize:14,fontWeight:'700',color:ink}}>{item.label}</AppText></Pressable>)}{reason==='OTHER'&&<><AppText style={{fontSize:12,fontWeight:'700',color:ink,marginTop:12}}>Your reason</AppText><AppTextInput accessibilityLabel="Cancellation reason" value={details} onChangeText={setDetails} placeholder="Tell us briefly why" maxLength={300} multiline textAlignVertical="top" style={{minHeight:90,padding:12,borderWidth:1,borderColor:line,borderRadius:10,color:ink}}/></>}</ScrollView><View style={{flexDirection:'row',gap:10}}><Pressable accessibilityRole="button" onPress={onClose} disabled={busy} style={{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:line,borderRadius:10}}><AppText style={{fontWeight:'700',color:ink}}>Keep order</AppText></Pressable><Pressable accessibilityRole="button" onPress={()=>reason&&(!busy)&&(reason==='OTHER'?Boolean(details.trim()):true)&&onSubmit(reason,details.trim())} disabled={!reason||busy||(reason==='OTHER'&&!details.trim())} style={{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',backgroundColor:green,borderRadius:10,opacity:(!reason||busy||(reason==='OTHER'&&!details.trim()))?0.5:1}}><AppText style={{fontWeight:'800',color:'#fff'}}>{busy?'Cancelling…':'Cancel order'}</AppText></Pressable></View></View></View></Modal>;
}

AppTextInput.displayName = 'AppTextInput';
