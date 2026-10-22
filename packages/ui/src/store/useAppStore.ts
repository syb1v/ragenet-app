import {
  DEFAULT_SETTINGS,
  fetchSubscription,
  generateHwid,
  parseSubscription,
  subscriptionFromParsed,
  buildXrayConfig,
  type AppSettings,
  type ParsedSubscription,
  type ServerNode,
  type Subscription,
  type VpnStatus,
} from '@ragenet/core';
import { createVpnBridge, type VpnBridge } from '@ragenet/vpn';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { create } from 'zustand';

export type Screen = 'home' | 'settings' | 'logs';
export type Sheet = 'addKey' | 'servers' | 'reset' | 'qr' | 'delete' | null;
export type AddMode = 'manual' | 'clipboard' | 'qr';

export interface MenuAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LogEntry {
  id: string;
  time: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

interface AppState {
  subscription: Subscription | null;
  servers: ServerNode[];
  selectedServerId: string | null;
  settings: AppSettings;
  vpnStatus: VpnStatus;
  screen: Screen;
  sheet: Sheet;
  addMode: AddMode;
  subscriptionMenuAnchor: MenuAnchor | null;
  logs: LogEntry[];
  toast: string | null;
  isRefreshing: boolean;
  isPinging: boolean;
  isSwitching: boolean;

  addSubscription: (input: string) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  pingServers: () => Promise<void>;
  pingSelectedServer: () => Promise<void>;
  loadNativeLogs: () => Promise<void>;
  clearLogs: () => Promise<void>;
  selectServer: (id: string) => void;
  deleteSubscription: () => void;
  initVpn: () => void;
  toggleConnection: () => Promise<void>;
  navigate: (screen: Screen) => void;
  openSheet: (sheet: Sheet, mode?: AddMode) => void;
  closeSheet: () => void;
  setAddMode: (mode: AddMode) => void;
  openSubscriptionMenu: (anchor: MenuAnchor) => void;
  closeSubscriptionMenu: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetApp: () => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  addLog: (message: string, level?: LogEntry['level']) => void;
}

const platformName = (): 'Android' | 'iOS' | 'Windows' | 'macOS' | 'Linux' | 'Web' => {
  switch (Platform.OS) {
    case 'android':
      return 'Android';
    case 'ios':
      return 'iOS';
    case 'macos':
      return 'macOS';
    case 'windows':
      return 'Windows';
    default:
      return 'Web';
  }
};

const deviceModel = (): string => {
  if (Platform.OS === 'web') {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser';
    return ua.length > 80 ? `${ua.slice(0, 77)}...` : ua;
  }
  return (
    Platform.select({
      ios: 'iPhone',
      android: 'Android device',
      macos: 'Mac',
      windows: 'Windows PC',
      default: 'Desktop',
    }) ?? 'Device'
  );
};

function stableDeviceHwid(): string {
  try {
    const nativeId = createVpnBridge().getStableDeviceId?.();
    if (nativeId) return nativeId;
  } catch {
    // Native module is unavailable (web preview, SSR, Expo Go).
  }
  return generateHwid();
}

export const DEVICE = {
  hwid: stableDeviceHwid(),
  os: platformName(),
  osVersion: Platform.Version?.toString() ?? 'unknown',
  model: deviceModel(),
  appVersion: Constants.expoConfig?.version ?? '0.3.4',
};

let vpnBridge: VpnBridge | null = null;
let vpnUnsubscribe: (() => void) | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let suppressVpnStatus = false;

function getVpnBridge(): VpnBridge {
  if (!vpnBridge) vpnBridge = createVpnBridge();
  return vpnBridge;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForVpnState(
  bridge: VpnBridge,
  expected: string,
  timeoutMs = 1800,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const status = await bridge.getStatus();
      if (status.state === expected) return;
    } catch {
      // Keep polling until the deadline.
    }
    await sleep(100);
  }
}

