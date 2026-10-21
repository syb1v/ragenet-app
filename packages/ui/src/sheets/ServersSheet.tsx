import { colors, fonts, radii } from '@ragenet/design';
import { flagForCountryCode } from '@ragenet/core';
import { Radar, X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { IconButton } from '../components/IconButton';
import { stripFlag } from '../lib/format';
import { useAppStore } from '../store/useAppStore';

export function ServersSheet() {
  const sheet = useAppStore((state) => state.sheet);
  const servers = useAppStore((state) => state.servers);
  const selectedServerId = useAppStore((state) => state.selectedServerId);
  const closeSheet = useAppStore((state) => state.closeSheet);
  const selectServer = useAppStore((state) => state.selectServer);
  const pingServers = useAppStore((state) => state.pingServers);

  const header = (
    <View style={styles.header}>
      <IconButton accessibilityLabel="Закрыть выбор сервера" onPress={closeSheet}>
        <X color={colors.text} size={21} strokeWidth={1.8} />
      </IconButton>
      <Text style={styles.title}>Выбор сервера</Text>
      <IconButton accessibilityLabel="Проверить пинг" onPress={pingServers}>
        <Radar color={colors.text} size={20} strokeWidth={1.8} />
      </IconButton>
    </View>
  );

  return (
    <BottomSheet visible={sheet === 'servers'} onClose={closeSheet} header={header}>
      <Text style={styles.subtitle}>
        {servers.length} {servers.length === 1 ? 'сервер' : 'серверов'} · нажмите, чтобы выбрать
      </Text>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {servers.map((server) => {
          const selected = server.id === selectedServerId;
          const flag = server.flagEmoji ?? flagForCountryCode(server.countryCode);
          const ping = server.latencyMs;
          const pingColor =
            ping == null
              ? colors.text3
              : ping < 60
                ? colors.green
                : ping < 110
                  ? colors.amber
                  : colors.danger;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={server.id}
              onPress={() => selectServer(server.id)}
              style={({ pressed }) => [
                styles.row,
                selected && styles.rowSelected,
                pressed && styles.pressed,
              ]}
            >
              {selected ? <View style={styles.accent} /> : null}
              <Text style={styles.flag}>{flag}</Text>
              <View style={styles.serverText}>
                <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={1}>
                  {stripFlag(server.name)}
                </Text>
                <Text style={styles.protocol}>{server.protocol.toUpperCase()}</Text>
              </View>
              <Text style={[styles.ping, { color: pingColor }]}>
                {ping == null ? '—' : `${ping} мс`}
              </Text>
            </Pressable>
          );
        })}
        {servers.length === 0 ? <Text style={styles.empty}>Нет серверов</Text> : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  subtitle: {
    color: colors.text3,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  scroll: {
    maxHeight: 540,
  },
  list: {
    paddingBottom: 8,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 10,
    position: 'relative',
  },
  rowSelected: {
    backgroundColor: colors.brandSoft,
    borderRadius: radii.sm,
    borderBottomColor: 'transparent',
    marginBottom: 2,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.8,
  },
  accent: {
    backgroundColor: colors.brandStrong,
    borderRadius: 2,
    bottom: 8,
    left: 0,
    position: 'absolute',
    top: 8,
    width: 2.5,
  },
  flag: {
    fontSize: 22,
    lineHeight: 28,
  },
  serverText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  nameSelected: {
    color: colors.brandStrong,
    fontFamily: fonts.semibold,
  },
  protocol: {
    color: colors.text3,
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  ping: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
  },
  empty: {
    color: colors.text3,
    fontFamily: fonts.regular,
    fontSize: 13,
    paddingVertical: 30,
    textAlign: 'center',
  },
});
