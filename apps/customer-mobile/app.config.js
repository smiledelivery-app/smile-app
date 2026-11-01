const base = require('./app.json').expo;
const maps = {};
if (process.env.GOOGLE_MAPS_ANDROID_API_KEY) maps.androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
if (process.env.GOOGLE_MAPS_IOS_API_KEY) maps.iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;

module.exports = {
  expo: {
    ...base,
    plugins: [...(base.plugins ?? []), ['react-native-maps', maps]],
  },
};
