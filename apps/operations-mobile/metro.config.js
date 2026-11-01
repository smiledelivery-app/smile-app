const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, '../..');
const mobileUiRoot = path.join(workspaceRoot, 'packages/mobile-ui');

config.watchFolders = [mobileUiRoot];
config.resolver.nodeModulesPaths = [
  path.join(__dirname, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@makanza/mobile-ui': mobileUiRoot,
};

module.exports = config;
