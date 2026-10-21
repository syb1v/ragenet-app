# iOS signing with your own certificate

The IPA produced by `.github/workflows/build-ios.yml` is unsigned. It contains:

```text
Payload/RageNet.app
Payload/RageNet.app/PlugIns/tunnel.appex
```

Both binaries must be signed. The Packet Tunnel extension is a separate app
extension with its own bundle identifier and its own provisioning profile.

## Requirements

- A paid **Apple Developer Program** account. A free Apple ID cannot enable
  Network Extensions.
- Two explicit App IDs:
  - `net.ragenet.vpn` — the main app;
  - `net.ragenet.vpn.tunnel` — the Packet Tunnel extension.
- Both App IDs must have **Network Extensions** enabled.
- App Group `group.net.ragenet.vpn` attached to both App IDs.
- Two provisioning profiles (development or ad hoc), one per App ID. A single
  wildcard profile will not work for a Network Extension.
- Your `.p12` signing certificate.

The bundle identifiers and App Group are defined in:

- `apps/mobile/app.json` (`ios.bundleIdentifier`, `ios.entitlements`);
- `apps/mobile/targets/tunnel/expo-target.config.js`.

If your Apple account uses a different App Group, change both files and rebuild
the IPA. The extension and the app must use the same group.

## Check a provisioning profile

On macOS:

```bash
security cms -D -i profile.mobileprovision > profile.plist
plutil -p profile.plist | grep -A6 -E \
  'application-identifier|networkextension|application-groups'
```

The main profile must contain:

```text
com.apple.developer.networking.networkextension = [packet-tunnel-provider]
com.apple.security.application-groups = [group.net.ragenet.vpn]
```

The extension profile must contain the same Network Extension entitlement and
`application-identifier` ending in `net.ragenet.vpn.tunnel`.

## Signing

Use a tool that signs **embedded app extensions**, not only the main `.app`.
Sideloadly and a configured Xcode account handle this. Some versions of
GBox/ESign apply one certificate to the outer app and leave
`PlugIns/tunnel.appex` unsigned; that IPA will install but VPN start will fail.

In Xcode terms:

1. Sign `RageNet.app` with the main app profile.
2. Sign `PlugIns/tunnel.appex` with the extension profile.
3. Rebuild the IPA keeping the `PlugIns` directory intact.

With command-line `codesign`, the sequence is roughly:

```bash
codesign --force --sign "Apple Development: ..." \
  --entitlements main.entitlements \
  Payload/RageNet.app/PlugIns/tunnel.appex

codesign --force --sign "Apple Development: ..." \
  --entitlements app.entitlements \
  Payload/RageNet.app
```

Do not sign the outer app before the nested extension.

## Verify

```bash
codesign -dvvv Payload/RageNet.app
codesign -dvvv Payload/RageNet.app/PlugIns/tunnel.appex

codesign -d --entitlements :- Payload/RageNet.app
codesign -d --entitlements :- Payload/RageNet.app/PlugIns/tunnel.appex
```

Both must have a valid signature and the extension must expose
`packet-tunnel-provider`.

## First run

1. Install the signed IPA.
2. Open RageNet and add a subscription key.
3. Tap the sphere. iOS asks for VPN configuration permission.
4. Tap again; the Packet Tunnel extension receives the Xray config, finds the
   utun descriptor and starts libXray.

If the app shows a VPN configuration error, check the device console
(`Console.app` → your device) for `RageNetVpn` and `tunnel` messages. The most
common causes are a missing Network Extension entitlement, a wrong extension
profile, or a bundle identifier mismatch.
