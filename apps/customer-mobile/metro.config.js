const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, '../..');
const mobileUiRoot = path.join(workspaceRoot, 'packages/mobile-ui');
const mobileUiNodeModules = path.join(mobileUiRoot, 'node_modules');

config.watchFolders = [mobileUiRoot];
config.resolver.nodeModulesPaths = [
  path.join(__dirname, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
  mobileUiNodeModules,
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@makanza/mobile-ui': mobileUiRoot,
  'expo-font': path.join(mobileUiNodeModules, 'expo-font'),
  '@expo-google-fonts/ibm-plex-mono': path.join(mobileUiNodeModules, '@expo-google-fonts/ibm-plex-mono'),
  '@expo-google-fonts/ibm-plex-sans': path.join(mobileUiNodeModules, '@expo-google-fonts/ibm-plex-sans'),
  '@expo-google-fonts/plus-jakarta-sans': path.join(mobileUiNodeModules, '@expo-google-fonts/plus-jakarta-sans'),
};

module.exports = config;
