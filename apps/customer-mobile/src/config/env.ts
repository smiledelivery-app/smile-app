/** Public Expo variables are bundled into the client. Never put secrets here. */
const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');

export const mobileEnv = Object.freeze({ apiUrl, demoMode: !apiUrl });
