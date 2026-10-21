# Desktop VPN layer

## Phase 0 shell

Tauri wraps the Expo web export (`apps/mobile/dist`). The Rust command surface
is intentionally empty except `vpn_status`, so the UI can run without elevation.

## Next step: Xray sidecar

Bundle a pinned `xray` binary per target:

- Windows x64/arm64: `xray.exe` + `wintun.dll`
- macOS universal: `xray` (x64 + arm64)
- Linux x64/arm64: `xray`

Generate a config with the `tun` inbound. On Windows use
`autoSystemRoutingTable` and `autoSystemWfpBlockLeak`; on Linux use
`autoSystemRoutingTable` and `autoSystemDnsToGateway`.

## Privilege model

TUN creation and route/DNS changes need root/Administrator. Keep the webview
unprivileged and run a small helper:

- Windows: UAC prompt or a Windows service over a named pipe.
- macOS: `osascript` admin prompt for a session, then a launchd daemon via
  `SMAppService` for a silent experience.
- Linux: `pkexec`/polkit, with a `.deb` that installs a helper with
  `CAP_NET_ADMIN`.

The helper must accept a fixed command set and a validated config path. Never
pass arbitrary command-line arguments from the renderer.

## Fallback

Until the helper is implemented, desktop can use Xray in SOCKS/HTTP mode and
set the system proxy (Windows registry, `networksetup` on macOS, `gsettings` on
Linux). This is enough to validate the UI and subscription flow, but it is not
a system-wide VPN.
