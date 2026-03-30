const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withDisableRTL(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:supportsRtl'] = 'false';
    }
    return config;
  });
};
