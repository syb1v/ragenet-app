const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');

/**
 * libXray is a direct local AAR. A local AAR cannot be a dependency of another
 * Android library, so the VPN module compiles against its classes.jar and the
 * app links the full AAR (classes + native .so files) here.
 *
 * The iOS main app also needs LibXray so pingBatch can run in an isolated
 * process while the Packet Tunnel owns the active core.
 */
module.exports = function withLibXray(config) {
  config = withAppBuildGradle(config, (config) => {
    const dependency = 'implementation files("../../modules/ragenet-vpn/android/libs/libXray.aar")';
    if (!config.modResults.contents.includes('libXray.aar')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${dependency}`,
      );
    }
    return config;
  });

  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return config;
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes("pod 'LibXray'")) {
        contents = contents.replace(
          /(target\s+'[^']+'\s+do\s*\n\s*use_expo_modules!)/,
          `$1\n  pod 'LibXray', :path => File.expand_path('../vendor/libxray', __dir__), :modular_headers => true`,
        );
        fs.writeFileSync(podfilePath, contents);
      }
      return config;
    },
  ]);
};
