import { colors, fonts } from '@ragenet/design';
import * as Clipboard from 'expo-clipboard';
import { ArrowLeft, Copy } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { useAppStore } from '../store/useAppStore';

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

export function LogsScreen() {
  const navigate = useAppStore((state) => state.navigate);
  const logs = useAppStore((state) => state.logs);
  const showToast = useAppStore((state) => state.showToast);

  const copyLogs = async () => {
    const text = logs.map((entry) => `[${formatTime(entry.time)}] ${entry.message}`).join('\n');
    try {
      await Clipboard.setStringAsync(text || 'RageNet logs are empty');
      showToast('Логи скопированы');
    } catch {
      showToast('Не удалось скопировать логи');
    }
  };

  const ordered = [...logs].reverse();

  return (
    <Screen>
      <Header
        left={
          <IconButton accessibilityLabel="Назад" onPress={() => navigate('settings')}>
            <ArrowLeft color={colors.text} size={21} strokeWidth={1.8} />
          </IconButton>
        }
        title="Логи"
        right={
          <IconButton accessibilityLabel="Скопировать логи" onPress={copyLogs}>
            <Copy color={colors.text} size={19} strokeWidth={1.8} />
          </IconButton>
        }
      />

      <Card style={styles.card} padded={false}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          {ordered.length === 0 ? (
            <Text style={styles.empty}>Пока нет записей</Text>
          ) : (
            ordered.map((entry) => (
              <View key={entry.id} style={styles.line}>
                <Text style={styles.time}>{formatTime(entry.time)}</Text>
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
  card: {
    flex: 1,
    marginTop: 4,
  },
  content: {
    padding: 14,
    gap: 10,
  },
  line: {
    flexDirection: 'row',
    gap: 8,
  },
  time: {
    color: colors.text3,
    fontFamily: fonts.mono,
    fontSize: 10.5,
    lineHeight: 16,
    paddingTop: 1,
  },
  message: {
    color: colors.text2,
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11.5,
    lineHeight: 16,
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
    marginTop: 10,
    paddingHorizontal: 2,
  },
});
