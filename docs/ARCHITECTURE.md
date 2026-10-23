# RageNet app — architecture

## Decisions

| Area     | Decision                        | Why                                                                             |
| -------- | ------------------------------- | ------------------------------------------------------------------------------- |
| Mobile   | Expo / React Native, TypeScript | One codebase for Android + iOS, native modules where needed                     |
| Desktop  | Tauri 2 + React Native Web      | Shared UI, small binaries, Rust for sidecar/helper                              |
| VPN core | Xray-core via `libXray`         | Supports Remnawave protocols and has a built-in TUN inbound                     |
| TUN      | Xray `tun` inbound              | No separate tun2socks process, lower memory and fewer moving parts              |
| Auth     | Subscription key only           | Matches the reference UX; billing stays in the web cabinet                      |
| Repo     | Separate `ragenet-app`          | Independent releases, CI secrets and versioning                                 |
| License  | AGPL-3.0                        | Compatible with reused GPLv3 native code and the existing open-source direction |

## Layers

```
apps/mobile  ─┐
apps/desktop ─┼─ packages/ui ── packages/design
              ├─ packages/core ── subscription / Xray config / HWID

packages/ui ── packages/particles (sphere simulation)
  └─ packages/vpn contract (native bridge)

apps/mobile/modules/ragenet-vpn/android  VpnService + ping service + libXray.aar
apps/mobile/modules/ragenet-vpn/ios      Expo bridge + LibXray.xcframework
apps/mobile/targets/tunnel               Packet Tunnel extension + App Group logs
native/desktop                           Xray sidecar + privileged helper (planned)
```

`packages/core` is platform-agnostic. It must not import React, React Native or
filesystem APIs. This keeps subscription parsing and Xray config generation
testable in Node and reusable on every platform.

## Data flow

```
subscription URL
  → fetch with Remnawave/HWID headers
  → decode base64 / plain / full JSON
  → parse metadata + server nodes + group separators
  → user picks a connectable server
  → build Xray JSON (TUN inbound, DNS, routing)
  → native bridge starts the core
  → native status events come back to the UI
```

The current subscription feed is a base64 list of share links. It contains 26
rows: 24 connectable servers and two loopback markers rendered as non-clickable
group headers. Loopback markers are never selected, pinged, or used as a proxy.

### Subscription metadata

Supported headers and body lines:

- `profile-title`, `subscription-name`
- `profile-update-interval`
- `subscription-userinfo` (`upload`, `download`, `total`, `expire`)
- `support-url`, `support-email`
- `profile-web-page-url` / `homepage`
- `announce`, `announce-url`
- `hide-url`, `sort-order`
- body `#profile-title:`, `#support-url:`, `#announce:`, etc.

`expire` values above 32 000 000 000 are treated as milliseconds.
`profile-update-interval` is parsed but automatic refresh is not implemented
yet; the UI currently has a manual refresh action.

### Xray config

The generated config always contains:

- a `tun` inbound (`ragenet0`, MTU 1500, sniffing);
- the selected proxy outbound;
- `direct` and `block` outbounds;
- routing rules for local traffic and the final proxy route.

The client does not start a local Xray API inbound. Live traffic counters are
planned for the native tunnel layer; until then the UI shows the subscription
quota from `subscription-userinfo`, not real-time speed.

Hysteria 2 links are emitted as Xray's `hysteria` outbound over the
QUIC/HTTP3 `hysteria` transport. The server-provided `fm` FinalMask JSON is
preserved, including `quicParams` such as `udpHop`, idle timeout and keepalive.
XHTTP links preserve advanced `extra` settings (padding, session/uplink keys
and xmux) instead of flattening them.

Full configs returned by a provider are sanitized before use: every non-TUN
inbound is removed, the API block is removed, and a TUN inbound is added if
missing. Full-config probes keep only outbounds, so a ping cannot start
provider-provided listeners. The client currently receives share-link feeds, so
this path is a hardening measure for future imports.

### Renderer and display refresh

The particle sphere reads the native display refresh rate (60/90/120 Hz) and
uses it as the paint budget. Android uses 360–600 particles depending on the
refresh rate and screen width; iOS keeps its existing cloud. Renderer state is
batched into one update per animation frame.

## Native contracts

### Android

`VpnService` creates the TUN and passes its fd through `xray.tun.fd`. Xray
outbound sockets are protected through `LibXray.registerDialerController`.
Foreground service type is `specialUse` with subtype `vpn` on Android 14+.
VPN consent is requested through `VpnService.prepare` and an Expo promise
resolved by `OnActivityResult`; the tunnel starts only after `RESULT_OK`.

Per-location ping runs in the separate `:ping` process. That process binds to a
non-VPN underlying network, calls `LibXray.touch()`, and invokes `pingBatch`, so
a probe does not enter the active tunnel and does not need a local API inbound.

### iOS

The main app owns `NETunnelProviderManager`; the Packet Tunnel extension owns
`LibXray`. The config travels through the App Group/Keychain. The extension
must stay under the ~50 MB memory limit: no React Native, no Skia, no large geo
databases inside it. Before start, a stale tunnel profile is stopped and
recreated; start/stop operations are bounded by timeouts. `tunnel.log` and
`xray.log` are written to the shared App Group container.

### Desktop

Tauri starts Xray as a sidecar. TUN/route changes are performed by a small
privileged helper with a fixed command surface. The webview never runs elevated.
System-proxy mode is the fallback until the helper is shipped.

## State machine

```
disconnected → connecting → connected → disconnecting → disconnected
                     ↘ error
```

The native layer is the source of truth. The UI may show an optimistic
`connecting` state, but it must reconcile with the next native event. Timers
are always cancellable; a stale start result must not overwrite a newer state.

## Security

- Subscription URLs and UUIDs are secrets: never log them, redact in exported
  logs, store in Keychain/Keystore/keyring.
- Keep only the TUN inbound in full configs; never start provider-provided
  SOCKS/HTTP/API listeners.
- Desktop helper accepts a fixed command set, not a shell.
- CSP in Tauri; no remote content in the webview.
- Update artifacts are checksummed/signed before production.
- iOS/Android update integrity is verified before prompting the user.

## Maintenance

- `native/versions.json` pins libXray/Xray/Go/NDK versions.
- Bump the core deliberately, then run the staging connection matrix:
  VLESS Reality, VLESS WS/TLS, gRPC, XHTTP, Trojan, Shadowsocks, full config.
- Keep parser/config regression fixtures in `packages/core/test` and add one
  for every new Remnawave header/format.
- Current test suites: `packages/core/src/xray/config.test.ts`,
  `packages/core/test/outbound.test.ts`, `packages/core/test/subscription.test.ts`,
  `packages/vpn/test/expo.test.ts`.
- Remote config endpoint (next phase) controls minimum version, support URL and
  feature flags without a store release.
