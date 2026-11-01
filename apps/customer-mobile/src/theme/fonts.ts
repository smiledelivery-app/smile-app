import { useFonts } from 'expo-font';
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

export const CUSTOMER_FONTS = {
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
};

export function useCustomerFonts() {
  const [fontsLoaded, fontError] = useFonts(CUSTOMER_FONTS);
  return { fontsLoaded, fontError: fontError ?? null };
}