const LATENCY_PROBE_URL = 'https://www.gstatic.com/generate_204';
const LATENCY_TIMEOUT_MS = 4000;

function latencyProbeUrl(): string {
  // Defeat caches and proxy response caches; the request itself must still
  // traverse the active tunnel.
  return `${LATENCY_PROBE_URL}?ragenet=${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function probeLatency(
  bridge: VpnBridge,
  timeoutMs = LATENCY_TIMEOUT_MS,
): Promise<number | null> {
  const url = latencyProbeUrl();

  // Native HTTP creates a fresh connection and includes DNS/TCP/TLS plus the
  // real proxy round-trip. Measuring the VPN entry port from inside the tunnel
  // measures the proxy connecting to itself and produces fake 3-20 ms values.
  if (bridge.measureHttpLatency) {
    try {
      const measured = await bridge.measureHttpLatency(url, timeoutMs);
      if (measured != null) return measured;
    } catch {
      // Fall through to the TCP probe below.
    }
  } else {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        mode: Platform.OS === 'web' ? 'no-cors' : 'cors',
        headers: {
          Accept: '*/*',
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
        },
        signal: controller.signal,
      });
      if (
        response.ok ||
        response.type === 'opaque' ||
        response.status === 0 ||
        (response.status >= 200 && response.status < 400)
      ) {
        return Math.max(
          0,
          Math.round(
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt,
          ),
        );
      }
    } catch {
      // Fall back to a real TCP handshake through the same network path.
    } finally {
      clearTimeout(timeout);
    }
  }

  try {
    return (await bridge.measureLatency?.('www.gstatic.com', 443, timeoutMs)) ?? null;
  } catch {
    return null;
  }
}

function initialLogs(): LogEntry[] {
  return [
    {
      id: 'boot',
      time: Date.now(),
      level: 'info',
      message: `RageNet ${Constants.expoConfig?.version ?? '0.1.29'} · native VPN bridge`,
    },
  ];
}

async function pingTargets(
  get: () => AppState,
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  targets: ServerNode[],
): Promise<void> {
  if (targets.length === 0 || get().isPinging || get().isSwitching) return;
  const bridge = getVpnBridge();
  const throughTunnel = get().vpnStatus.state === 'connected';
  const targetIds = new Set(targets.map((server) => server.id));

  set({
    isPinging: true,
    servers: get().servers.map((server) =>
      targetIds.has(server.id) ? { ...server, latencyMs: undefined } : server,
    ),
  });

  try {
    const measured = await Promise.all(
      targets.map(async (server) => {
        const latency = await probeLatency(bridge);
        if (latency != null) {
          set((state) => ({
            servers: state.servers.map((entry) =>
              entry.id === server.id ? { ...entry, latencyMs: latency } : entry,
            ),
          }));
        }
        return { ...server, latencyMs: latency ?? undefined };
      }),
    );
    const subscription = get().subscription;
    const nextServers = get().servers.map((server) => {
      const result = measured.find((entry) => entry.id === server.id);
      return result ?? server;
    });
    set({
      servers: nextServers,
      subscription: subscription ? { ...subscription, servers: nextServers } : null,
    });
  } finally {
    set({ isPinging: false });
  }

  const answered = targets.filter((server) => {
    const current = get().servers.find((entry) => entry.id === server.id);
    return current?.latencyMs != null;
  }).length;
  get().addLog(
    `Пинг завершён · ${answered}/${targets.length} локаций · ${
      throughTunnel ? 'через туннель' : 'напрямую'
    }`,
  );
}

export const useAppStore = create<AppState>((set, get) => ({
  subscription: null,
  servers: [],
  selectedServerId: null,
  settings: DEFAULT_SETTINGS,
  vpnStatus: { state: 'disconnected' },
  screen: 'home',
  sheet: null,
  addMode: 'manual',
  subscriptionMenuAnchor: null,
  logs: initialLogs(),
  toast: null,
  isRefreshing: false,
  isPinging: false,
  isSwitching: false,

  addLog: (message, level = 'info') =>
    set((state) => ({
      logs: [
        ...state.logs.slice(-199),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          time: Date.now(),
          level,
          message,
        },
      ],
    })),

  addSubscription: async (input) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    let parsed: ParsedSubscription;
    if (/^https?:\/\//i.test(trimmed)) {
      get().addLog('Загрузка подписки…');
      const result = await fetchSubscription(trimmed, { device: DEVICE });
      parsed = result.parsed;
    } else {
      parsed = parseSubscription(trimmed);
    }

    if (parsed.servers.length === 0) {
      throw new Error('В подписке не найдено ни одного сервера');
    }

    const subscription = subscriptionFromParsed(`sub-${Date.now().toString(36)}`, trimmed, parsed);
    set({
      subscription,
      servers: subscription.servers,
      selectedServerId: subscription.servers[0]?.id ?? null,
      screen: 'home',
      sheet: null,
      vpnStatus: { state: 'disconnected' },
    });
    get().addLog(`Подписка добавлена · ${subscription.servers.length} сервера`);
  },

  refreshSubscription: async () => {
    const { subscription, isRefreshing } = get();
    if (!subscription || isRefreshing) return;

    set({ isRefreshing: true });
    try {
      if (subscription.url.startsWith('http')) {
        const result = await fetchSubscription(subscription.url, { device: DEVICE });
        const updated = subscriptionFromParsed(subscription.id, subscription.url, result.parsed);
        set({
          subscription: updated,
          servers: updated.servers,
          selectedServerId:
            updated.servers.find((server) => server.id === get().selectedServerId)?.id ??
            updated.servers[0]?.id ??
            null,
        });
        get().addLog('Подписка обновлена');
      } else {
        set({ subscription: { ...subscription, updatedAt: Date.now() } });
        get().addLog('Локальная подписка обновлена');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось обновить подписку';
      get().addLog(message, 'error');
      get().showToast(message);
    } finally {
      set({ isRefreshing: false });
    }
  },

  pingServers: async () => {
    await pingTargets(get, set, get().servers);
  },

  pingSelectedServer: async () => {
    const selected =
      get().servers.find((server) => server.id === get().selectedServerId) ?? get().servers[0];
    if (!selected) return;
    await pingTargets(get, set, [selected]);
  },

  loadNativeLogs: async () => {
    const bridge = getVpnBridge();
    if (!bridge.getLogs) return;
    try {
      const entries = await bridge.getLogs();
      if (entries.length === 0) return;
      set((state) => {
        const existing = new Set(state.logs.map((entry) => entry.id));
        const nativeLogs = entries
          .slice(-300)
          .map((entry) => ({
            id: `native-${entry.time}-${entry.message.slice(0, 24)}`,
            time: entry.time,
            level: entry.level,
            message: entry.message,
          }))
          .filter((entry) => !existing.has(entry.id));
        return {
          logs: [...state.logs, ...nativeLogs].sort((a, b) => a.time - b.time).slice(-500),
        };
      });
    } catch {
      // Native logs are diagnostic only.
    }
  },

  clearLogs: async () => {
    const bridge = getVpnBridge();
    try {
      await bridge.clearLogs?.();
    } catch {
      // Clearing native logs is best effort.
    }
    set({ logs: initialLogs() });
  },

  selectServer: (id) => {
    const server = get().servers.find((entry) => entry.id === id);
    if (!server) return;
    if (get().isPinging || get().isSwitching) return;

    const wasConnected = get().vpnStatus.state === 'connected';
    set({ selectedServerId: id, sheet: null });
    get().addLog(`Выбран сервер · ${server.name}`);

    if (!wasConnected) return;

    set({ isSwitching: true, vpnStatus: { state: 'connecting', since: Date.now() } });
    void (async () => {
      const bridge = getVpnBridge();
      suppressVpnStatus = true;
      try {
        await bridge.stop();
        await waitForVpnState(bridge, 'disconnected');
        const config = buildXrayConfig(get().servers, {
          selectedServerId: id,
          routingMode: get().settings.routingMode,
          logLevel: get().settings.logLevel,
        });
        await bridge.start({
          config: JSON.stringify(config),
          killSwitch: get().settings.killSwitch,
        });
        const status = await bridge.getStatus();
        set({ vpnStatus: status });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось переключить локацию';
        get().addLog(message, 'error');
        get().showToast(message);
        set({ vpnStatus: { state: 'error', error: message } });
      } finally {
        suppressVpnStatus = false;
        set({ isSwitching: false });
      }
    })();
  },

  deleteSubscription: () => {
    void getVpnBridge()
      .stop()
      .catch(() => undefined);
    set({
      subscription: null,
      servers: [],
      selectedServerId: null,
      vpnStatus: { state: 'disconnected' },
      screen: 'home',
      sheet: null,
      subscriptionMenuAnchor: null,
    });
    get().addLog('Подписка удалена', 'warn');
  },

  initVpn: () => {
    if (vpnUnsubscribe) return;
    const bridge = getVpnBridge();
    try {
      const stableId = bridge.getStableDeviceId?.();
      if (stableId) DEVICE.hwid = stableId;
    } catch {
      // Keep the fallback identifier when the native module is unavailable.
    }
    vpnUnsubscribe = bridge.subscribe((status) => {
      if (!suppressVpnStatus) set({ vpnStatus: status });
    });
    bridge
      .getStatus()
      .then((status) => set({ vpnStatus: status }))
      .catch(() => undefined);
    bridge.subscribeLogs?.((entry) => get().addLog(entry.message, entry.level));
  },

  toggleConnection: async () => {
    const state = get().vpnStatus.state;
    if (!get().subscription) {
      get().showToast('Сначала добавьте ключ подписки');
      return;
    }
    if (state === 'connecting' || state === 'disconnecting' || get().isPinging || get().isSwitching)
      return;

    const selected =
      get().servers.find((server) => server.id === get().selectedServerId) ?? get().servers[0];
    if (!selected) {
      get().showToast('Нет доступных серверов');
      return;
    }

    const bridge = getVpnBridge();
    try {
      if (state === 'connected') {
        get().addLog('Отключение…');
        await bridge.stop();
        return;
      }

      const config = buildXrayConfig(get().servers, {
        selectedServerId: selected.id,
        routingMode: get().settings.routingMode,
        logLevel: get().settings.logLevel,
      });
      const prepared = await bridge.prepare();
      if (!prepared) {
        get().showToast('Разрешите VPN в системном окне и нажмите ещё раз');
        return;
      }
      get().addLog(`Подключение · ${selected.name}`);
      await bridge.start({
        config: JSON.stringify(config),
        killSwitch: get().settings.killSwitch,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось переключить VPN';
      get().addLog(message, 'error');
      get().showToast(message);
    }
  },

  navigate: (screen) => set({ screen, subscriptionMenuAnchor: null }),
  openSheet: (sheet, mode = 'manual') =>
    set({ sheet, addMode: mode, subscriptionMenuAnchor: null }),
  closeSheet: () => set({ sheet: null }),
  setAddMode: (mode) => set({ addMode: mode }),
  openSubscriptionMenu: (anchor) => set({ subscriptionMenuAnchor: anchor }),
  closeSubscriptionMenu: () => set({ subscriptionMenuAnchor: null }),
  updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

  resetApp: () => {
    void getVpnBridge()
      .stop()
      .catch(() => undefined);
    set({
      subscription: null,
      servers: [],
      selectedServerId: null,
      vpnStatus: { state: 'disconnected' },
      screen: 'home',
      sheet: null,
      settings: DEFAULT_SETTINGS,
      logs: initialLogs(),
    });
  },

  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = setTimeout(() => set({ toast: null }), 2800);
  },

  clearToast: () => set({ toast: null }),
}));
