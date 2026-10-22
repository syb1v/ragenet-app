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
import { createDemoSubscription } from '../lib/demo';

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

  loadDemo: () => void;
  addSubscription: (input: string) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  pingServers: () => Promise<void>;
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

export const DEVICE = {
  hwid: generateHwid(),
  os: platformName(),
  osVersion: Platform.Version?.toString() ?? 'unknown',
  model: deviceModel(),
  appVersion: Constants.expoConfig?.version ?? '0.1.7',
};

let vpnBridge: VpnBridge | null = null;
let vpnUnsubscribe: (() => void) | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function getVpnBridge(): VpnBridge {
  if (!vpnBridge) vpnBridge = createVpnBridge();
  return vpnBridge;
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

  loadDemo: () => {
    const subscription = createDemoSubscription();
    if (get().vpnStatus.state !== 'disconnected') {
      void getVpnBridge()
        .stop()
        .catch(() => undefined);
    }
    set({
      subscription,
      servers: subscription.servers,
      selectedServerId: subscription.servers[0]?.id ?? null,
      vpnStatus: { state: 'disconnected' },
      screen: 'home',
      sheet: null,
      logs: initialLogs(),
    });
    get().addLog(`Демо-подписка загружена · ${subscription.servers.length} сервера`);
  },

  addSubscription: async (input) => {
    const trimmed = input.trim();
    if (!trimmed || trimmed === 'demo' || trimmed.startsWith('demo://')) {
      get().loadDemo();
      return;
    }

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
        const updated = {
          ...subscription,
          updatedAt: Date.now(),
          meta: {
            ...subscription.meta,
            downloadBytes: (subscription.meta.downloadBytes ?? 0) + 18 * 1024 ** 2,
          },
        };
        set({ subscription: updated });
        get().addLog('Демо-подписка обновлена');
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
    const { servers } = get();
    if (servers.length === 0) return;
    const bridge = getVpnBridge();
    if (!bridge.measureLatency) {
      get().addLog('Реальный пинг недоступен на этой платформе', 'warn');
      return;
    }

    set({
      isPinging: true,
      servers: servers.map((server) => ({ ...server, latencyMs: undefined })),
    });
    const measured = await Promise.all(
      servers.map(async (server) => {
        let latency: number | null = null;
        try {
          latency = (await bridge.measureLatency?.(server.host, server.port)) ?? null;
        } catch {
          latency = null;
        }
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
    set({
      isPinging: false,
      servers: measured,
      subscription: subscription ? { ...subscription, servers: measured } : null,
    });
    const answered = measured.filter((server) => server.latencyMs != null).length;
    get().addLog(`Пинг завершён · ${answered}/${measured.length} серверов`);
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
    set({ selectedServerId: id, sheet: null });
    get().addLog(`Выбран сервер · ${server.name}`);
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
    vpnUnsubscribe = bridge.subscribe((status) => set({ vpnStatus: status }));
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
    if (state === 'connecting' || state === 'disconnecting') return;

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
