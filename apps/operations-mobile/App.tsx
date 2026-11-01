import OperationsNavigator from './src/navigation/OperationsNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useRafiqFonts } from '@makanza/mobile-ui';

export default function App(){const {fontsLoaded}=useRafiqFonts();if(!fontsLoaded)return null;return <SafeAreaProvider><OperationsNavigator/></SafeAreaProvider>;}
