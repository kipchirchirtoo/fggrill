const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// WatermelonDB configuration
config.resolver.sourceExts.push('cjs');

module.exports = config;
