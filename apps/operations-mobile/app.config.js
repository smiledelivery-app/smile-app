
const path = require('node:path');
const { existsSync } = require('node:fs');

try {
  require('dotenv').config({
    path: path.resolve(__dirname, '../../.env'),
    override: false,
  });
} catch {}

try {
  require('dotenv').config({
    path: path.resolve(__dirname, '.env'),
     override: false,
  });
} catch {}
delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
const base = require('./app.json').expo;

// EAS project ID: supplied by the newly linked Operations EAS project.
const projectId = '9b018d6b-6690-4a42-8c6a-c553fcb49119';
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ||
  (existsSync('./google-services.json')
    ? './google-services.json'
    : undefined);

const androidApiKey =
  process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
  process.env.MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_ROUTES_API_KEY ||
  base.android?.config?.googleMaps?.apiKey;

const iosApiKey =
  process.env.GOOGLE_MAPS_IOS_API_KEY ||
  process.env.MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_ROUTES_API_KEY ||
  base.ios?.config?.googleMapsApiKey;

const maps = {};

if (androidApiKey) {
  maps.androidGoogleMapsApiKey = androidApiKey;
}

if (iosApiKey) {
  maps.iosGoogleMapsApiKey = iosApiKey;
}

module.exports = {
  expo: {
    ...base,

    owner: 'smile-delivery',

    updates: {
      ...base.updates,
      ...(projectId
        ? { url: `https://u.expo.dev/${projectId}` }
        : {}),
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
    },

    runtimeVersion: {
      policy: 'appVersion',
    },

    extra: {
      ...base.extra,
      ...(projectId
        ? {
            eas: {
              ...base.extra?.eas,
              projectId,
            },
          }
        : {}),
    },

    android: {
      ...base.android,

      ...(googleServicesFile
        ? { googleServicesFile }
        : {}),

      ...(androidApiKey
        ? {
            config: {
              ...base.android?.config,
              googleMaps: {
                apiKey: androidApiKey,
              },
            },
          }
        : {}),
    },

    ios: {
      ...base.ios,

      ...(iosApiKey
        ? {
            config: {
              ...base.ios?.config,
              googleMapsApiKey: iosApiKey,
            },
          }
        : {}),
    },

    plugins: [
      ...(base.plugins ?? []),
      ['react-native-maps', maps],
    ],
  },
};
