import { colors, fonts, radii } from '@ragenet/design';
import { flagForCountryCode } from '@ragenet/core';
import {
  ArrowUpDown,
  Calendar,
  ChevronsUpDown,
  Headphones,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings,
} from 'lucide-react-native';
import { useEffect, useRef, type ComponentRef } from 'react';
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

  useEffect(() => {
    if (previousState.current !== vpnStatus.state) {
      if (vpnStatus.state === 'connected') successHaptic();
      if (vpnStatus.state === 'error') errorHaptic();
      previousState.current = vpnStatus.state;
    }
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
        <View style={styles.sphereArea}>
          <ParticleSphere state={vpnStatus.state} onToggle={toggleConnection} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isConnected ? 'Отключить VPN' : 'Подключить VPN'}
            onPress={toggleConnection}
            hitSlop={10}
          >
            <Text
              style={[
                styles.status,
                isConnected && styles.statusConnected,
                vpnStatus.state === 'connecting' && styles.statusConnecting,
              ]}
            >
              {STATUS_LABEL[vpnStatus.state] ?? 'Отключено'}
            </Text>
          </Pressable>
          <Text style={styles.hint}>
            {isConnected
              ? 'Тап или удержание — отключить · перетаскивание — игра'
              : 'Тап или удержание — подключить · перетаскивание — игра'}
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

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statLabelRow}>
                <ArrowUpDown color={colors.text2} size={15} strokeWidth={1.8} />
                <Text style={styles.statLabel}>Трафик</Text>
              </View>
              <Text style={styles.statValue}>
                {subscription.meta.hideTraffic ? '∞' : formatBytes(used)}
              </Text>
              {!subscription.meta.hideTraffic && total ? (
                <Text style={styles.statSub}>из {formatBytes(total)}</Text>
              ) : null}
            </View>
            <View style={styles.statCard}>
              <View style={styles.statLabelRow}>
                <Calendar color={colors.text2} size={15} strokeWidth={1.8} />
                <Text style={styles.statLabel}>Действует до</Text>
              </View>
              <Text style={styles.statValue}>{formatDate(subscription.meta.expiresAt)}</Text>
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
  sphereArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 348,
    paddingBottom: 6,
    paddingTop: 2,
  },
  status: {
    color: colors.text2,
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 6,
  },
  statusConnected: {
    color: colors.green,
  },
  statusConnecting: {
    color: colors.brandStrong,
  },
  hint: {
    color: colors.text3,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  info: {
    gap: 12,
    marginTop: 10,
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 92,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  statLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  statLabel: {
    color: colors.text2,
    fontFamily: fonts.medium,
    fontSize: 12.5,
  },
  statValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.2,
    lineHeight: 21,
    marginTop: 8,
  },
  statSub: {
    color: colors.text3,
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 1,
  },
  serverRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
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
    height: 54,
    marginTop: 0,
    borderRadius: radii.md,
  },
});
