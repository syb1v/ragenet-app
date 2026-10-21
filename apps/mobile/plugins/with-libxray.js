const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * libXray is a direct local AAR. A local AAR cannot be a dependency of another
 * Android library, so the VPN module compiles against its classes.jar and the
 * app links the full AAR (classes + native .so files) here.
 */
module.exports = function withLibXray(config) {
  return withAppBuildGradle(config, (config) => {
    const dependency = 'implementation files("../../modules/ragenet-vpn/android/libs/libXray.aar")';
    if (!config.modResults.contents.includes('libXray.aar')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${dependency}`,
      );
    }
    return config;
  });
};
