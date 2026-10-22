import { colors, fonts, radii } from '@ragenet/design';
import * as Clipboard from 'expo-clipboard';
import { Platform, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { PlatformIcon } from '../components/PlatformIcon';
import { useAppStore } from '../store/useAppStore';

export function QrSheet() {
  const { width } = useWindowDimensions();
  const sheet = useAppStore((state) => state.sheet);
  const subscription = useAppStore((state) => state.subscription);
  const closeSheet = useAppStore((state) => state.closeSheet);
  const showToast = useAppStore((state) => state.showToast);

  const size = Math.min(Math.max(180, width - 190), 210);
  const url = subscription?.url ?? '';

  const copy = async () => {
    if (!url) return;
    try {
      await Clipboard.setStringAsync(url);
      showToast('Ссылка скопирована');
    } catch {
      showToast('Не удалось скопировать ссылку');
    }
  };

  const share = async () => {
    if (!url) return;
    if (Platform.OS === 'web') {
      await copy();
      return;
    }
    try {
      await Share.share({ message: url, url });
    } catch {
      showToast('Не удалось поделиться ссылкой');
    }
  };

  const header = (
    <View style={styles.header}>
      <IconButton accessibilityLabel="Закрыть QR-код" onPress={closeSheet}>
        <PlatformIcon name="close" size={21} color={colors.text} />
      </IconButton>
      <Text style={styles.title}>QR-код</Text>
      <View style={styles.spacer} />
    </View>
  );

  return (
    <BottomSheet visible={sheet === 'qr'} onClose={closeSheet} header={header}>
      <View style={styles.content}>
        <View style={styles.qrShell}>
          <QRCode
            value={url || 'https://ragenet.example'}
            size={size}
            color={colors.bg}
            backgroundColor={colors.text}
            quietZone={10}
          />
        </View>
        <Text style={styles.name}>{subscription?.meta.title ?? 'RageNet VPN'}</Text>
        <Text style={styles.hint}>
          Отсканируйте код в RageNet на другом устройстве. Ссылка содержит ключ подписки — не
          публикуйте её.
        </Text>
        <View style={styles.actions}>
          <Button
            label="Скопировать"
            onPress={copy}
            variant="secondary"
            icon={<PlatformIcon name="copy" size={18} color={colors.text} />}
            style={styles.actionButton}
          />
          <Button
            label="Поделиться"
            onPress={share}
            variant="ghost"
            icon={<PlatformIcon name="share" size={18} color={colors.brandStrong} />}
            style={styles.actionButton}
          />
        </View>
      </View>
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
  spacer: {
    width: 42,
  },
  content: {
    alignItems: 'center',
    paddingBottom: 10,
    paddingTop: 12,
  },
  qrShell: {
    backgroundColor: colors.text,
    borderRadius: radii.md,
    padding: 10,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    marginTop: 14,
  },
  hint: {
    color: colors.text3,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
    marginTop: 6,
    maxWidth: 280,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    paddingHorizontal: 10,
  },
});
