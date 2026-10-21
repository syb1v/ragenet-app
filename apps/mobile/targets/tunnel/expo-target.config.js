/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'network-packet-tunnel',
  name: 'tunnel',
  displayName: 'RageNet Tunnel',
  bundleIdentifier: '.tunnel',
  deploymentTarget: '16.4',
  frameworks: ['NetworkExtension'],
  entitlements: {
    'com.apple.developer.networking.networkextension': ['packet-tunnel-provider'],
  },
};
