# GitHub Actions builds

## Android APK

Workflow: `.github/workflows/build-mobile.yml` → job **Android universal APK**

What it does:

1. Installs Java 21, Android SDK/NDK r29, pnpm.
2. Runs `expo prebuild --platform android`.
3. Builds `assembleRelease`.
4. Uploads `RageNet-<version>-android-universal.apk` and `SHA256SUMS-android.txt`.

The release build uses the generated debug keystore because no production
keystore is configured yet. The APK is **installable** and includes all ABIs
from `reactNativeArchitectures` (`armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`).

Install for testing:

```bash
adb install -r RageNet-0.1.3-android-universal.apk
```

For a production/self-signed release, add a keystore to GitHub Secrets and a
`release` signingConfig; do not use the debug key for public distribution.

## iOS unsigned IPA

Workflow: same file → job **iOS unsigned IPA**

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

GitHub → Actions → **Build mobile** → **Run workflow**.

Artifacts appear at the bottom of the run:

- `ragenet-android-apk`
- `ragenet-ios-ipa`

### Tag release

```bash
git tag app-v0.1.3
git push origin app-v0.1.3
```

On tags, the `release` job also publishes a GitHub Release with the APK, IPA and
`SHA256SUMS.txt`.

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
