# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.23] - 2026-10-22

### Changed

- Restored the RageNet particle sphere as the single home connection surface,
  using the original simulation and a native SVG renderer without Skia.
- The sphere responds to touch and drag, uses soft haptic ticks, and has no
  perpetual ring spin.

## [0.1.22] - 2026-10-22

### Changed

- Calmed the connection surface: aperture rings and dust no longer rotate
  continuously. They stay still at rest, respond to drag, and vibrate only
  while the user holds the core.
- Drag now visibly rotates the dust halo instead of only producing haptic
  ticks.

## [0.1.21] - 2026-10-21

### Changed

- Replaced the particle sphere with **Signal Aperture**: SVG rings, hold
  progress, state-driven motion and a compact power core.
- Reworked the home hierarchy: status pill, compact traffic/expiry strip,
  quieter subscription actions and route row.
- Haptics now use soft selection ticks, a restrained hold ramp and no heavy
  impact; drag feedback is gentler.

### Removed

- The unused particle simulation/renderers and the Skia native dependency.

## [0.1.20] - 2026-10-21

### Added

- Successful Android, iOS, signed iOS and desktop builds now publish their
  artifacts to GitHub Releases. Manual runs create/update a prerelease
  `app-v<version>`; `app-v*` tag builds publish a stable release.

### Added

- `Sign iOS IPA` workflow that signs the app, `tunnel.appex` and nested
  frameworks with two provisioning profiles supplied through GitHub Secrets.

## [0.1.19] - 2026-10-21

### Fixed

- Android library modules cannot contain a direct local `.aar`. The VPN module
  now compiles against `libXray-classes.jar` (`compileOnly`), while the app
  links the full `libXray.aar` through a small Expo config plugin.

## [0.1.18] - 2026-10-21

### Fixed

- The local `ragenet-vpn` Android library compiled against SDK 36 while
  `expo-modules-core` requires 37. It now uses `compileSdkVersion 37`.

## [0.1.17] - 2026-10-21

### Fixed

- Removed the unused App Group entitlement from the iOS app and tunnel; it
  complicated signing without being used by the provider configuration.
- iOS workflow defaults to `Release` and names artifacts
  `ragenet-ios-ipa-release` / `ragenet-ios-ipa-debug`, so an installable IPA is
  not confused with a Metro-dependent debug build.

## [0.1.16] - 2026-10-21

### Changed

- Android uses an SVG particle renderer. The Skia JSI/CMake build is excluded
  from the Android autolinking graph, cutting a ~20 minute native compile that
  repeatedly exhausted the hosted runner. iOS keeps the Skia renderer.

## [0.1.15] - 2026-10-21

### Fixed

- Android uses the real SDK package name `platforms;android-37.0` and links it
  as `android-37` for AGP 9.
- The Packet Tunnel target no longer sets `use_frameworks!` independently of
  the main app; CocoaPods rejected mismatched framework linkage.

## [0.1.14] - 2026-10-21

### Fixed

- Expo iOS autolinking only scans podspecs inside top-level package
  directories. `RageNetVpn.podspec` now lives in `ios/`, and the LibXray pod
  moved to `vendor/libxray` to avoid a duplicate `LibXray` dependency.

- Expo SDK 58 Android modules require `compileSdk 37`; the app previously used
  36 and failed `checkDebugAarMetadata`. CI now installs `platforms;android-37`.

## [0.1.13] - 2026-10-21

### Fixed

- iOS status events are delivered on the main queue.
- Link `libresolv.9` with the iOS libXray pod, matching the upstream Packet
  Tunnel integration.
- Documentation now describes signing both the app and the embedded
  `tunnel.appex`; a single profile is not enough for Network Extension.

## [0.1.12] - 2026-10-21

### Added

- iOS Packet Tunnel Extension target (`tunnel`) generated with
  `@bacons/apple-targets`, including Network Extension and App Group entitlements.
- iOS `NETunnelProviderManager` bridge in the local Expo module, utun file
  descriptor discovery and `xray.tun.fd` handoff to libXray.
- `LibXray.xcframework` fetch script, local CocoaPods podspec and iOS CI cache.
  The unsigned IPA now contains the extension and can be signed by the user.

### Changed

- Generated routing rules no longer depend on `geoip.dat` / `geosite.dat`:
  private CIDRs are explicit and `bypass-ru` uses `domain:ru`. This makes the
  mobile runtime work without bundled geo assets.

### Notes

- Real iOS VPN still requires a paid Apple Developer profile with the
  `packet-tunnel-provider` entitlement and `group.net.ragenet.vpn` App Group.
  An unsigned IPA alone cannot start the tunnel.

## [0.1.11] - 2026-10-21

### Fixed

- App and VPN module had different `minSdkVersion` values (24 vs 26). The app
  now sets `minSdkVersion: 26` through `expo-build-properties`.

