# Android VPN layer

## Runtime path

```
React Native JS
  └─ Expo module (RageNetVpn)
       └─ VpnService (foreground, :native process)
            ├─ Builder.establish() -> TUN fd
            ├─ xray.tun.fd = fd
            ├─ LibXray.registerDialerController(VpnService.protect)
            └─ LibXray.invoke({ method: "runXray", payload: { xrayJson } })
```

## Rules

- Every Xray outbound socket must call `VpnService.protect(fd)` through the
  `DialerController`; otherwise traffic loops back into the TUN.
- The TUN must not be exposed to other apps. Use `addDisallowedApplication` for
  RageNet itself when building the interface if the platform requires it.
- Foreground service type on Android 14+: `specialUse` with the
  `android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE` property set to `vpn`.
- Always-on VPN and "Block connections without VPN" are configured by the user
  in system settings. The app should explain and deep-link there, not silently
  toggle system settings.
- Build `libXray.aar` with NDK r29 and verify 16 KB page alignment before
  shipping for Android 15+.
- Stop the core, close the TUN and remove the notification on `onRevoke()` and
  on a failed start.

## Import contract

The Expo module should expose:

```ts
prepare(): Promise<boolean>; // VpnService.prepare()
start(configJson: string, options: StartOptions): Promise<void>;
stop(): Promise<void>;
getStatus(): Promise<VpnStatus>;
addListener(event: 'status', listener: (status: VpnStatus) => void): () => void;
```

`StartOptions` carries per-app lists, MTU, DNS and kill-switch intent. The Xray
config itself stays in the native service; JS must not be able to start an
arbitrary Unix process.
