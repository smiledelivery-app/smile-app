/** Public Expo variables are bundled into the client. Never put secrets here. */
import { Platform } from 'react-native';

const localApiUrl = Platform.OS === 'android'
  ? 'http://192.168.233.172:4100/api/v1'
  : 'http://localhost:4100/api/v1';
const configuredApiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
const apiUrl = (configuredApiUrl || (__DEV__ ? localApiUrl : '')).replace(/\/$/, '');
const googleMapsEnabled = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ENABLED === 'true';

export const mobileEnv = Object.freeze({ apiUrl, demoMode: !apiUrl, googleMapsEnabled });
