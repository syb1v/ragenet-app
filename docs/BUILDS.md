# GitHub Actions builds

## Android APK

Workflow: `.github/workflows/build-android.yml`

What it does:

1. Installs Java 21, Android SDK/NDK r29, pnpm and restores the libXray AAR cache.
2. Runs `expo prebuild --platform android`.
3. Builds `assembleRelease` by default (arm64-v8a only).
4. Collects `RageNet-<version>-android-arm64-release.apk` and publishes it to the
   `app-v<version>` GitHub Release.

The Release APK is self-signed with the generated debug keystore because a
production keystore is not configured yet. It is installable, includes
`assets/index.android.bundle`, and does **not** need Metro.

R8/minify and resource shrinking are explicitly disabled in `app.json` via
`expo-build-properties`. Do not re-enable them without a full device smoke test:
the first release with R8 stripped native modules and crashed during startup.

Install for testing:

```bash
adb install -r RageNet-<version>-android-arm64-release.apk
adb logcat -c
adb shell am start -W -n net.ragenet.vpn/.MainActivity
```

Verify the JS bundle inside the APK:

```bash
unzip -l RageNet-<version>-android-arm64-release.apk | grep index.android.bundle
```

## iOS unsigned IPA

Workflow: `.github/workflows/build-ios.yml`

What it does:

1. Runs `expo prebuild --platform ios`.
2. Runs `pod install`.
3. Builds with `CODE_SIGNING_ALLOWED=NO`, `CODE_SIGNING_REQUIRED=NO`.
4. Packages `Payload/RageNet.app` into
   `RageNet-<version>-ios-Release-unsigned.ipa`.

The workflow does not need an Apple Developer account. The IPA contains the
main app and the Packet Tunnel extension (`PlugIns/tunnel.appex`) but has no
signature and cannot start the VPN as-is.

Use the **Release** IPA for signing. A Debug IPA has no embedded
`main.jsbundle` and expects Metro; installing it without Metro produces
`No script URL provided`.

The VPN will not work unless both the app and the extension are signed with
paid Apple Developer Program profiles containing:

- `com.apple.developer.networking.networkextension` =
  `packet-tunnel-provider`;
- explicit App IDs `net.ragenet.vpn` and `net.ragenet.vpn.tunnel`.

A free Apple ID cannot enable Network Extensions. A wildcard profile cannot
sign a Network Extension. See [`IOS_SIGNING.md`](IOS_SIGNING.md) or the
[`Sign iOS IPA`](SIGNED_IOS.md) workflow.

## Desktop

Workflow: `.github/workflows/build-desktop.yml`

- Windows: NSIS EXE and MSI.
- macOS: universal DMG.
- Linux: AppImage, deb and rpm.

The desktop build is currently UI-only: it does not include an Xray sidecar or
privileged TUN helper. System proxy/TUN are future work.

## GitHub Releases

Every successful platform build publishes files to a GitHub Release tagged
`app-v<version>`:

- manual `workflow_dispatch` runs create/update the release;
- `app-v*` tag builds update the same tag;
- assets are uploaded with `--clobber`, so rebuilding the same version replaces
  files instead of failing.

Expected complete release assets:

- `RageNet-<version>-android-arm64-release.apk`
- `RageNet-<version>-ios-Release-unsigned.ipa`
- `RageNet_<version>_x64-setup.exe`
- `RageNet_<version>_x64_en-US.msi`
- `RageNet_<version>_universal.dmg`
- `RageNet_<version>_amd64.AppImage`
- `RageNet_<version>_amd64.deb`
- `RageNet-<version>-1.x86_64.rpm`

## Run a build

### Manual

GitHub → Actions → **Build Android**, **Build iOS** or **Build desktop** →
**Run workflow**.

Artifacts are attached to the run and to the GitHub Release.

### Tag release

```bash
git tag app-v0.3.19
git push origin app-v0.3.19
```

Both mobile workflows and the desktop workflow also run on `app-v*` tags.

## Before publishing

- Ensure `pnpm version:check`, `format:check`, `typecheck`, `test` and
  `build:web` are green.
- Verify the Android APK contains `assets/index.android.bundle`.
- Verify the iOS IPA contains `main.jsbundle` and `PlugIns/tunnel.appex`.
- Update `CHANGELOG.md` and release notes.
- Confirm the release has all eight assets.
- For iOS, confirm the signing profile includes the Network Extension
  entitlement.

Unsigned builds need no secrets. For a signed Android release, add the
keystore secrets from `docs/SIGNING.md`. For a signed iOS/TestFlight build, add
the Apple certificate and two provisioning profiles.
