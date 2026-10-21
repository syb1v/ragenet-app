# iOS VPN layer

## Runtime path

```
RageNet app
  └─ NETunnelProviderManager (profile + App Group config)
       └─ Packet Tunnel Extension (Swift, no React Native)
            ├─ NEPacketTunnelNetworkSettings
            ├─ utun fd discovery
            ├─ xray.tun.fd = fd
            └─ LibXray runXray(config)
```

## Hard constraints

- The extension has a ~50 MB memory budget. Do not link React Native, Skia,
  analytics or large geo assets into the Packet Tunnel target.
- A Network Extension requires the paid Apple Developer Program and the
  `com.apple.developer.networking.networkextension` entitlement with
  `packet-tunnel-provider`. A free Apple ID cannot use it.
- An unsigned IPA can be built by CI, but the extension will not start until
  the app is signed with a profile that contains the entitlement.
- Test on a physical device. The simulator cannot run a real Packet Tunnel.

## Build target checklist

- App Group: `group.net.ragenet.vpn`
- Extension bundle id: `net.ragenet.vpn.tunnel`
- Both targets share the App Group and Keychain access group.
- The extension reads the config from the App Group container or from
  `NETunnelProviderProtocol.providerConfiguration`.
- `includeAllNetworks` is the kill-switch switch. `onDemandRules` implement
  Wi-Fi/cellular behavior.
- Stats and logs are exchanged through `sendProviderMessage` and the App Group,
  never through a shared React Native runtime.

## Signing

`docs/SIGNING.md` in the repository root contains the exact path from an
unsigned CI IPA to an Ad Hoc/TestFlight build.
