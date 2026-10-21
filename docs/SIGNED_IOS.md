# Signed iOS IPA via GitHub Actions

GBox can only sign this app correctly if it lets you assign a **separate
provisioning profile** to `PlugIns/tunnel.appex` and signs every nested
`Frameworks/*.framework`. If that option is missing, use the `Sign iOS IPA`
workflow instead.

## What you need

- Paid Apple Developer Program certificate (`.p12`).
- Provisioning profile for `net.ragenet.vpn`.
- Separate provisioning profile for `net.ragenet.vpn.tunnel`.
- Network Extensions (`packet-tunnel-provider`) enabled on both App IDs.
- The device UDID included in both profiles if they are development/ad hoc.

Both profiles must contain:

```text
com.apple.developer.networking.networkextension = [packet-tunnel-provider]
```

No App Group is required by RageNet 0.1.17+.

## Create the tunnel profile

Apple Developer → Certificates, Identifiers & Profiles:

1. **Identifiers → App IDs → +**
   - Bundle ID: `net.ragenet.vpn.tunnel`
   - Enable **Network Extensions**.
2. **Profiles → +**
   - iOS App Development (or Ad Hoc);
   - select the `net.ragenet.vpn.tunnel` App ID;
   - select your certificate and test devices;
   - download the `.mobileprovision`.

Do the same for the main `net.ragenet.vpn` App ID if you do not already have a
profile with Network Extensions.

## Add GitHub Secrets

Repository → Settings → Secrets and variables → Actions → New repository
secret:

| Secret                     | Value                                   |
| -------------------------- | --------------------------------------- |
| `IOS_CERTIFICATE_P12`      | base64 of the `.p12`                    |
| `IOS_CERTIFICATE_PASSWORD` | `.p12` password                         |
| `IOS_MAIN_PROVISION`       | base64 of the main `.mobileprovision`   |
| `IOS_TUNNEL_PROVISION`     | base64 of the tunnel `.mobileprovision` |

Base64 on macOS:

```bash
base64 -i certificate.p12 | pbcopy
base64 -i main.mobileprovision | pbcopy
base64 -i tunnel.mobileprovision | pbcopy
```

On Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.p12")) | Set-Clipboard
```

Secrets are not exposed to pull requests or logs.

## Run

GitHub → Actions → **Sign iOS IPA** → Run workflow.

Leave `run_id` empty to use the latest successful Release build. The workflow:

1. Downloads `ragenet-ios-ipa-release` from the latest Build iOS run.
2. Imports the certificate and both profiles into a temporary keychain.
3. Extracts entitlements from each profile.
4. Signs every nested framework/dylib.
5. Signs `tunnel.appex` with the tunnel profile.
6. Signs `RageNet.app` with the main profile and embeds both profiles.
7. Verifies the result and uploads `ragenet-ios-ipa-signed`.

Install the signed IPA without re-signing it (do not let GBox re-sign it again).
A development/ad hoc profile only installs on devices listed in that profile.
