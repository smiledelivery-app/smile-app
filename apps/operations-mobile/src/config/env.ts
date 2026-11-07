/** Public Expo variables are bundled into the client. Never put secrets here. */
import { Platform } from 'react-native';

const localApiUrl = Platform.OS === 'android'
  ? 'https://smile-backend-2den.onrender.com/api/v1'
  : 'https://smile-backend-2den.onrender.com/api/v1'
const configuredApiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
const apiUrl = (configuredApiUrl || (__DEV__ ? localApiUrl : '')).replace(/\/$/, '');
const googleMapsEnabled = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ENABLED === 'true';
export const mobileEnv = Object.freeze({ apiUrl, demoMode: false, googleMapsEnabled });
