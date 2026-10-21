# Versioning and releases

## App version

RageNet app follows [Semantic Versioning](https://semver.org/):

- **PATCH** — fixes, copy changes, small UI corrections.
- **MINOR** — new user-facing features, new screens, new settings.
- **MAJOR** — incompatible profile/storage changes or a new architecture.

The app version must be identical in:

- `package.json`
- `apps/mobile/package.json`
- `apps/mobile/app.json` → `expo.version`
- `apps/desktop/package.json`
- `apps/desktop/src-tauri/tauri.conf.json`

Run:

```bash
pnpm version:check
```

The CI runs the same check. A mismatch blocks the build.

## Changelog

Every code change gets an entry in `CHANGELOG.md` using
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/):

```md
## [0.1.2] - 2026-10-24

### Fixed

- ...
```

Use `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
Documentation-only changes may omit the changelog entry.

## Tags

| Tag                 | Meaning                    |
| ------------------- | -------------------------- |
| `app-v0.1.1`        | client release             |
| `native-v26.10.17`  | libXray/Xray native assets |
| `app-v0.2.0-beta.1` | pre-release                |

Tags are created only after all checks pass and artifacts are uploaded.

## Native core versions

Native versions are independent from the app version and live in
`native/versions.json`:

- libXray
- Xray-core
- Go
- Android NDK
- min/target SDK
- iOS/macOS minimums

Bump them deliberately, then run the staging connection matrix:
VLESS Reality, VLESS WS/TLS, gRPC, XHTTP, Trojan, Shadowsocks, full config.

## Build numbers

- Android `versionCode`: monotonically increasing, derived from CI run number or
  a dedicated counter.
- iOS `CFBundleVersion`: monotonically increasing build number, separate from
  the marketing version.
- Desktop installers use the app version; updater manifests use SemVer.

These values are not in the repository yet; add them when the native projects
are generated.

## Release checklist

1. `pnpm version:check`
2. `pnpm format:check`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm build:web`
6. Update `CHANGELOG.md`
7. Run native build workflows
8. Verify artifacts and checksums
9. Create tag `app-vX.Y.Z`
10. Publish GitHub Release with notes and `SHA256SUMS.txt`
11. Update `docs/ROADMAP.md` if a milestone changed
12. For iOS: confirm signing profile includes Network Extension entitlement

## Hotfix

1. Branch from the released tag.
2. Bump PATCH.
3. Add a `Fixed` changelog entry.
4. Run the full checklist.
5. Release `app-vX.Y.Z+1`.

## Backend

The Python backend and cabinet live in the main RageNet VPN repository and keep
their own versioning/CHANGELOG rules. The app version is not tied to the backend
version; compatibility is expressed through the remote config `min_version`.
