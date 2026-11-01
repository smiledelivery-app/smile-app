import { forwardRef } from 'react';
import { Text as NativeText, TextInput as NativeTextInput, StyleSheet, type TextInputProps, type TextProps } from 'react-native';
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

AppTextInput.displayName = 'AppTextInput';
