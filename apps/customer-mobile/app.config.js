const base = require('./app.json').expo;
const { existsSync } = require('node:fs');
const easProjectId = 'f6ccdff4-cf4d-4ced-93df-fcaa053adede';
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? (existsSync('./google-services.json') ? './google-services.json' : undefined);
const maps = {};
if (process.env.GOOGLE_MAPS_ANDROID_API_KEY) maps.androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
if (process.env.GOOGLE_MAPS_IOS_API_KEY) maps.iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;

module.exports = {
  expo: {
    ...base,
    extra: {
      ...base.extra,
      eas: { ...base.extra?.eas, projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? base.extra?.eas?.projectId ?? easProjectId },
    },
    android: { ...base.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
    plugins: [...(base.plugins ?? []), ['react-native-maps', maps]],
  },
};
