import { colors, fonts, radii } from '@ragenet/design';
import { X } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { useAppStore } from '../store/useAppStore';

export function ResetSheet() {
  const sheet = useAppStore((state) => state.sheet);
  const closeSheet = useAppStore((state) => state.closeSheet);
  const resetApp = useAppStore((state) => state.resetApp);
  const showToast = useAppStore((state) => state.showToast);

  const header = (
    <View style={styles.header}>
      <IconButton accessibilityLabel="Закрыть" onPress={closeSheet}>
        <X color={colors.text} size={21} strokeWidth={1.8} />
      </IconButton>
      <Text style={styles.title}>Сброс приложения</Text>
      <View style={styles.spacer} />
    </View>
  );

  const reset = () => {
    resetApp();
    showToast('Приложение сброшено');
  };

  return (
    <BottomSheet visible={sheet === 'reset'} onClose={closeSheet} header={header}>
      <View style={styles.body}>
        <Text style={styles.heading}>Удалить все данные?</Text>
        <Text style={styles.text}>
          Будут удалены сохранённые подписки, настройки приложения и установленный VPN-профиль.
          Постоянный ID устройства сохранится.
        </Text>
        <Button label="Сбросить приложение" onPress={reset} variant="danger" />
        <Button label="Отмена" onPress={closeSheet} variant="ghost" />
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
  body: {
    gap: 12,
    paddingBottom: 8,
    paddingTop: 16,
  },
  heading: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  text: {
    color: colors.text2,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
});
