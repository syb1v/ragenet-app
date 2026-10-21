# RageNet app — roadmap

**Статус:** Phase 0 завершён, Phase 1–2 в работе
**Версия:** 0.1.19
**Дата обновления:** 21 октября 2026
**Репозиторий:** `ragenet-app` (клиент; backend/cabinet — в основном репозитории RageNet VPN)

## Допущения

- Команда: 1–2 разработчика (RN/mobile + native/desktop).
- Есть staging-подписка Remnawave и тестовая нода.
- Есть возможность запускать GitHub Actions.
- Apple Developer Program пока не оплачен; iOS VPN зависит от этого.
- Оценки — не обещание даты, а диапазон при отсутствии блокеров.

## Текущее состояние

Готово:

- UI-прототип: онбординг, главный экран, настройки, логи;
- шар из 2 200 частиц: тап, удержание, drag, прогрессивная тряска, haptics, реакция на состояние;
- компактное меню подписки: QR, share, copy, delete;
- парсер подписок Remnawave, HWID, сборщик Xray-конфига, санитайзер full configs;
- Tauri 2 каркас, иконки, дизайн-токены, CI-скелет, тесты;
- web-превью и JS-бандлы Android/iOS;
- Android `VpnService`, libXray AAR, TUN fd и foreground service;
- iOS Packet Tunnel Extension, `NETunnelProviderManager` и LibXray XCFramework;
- unsigned IPA с extension внутри (подписывается сертификатом пользователя).

Не готово / в работе:

- подтверждённый runtime-тест Android-туннеля на устройстве;
- статистика трафика из Xray и ping через core API;
- desktop Xray sidecar/helper;
- подписанные релизные артефакты;
- staging-проверка протоколов и iOS-подпись двумя профилями.

## Фазы

### Phase 0 — Foundation

**Статус:** done · **Версия:** 0.1.19

- Монорепо, дизайн-система, экраны.
- Парсер подписок и сборщик Xray-конфига.
- Интерактивный шар.
- Tauri shell и native-контракты.
- CI: typecheck, tests, prettier, web build.
- Документация: architecture, signing, phase 0, roadmap, versioning.

**Выход:** web-превью, Android/iOS JS-бандлы, тесты.

### Phase 1 — Android VPN MVP

**Срок:** 3–4 недели · **Ориентир:** 18–25 ноября 2026

- `VpnService` + TUN fd.
- libXray AAR, `xray.tun.fd`, `DialerController`.
- Foreground service: статус, трафик, «Отключить».
- Реальный fetch подписки, secure storage, HWID.
- Ping серверов и статистика из Xray.
- Universal debug APK в GitHub Actions.
- Проверка на staging: VLESS Reality, WS/TLS, Trojan, Shadowsocks.

**Выход:** APK, который реально подключается и отключается на физическом Android-устройстве.

### Phase 2 — iOS MVP

**Срок:** 3–4 недели · **Ориентир:** ноябрь–декабрь 2026

- Packet Tunnel Extension + App Group.
- LibXray XCFramework, utun fd, `xray.tun.fd`.
- Статус/статистика через provider messages.
- Unsigned IPA в CI.
- Ad Hoc/TestFlight — только при наличии Apple Developer Program.

**Выход:** unsigned IPA с UI; функциональный VPN — после подписи NE entitlement.
**Блокер:** оплаченный Apple Developer Program.

### Phase 3 — Desktop

**Срок:** 3–5 недель · **Ориентир:** ноябрь–декабрь 2026

- Tauri 2 сборка Windows/macOS/Linux.
- Xray sidecar.
- System proxy mode без admin.
- Привилегированный helper и TUN:
  - Windows: UAC/служба, wintun;
  - macOS: helper/LaunchDaemon, notarization;
  - Linux: pkexec/polkit, `.deb`.
- Tray, autostart, single instance.
- EXE/DMG/AppImage/deb в CI.

**Выход:** desktop-билды; system proxy — раньше, TUN — после helper.

### Phase 4 — Remnawave / INCY parity

**Срок:** 3–4 недели · **Ориентир:** декабрь 2026 — январь 2027

- Routing-профили: direct/proxy/block, домены/IP/порты.
- Full Xray configs с balancers/observatory.
- TLS fragmentation/noise.
- Kill switch, per-app, always-on/on-demand.
- Deep links, QR-камера, несколько подписок.
- Логи с редакцией секретов, экспорт диагностики.
- RU/EN, RTL/FA при необходимости.

**Выход:** функциональный паритет с INCY по основным сценариям.

### Phase 5 — Hardening и релиз

**Срок:** 2–3 недели · **Ориентир:** январь–февраль 2027

- Performance/battery, iOS 50 MB budget.
- Accessibility, Reduce Motion.
- Security review helper/IPC, full-config sanitizer.
- Release workflows, checksums, updater.
- Документация поддержки и troubleshooting.

**Выход:** стабильный релиз всех платформ.

## Ориентиры по билдам

| Билд                        | Что внутри                         | Ориентир                   |
| --------------------------- | ---------------------------------- | -------------------------- |
| UI Android APK              | mock, без VPN                      | 23–27 октября 2026         |
| UI iOS unsigned IPA         | mock, без NE                       | 23–27 октября 2026         |
| Desktop UI EXE/DMG/AppImage | system proxy                       | 5–12 ноября 2026           |
| Android VPN MVP             | реальный VLESS Reality             | 18–25 ноября 2026          |
| iOS unsigned + NE target    | без рабочего VPN                   | ноябрь–декабрь 2026        |
| iOS рабочий VPN             | после Apple Developer Program      | +3–4 недели после аккаунта |
| Desktop TUN                 | helper на Windows/Linux            | декабрь 2026               |
| All-platform MVP            | Android + iOS + desktop            | январь 2027                |
| INCY/Remnawave parity       | routing, kill switch, full configs | март–апрель 2027           |

## Блокеры и зависимости

1. **Apple Developer Program** — без него iOS VPN не запустится.
2. **Staging Remnawave** — подписка и нода для проверки протоколов.
3. **Android keystore** — для устанавливаемого release APK; debug-подпись уже возможна.
4. **Rust/Android SDK/Xcode в CI** — нужны для реальных сборок.
5. **Домен и bundle id** — сейчас заложено `net.ragenet.vpn`, scheme `ragenet`.

## Definition of Done для MVP

- APK/IPA/EXE/DMG/AppImage/deb собираются в CI.
- Подписка добавляется по ссылке/QR/буферу.
- Реальный туннель поднимается и опускается.
- Серверы, пинг, трафик и срок отображаются.
- Настройки, логи, сброс и поддержка работают.
- Нет known critical bugs; staging-матрица протоколов пройдена.
- Секреты не попадают в логи и артефакты.

## Вне scope первого релиза

- Android TV / Apple TV.
- TUIC, AnyTLS, SSR.
- App Store / Google Play.
- Нативный аккаунт с балансом и платежами внутри приложения.
- Push-уведомления.

## Как обновлять roadmap

- Даты и статусы меняются в этом файле, а не в чатах.
- При завершении фазы обновить `CHANGELOG.md`, версию и `docs/PHASE0.md`/roadmap.
- Перед релизом добавить фактические даты и ссылки на артефакты.
