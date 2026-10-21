import {
  DEFAULT_SETTINGS,
  fetchSubscription,
  generateHwid,
  parseSubscription,
  subscriptionFromParsed,
  type AppSettings,
  type ParsedSubscription,
  type ServerNode,
  type Subscription,
  type VpnStatus,
} from '@ragenet/core';
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

  loadDemo: () => void;
  addSubscription: (input: string) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  pingServers: () => Promise<void>;
  selectServer: (id: string) => void;
  deleteSubscription: () => void;
  toggleConnection: () => void;
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
  appVersion: '0.1.0',
};

let statsTimer: ReturnType<typeof setInterval> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let connectTimer: ReturnType<typeof setTimeout> | null = null;

function stopStatsTimer(): void {
  if (statsTimer) {
    clearInterval(statsTimer);
    statsTimer = null;
  }
}

function stopConnectTimer(): void {
  if (connectTimer) {
    clearTimeout(connectTimer);
    connectTimer = null;
  }
}

function initialLogs(): LogEntry[] {
  return [
    {
      id: 'boot',
      time: Date.now(),
      level: 'info',
      message: 'RageNet 0.1.0 · Phase 0 preview',
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
    stopStatsTimer();
    stopConnectTimer();
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
    set({
      servers: servers.map((server) => ({ ...server, latencyMs: undefined })),
    });
    await new Promise((resolve) => setTimeout(resolve, 650));
    const measured = get().servers.map((server) => ({
      ...server,
      latencyMs: 22 + Math.floor(Math.random() * 110),
    }));
    const subscription = get().subscription;
    set({
      servers: measured,
      subscription: subscription ? { ...subscription, servers: measured } : null,
    });
    get().addLog(`Пинг завершён · ${measured.length} серверов`);
  },

  selectServer: (id) => {
    const server = get().servers.find((entry) => entry.id === id);
    if (!server) return;
    set({ selectedServerId: id, sheet: null });
    get().addLog(`Выбран сервер · ${server.name}`);
  },

  deleteSubscription: () => {
    stopStatsTimer();
    stopConnectTimer();
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

  toggleConnection: () => {
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

    if (state === 'connected') {
      stopStatsTimer();
      set({ vpnStatus: { ...get().vpnStatus, state: 'disconnecting' } });
      get().addLog('Отключение…');
      connectTimer = setTimeout(() => {
        set({ vpnStatus: { state: 'disconnected' } });
        get().addLog('VPN отключён');
      }, 520);
      return;
    }

    stopConnectTimer();
    set({
      vpnStatus: {
        state: 'connecting',
        since: Date.now(),
      },
    });
    get().addLog(`Подключение · ${selected.name}`);

    connectTimer = setTimeout(() => {
      set({
        vpnStatus: {
          state: 'connected',
          since: Date.now(),
          stats: { uploadedBytes: 0, downloadedBytes: 0, uptimeSeconds: 0 },
        },
      });
      get().addLog(`VPN подключён · ${selected.name}`);

      stopStatsTimer();
      statsTimer = setInterval(() => {
        const current = get().vpnStatus;
        if (current.state !== 'connected' || !current.stats) return;
        set({
          vpnStatus: {
            ...current,
            stats: {
              uploadedBytes: current.stats.uploadedBytes + 1800 + Math.floor(Math.random() * 3200),
              downloadedBytes:
                current.stats.downloadedBytes + 26000 + Math.floor(Math.random() * 58000),
              uptimeSeconds: current.stats.uptimeSeconds + 1,
            },
          },
        });
      }, 1000);
    }, 1250);
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
    stopStatsTimer();
    stopConnectTimer();
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
