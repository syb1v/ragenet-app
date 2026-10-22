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

native/android  VpnService + libXray.aar
native/ios      Packet Tunnel + LibXray.xcframework
native/desktop  Xray sidecar + privileged helper
```

`packages/core` is platform-agnostic. It must not import React, React Native or
filesystem APIs. This keeps subscription parsing and Xray config generation
testable in Node and reusable on every platform.

## Data flow

```
subscription URL
  → fetch with Remnawave/HWID headers
  → decode base64 / plain / full JSON
  → parse metadata + server nodes
  → user picks a server
  → build Xray JSON (TUN inbound, DNS, routing, stats)
  → native bridge starts the core
  → status/stats events come back to the UI
```

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

### Xray config

The generated config always contains:

- a `tun` inbound (`ragenet0`, MTU 1500, sniffing);
- a loopback-only stats API inbound;
- the selected proxy outbound;
- `direct` and `block` outbounds;
- routing rules for API, local traffic and the final proxy route;
- stats/policy blocks.

Full configs returned by a provider are sanitized before use: every non-TUN
inbound is forced to `127.0.0.1`, public `dokodemo-door`/SOCKS/HTTP inbounds are
not allowed to listen on external interfaces, and the TUN/stats plumbing is
added if missing.

## Native contracts

### Android

`VpnService` creates the TUN and passes its fd through `xray.tun.fd`. Xray
outbound sockets are protected through `LibXray.registerDialerController`.
Foreground service type is `specialUse` with subtype `vpn` on Android 14+.

### iOS

The main app owns `NETunnelProviderManager`; the Packet Tunnel extension owns
`LibXray`. The config travels through the App Group/Keychain. The extension
must stay under the ~50 MB memory limit: no React Native, no Skia, no large geo
databases inside it.

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
- Force full-config inbounds to loopback; do not allow arbitrary public listeners.
- Desktop helper accepts a fixed command set, not a shell.
- CSP in Tauri; no remote content in the webview.
- Update artifacts are checksummed/signed before production.
- iOS/Android update integrity is verified before prompting the user.

## Maintenance

- `native/versions.json` pins libXray/Xray/Go/NDK versions.
- Bump the core deliberately, then run the staging connection matrix:
  VLESS Reality, VLESS WS/TLS, gRPC, XHTTP, Trojan, Shadowsocks, full config.
- Keep subscription fixtures in `packages/core/test/fixtures` and add one for
  every new Remnawave header/format.
- Release cadence: app every 2 weeks, native core monthly, toolchains quarterly.
- Remote config endpoint (next phase) controls minimum version, support URL and
  feature flags without a store release.
