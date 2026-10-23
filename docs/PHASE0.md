# Phase 0 — foundation

**Статус:** завершён · **Текущая версия:** 0.3.19 · **Следующий этап:** стабилизация 0.3.19 → Phase 4 (reconnect, stats, desktop).

Phase 0 был фундаментом проекта. Часть пунктов, которые раньше были в «Not done», уже реализована в Phase 1–2 и отмечена здесь как выполненная.

## Сделано

- [x] Монорепозиторий `ragenet-app`, pnpm workspace, AGPL-3.0.
- [x] Дизайн-токены, шрифты, темы, брендинг.
- [x] Онбординг, главный экран, настройки, логи, листы подписки/серверов/сброса.
- [x] Сфера: независимое дрожание частиц, tap/hold/drag, haptics, burst.
- [x] Адаптивная частота рендера 60/90/120 Hz и 360–600 частиц на Android.
- [x] Парсер Remnawave: base64, plain, JSON, full Xray config, заголовки.
- [x] Группы-разделители подписки: 26 строк, 24 подключаемых сервера в текущем feed.
- [x] Xray config builder: TUN, DNS, routing, без локального API.
- [x] Full-config sanitizer: TUN-only inbounds, без socks/http/dokodemo/API.
- [x] Hysteria2 `fm`/`finalmask` с `quicParams`; XHTTP `extra`.
- [x] HWID/device info helper.
- [x] Bridge `packages/vpn`: native contract, sync/async normalization, mock.
- [x] Android `VpnService`, libXray AAR, TUN fd, foreground service, permission flow.
- [x] Android ping в изолированном `:ping` процессе.
- [x] iOS Packet Tunnel Extension, App Group logs, `NETunnelProviderManager`, LibXray XCFramework.
- [x] iOS stale-tunnel reset and start/stop timeouts.
- [x] Реальный fetch подписки, SecureStore/Keychain, QR-сканер.
- [x] CI: typecheck, tests, prettier, web build.
- [x] GitHub Actions: Android Release APK, unsigned iOS IPA, desktop installers.
- [x] Tauri 2 desktop shell.
- [x] Документация: architecture, signing, builds, roadmap, versioning.

## Ещё не сделано

- [ ] Проверка Android VPN permission и ping на физическом устройстве после 0.3.19.
- [ ] Проверка iOS reset-туннеля на подписанном IPA.
- [ ] Reconnect после смены сети и `setUnderlyingNetworks`.
- [ ] Автообновление подписки по `profile-update-interval`.
- [ ] Живая статистика трафика из native-слоя.
- [ ] Desktop Xray sidecar + привилегированный TUN helper.
- [ ] Подписанные production-артефакты Android/iOS/desktop.
- [ ] Staging-матрица протоколов и iOS-подпись двумя профилями.

## Контекст

- Android/iOS уже поднимают реальный туннель; desktop пока UI.
- Текущая подписка — share-link feed, не full JSON. Balancer/observatory/mux/sockopt/FakeDNS/fragment/noise не добавляются, пока сервер их не отдаёт.
- iOS IPA остаётся unsigned; VPN extension требует Apple Developer Program и entitlement `packet-tunnel-provider`.
- Hysteria2 с `insecure=1` без `pinSHA256` не поддерживается Xray 26.10.
