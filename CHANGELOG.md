# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.15] - 2026-10-23

### Fixed

- Android release builds now explicitly disable R8 minification and resource
  shrinking. The previous Release APK was standalone but could fail on launch
  after R8 stripped code required by native modules.

## [0.3.14] - 2026-10-23

### Changed

- Locations are now pinged as independent jobs with up to four probes in
  flight; each row is updated as soon as that location responds or times out.
- Tapping the sphere cancels an active ping immediately and unblocks
  connect/disconnect without waiting for the native probe to finish.
- The sphere now shows a smooth ping scan with a cyan-violet shimmer, a
  slightly faster spin and a soft glow while locations are being measured.

### Fixed

- Late results from a cancelled ping are ignored instead of overwriting the
  UI.

## [0.3.13] - 2026-10-22

### Fixed

- Android releases now default to a self-signed Release APK with the embedded
  `index.android.bundle` instead of the development Debug APK, which required
  Metro and failed with `Unable to load script` on a standalone phone.

## [0.3.12] - 2026-10-22

### Changed

- Renderer animation loops no longer restart when the VPN state changes,
  removing the canvas reset and visual jerk between statuses.
- Status changes no longer trigger an extra radial reaction pulse in the
  particle simulation.
- Particle and glow colors now transition over roughly 600 ms instead of
  snapping in about 250 ms.
- The connection status pill now animates background, border, dot and text
  colors with Reanimated, and crossfades its label.

## [0.3.11] - 2026-10-22

### Fixed

- The particle renderer now uses an oversized centered surface instead of a
  square canvas/SVG viewport, so burst particles are not cut into a square.
- The connection timer reserves a permanent slot, preventing the subscription
  card and bottom controls from jumping when the timer appears or disappears.
- Native sphere glow now fades smoothly between disconnected and connected
  states instead of snapping on and off.

## [0.3.10] - 2026-10-22

### Changed

- The explosion now has a dedicated native haptic burst layered from a short
  continuous rumble and several transient impacts, instead of switching to a
  single medium impact after the particle stream stops.
- Continuous particle haptics leave amplitude headroom so the explosion reads
  as a stronger contrast.
- The sphere now expands through a visible 1.85× peak before settling back to
  1.0 over a longer release animation.

## [0.3.9] - 2026-10-22

### Added

- Per-location latency measurement through libXray `pingBatch`, in isolated
  batches of up to five proxy outbounds. Each location is probed through its
  own proxy exit instead of inheriting the selected tunnel's latency.
- Subscription and selected-location persistence through SecureStore with
  chunking for large full-config payloads and a browser localStorage fallback.

### Fixed

- Closing and reopening the app no longer asks for the subscription again.
- Android pingBatch runs in an isolated `:ping` process bound to the
  underlying non-VPN network; iOS probes bind to the physical interface so
  they do not re-enter the active utun.

## [0.3.8] - 2026-10-22

### Added

- Native continuous particle haptics. Every trembling particle contributes
  energy, density and rate to the phone vibration; iOS uses Core Haptics and
  Android uses an amplitude waveform instead of the old fixed hold ramp.

## [0.3.7] - 2026-10-22

### Fixed

- Full Xray configs now use their top-level `remarks` (or
  `meta.serverDescription`) as the location name instead of falling back to
  the proxy outbound tag. Flag and country detection now works as expected.

## [0.3.6] - 2026-10-22

### Added

- Hysteria 2 support through the Xray `hysteria` outbound and QUIC/HTTP3
  transport. Supports `hysteria2://` / `hy2://` links, auth in userinfo or
  `auth`, SNI, ALPN, certificate pinning, Salamander obfs, bandwidth limits
  and port hopping.
- Advanced XHTTP `extra` settings are now carried over from share links
  instead of dropping all padding, session, uplink and xmux options.

### Fixed

- The TUN fallback route in a full Xray config is inserted before the final
  catch-all rule instead of after it, where it was unreachable.
- Updated libXray/Xray to v26.10.21 with the current certificate set and
  Hysteria 2 transport support.

## [0.3.5] - 2026-10-22

### Changed

- The charge tremor is now generated independently per particle, with its own
  gain, onset, frequency and direction instead of a shared sphere-wide shake.
- The current location keeps the real HTTPS latency through the active proxy.
- Every other location is measured by a TCP handshake to its actual entry
  node, so unreachable or placeholder locations stay empty instead of showing
  the selected location's latency.

## [0.3.4] - 2026-10-22

### Fixed

- Remnawave now receives one stable HWID per installation instead of a new
  random UUID on every launch.
- Android derives the HWID from the signing-scoped `ANDROID_ID`; iOS stores a
  generated UUID in the Keychain so it survives app deletion and reinstall.
- Latency is now measured with a fresh HTTPS request to
  `https://www.gstatic.com/generate_204` through the active tunnel, including
  DNS, TCP and TLS. Probing the VPN entry port from inside the tunnel made the
  proxy connect to itself and produced fake 3-20 ms values.
- The latency probe domain is explicitly routed through the selected proxy,
  including in full custom Xray configs.

## [0.3.3] - 2026-10-22

### Changed

- Dragging across the sphere no longer starts the hold/explosion; only a
  stationary hold charges it.
- Dragging emits travelling liquid ripples in addition to local particle
  repulsion.
