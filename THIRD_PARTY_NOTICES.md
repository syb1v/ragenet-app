# Third-party notices

RageNet bundles or links the following open-source components. This file is a
working draft; it must be completed before the first public binary release.

## Xray-core

- Project: https://github.com/XTLS/Xray-core
- License: Mozilla Public License 2.0 (MPL-2.0)
- Usage: proxy core, TUN inbound, routing, stats API.
- Notes: MPL is file-level copyleft. If we modify Xray-core source files, those
  modified files must be made available under MPL-2.0. Unmodified binaries may
  be distributed with this notice.

## libXray

- Project: https://github.com/XTLS/libXray
- License: MIT
- Usage: gomobile/FFI wrapper around Xray-core, subscription decoding, ping,
  `xray.tun.fd` support.

## OneXray

- Project: https://github.com/YuanDevTeam/OneXray
- License: GNU General Public License v3.0
- Usage: reference for native Packet Tunnel / VpnService integration and
  platform behavior. If any source code is copied or adapted, the combined
  work remains AGPL-3.0/GPL-3.0-compatible and this attribution must be kept.

## React Native / Expo / Tauri

- React Native: MIT
- Expo: MIT (individual packages may have different licenses)
- Tauri: MIT / Apache-2.0
- React Native Skia: MIT
- Lucide icons: ISC
- Manrope / IBM Plex Mono: SIL Open Font License 1.1

## Before release

- Generate a complete dependency license report.
- Add the full license texts for every bundled component.
- Add an in-app "Licenses" screen that loads the generated notices.
- Confirm that the app repository license (AGPL-3.0) is compatible with every
  copied native component.
