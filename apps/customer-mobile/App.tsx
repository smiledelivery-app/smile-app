import CustomerNavigator from './src/navigation/CustomerNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useCustomerFonts } from './src/theme/fonts';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App(){
  const {fontsLoaded}=useCustomerFonts();
  useEffect(()=>{if(fontsLoaded)void SplashScreen.hideAsync();},[fontsLoaded]);
  if(!fontsLoaded)return null;
  return <SafeAreaProvider><CustomerNavigator/></SafeAreaProvider>;
}
