import { colors, fonts } from '@ragenet/design';
import { flagForCountryCode } from '@ragenet/core';
import {
  ArrowUpDown,
  Calendar,
  ChevronsUpDown,
  Headphones,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Send,
  Settings,
} from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { ParticleSphere } from '../components/particles/ParticleSphere';
import { errorHaptic, successHaptic } from '../lib/haptics';
import { formatBytes, formatDate, formatUpdated, stripFlag } from '../lib/format';
import { DEMO_SUPPORT_URL } from '../lib/demo';
import { TELEGRAM_BOT_URL } from '../lib/links';
import { useAppStore } from '../store/useAppStore';

const STATUS_LABEL: Record<string, string> = {
  disconnected: 'Отключено',
  connecting: 'Подключение…',
  connected: 'Подключено',
  disconnecting: 'Отключение…',
  error: 'Ошибка подключения',
};

export function HomeScreen() {
  const subscription = useAppStore((state) => state.subscription);
  const servers = useAppStore((state) => state.servers);
  const selectedServerId = useAppStore((state) => state.selectedServerId);
  const vpnStatus = useAppStore((state) => state.vpnStatus);
  const isRefreshing = useAppStore((state) => state.isRefreshing);
  const openSubscriptionMenu = useAppStore((state) => state.openSubscriptionMenu);

  const navigate = useAppStore((state) => state.navigate);
  const openSheet = useAppStore((state) => state.openSheet);
  const refreshSubscription = useAppStore((state) => state.refreshSubscription);
  const toggleConnection = useAppStore((state) => state.toggleConnection);
  const showToast = useAppStore((state) => state.showToast);

  const previousState = useRef(vpnStatus.state);
  const moreButtonRef = useRef<ComponentRef<typeof View>>(null);
  const [connectedSeconds, setConnectedSeconds] = useState(0);
  const [chargeProgress, setChargeProgress] = useState<number | null>(null);

  useEffect(() => {
    if (previousState.current !== vpnStatus.state) {
      if (vpnStatus.state === 'connected') successHaptic();
      if (vpnStatus.state === 'error') errorHaptic();
      previousState.current = vpnStatus.state;
    }
  }, [vpnStatus.state]);

  useEffect(() => {
    if (vpnStatus.state !== 'connected') {
      setConnectedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setConnectedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [vpnStatus.state]);

  if (!subscription) return null;

  const selectedServer =
    servers.find((server) => server.id === selectedServerId) ?? servers[0] ?? null;
  const total = subscription.meta.totalBytes;
  const used = (subscription.meta.downloadBytes ?? 0) + (subscription.meta.uploadBytes ?? 0);
  const supportUrl = subscription.meta.supportUrl ?? DEMO_SUPPORT_URL;
  const flag = selectedServer?.flagEmoji ?? flagForCountryCode(selectedServer?.countryCode) ?? '🌐';
  const serverName = selectedServer ? stripFlag(selectedServer.name) : 'Выберите сервер';
  const isConnected = vpnStatus.state === 'connected';

  const openSupport = async () => {
    try {
      await Linking.openURL(supportUrl);
    } catch {
      showToast(`Поддержка: ${supportUrl}`);
    }
  };

  const openBot = async () => {
    try {
      await Linking.openURL(TELEGRAM_BOT_URL);
    } catch {
      showToast(`Telegram-бот: ${TELEGRAM_BOT_URL}`);
    }
  };

  return (
    <Screen>
      <Header
        left={
          <IconButton accessibilityLabel="Настройки" onPress={() => navigate('settings')}>
            <Settings color={colors.text} size={20} strokeWidth={1.8} />
          </IconButton>
        }
        right={
          <IconButton accessibilityLabel="Добавить ключ" onPress={() => openSheet('addKey')}>
            <Plus color={colors.text} size={22} strokeWidth={1.8} />
          </IconButton>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.coreArea}>
          <ParticleSphere
            state={vpnStatus.state}
            onToggle={toggleConnection}
            onChargeProgress={setChargeProgress}
          />
          <View
            style={[
              styles.statusPill,
              isConnected && styles.statusPillConnected,
              vpnStatus.state === 'connecting' && styles.statusPillConnecting,
              vpnStatus.state === 'error' && styles.statusPillError,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                isConnected && styles.statusDotConnected,
                vpnStatus.state === 'connecting' && styles.statusDotConnecting,
                vpnStatus.state === 'error' && styles.statusDotError,
              ]}
            />
            <Text
              accessibilityLiveRegion="polite"
              style={[
                styles.statusText,
                isConnected && styles.statusTextConnected,
                vpnStatus.state === 'connecting' && styles.statusTextConnecting,
              ]}
            >
              {STATUS_LABEL[vpnStatus.state] ?? 'Отключено'}
            </Text>
          </View>
          {isConnected ? (
            <Text style={styles.connectedTimer}>
              {String(Math.floor(connectedSeconds / 60)).padStart(2, '0')}:
              {String(connectedSeconds % 60).padStart(2, '0')}
            </Text>
          ) : null}
          <Text style={styles.hint}>
            {isConnected
              ? 'Коснитесь, чтобы отключиться'
              : chargeProgress != null
                ? chargeProgress >= 1
                  ? 'Сфера собирается'
                  : `Удерживайте ${Math.max(0, 8 - chargeProgress * 8).toFixed(1)} с`
                : vpnStatus.state === 'connecting'
                  ? 'Сфера собирается'
                  : 'Коснитесь для волны · удерживайте 8 секунд'}
          </Text>
        </View>

        <View style={styles.info}>
          <View style={styles.subscriptionRow}>
            <View style={styles.subscriptionText}>
              <Text style={styles.subscriptionTitle} numberOfLines={1}>
                {subscription.meta.title ?? 'RageNet VPN'}
              </Text>
              <Text style={styles.updated}>Обновлено {formatUpdated(subscription.updatedAt)}</Text>
            </View>
            <View style={styles.subscriptionActions}>
              <IconButton
                accessibilityLabel="Обновить подписку"
                onPress={refreshSubscription}
                size={40}
              >
                {isRefreshing ? (
                  <ActivityIndicator color={colors.text2} size="small" />
                ) : (
                  <RefreshCw color={colors.text2} size={18} strokeWidth={1.8} />
                )}
              </IconButton>
              <View ref={moreButtonRef} collapsable={false}>
                <IconButton
                  accessibilityLabel="Меню подписки"
                  onPress={() => {
                    moreButtonRef.current?.measureInWindow((x, y, width, height) => {
                      openSubscriptionMenu({ x, y, width, height });
                    });
                  }}
                  size={40}
                >
                  <MoreHorizontal color={colors.text2} size={19} strokeWidth={1.8} />
                </IconButton>
              </View>
            </View>
          </View>

          <View style={styles.dataStrip}>
            <View style={styles.dataCell}>
              <View style={styles.dataLabelRow}>
                <ArrowUpDown color={colors.text2} size={14} strokeWidth={1.8} />
                <Text style={styles.dataLabel}>Трафик</Text>
              </View>
              <Text style={styles.dataValue}>
                {subscription.meta.hideTraffic ? '∞' : formatBytes(used)}
              </Text>
              {!subscription.meta.hideTraffic && total ? (
                <Text style={styles.dataSub}>из {formatBytes(total)}</Text>
              ) : null}
            </View>
            <View style={styles.dataDivider} />
            <View style={styles.dataCell}>
              <View style={styles.dataLabelRow}>
                <Calendar color={colors.text2} size={14} strokeWidth={1.8} />
                <Text style={styles.dataLabel}>Действует до</Text>
              </View>
              <Text style={styles.dataValue}>{formatDate(subscription.meta.expiresAt)}</Text>
              <Text style={styles.dataSub}>активна</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Выбрать сервер"
            onPress={() => openSheet('servers')}
            style={({ pressed }) => [styles.serverRow, pressed && styles.pressed]}
          >
            <Text style={styles.serverFlag}>{flag}</Text>
            <View style={styles.serverText}>
              <Text style={styles.serverName} numberOfLines={1}>
                {serverName}
              </Text>
              {selectedServer?.latencyMs ? (
                <Text style={styles.serverPing}>{selectedServer.latencyMs} мс</Text>
              ) : (
                <Text style={styles.serverPing}>Пинг не измерен</Text>
              )}
            </View>
            <ChevronsUpDown color={colors.text2} size={19} strokeWidth={1.8} />
          </Pressable>

          <Button
            label="Поддержка"
            onPress={openSupport}
            variant="secondary"
            icon={<Headphones color={colors.text2} size={20} strokeWidth={1.8} />}
            style={styles.supportButton}
          />
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Открыть Telegram-бота"
            onPress={openBot}
            style={styles.botLink}
          >
            <Send color={colors.text3} size={14} strokeWidth={1.8} />
            <Text style={styles.botLinkText}>Открыть Telegram-бота</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingBottom: 10,
  },
  coreArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 330,
    paddingBottom: 4,
    paddingTop: 2,
  },
  statusPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(21, 30, 47, 0.6)',
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    marginTop: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  statusPillConnected: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandBorder,
  },
  statusPillConnecting: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandBorder,
  },
  statusPillError: {
    backgroundColor: colors.dangerSoft,
    borderColor: 'rgba(243, 101, 110, 0.3)',
  },
  statusDot: {
    backgroundColor: colors.text2,
    borderRadius: 99,
    height: 5,
    width: 5,
  },
  statusDotConnected: {
    backgroundColor: colors.brandStrong,
  },
  statusDotConnecting: {
    backgroundColor: colors.brandStrong,
  },
  statusDotError: {
    backgroundColor: colors.danger,
  },
  statusText: {
    color: colors.text2,
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 15,
  },
  statusTextConnected: {
    color: colors.text,
  },
  statusTextConnecting: {
    color: colors.brandStrong,
  },
  connectedTimer: {
    color: colors.text3,
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  hint: {
    color: colors.text3,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  info: {
    gap: 10,
    marginTop: 8,
  },
  subscriptionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  subscriptionText: {
    flex: 1,
    minWidth: 0,
  },
  subscriptionTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 19,
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  updated: {
    color: colors.text2,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
  subscriptionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  dataStrip: {
    backgroundColor: 'rgba(21, 30, 47, 0.54)',
    borderColor: colors.line,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 66,
  },
  dataCell: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dataLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  dataLabel: {
    color: colors.text2,
    fontFamily: fonts.medium,
    fontSize: 10,
  },
  dataValue: {
    color: colors.text,
    fontFamily: fonts.monoMedium,
    fontSize: 12.5,
    letterSpacing: -0.2,
    lineHeight: 17,
    marginTop: 3,
  },
  dataSub: {
    color: colors.text3,
    fontFamily: fonts.regular,
    fontSize: 9.5,
    lineHeight: 13,
    marginTop: 1,
  },
  dataDivider: {
    backgroundColor: colors.line,
    width: 1,
  },
  serverRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
  },
  pressed: {
    opacity: 0.8,
  },
  serverFlag: {
    fontSize: 22,
    lineHeight: 28,
  },
  serverText: {
    flex: 1,
    minWidth: 0,
  },
  serverName: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
  },
  serverPing: {
    color: colors.text3,
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  supportButton: {
    borderRadius: 15,
    height: 46,
    marginTop: 0,
  },
  botLink: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  botLinkText: {
    color: colors.text3,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
});