- Leaving the sphere clears the pointer impression immediately.
- The hold vibration now starts slowly and accelerates non-linearly near the
  release.
- Larger, fewer sphere particles and a visible 1.3× burst overshoot.
- Layered haptic impacts for a deeper hold pulse.

## [0.3.2] - 2026-10-22

### Changed

- Fewer and larger sphere particles.
- The release now expands through a visible 1.3× overshoot before settling
  back to 1.0 instead of jumping from the compressed state to normal size.
- Stronger layered hold haptics with light/medium impacts and a tighter pulse
  ramp.

## [0.3.1] - 2026-10-22

### Fixed

- Location sheet scrolling is no longer blocked by swipe-to-dismiss; the drag
  area is limited to the handle.
- Ping resets previous values, shows pending rows and no longer tears down the
  active connection.
- HTTP latency uses `https://www.gstatic.com/generate_204` through the active
  tunnel, with TCP fallback.
- Copy actions now show a toast above sheets and menus.
- Core Xray logs are collected alongside tunnel lifecycle logs.
- Location switching waits for the old tunnel to stop before starting the new
  one.
- Home cards are anchored toward the bottom while the sphere/status stay
  centered above them.

## [0.3.0] - 2026-10-22

### Added

- Anchored native-style menu for the subscription actions.
- Swipe-to-dismiss server selection sheet.
- QR camera scanner for subscription links.
- HTTP GET latency probe with TCP fallback and latency colour thresholds.
- Selected-server ping from the main screen.
- Automatic tunnel restart when changing the selected location.
- Silent pause/resume around latency probes while connected.
- English log levels: ALL / INFO / WARN / ERROR.

### Changed

- Compact home composition: connection status stays under the sphere while
  traffic, expiry, location and support controls are pinned toward the bottom.
- Enlarged launcher logo and in-app RageNet mark.
- More immediate and stronger sphere vibration.
- Removed the demo subscription and demo mode.
- Full Xray configs receive an explicit TUN fallback route.

### Fixed

- Tunnel restoration after location changes and latency probes.
- QR permission flow on native platforms.

## [0.2.1] - 2026-10-22

### Changed

- Desktop now opens as a wide native-style workspace instead of a phone-sized
  web column: sidebar navigation, wider connection canvas and installers only
  in GitHub Releases.
- Desktop and web root backgrounds fill the window; the support row remains
  pinned to the bottom on mobile.

## [0.2.0] - 2026-10-22

### Added

- Platform-native icons: SF Symbols on iOS and Material icons on Android.
- Native iOS action sheet for the subscription menu.
- Real TCP latency probing through the native VPN bridge.
- Native tunnel log collection with All/Info/Warn/Error filters, clear and
  download actions.
- Animated bottom sheets that slide in and out instead of fading.

### Changed

- Compact home layout: support and Telegram links sit at the bottom, the
  interaction hint is gone, refresh uses one arrow, and the ping action uses a
  speedometer that becomes live dots while measuring.
- Particle positions now use a deterministic Fibonacci shell with layered
  depth instead of an unconstrained random volume.
- Settings rows are tighter and the licenses row is removed.

## [0.1.29] - 2026-10-22

### Changed

- Particle tremble now ramps in cubically, stays low through the first half of
  the hold, and accelerates only near the release.
- The tremble frequency is slower at rest and rises with the charge instead of
  starting at full speed.
- Vibration fades out during the burst rather than snapping off.
- Particle dots, especially foreground dots, are slightly smaller; native
  stroke widths were reduced to match.

## [0.1.28] - 2026-10-22

### Changed

- Tap now plays the resting-state wave first and only then transitions into
  the connecting colour, so the wave no longer reads as a pale flash.
- Increased the native particle redraw rate for a smoother gather and release.

## [0.1.27] - 2026-10-22

### Changed

- Softened the tap wave: one slow front, wider and dimmer, with a longer
  fade-in instead of a bright flash.
- Kept the finger's repulsion active through the gather phase and only removed
  it when the energy is released.
- Moved compression and release into the particle simulation: particles gather
  toward the centre, then receive a damped radial impulse.
- Extended the hold transition to a 1.5 second gather, a compressed pause and a
  2 second physical release.
- Added soft haptic feedback during the gather phase.

## [0.1.26] - 2026-10-22

### Fixed

- Desktop icons now use RGBA PNG/ICNS assets accepted by Tauri.
- The Linux desktop build no longer installs the obsolete appindicator package
  that conflicts with libayatana-appindicator.

## [0.1.25] - 2026-10-22

### Changed

- The tap response is now one soft wavefront that travels from the finger
  across the sphere, instead of several concentric rings.
- The particle cloud uses fewer, larger particles in a volumetric distribution,
  with irregular per-particle tremble so vibration no longer forms a grid.
- Touch repulsion has a wider, softer area around the finger.
- The hold-to-connect transition now gathers the sphere inward more slowly,
  then expands it with a longer, damped burst.
- The home screen shows a countdown while charging and hands the state over to
  the connection flow when the burst begins.

## [0.1.24] - 2026-10-22

### Added

- Liquid tap wave on the RageNet sphere.
- Eight-second hold charge with pointer repulsion, increasing particle
  tremble, a compress/burst transition and a soft progressive haptic ramp.
- Connected-state timer and a quieter lavender connected status.

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