## [0.1.10] - 2026-10-21

### Fixed

- Android manifest merger failed because the app and the local VPN module shared
  the `net.ragenet.vpn` namespace. The module now uses `net.ragenet.vpn.nativevpn`.

## [0.1.9] - 2026-10-21

### Fixed

- Android CI ran out of disk while unpacking all four libXray ABIs. The workflow
  now frees runner space and uses an arm64-only trimmed AAR.

## [0.1.8] - 2026-10-21

### Added

- Android native Xray bridge: local Expo module, `VpnService`, libXray AAR,
  TUN fd handoff, `DialerController`, foreground notification and real connection lifecycle.
- `@ragenet/vpn` Expo bridge with automatic mock fallback for web/Expo Go.
- `tools/fetch-libxray.sh` and Android CI AAR cache.

### Changed

- Store now drives VPN state through the native bridge instead of local mock timers.
- Android app requests `FOREGROUND_SERVICE_SPECIAL_USE` and builds with Gradle caching.

## [0.1.7] - 2026-10-21

### Added

- Organic jittered particle sphere with irregular density, radius variation and outliers.
- Global particle tremble during hold, including when the finger moves inside the sphere.
- Telegram bot link on Home and in Settings.
- Native-feeling press states (iOS scale, Android ripple) and continuous border curves.
- Settings page sheet on iOS and animated slide on Android/web.
- CocoaPods/DerivedData caching and debug/release build modes in CI.

### Changed

- Sphere reduced to 1600 particles and a smaller footprint.
- Hold now triggers inside the sphere even while dragging; leaving the sphere cancels it.
- Removed the drag/play hint and the charge ring.
- Traffic and expiry cards made more compact.

### Fixed

- Settings version/build number now come from Expo config instead of hardcoded values.

## [0.1.6] - 2026-10-21

### Changed

- Split mobile CI into independent `Build Android` and `Build iOS` workflows.
- Android first build is arm64-only to fit the hosted runner memory budget;
  a universal arm64 + armeabi-v7a artifact is the next step.

## [0.1.5] - 2026-10-21

### Fixed

- Declared `babel-preset-expo` explicitly; iOS release bundling failed with
  `Cannot find module 'babel-preset-expo'` inside `Bundle React Native code`.

## [0.1.4] - 2026-10-21

### Fixed

- Removed the CI step that rewrote `android.ndkVersion`; the runner already
  provides the NDK and Gradle resolves it correctly.

## [0.1.3] - 2026-10-21

### Fixed

- Android CI resolves the installed NDK from `ANDROID_HOME/ndk` instead of an
  undefined `ANDROID_NDK_HOME`.
- iOS CI uses the macOS 26 runner and latest stable Xcode to satisfy Swift 6.2
  package requirements.

## [0.1.2] - 2026-10-21

### Fixed

- Updated GitHub Actions to current majors; `setup-android@v4` fixes the
  missing `tools` package failure on the mobile build runner.

## [0.1.1] - 2026-10-21

### Added

- Compact anchored subscription menu next to the "…" button: QR code, share,
  copy link, delete.
- Larger RageNet brand lockup with the wordmark.
- Tap, stationary press-and-hold and drag-only interaction model.
- Progressive charge tremble, charge ring and haptic ramp during hold.
- Speed-sensitive haptic ticks and local particle shiver while dragging.
- Smooth reaction pulse on connection state changes.
- Documentation: `docs/ROADMAP.md`, `docs/VERSIONING.md`.
- `pnpm version:check` and CI version consistency check.

### Changed

- Drag is now play-only; a movement above 26 px cancels the hold action.
- Particle size reduced and the cloud made denser.
- Connection-state reactions are softer and never start with a one-frame jump.
- Subscription menu no longer opens a bottom sheet/modal.

### Fixed

- Shadowsocks server names with percent-encoded flags are decoded correctly.
- Bottom sheets no longer clip their last action row.
- Expo config schema and app metadata validated with `expo-doctor`.

## [0.1.0] - 2026-10-21

### Added

- Initial Expo React Native + Tauri monorepo.
- RageNet design tokens, fonts, logo and generated app icons.
- Onboarding, home, settings and logs screens.
- Add-key, server picker and reset bottom sheets.
- Interactive 2 200-particle sphere with web Canvas2D and native Skia renderers.
- Remnawave subscription parser (base64, plain, JSON, full Xray config).
- Subscription metadata and HWID headers.
- Xray config builder with TUN inbound, stats and routing presets.
- Full-config sanitizer.
- Demo mode for web and mobile previews.
- Unit tests for subscription parsing, Xray config and particle simulation.
- Tauri 2 desktop shell scaffold.
- Native integration contracts for Android, iOS and desktop.
- CI workflow for typecheck, tests, prettier and web build.
