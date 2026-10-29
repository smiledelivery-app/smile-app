/** Public Expo variables are bundled into the client. Never put secrets here. */
const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');
const googleMapsEnabled = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ENABLED === 'true';

export const mobileEnv = Object.freeze({ apiUrl, googleMapsEnabled, demoMode: !apiUrl });
