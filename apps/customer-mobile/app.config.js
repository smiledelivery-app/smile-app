const path = require('node:path');
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
} catch {}
try {
  require('dotenv').config({ path: path.resolve(__dirname, '.env') });
} catch {}

const base = require('./app.json').expo;
const { existsSync } = require('node:fs');
const easProjectId = 'f6ccdff4-cf4d-4ced-93df-fcaa053adede';
const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? base.extra?.eas?.projectId ?? easProjectId;
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? (existsSync('./google-services.json') ? './google-services.json' : undefined);

const androidApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY || process.env.MAPS_API_KEY || process.env.GOOGLE_MAPS_ROUTES_API_KEY || base.android?.config?.googleMaps?.apiKey;
const iosApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY || process.env.MAPS_API_KEY || process.env.GOOGLE_MAPS_ROUTES_API_KEY || base.ios?.config?.googleMapsApiKey;

const maps = {};
if (androidApiKey) maps.androidGoogleMapsApiKey = androidApiKey;
if (iosApiKey) maps.iosGoogleMapsApiKey = iosApiKey;

module.exports = {
  expo: {
    ...base,
    updates: {
      ...base.updates,
      url: `https://u.expo.dev/${projectId}`,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
    },
    runtimeVersion: { policy: 'appVersion' },
    extra: {
      ...base.extra,
      eas: { ...base.extra?.eas, projectId },
    },
    android: {
      ...base.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
      ...(androidApiKey ? { config: { ...base.android?.config, googleMaps: { apiKey: androidApiKey } } } : {}),
    },
    ios: {
      ...base.ios,
      ...(iosApiKey ? { config: { ...base.ios?.config, googleMapsApiKey: iosApiKey } } : {}),
    },
    plugins: [
      ...(base.plugins ?? []),
      ['react-native-maps', maps],
    ],
  },
};
