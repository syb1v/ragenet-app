# RageNet VPN app

Кроссплатформенный клиент RageNet: React Native для Android/iOS и Tauri + React Native Web для desktop. Ядро — Xray-core через `libXray` с TUN-инбаундом.

> **Статус: Phase 1–2, версия 0.3.19.** Android и iOS используют реальный Xray-туннель. iOS-подпись и привилегированный desktop-helper пока остаются отдельными задачами.

## Что уже работает

- онбординг и добавление подписки из буфера, QR-кода и вручную;
- главный экран со сферой: независимое дрожание частиц, tap/hold/drag, haptics и плавные переходы;
- адаптивная сфера: 60/90/120 fps по частоте дисплея, 360–600 частиц на Android;
- карточка подписки, квота, срок действия, выбор локации и поддержка;
- группы подписки: 24 подключаемых сервера и 2 служебных заголовка в текущем feed;
- парсер Remnawave: base64/plain/JSON/full Xray config, заголовки `subscription-userinfo`, `profile-title`, `support-url`, `announce`, `profile-update-interval`;
- сборщик Xray-конфига с TUN inbound, DNS и routing; без локального API;
- VLESS Reality, VLESS XHTTP Reality/TLS, Hysteria2, Shadowsocks, Trojan, VMess;
- Hysteria2 `fm` FinalMask с `quicParams` (`udpHop`, timeout, keepalive);
- XHTTP `extra` со всеми полями (`xmux`, headers, padding, session/uplink);
- санитайзер full-config: только TUN, без socks/http/dokodemo/API;
- потоковый пинг по локациям, отмена пинга касанием сферы, пинг через `:ping` процесс на Android;
- сохранение подписки в SecureStore/Keychain с чанками;
- стабильный HWID для Remnawave;
- логи с фильтрами, скачиванием и выводом Xray core;
- Tauri 2 shell для Windows/macOS/Linux;
- unit-тесты парсера, конфига, bridge и Xray-сборщика.

## Ограничения текущей версии

- iOS IPA собирается **unsigned**; для запуска нужен Apple Developer Program, два профиля и Network Extension entitlement.
- Desktop пока UI без TUN/sidecar.
- Живая статистика трафика и автообновление подписки ещё не подключены.
- Android VPN permission и пинг требуют проверки на физическом устройстве после 0.3.19.
- iOS-туннель после зависания восстанавливается сбросом профиля; нужна проверка на устройстве.
- Full JSON с balancer/observatory/mux/sockopt/FakeDNS/fragment/noise текущая подписка не содержит, поэтому эти поля не добавляются клиентом.

## Превью

| Онбординг                                 | Главный экран                 | Настройки                             |
| ----------------------------------------- | ----------------------------- | ------------------------------------- |
| ![Onboarding](screenshots/onboarding.png) | ![Home](screenshots/home.png) | ![Settings](screenshots/settings.png) |

## Быстрый старт

```bash
pnpm install
pnpm web          # Expo web, http://localhost:8081
pnpm test
pnpm typecheck
pnpm build:web
```

## Структура

```
apps/
  mobile/        Expo React Native (Android/iOS)
  desktop/       Tauri 2 shell поверх Expo web build
  mobile/modules/ragenet-vpn/  Expo native module: VPN, ping, haptics
  mobile/targets/tunnel/       iOS Packet Tunnel extension
packages/
  design/        токены, шрифты, темы
  core/          подписки, Remnawave-заголовки, Xray-конфиг, HWID
  vpn/           контракт native bridge + mock
  particles/     симуляция сферы
  ui/            экраны, компоненты, store
native/          контракты и версии native-ядра
tools/           генерация иконок, сборка libXray
```

## Документация

- [Roadmap и текущее состояние](docs/ROADMAP.md)
- [Архитектура](docs/ARCHITECTURE.md)
- [Версионирование и релизы](docs/VERSIONING.md)
- [Сборки в GitHub Actions](docs/BUILDS.md)
- [Подпись и дистрибуция](docs/SIGNING.md)
- [Phase 0: фундамент](docs/PHASE0.md)
- [iOS signing](docs/IOS_SIGNING.md)
- [Signed IPA workflow](docs/SIGNED_IOS.md)

## Команды

```bash
pnpm dev                      # Expo dev server
pnpm web                      # Expo web
pnpm android                  # Expo Android
pnpm ios                      # Expo iOS (macOS)
pnpm build:web                # статический web export
pnpm version:check
pnpm format:check
pnpm typecheck
pnpm test
pnpm --filter @ragenet/desktop dev
pnpm --filter @ragenet/desktop build
```

## Сборки и подпись

- Android: CI собирает self-signed Release APK arm64-v8a со встроенным `index.android.bundle`; R8/minify отключён для стабильного запуска.
- iOS: Release IPA содержит `main.jsbundle` и `PlugIns/tunnel.appex`, но без подписи не устанавливается для VPN.
- macOS: для TUN нужен привилегированный helper; для распространения — Developer ID + notarization.
- Windows: EXE/MSI без code-signing сертификата покажет SmartScreen.

Подробности: [docs/BUILDS.md](docs/BUILDS.md), [docs/SIGNING.md](docs/SIGNING.md).

## Лицензия

AGPL-3.0. Xray-core распространяется под MPL-2.0, libXray — под MIT. Сторонние лицензии и attribution — в `THIRD_PARTY_NOTICES.md`.
