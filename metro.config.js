const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add ICO files to asset extensions
if (!config.resolver.assetExts) {
  config.resolver.assetExts = [];
}
if (!config.resolver.assetExts.includes('ico')) {
  config.resolver.assetExts.push('ico');
}

module.exports = config;