# RageNet app — working rules

## Scope

This repository contains the cross-platform client only. The Python backend,
cabinet and subscription portal live in the main RageNet VPN repository.

- Product plan and dates: [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Versioning and release policy: [`docs/VERSIONING.md`](docs/VERSIONING.md)
- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Builds: [`docs/BUILDS.md`](docs/BUILDS.md)
- Signing: [`docs/SIGNING.md`](docs/SIGNING.md)

## Before every commit

```bash
pnpm version:check
pnpm format:check
pnpm typecheck
pnpm test
pnpm build:web
```

All checks must pass. If a command cannot run because the environment lacks
Xcode/Android SDK/Rust, say so explicitly and list what was not verified.

## Versioning

- Root `package.json`, `apps/mobile/package.json`, `apps/mobile/app.json`,
  `apps/desktop/package.json` and `apps/desktop/src-tauri/tauri.conf.json` use
  the same app version.
- Bump PATCH for fixes, MINOR for features, MAJOR for incompatible profile or
  storage changes. Do not bump native core versions for app changes.
- Add a Keep a Changelog entry for every code change and update
  `docs/ROADMAP.md` when a milestone moves.
- Run `pnpm version:check`; it verifies all version locations and the changelog
  entry. CI runs the same check.
- Native core versions live in `native/versions.json`; change them only with a
  tested staging connection matrix.

## Security

- Never log subscription URLs, UUIDs, passwords or full configs.
- Any change to the full-config sanitizer needs a regression test.
- Native helper commands must not accept arbitrary paths or shell arguments.
- Do not commit signing keys, provisioning profiles or keystores.

## UI

- The shared design tokens are the source of truth. Do not hardcode new colors
  in screens; add a token and use it on web/native.
- The main screen has one focal object: the particle sphere. Avoid adding
  tabs, dashboards or extra cards without an explicit product decision.
- Test at 390×844 and 360×740, plus desktop 460×900.
- Respect Reduce Motion and provide an accessible button fallback for the
  tap-or-hold gesture.

## Native

- Xray TUN inbound is the chosen integration; do not add tun2socks.
- Android: protect every outbound socket through `DialerController`.
- iOS: no React Native or Skia inside the Packet Tunnel extension.
- Desktop: the webview never runs elevated.
