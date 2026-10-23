import { colors, fonts, radii } from '@ragenet/design';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { flagForCountryCode } from '@ragenet/core';
import { stripFlag } from '../lib/format';
import { useAppStore } from '../store/useAppStore';
import { BrandLockup } from './BrandLockup';
import { PlatformIcon } from './PlatformIcon';

interface DesktopShellProps {
  children: ReactNode;
  onAddKey: () => void;
}

export function DesktopShell({ children, onAddKey }: DesktopShellProps) {
  const navigate = useAppStore((state) => state.navigate);
  const screen = useAppStore((state) => state.screen);
  const servers = useAppStore((state) => state.servers);
  const selectedServerId = useAppStore((state) => state.selectedServerId);
  const vpnStatus = useAppStore((state) => state.vpnStatus);

  const selected =
    servers.find((server) => server.id === selectedServerId && !server.isGroup) ??
    servers.find((server) => !server.isGroup);
  const serverName = selected ? stripFlag(selected.name) : 'Нет сервера';
  const flag = selected?.flagEmoji ?? flagForCountryCode(selected?.countryCode) ?? '🌐';

  const webFullHeight =
    Platform.OS === 'web' ? ({ minHeight: '100vh' } as unknown as ViewStyle) : undefined;

  return (
    <View style={[styles.root, webFullHeight]}>
      <View style={styles.sidebar}>
        <View style={styles.brand}>
          <BrandLockup size={34} />
        </View>

        <Text style={styles.section}>Приложение</Text>
        <DesktopNav
          active={screen === 'home'}
          icon="wifi"
          label="Подключение"
          onPress={() => navigate('home')}
        />
        <DesktopNav
          active={screen === 'logs'}
          icon="file"
          label="Логи туннеля"
          onPress={() => navigate('logs')}
        />
        <DesktopNav
          active={screen === 'settings'}
          icon="settings"
          label="Настройки"
          onPress={() => navigate('settings')}
        />

        <View style={styles.sidebarSpacer} />

        <View style={styles.connectionCard}>
          <View style={styles.connectionTop}>
            <Text style={styles.flag}>{flag}</Text>
            <View style={styles.connectionText}>
              <Text style={styles.server} numberOfLines={1}>
                {serverName}
              </Text>
              <Text style={styles.connectionStatus}>
                {vpnStatus.state === 'connected'
                  ? 'Подключено'
                  : vpnStatus.state === 'connecting'
                    ? 'Подключение'
                    : 'Отключено'}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onAddKey}
            style={({ pressed }) => [styles.addKey, pressed && styles.pressed]}
          >
            <PlatformIcon name="plus" size={16} color={colors.text2} />
            <Text style={styles.addKeyText}>Добавить ключ</Text>
          </Pressable>
        </View>

        <Text style={styles.version}>RageNet VPN · 0.3.19</Text>
      </View>

      <View style={styles.content}>{children}</View>
    </View>
  );
}

interface DesktopNavProps {
  active: boolean;
  icon: 'wifi' | 'file' | 'settings';
  label: string;
  onPress: () => void;
}

function DesktopNav({ active, icon, label, onPress }: DesktopNavProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.nav, active && styles.navActive, pressed && styles.pressed]}
    >
      <PlatformIcon name={icon} size={18} color={active ? colors.brandStrong : colors.text2} />
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
      {active ? <View style={styles.activeMark} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.bg,
  },
  sidebar: {
    width: 252,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 18,
    backgroundColor: '#0A111E',
    borderRightColor: colors.line,
    borderRightWidth: 1,
  },
  brand: {
    marginBottom: 30,
    paddingHorizontal: 8,
  },
  section: {
    color: colors.text3,
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 8,
    paddingHorizontal: 10,
    textTransform: 'uppercase',
  },
  nav: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flexDirection: 'row',
    gap: 11,
    height: 42,
    marginBottom: 3,
    paddingHorizontal: 11,
    position: 'relative',
  },
  navActive: {
    backgroundColor: colors.brandSoft,
  },
  navText: {
    color: colors.text2,
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  navTextActive: {
    color: colors.text,
    fontFamily: fonts.semibold,
  },
  activeMark: {
    backgroundColor: colors.brandStrong,
    borderRadius: 99,
    height: 5,
    width: 5,
  },
  sidebarSpacer: {
    flex: 1,
    minHeight: 24,
  },
  connectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 12,
  },
  connectionTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  flag: {
    fontSize: 22,
  },
  connectionText: {
    flex: 1,
    minWidth: 0,
  },
  server: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  connectionStatus: {
    color: colors.text3,
    fontFamily: fonts.regular,
    fontSize: 10.5,
    marginTop: 2,
  },
  addKey: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radii.xs,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: 30,
    justifyContent: 'center',
    marginTop: 10,
  },
  addKeyText: {
    color: colors.text2,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  pressed: {
    opacity: 0.74,
  },
  version: {
    color: colors.text3,
    fontFamily: fonts.regular,
    fontSize: 10,
    marginTop: 14,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
});
