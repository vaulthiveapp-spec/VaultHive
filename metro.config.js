const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes("ico")) {
  config.resolver.assetExts.push("ico");
}

module.exports = config;