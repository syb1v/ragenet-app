import { colors, fonts } from '@ragenet/design';
import { shortHwid } from '@ragenet/core';
import Constants from 'expo-constants';
import type { ReactNode } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Divider } from '../components/Card';
import { Header } from '../components/Header';
import { IconButton } from '../components/IconButton';
import { PlatformIcon } from '../components/PlatformIcon';
import { Screen } from '../components/Screen';
import { TELEGRAM_SUPPORT_URL } from '../lib/links';
import { todayLabel } from '../lib/format';
import { tapHaptic } from '../lib/haptics';
import { TELEGRAM_BOT_URL } from '../lib/links';
import { DEVICE, useAppStore } from '../store/useAppStore';

interface SettingRowProps {
  icon?: ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
  mono?: boolean;
}

function SettingRow({ icon, label, value, onPress, danger, last, mono }: SettingRowProps) {
  return (
    <>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        android_ripple={
          onPress && Platform.OS === 'android' ? { color: colors.white10 } : undefined
        }
        disabled={!onPress}
        onPress={onPress}
        onPressIn={onPress ? tapHaptic : undefined}
        style={({ pressed }) => [styles.row, pressed && onPress ? styles.pressed : null]}
      >
        {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
        <Text style={[styles.rowLabel, danger && styles.danger, !icon && styles.rowLabelNoIcon]}>
          {label}
        </Text>
        {value ? (
          <Text
            numberOfLines={1}
            style={[styles.rowValue, mono && styles.monoValue, danger && styles.danger]}
          >
            {value}
          </Text>
        ) : null}
        {onPress && !value ? (
          <PlatformIcon name="chevron" size={18} color={danger ? colors.danger : colors.text3} />
        ) : null}
      </Pressable>
      {!last ? <Divider inset={14} /> : null}
    </>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

interface SettingsScreenProps {
  onClose?: () => void;
}

export function SettingsScreen({ onClose }: SettingsScreenProps = {}) {
  const navigate = useAppStore((state) => state.navigate);
  const openSheet = useAppStore((state) => state.openSheet);
  const showToast = useAppStore((state) => state.showToast);
  const subscription = useAppStore((state) => state.subscription);
  const supportUrl = subscription?.meta.supportUrl ?? TELEGRAM_SUPPORT_URL;
  const appVersion = '0.3.19';
  const buildNumber = '22';

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
          <IconButton
            accessibilityLabel="Закрыть настройки"
            onPress={onClose ?? (() => navigate('home'))}
          >
            <PlatformIcon name="close" size={22} color={colors.text} />
          </IconButton>
        }
        title="Настройки"
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical
        overScrollMode="always"
      >
        <SectionLabel>Ссылки</SectionLabel>
        <Card padded={false}>
          <SettingRow
            icon={<PlatformIcon name="file" size={21} color={colors.brandStrong} />}
            label="Логи"
            onPress={() => navigate('logs')}
          />
          <SettingRow
            icon={<PlatformIcon name="support" size={21} color={colors.brandStrong} />}
            label="Поддержка"
            onPress={openSupport}
          />
          <SettingRow
            icon={<PlatformIcon name="send" size={20} color={colors.brandStrong} />}
            label="Telegram-бот"
            onPress={openBot}
            last
          />
        </Card>

        <View style={styles.resetBlock}>
          <Card padded={false}>
            <SettingRow
              danger
              icon={<PlatformIcon name="trash" size={21} color={colors.danger} />}
              label="Сбросить приложение"
              onPress={() => openSheet('reset')}
              last
            />
          </Card>
          <Text style={styles.resetNote}>
            Будут удалены сохранённые подписки, настройки приложения и установленный VPN-профиль.
            Постоянный ID устройства сохранится. Это действие необратимо.
          </Text>
        </View>

        <SectionLabel>О приложении</SectionLabel>
        <Card padded={false}>
          <SettingRow label="Версия" value={appVersion} />
          <SettingRow label="Сборка" value={buildNumber} />
          <SettingRow label="Дата сборки" value={todayLabel()} />
          <SettingRow label="Версия ядра" value="Xray 26.10" mono />
          <SettingRow label="ID устройства" value={shortHwid(DEVICE.hwid)} mono />
        </Card>

        <Text style={styles.footer}>
          RageNet VPN · {subscription?.meta.title ?? 'Phase 0 preview'}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 18,
  },
  sectionLabel: {
    color: colors.text2,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 9,
    marginTop: 16,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  pressed: {
    opacity: 0.75,
  },
  rowIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
  },
  rowLabel: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  rowLabelNoIcon: {
    paddingLeft: 0,
  },
  rowValue: {
    color: colors.text2,
    fontFamily: fonts.regular,
    fontSize: 14,
    maxWidth: '55%',
    textAlign: 'right',
  },
  monoValue: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
  },
  danger: {
    color: colors.danger,
  },
  resetBlock: {
    marginTop: 18,
  },
  resetNote: {
    color: colors.text3,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 10,
    paddingHorizontal: 2,
  },
  footer: {
    color: colors.text3,
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 22,
    textAlign: 'center',
  },
});
