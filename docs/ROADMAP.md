# RageNet app — roadmap

**Статус:** Phase 0 завершён; Android/iOS MVP работает, идёт стабилизация 0.3.19
**Версия:** 0.3.19
**Дата обновления:** 23 октября 2026
**Репозиторий:** `ragenet-app` (клиент; backend/cabinet — в основном репозитории RageNet VPN)

## Текущее состояние

Готово:

- UI: онбординг, главный экран, настройки, логи, подписка, серверы, сброс;
- сфера: 360–600 частиц, tap/hold/drag, haptics, burst, 60/90/120 Hz;
- парсер Remnawave, HWID, SecureStore/Keychain, QR-сканер;
- реальные Android `VpnService` и iOS Packet Tunnel Extension;
- VLESS Reality, VLESS XHTTP Reality/TLS, Hysteria2, Trojan, Shadowsocks, VMess;
- Hysteria2 `fm`/`finalmask`, XHTTP `extra`;
- streaming ping, отмена пинга касанием сферы, Android `:ping` процесс;
- группы подписки: 26 строк / 24 подключаемых сервера в текущем feed;
- full-config sanitizer без локального API и socks/http;
- GitHub Actions: Android Release APK, unsigned iOS IPA, desktop installers.

Ближайшие задачи:

- подтвердить на Android: запуск 0.3.19, системный диалог VPN, пинг локаций;
- подтвердить на iOS: восстановление после зависшего туннеля без перезагрузки;
- reconnect при смене Wi-Fi/LTE;
- автообновление подписки;
- живая статистика трафика;
- desktop sidecar/TUN;
- подпись iOS и production Android keystore.

## Фазы

### Phase 0 — Foundation

**Статус:** done

Монорепо, дизайн, парсер, Xray config builder, сфера, Tauri shell, CI, документация, первые релизы.

### Phase 1 — Android VPN MVP

**Статус:** работает, идёт стабилизация

- `VpnService` + TUN fd;
- libXray AAR, `xray.tun.fd`, `DialerController`;
- foreground service, уведомление, отключение;
- permission через системный диалог;
- подписка, HWID, SecureStore;
- ping через изолированный `:ping` процесс;
- Release APK arm64-v8a со встроенным JS-бандлом.

**Осталось:** проверить permission/ping на физическом устройстве, reconnect, автообновление, live stats.

### Phase 2 — iOS MVP

**Статус:** работает на подписанном устройстве; идёт стабилизация

- Packet Tunnel Extension + App Group logs;
- LibXray XCFramework, utun fd, `xray.tun.fd`;
- Hysteria2/XHTTP и остальные протоколы;
- reset stale tunnel profile, start/stop timeouts;
- unsigned Release IPA в CI.

**Осталось:** проверить reset на устройстве, on-demand, provider messages для статистики, подпись NE entitlement.

**Блокер:** Apple Developer Program и два provisioning profile.

### Phase 3 — Desktop

**Статус:** UI shell готов; TUN не реализован

- Tauri 2: Windows/macOS/Linux;
- Xray sidecar;
- system proxy без admin;
- привилегированный helper:
  - Windows: UAC/служба, wintun;
  - macOS: LaunchDaemon, notarization;
  - Linux: pkexec/polkit, deb/rpm/AppImage.

### Phase 4 — Remnawave parity

**Статус:** частично

- reconnect, `setUnderlyingNetworks`;
- автообновление подписки по `profile-update-interval`;
- live traffic stats и квота;
- on-demand/always-on там, где поддерживает ОС;
- несколько подписок, deep links, улучшенные логи;
- server-driven routing/DNS только если сервер начнёт отдавать full JSON.

**Не добавляем без серверных данных:** balancer/observatory, глобальный mux, sockopt, FakeDNS, fragment/noise, локальные socks/http inbound’ы.

### Phase 5 — Hardening

- performance/battery, iOS 50 MB budget;
- accessibility, Reduce Motion;
- security review helper/IPC и full-config sanitizer;
- release signing, checksums, updater;
- support/troubleshooting docs.

## Ближайшие релизы

| Версия   | Содержание                                                                                  |
| -------- | ------------------------------------------------------------------------------------------- |
| `0.3.19` | Android VPN permission, ping init, iOS tunnel reset, logs flicker, 60–120 Hz, button layout |
| `0.3.20` | reconnect, auto-refresh подписки, чистка настроек                                           |
| `0.3.21` | live traffic stats, quota, notification polish                                              |
| `0.4.x`  | iOS on-demand, desktop sidecar/TUN, signed builds                                           |

## Блокеры

1. **Apple Developer Program** — без него iOS VPN не запустится на устройстве.
2. **Android production keystore** — текущий APK self-signed.
3. **Desktop helper** — нужен для TUN на Windows/macOS/Linux.
4. **Физические устройства** — Android permission/ping и iOS tunnel reset нужно проверить вживую.
5. **Формат подписки** — текущий feed содержит только share-link’и; advanced full-JSON функции не включаем.

## Definition of Done для MVP

- APK/IPA/desktop installers собираются в CI.
- Подписка добавляется по ссылке/QR/буферу и сохраняется.
- Реальный туннель поднимается/опускается на Android и iOS.
- Все локации пингуются, сфера отменяет пинг, статус обновляется.
- iOS восстанавливается после зависшего туннеля без перезагрузки.
- Нет known critical bugs.
- Секреты не попадают в логи и артефакты.

## Вне scope первого релиза

- Android TV / Apple TV.
- TUIC, AnyTLS, SSR.
- App Store / Google Play.
- Платежи и баланс внутри приложения.
- Push-уведомления.
