# RageNet app — working rules

## Read this first

This repository contains the **cross-platform client only**. The Python backend,
cabinet and subscription portal live in the main RageNet VPN repository.

Before changing code, read the document that matches the work:

- Product state and priorities: [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Architecture and data flow: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Versioning and release policy: [`docs/VERSIONING.md`](docs/VERSIONING.md)
- Builds and artifacts: [`docs/BUILDS.md`](docs/BUILDS.md)
- Signing: [`docs/SIGNING.md`](docs/SIGNING.md)
- iOS signing: [`docs/IOS_SIGNING.md`](docs/IOS_SIGNING.md)
- Signed IPA workflow: [`docs/SIGNED_IOS.md`](docs/SIGNED_IOS.md)
- Foundation history: [`docs/PHASE0.md`](docs/PHASE0.md)

Current baseline: **0.3.19**, native build numbers **22**, Android package
`net.ragenet.vpn`. The exact commit changes; do not hardcode it in code or docs.

## Product and configuration rules

1. The server subscription is the source of truth.
2. The current feed is a base64 list of share links. It is **not** full Xray
   JSON. It contains 26 rows: 24 connectable servers and 2 loopback markers.
3. Loopback markers are rendered as non-clickable group headers. They must never
   be selected, pinged, persisted as `selectedServerId`, or used as a proxy
   fallback.
4. Do not invent client-side settings for features the feed does not contain:
   balancer/observatory, global mux, sockopt, FakeDNS, fragment/noise, custom
   routing, local DNS/MTU UI. `extra.xmux` is XHTTP multiplexing, not Xray mux.
5. If the server starts sending these features later, first define the exact
   share-link/JSON contract, then add parsing and tests. Do not add UI toggles
   that do nothing.
6. Server-provided Hysteria2 `fm` is authoritative FinalMask JSON. Preserve
   `udp`, `tcp` and `quicParams`; do not rebuild it from only `obfs`/`mport`.
7. XHTTP `extra` is preserved as-is. Do not flatten or drop unknown fields.
8. Full JSON support exists as a hardened path, but is not the current feed.
   Keep only the TUN inbound; remove socks/http/mixed/dokodemo/API listeners.

## Security rules

- Never log subscription URLs, UUIDs, passwords, tokens or full configs.
- Generated configs must not start a local Xray API inbound. No
  `HandlerService`, `LoggerService` or API control port.
- Full-config sanitizer must drop every non-TUN inbound and all API blocks.
  Any sanitizer change needs a regression test.
- Ping configs built from full configs must contain only outbounds.
- Native helper commands must use a fixed command set, never shell strings.
- Do not commit signing keys, keystores, provisioning profiles, real
  subscription tokens or user-specific feeds.
- Do not put secrets into release notes or screenshots.

## Repository map

```text
apps/
  mobile/                       Expo React Native app
    index.ts / App.tsx
    app.json                    version, buildNumber, versionCode, plugins
    modules/ragenet-vpn/        Expo native module
      android/                  VpnService, ping service, haptics, bridge
      ios/                      Expo bridge, haptics, Keychain HWID
    targets/tunnel/             iOS Packet Tunnel extension
  desktop/                      Tauri shell (UI only, no sidecar/TUN yet)
packages/
  design/                       design tokens and themes
  core/                         subscription parser, Xray config, HWID
  vpn/                          native bridge contract, mock, tests
  particles/                    sphere simulation
  ui/                           screens, components, Zustand store
native/                         native versions and contracts
tools/                          icon generation, libXray fetch scripts
docs/                           product and engineering documentation
```

## Key code paths

| Area                                  | File                                                               |
| ------------------------------------- | ------------------------------------------------------------------ |
| Subscription parsing, headers, groups | `packages/core/src/subscription/parse.ts`                          |
| Share-link/outbound generation        | `packages/core/src/xray/outbound.ts`                               |
| Xray config, sanitizer, ping configs  | `packages/core/src/xray/config.ts`                                 |
| Bridge contract                       | `packages/vpn/src/types.ts`, `packages/vpn/src/expo.ts`            |
| App state, VPN start/stop, ping       | `packages/ui/src/store/useAppStore.ts`                             |
| Session persistence                   | `packages/ui/src/lib/sessionStorage.ts`                            |
| Navigation and modal base             | `packages/ui/src/RageNetApp.tsx`                                   |
| Server list and group headers         | `packages/ui/src/sheets/ServersSheet.tsx`                          |
| Sphere interaction                    | `packages/ui/src/components/particles/ParticleSphere.tsx`          |
| Native SVG renderer                   | `packages/ui/src/components/particles/ParticleRenderer.native.tsx` |
| Android VPN/ping/haptics              | `apps/mobile/modules/ragenet-vpn/android/`                         |
| iOS VPN/haptics                       | `apps/mobile/modules/ragenet-vpn/ios/`                             |
| iOS packet tunnel                     | `apps/mobile/targets/tunnel/`                                      |

## Architecture in one minute

```text
subscription URL
  → fetch with HWID headers
  → base64/plain/full JSON parser
  → metadata + server nodes + group markers
  → user selects a connectable server
  → buildXrayConfig / buildPingBatchConfig
  → Expo native module / Tauri bridge
  → Xray TUN (Android/iOS) or desktop shell
```

- Android: `VpnService` owns the TUN fd; libXray receives `xray.tun.fd`.
  Outbound sockets are protected with `LibXray.registerDialerController`.
- iOS: `NETunnelProviderManager` in the app; `PacketTunnelProvider` owns
  libXray and the utun fd. Logs use the shared App Group container.
- Desktop: Tauri UI only until sidecar/TUN helper is implemented.
- Pings run outside the active tunnel:
  - Android in the `:ping` process bound to a non-VPN network;
  - iOS in the main app with a physical interface.
- The particle sphere reads the display refresh rate (60/90/120 Hz) and uses
  360–600 particles on Android. Do not cap it to 30 fps.

## Change recipes

### Add or change a protocol/parameter

1. Add parser/outbound support in `packages/core`.
2. Preserve unknown fields; do not silently drop server data.
3. Add a unit test with a redacted fixture.
4. Check `buildPingBatchConfig` uses the same outbound semantics.
5. Test connection and per-location ping on a device.

### Hysteria2

- `fm` is URL-encoded JSON and belongs under `streamSettings.finalmask`.
- Keep `quicParams`, including `udpHop`, `maxIdleTimeout`, `keepAlivePeriod`,
  `disablePathMTUDiscovery`, congestion and bandwidth fields.
- `obfs`/`obfs-password`/`mport` are fallbacks only when `fm` is absent.
- Xray 26.10 does not support `insecure=1` without `pinSHA256`; do not add a
  fake insecure mode.

### XHTTP

- Keep exactly `host`, `path`, `mode`, `extra` in `xhttpSettings`.
- Preserve all `extra` keys, including `xmux`, `headers`, padding, session and
  uplink fields.
- Empty `xhttpSettings.host` is valid; Xray falls back to `serverName` then
  address.

### Subscription groups

- Keep loopback share links in the parsed list with `isGroup: true`.
- Filter them from selection, ping, connect and `selectedServerId` fallback.
- Render them as headers, not buttons.
- Keep the count of connectable servers separate from total rows.

### Android VPN permission

- `prepare()` must open the system consent dialog via
  `VpnService.prepare` + `startActivityForResult`.
- Resolve the Expo promise from `OnActivityResult`; do not show a toast and
  stop while the dialog is opening.
- If no activity is available, return `false` and let the UI ask the user to
  retry from the app.
- Only one Android VPN can be active; handle another VPN app being connected.

### Android ping

- `RageNetPingService` runs in `:ping`; it must use a non-VPN underlying network.
- Call `LibXray.touch()` before `LibXray.invoke` in the isolated process.
- Never ping group markers.
- Log failures to logcat; empty results are not enough for diagnosis.

### iOS tunnel

- A stale NetworkExtension profile can survive disconnect. The native module
  must stop and recreate the matching profile before a new start.
- Bound `startTunnel`/`stopTunnel` with timeouts; call completion exactly once.
- Keep `tunnel.log` and `xray.log` in the App Group container.
- Do not add React Native or Skia to the extension.
- Unsigned IPA is not a working VPN build.

### UI

- Navigation is not a full router: `screen` is `home | settings | logs`.
- Settings is a modal. When opening it from Logs, keep Logs as the base screen;
  do not let HomeScreen flash underneath.
- Keep the sphere as the single focal object.
- Use design tokens; do not add hardcoded colors.
- Test 390×844, 360×740 and desktop 460×900.
- Respect Reduce Motion where practical.
- Button labels may wrap to two lines; keep them centered and readable.

## Commands and required checks

Before every commit:

```bash
pnpm version:check
pnpm format:check
pnpm typecheck
pnpm test
pnpm build:web
```

Useful fixes:

```bash
pnpm format
pnpm --filter @ragenet/mobile exec tsc --noEmit
```

CI: `.github/workflows/ci.yml` runs version, formatting, types, tests and web
build. Native builds are separate workflows; do not claim them passing locally
unless actually run.

## Versioning and releases

- App version must match in:
  - `package.json`
  - `apps/mobile/package.json`
  - `apps/mobile/app.json` → `expo.version`
  - `apps/desktop/package.json`
  - `apps/desktop/src-tauri/tauri.conf.json`
- Bump PATCH for fixes, MINOR for user-facing features, MAJOR for incompatible
  profile/storage changes.
- Bump `ios.buildNumber` and `android.versionCode` every release.
- Every code change needs a Keep a Changelog entry in `CHANGELOG.md`.
- Do not bump native core versions for app-only changes.

Release checklist:

1. Run all checks.
2. Bump app version/build numbers.
3. Update `CHANGELOG.md` and `docs/ROADMAP.md` if a milestone moved.
4. Commit and push.
5. Run Android, iOS and desktop workflows.
6. Verify all eight release assets.
7. Verify Android APK contains `assets/index.android.bundle`.
8. Verify iOS IPA contains `main.jsbundle` and `PlugIns/tunnel.appex`.
9. Update release notes; keep the newest release as `latest`.
10. For iOS signing, confirm Network Extension profiles.

Expected assets are documented in [`docs/BUILDS.md`](docs/BUILDS.md).

## Testing matrix

Minimum before release:

- Parser: base64, plain, JSON, full config, group markers.
- Outbound: VLESS Reality, VLESS XHTTP Reality/TLS, Hysteria2 `fm`, XHTTP
  `extra`, Shadowsocks, Trojan/VMess.
- Config: no API, no local inbound, ping config only outbounds.
- Android: release APK starts without Metro; permission dialog; connect;
  per-location ping; cancel ping; subscription persistence.
- iOS: signed IPA starts; connect/disconnect; Hysteria; network switch;
  stale-tunnel recovery; logs.
- Desktop: installers launch; UI only until TUN is implemented.

## Debugging

### Android

```bash
adb devices -l
adb shell getprop ro.product.cpu.abi
adb install -r RageNet-<version>-android-arm64-release.apk
adb logcat -c
adb shell am start -W -n net.ragenet.vpn/.MainActivity
adb logcat -d -v threadtime > /tmp/ragenet.log
```

Filter for `FATAL EXCEPTION`, `AndroidRuntime`, `ReactNativeJS`, `RageNet`,
`RageNetPingService`, `UnsatisfiedLinkError`, `SIGSEGV`.

Check the APK:

```bash
unzip -l RageNet-<version>-android-arm64-release.apk | grep index.android.bundle
unzip -p RageNet-<version>-android-arm64-release.apk assets/app.config
```

If Android release crashes at startup:

- Do not assume R8; currently minify is off.
- Check `ReactNativeJS` for fatal JS errors.
- Remember Expo native functions may be synchronous on Android while the JS
  bridge previously expected a Promise. Normalize with `Promise.resolve`.
- Check `getStatus`, `getLogs`, `clearLogs`, `prepare` and display-refresh calls.
- Do not enable R8 without a device smoke test.

### iOS

- Use the signed IPA, not the unsigned release.
- Read `tunnel.log` and `xray.log` from the app Logs screen.
- If the tunnel is stuck, call the native reset path; reboot should not be the
  only recovery.
- Check iOS Settings → VPN for RageNet and another VPN app.
- Confirm both profiles include `packet-tunnel-provider`; App Group is needed
  only for shared logs.

## Common pitfalls

- Calling `.then()` on a synchronous Expo module result.
- Forgetting `LibXray.touch()` in the isolated ping process.
- Adding a client-side setting that the server feed never provides.
- Treating `xmux` as global Xray mux.
- Rebuilding Hysteria `fm` instead of preserving it.
- Letting loopback group markers become selectable servers.
- Re-enabling R8 without checking native startup.
- Hardcoding 30 fps for the sphere.
- Rendering `HomeScreen` under the settings modal when coming from Logs.
- Assuming the desktop shell has a working TUN.
- Committing a real subscription token or a signed artifact.

## Known current limitations

- iOS IPA is unsigned; VPN extension needs paid Apple Developer Program and two
  profiles.
- Desktop has no Xray sidecar/TUN helper.
- Live traffic speed is not implemented yet; subscription quota comes from
  headers.
- Auto-refresh, reconnect and network-change handoff are not complete.
- `profile-update-interval` is parsed but not yet used for automatic refresh.
- Full JSON advanced features (balancer/observatory/mux/sockopt/FakeDNS/
  fragment/noise) are not in the current feed and are not exposed in UI.
- Hysteria2 `insecure=1` without `pinSHA256` is unsupported under Xray 26.10.
- Android arm64 only; x86/32-bit artifacts are not built.

## Next priorities

1. Stabilize 0.3.19 on physical Android and signed iOS.
2. Verify VPN permission, ping and iOS stale-tunnel recovery.
3. Reconnect and `setUnderlyingNetworks`.
4. Subscription auto-refresh.
5. Native traffic stats and notification.
6. Desktop sidecar/TUN and signed releases.

## Documentation maintenance

When behavior changes, update the closest document in the same commit:

- feature/architecture → `docs/ARCHITECTURE.md`
- phase/priority → `docs/ROADMAP.md`
- commands/release → `docs/BUILDS.md`, `docs/VERSIONING.md`
- signing → `docs/SIGNING.md`, `docs/IOS_SIGNING.md`, `docs/SIGNED_IOS.md`
- foundation/history → `docs/PHASE0.md`
- workflow rules → this `AGENTS.md`

Do not leave a doc claiming a feature is done when it is only planned, or vice
versa.
