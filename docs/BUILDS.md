# GitHub Actions builds

## Android APK

Workflow: `.github/workflows/build-android.yml`

What it does:

1. Installs Java 21, Android SDK/NDK r29, pnpm and restores the libXray AAR cache.
2. Runs `expo prebuild --platform android`.
3. Builds a Debug APK for manual runs / Release APK for tags (arm64-v8a).
4. Uploads `RageNet-<version>-android-arm64.apk` and `SHA256SUMS-android.txt`.

The first workflow build is arm64-only to keep the runner stable and fast.
A universal arm64 + armeabi-v7a APK is the next step; x86/x86_64 are emulator-only
and can be added as separate artifacts.

The release build uses the generated debug keystore because no production
keystore is configured yet. The APK is **installable** and, in this first
workflow, contains the `arm64-v8a` ABI only. This covers modern Android phones
and keeps the GitHub runner below its memory limit.

Install for testing:

```bash
adb install -r RageNet-<version>-android-arm64.apk
```

For a production/self-signed release, add a keystore to GitHub Secrets and a
`release` signingConfig; do not use the debug key for public distribution.

## iOS unsigned IPA

Workflow: `.github/workflows/build-ios.yml`

What it does:

1. Runs `expo prebuild --platform ios`.
2. Runs `pod install`.
3. Builds with `CODE_SIGNING_ALLOWED=NO`, `CODE_SIGNING_REQUIRED=NO`.
4. Packages `Payload/RageNet.app` into
   `RageNet-<version>-ios-unsigned.ipa`.

The workflow does **not** need an Apple Developer account. The IPA has no
signature and cannot be installed as-is. Use Sideloadly/AltStore/your own
signing service, or sign it with a certificate you control.

**Important:** the VPN/Network Extension will not work until the app is signed
with a paid Apple Developer Program profile containing the
`packet-tunnel-provider` entitlement. A free Apple ID cannot enable Network
Extensions. The current build is a UI preview; the Packet Tunnel target is added
in Phase 2.

## Run a build

### Manual

GitHub → Actions → **Build Android** or **Build iOS** → **Run workflow**.

Artifacts appear at the bottom of the run:

- `ragenet-android-apk`
- `ragenet-ios-ipa`

### Tag release

```bash
git tag app-v0.1.10
git push origin app-v0.1.10
```

Both workflows also run on `app-v*` tags. Artifacts are available on each run
page; a combined GitHub Release job can be added after both pipelines are green.

## Desktop

Workflow: `.github/workflows/build-desktop.yml`

- Windows: NSIS EXE.
- macOS: universal DMG.
- Linux: AppImage/deb.

It requires Rust on the runner. The local environment currently has no Rust, so
this workflow has not been executed yet.

## Before the first run

- Push the `ragenet-app` repository to GitHub.
- Ensure Actions are enabled.
- The unsigned builds need no secrets.
- For a signed Android release, add the keystore secrets described in
  `docs/SIGNING.md`.
- For a signed iOS/TestFlight build, add Apple certificate/profile secrets.
