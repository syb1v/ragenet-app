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

The workflow does **not** need an Apple Developer account to produce the
unsigned IPA. The IPA contains the main app and the Packet Tunnel extension
(`Payload/RageNet.app/PlugIns/tunnel.appex`) but has no signature and cannot be
installed as-is. Sign it with your `.p12` + `.mobileprovision` in a signing tool
that also signs embedded app extensions (Sideloadly, ESign/GBox with extension
support, or Xcode).

**Important:** the VPN will not work unless both the app and the extension are
signed with paid Apple Developer Program profiles containing:

- `com.apple.developer.networking.networkextension` =
  `packet-tunnel-provider`;
- `com.apple.security.application-groups` = `group.net.ragenet.vpn`;
- explicit App IDs `net.ragenet.vpn` and `net.ragenet.vpn.tunnel`.

A free Apple ID cannot enable Network Extensions. A single wildcard profile
cannot sign a Network Extension. If your signing tool only applies one profile,
the embedded `tunnel.appex` will remain unsigned and iOS will refuse to start
the tunnel. See [`IOS_SIGNING.md`](IOS_SIGNING.md) for the full checklist.

## Run a build

### Manual

GitHub → Actions → **Build Android** or **Build iOS** → **Run workflow**.

Artifacts appear at the bottom of the run:

- `ragenet-android-apk`
- `ragenet-ios-ipa`

### Tag release

```bash
git tag app-v0.1.16
git push origin app-v0.1.16
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
