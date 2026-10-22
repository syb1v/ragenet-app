# Phase 0 — foundation

**Status:** done · **App version:** 0.3.7 · **Next:** Phase 1 (Android VPN MVP)

See [ROADMAP.md](ROADMAP.md) for dates and [VERSIONING.md](VERSIONING.md) for
release rules.

## Done

- [x] Separate `ragenet-app` repository skeleton with pnpm workspace.
- [x] AGPL-3.0 license and branding assets.
- [x] Design tokens matching the cabinet (`rage-ds.css`).
- [x] Onboarding, home, settings, logs, add-key sheet, server sheet, reset sheet.
- [x] Interactive RageNet sphere with tap-or-hold connect and native SVG rendering.
- [x] Soft selection-tick haptics, progressive hold feedback and state transitions.
- [x] Progressive haptic ramp for press-and-hold.
- [x] Gentle drag feedback and full press/release lifecycle.
- [x] Compact anchored subscription menu (QR, share, copy, delete).
- [x] Tap / stationary hold actions; drag is play-only.
- [x] Remnawave subscription parser (base64, plain, JSON, full config).
- [x] Metadata parser (headers + body lines).
- [x] Xray config builder with TUN inbound, stats, routing presets.
- [x] Full-config sanitizer (loopback-only inbounds).
- [x] HWID/device info helper.
- [x] Unit tests for parser and Xray config.
- [x] Branded mobile/desktop icons generated from the logo.
- [x] Tauri 2 desktop shell scaffolding.
- [x] Architecture, native contracts, signing notes.
- [x] GitHub Actions CI for types/tests/prettier/web build.
- [x] Android/iOS JS bundles verified (`expo export`).

## Not done yet

- [ ] `packages/vpn` native bridge + real Android `VpnService`.
- [ ] libXray AAR/XCFramework wiring.
- [ ] iOS Packet Tunnel target + App Group.
- [ ] Tauri Xray sidecar + privileged helper.
- [ ] Real subscription fetch on device (including CORS-free native fetch).
- [ ] Real ping/statistics from Xray.
- [ ] Full config import UI.
- [ ] QR camera scanner.
- [ ] Localization extraction (RU/EN).
- [ ] App update checks, crash reporting, remote config.
- [ ] GitHub release workflows for signed/unsigned artifacts.
- [ ] Staging Remnawave test matrix.
- [ ] `THIRD_PARTY_NOTICES.md`.

## Next checkpoint

Phase 1 starts with a native spike:

1. Add `expo-modules-core` module `RageNetVpn`.
2. Android `VpnService` with a stub TUN and `LibXray.invoke`.
3. Connect to a staging VLESS Reality node.
4. Add status + traffic events to the existing store.
5. Build a universal debug APK in CI.

Do not start iOS Packet Tunnel work until the Apple Developer Program question
is resolved; the code can be written, but it cannot be validated without the
Network Extension entitlement.
