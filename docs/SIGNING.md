# Signing and distribution

## Android

An APK must be signed to install. There is no usable "unsigned APK" for end
users.

Phase 0 builds:

```bash
cd apps/mobile
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleDebug
# app/build/outputs/apk/debug/app-debug.apk
```

Debug builds are signed with the debug keystore and are installable for
internal testing. For a release:

1. Create a keystore once and store it in GitHub Actions secrets.
2. Add a `release` signing config to `android/app/build.gradle`.
3. Build `assembleRelease` and upload the universal APK + `mapping.txt`.
4. Keep the keystore backed up; losing it prevents updates for existing users.

AAB can be added later for Google Play; the requested universal APK is a
sideload artifact.

## iOS

### Unsigned IPA

On a macOS runner:

```bash
cd apps/mobile
npx expo prebuild --platform ios --no-install
cd ios
pod install
xcodebuild \
  -workspace RageNet.xcworkspace \
  -scheme RageNet \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO

mkdir -p Payload
cp -R build/Build/Products/Release-iphoneos/RageNet.app Payload/
zip -r RageNet-unsigned.ipa Payload
```

This IPA is for people who will sign it themselves. It will not start a VPN
extension as-is.

### Why the VPN does not work without a paid account

`NEPacketTunnelProvider` requires:

- a paid Apple Developer Program membership;
- the `com.apple.developer.networking.networkextension` entitlement with
  `packet-tunnel-provider`;
- a provisioning profile containing that entitlement;
- an explicit App ID and a matching provisioning profile for each target.

Free Apple IDs cannot use Network Extensions. Sideloading tools can install an
unsigned IPA, but the extension will be rejected by the system.

### Turning it on later

1. Buy the Apple Developer Program.
2. Create App IDs for `net.ragenet.vpn` and `net.ragenet.vpn.tunnel`.
3. Enable Network Extensions → Packet Tunnel on both.
4. Add `ios/RageNet.entitlements` and `ios/tunnel/tunnel.entitlements`.
5. Put the certificate and provisioning profiles in GitHub Actions secrets.
6. Switch CI from `CODE_SIGNING_ALLOWED=NO` to the signed archive path.
7. Test on a physical device; the simulator cannot run a Packet Tunnel.

## macOS

Full TUN needs root. For a public build:

- sign the app and helper with a Developer ID certificate;
- notarize with `notarytool`;
- staple the ticket to the DMG.

Without notarization, users must right-click → Open and may still see Gatekeeper
warnings. System-proxy mode works without elevation but does not cover every app.

## Windows

An unsigned EXE triggers SmartScreen. For production, use an EV/OV code-signing
certificate and sign both the app and the helper. Until then, publish SHA-256
checksums and instructions for verifying the download.

## GitHub Actions secrets

| Secret                           | Used for                  |
| -------------------------------- | ------------------------- |
| `ANDROID_KEYSTORE_BASE64`        | release APK signing       |
| `ANDROID_KEYSTORE_PASSWORD`      | release APK signing       |
| `ANDROID_KEY_ALIAS`              | release APK signing       |
| `ANDROID_KEY_PASSWORD`           | release APK signing       |
| `APPLE_CERTIFICATE_BASE64`       | signed iOS/macOS builds   |
| `APPLE_CERTIFICATE_PASSWORD`     | signed iOS/macOS builds   |
| `APPLE_PROVISION_PROFILE_BASE64` | Network Extension profile |
| `APPLE_TEAM_ID`                  | signing                   |
| `TAURI_SIGNING_PRIVATE_KEY`      | desktop updater           |

Never put these values in the repository. Use protected GitHub Environments and
require approval for release jobs.
