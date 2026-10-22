import { colors, fonts } from '@ragenet/design';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { IconButton } from '../components/IconButton';
import { PlatformIcon } from '../components/PlatformIcon';
import { Screen } from '../components/Screen';
import { useAppStore, type LogEntry } from '../store/useAppStore';

type LogFilter = 'all' | LogEntry['level'];

const FILTERS: { id: LogFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'info', label: 'Инфо' },
  { id: 'warn', label: 'Варн' },
  { id: 'error', label: 'Еррор' },
];

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function logText(logs: LogEntry[]): string {
  return logs
    .map((entry) => `[${formatTime(entry.time)}] ${entry.level.toUpperCase()} ${entry.message}`)
    .join('\n');
}

export function LogsScreen() {
  const navigate = useAppStore((state) => state.navigate);
  const logs = useAppStore((state) => state.logs);
  const clearLogs = useAppStore((state) => state.clearLogs);
  const loadNativeLogs = useAppStore((state) => state.loadNativeLogs);
  const showToast = useAppStore((state) => state.showToast);
  const [filter, setFilter] = useState<LogFilter>('all');

  useEffect(() => {
    void loadNativeLogs();
    const timer = setInterval(() => {
      void loadNativeLogs();
    }, 1600);
    return () => clearInterval(timer);
  }, [loadNativeLogs]);

  const ordered = useMemo(
    () =>
      [...logs]
        .filter((entry) => filter === 'all' || entry.level === filter)
        .sort((a, b) => b.time - a.time),
    [filter, logs],
  );

  const download = async () => {
    const text = logText([...logs].sort((a, b) => a.time - b.time)) || 'RageNet logs are empty';
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'ragenet-tunnel.log';
        anchor.click();
        URL.revokeObjectURL(url);
        return;
      }

      const uri = `${FileSystem.cacheDirectory ?? ''}ragenet-tunnel.log`;
      await FileSystem.writeAsStringAsync(uri, text);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: 'Скачать логи RageNet',
          mimeType: 'text/plain',
          UTI: 'public.plain-text',
        });
      } else {
        await Share.share({ message: text, title: 'RageNet logs' });
      }
    } catch {
      showToast('Не удалось сохранить логи');
    }
  };

  const clear = async () => {
    await clearLogs();
    showToast('Логи очищены');
  };

  return (
    <Screen>
      <Header
        left={
          <IconButton accessibilityLabel="Назад" onPress={() => navigate('settings')}>
            <PlatformIcon name="back" size={21} color={colors.text} />
          </IconButton>
        }
        title="Логи"
        right={
          <View style={styles.headerActions}>
            <IconButton accessibilityLabel="Очистить логи" onPress={clear} size={40}>
              <PlatformIcon name="trash" size={18} color={colors.text2} />
            </IconButton>
            <IconButton accessibilityLabel="Скачать логи" onPress={download} size={40}>
              <PlatformIcon name="download" size={19} color={colors.text2} />
            </IconButton>
          </View>
        }
      />

      <View style={styles.filters}>
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={item.id}
              onPress={() => setFilter(item.id)}
              style={({ pressed }) => [
                styles.filter,
                active && styles.filterActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.card} padded={false}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          {ordered.length === 0 ? (
            <Text style={styles.empty}>Пока нет записей</Text>
          ) : (
            ordered.map((entry) => (
              <View key={entry.id} style={styles.line}>
                <Text style={styles.time}>{formatTime(entry.time)}</Text>
                <View style={styles.messageColumn}>
                  <Text
                    style={[
                      styles.level,
                      entry.level === 'error' && styles.error,
                      entry.level === 'warn' && styles.warn,
                    ]}
                  >
                    {entry.level.toUpperCase()}
                  </Text>
                  <Text
                    style={[
                      styles.message,
                      entry.level === 'error' && styles.error,
                      entry.level === 'warn' && styles.warn,
                    ]}
                  >
                    {entry.message}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </Card>

      <Text style={styles.note}>
        Секреты подписки и UUID серверов не попадают в лог. Перед отправкой проверьте содержимое.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  filters: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    marginTop: 2,
  },
  filter: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  filterActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandBorder,
  },
  filterText: {
    color: colors.text3,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  filterTextActive: {
    color: colors.brandStrong,
    fontFamily: fonts.semibold,
  },
  pressed: {
    opacity: 0.72,
  },
  card: {
    flex: 1,
    marginTop: 2,
  },
  content: {
    padding: 12,
    gap: 8,
  },
  line: {
    flexDirection: 'row',
    gap: 8,
  },
  time: {
    color: colors.text3,
    fontFamily: fonts.mono,
    fontSize: 10,
    lineHeight: 15,
    paddingTop: 1,
  },
  messageColumn: {
    flex: 1,
    gap: 1,
  },
  level: {
    color: colors.text3,
    fontFamily: fonts.monoMedium,
    fontSize: 8.5,
    letterSpacing: 0.4,
  },
  message: {
    color: colors.text2,
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 15,
  },
  error: {
    color: colors.danger,
  },
  warn: {
    color: colors.amber,
  },
  empty: {
    color: colors.text3,
    fontFamily: fonts.mono,
    fontSize: 12,
    paddingVertical: 12,
    textAlign: 'center',
  },
  note: {
    color: colors.text3,
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 8,
    paddingHorizontal: 2,
  },
});
