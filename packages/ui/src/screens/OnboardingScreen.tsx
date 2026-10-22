import { colors, fonts } from '@ragenet/design';
import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandLockup } from '../components/BrandLockup';
import { Button } from '../components/Button';
import { Pill } from '../components/Pill';
import { PlatformIcon } from '../components/PlatformIcon';
import { Screen } from '../components/Screen';
import { useAppStore } from '../store/useAppStore';

export function OnboardingScreen() {
  const openSheet = useAppStore((state) => state.openSheet);
  const loadDemo = useAppStore((state) => state.loadDemo);
  const showToast = useAppStore((state) => state.showToast);

  const pasteFromClipboard = async () => {
    try {
      const value = await Clipboard.getStringAsync();
      openSheet('addKey', value.trim() ? 'clipboard' : 'manual');
    } catch {
      showToast('Не удалось прочитать буфер обмена');
      openSheet('addKey', 'manual');
    }
  };

  return (
    <Screen>
      <View style={styles.top}>
        <BrandLockup size={54} />
      </View>

      <View style={styles.spacer} />

      <View style={styles.content}>
        <Pill>Добро пожаловать</Pill>
        <Text style={styles.title}>Добавьте ключ для отображения списка серверов</Text>
        <Text style={styles.subtitle}>Выберите способ добавления</Text>

        <View style={styles.options}>
          <Button
            label="Из буфера"
            onPress={pasteFromClipboard}
            variant="secondary"
            icon={<PlatformIcon name="clipboard" size={22} color={colors.text} />}
            style={styles.option}
          />
          <Button
            label="QR-код"
            onPress={() => openSheet('addKey', 'qr')}
            variant="secondary"
            icon={<PlatformIcon name="qr" size={22} color={colors.text} />}
            style={styles.option}
          />
          <Button
            label="Вручную"
            onPress={() => openSheet('addKey', 'manual')}
            variant="secondary"
            icon={<PlatformIcon name="keyboard" size={22} color={colors.text} />}
            style={styles.option}
          />
        </View>
      </View>

      <View style={styles.spacer} />

      <View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={loadDemo} hitSlop={12}>
          <Text style={styles.demo}>Посмотреть демо</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    alignItems: 'center',
    paddingTop: 10,
  },
  spacer: {
    flex: 1,
    minHeight: 32,
  },
  content: {
    paddingHorizontal: 4,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.extrabold,
    fontSize: 28,
    letterSpacing: -0.8,
    lineHeight: 34,
    marginTop: 18,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.text2,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 18,
    marginTop: 14,
    textAlign: 'center',
  },
  options: {
    gap: 12,
    marginTop: 2,
  },
  option: {
    borderColor: colors.line,
    borderRadius: 18,
    height: 62,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 12,
    paddingTop: 8,
  },
  demo: {
    color: colors.text3,
    fontFamily: fonts.medium,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
