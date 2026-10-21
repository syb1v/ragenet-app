import { colors, fonts, radii } from '@ragenet/design';
import * as Clipboard from 'expo-clipboard';
import { ClipboardPaste, QrCode } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { errorHaptic } from '../lib/haptics';
import { useAppStore } from '../store/useAppStore';

export function AddKeySheet() {
  const sheet = useAppStore((state) => state.sheet);
  const addMode = useAppStore((state) => state.addMode);
  const closeSheet = useAppStore((state) => state.closeSheet);
  const setAddMode = useAppStore((state) => state.setAddMode);
  const addSubscription = useAppStore((state) => state.addSubscription);
  const showToast = useAppStore((state) => state.showToast);

  const visible = sheet === 'addKey';
  const webInputStyle =
    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : undefined;
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setLoading(false);
    if (addMode === 'clipboard') {
      Clipboard.getStringAsync()
        .then((clipboard) => {
          setValue(clipboard.trim());
          if (!clipboard.trim()) showToast('Буфер обмена пуст');
        })
        .catch(() => {
          setValue('');
          showToast('Не удалось прочитать буфер обмена');
        });
    } else {
      setValue('');
    }
  }, [addMode, showToast, visible]);

  const paste = async () => {
    try {
      const clipboard = await Clipboard.getStringAsync();
      if (!clipboard.trim()) {
        showToast('Буфер обмена пуст');
        return;
      }
      setValue(clipboard.trim());
      setAddMode('manual');
    } catch {
      showToast('Не удалось прочитать буфер обмена');
    }
  };

  const submit = async () => {
    if (!value.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      await addSubscription(value);
      closeSheet();
      showToast('Подписка добавлена');
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'Не удалось добавить подписку';
      setError(message);
      errorHaptic();
    } finally {
      setLoading(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        onPress={closeSheet}
        style={({ pressed }) => [styles.headerPill, pressed && styles.pressed]}
      >
        <Text style={styles.headerPillText}>Отмена</Text>
      </Pressable>
      <Text style={styles.title}>Новый ключ</Text>
      <Pressable
        accessibilityRole="button"
        disabled={!value.trim() || loading || addMode === 'qr'}
        onPress={submit}
        style={({ pressed }) => [
          styles.headerPill,
          styles.donePill,
          (!value.trim() || loading || addMode === 'qr') && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.doneText}>Готово</Text>
      </Pressable>
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={closeSheet} header={header}>
      {addMode === 'qr' ? (
        <View style={styles.qrContent}>
          <View style={styles.qrFrame}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
            <QrCode color={colors.text2} size={58} strokeWidth={1.2} />
          </View>
          <Text style={styles.qrTitle}>Наведите камеру на QR-код подписки</Text>
          <Text style={styles.qrHint}>
            Сканер камеры появится в следующей сборке. Пока можно вставить ссылку из буфера.
          </Text>
          <Button
            label="Вставить из буфера"
            onPress={paste}
            variant="secondary"
            icon={<ClipboardPaste color={colors.text} size={19} strokeWidth={1.8} />}
            style={styles.fullButton}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.bodyScroll}
        >
          <Text style={styles.label}>Ссылка на подписку</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={addMode === 'manual'}
            keyboardType="url"
            onChangeText={setValue}
            onSubmitEditing={submit}
            placeholder="https://..."
            placeholderTextColor={colors.text3}
            selectionColor={colors.brand}
            style={[styles.input, webInputStyle]}
            value={value}
          />
          <Text style={styles.note}>
            Remnawave-ссылка, base64 или полный Xray-конфиг. Для демо введите demo.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={paste}
            style={({ pressed }) => [styles.pasteRow, pressed && styles.pressed]}
          >
            <ClipboardPaste color={colors.violet} size={18} strokeWidth={1.8} />
            <Text style={styles.pasteText}>Вставить из буфера</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={loading ? 'Добавляем…' : 'Добавить подписку'}
            onPress={submit}
            disabled={!value.trim() || loading}
            icon={loading ? <ActivityIndicator color={colors.text} size="small" /> : undefined}
            style={styles.fullButton}
          />
        </ScrollView>
      )}
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
  headerPill: {
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    minWidth: 82,
    paddingHorizontal: 14,
  },
  donePill: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandBorder,
  },
  headerPillText: {
    color: colors.text2,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  doneText: {
    color: colors.brandStrong,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.45,
  },
  bodyScroll: {
    maxHeight: 560,
  },
  body: {
    paddingBottom: 4,
    paddingTop: 12,
  },
  label: {
    color: colors.text2,
    fontFamily: fonts.medium,
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface2,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
    height: 52,
    paddingHorizontal: 14,
  },
  pasteRow: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 9,
  },
  pasteText: {
    color: colors.violet,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 10,
    textAlign: 'center',
  },
  fullButton: {
    marginTop: 0,
  },
  note: {
    color: colors.text3,
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  qrContent: {
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 8,
  },
  qrFrame: {
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderColor: colors.line,
    borderRadius: 26,
    borderWidth: 1,
    height: 220,
    justifyContent: 'center',
    marginBottom: 22,
    width: 220,
  },
  corner: {
    borderColor: colors.brandStrong,
    height: 28,
    position: 'absolute',
    width: 28,
  },
  cornerTopLeft: {
    borderLeftWidth: 2,
    borderTopWidth: 2,
    left: 18,
    top: 18,
    borderTopLeftRadius: 6,
  },
  cornerTopRight: {
    borderRightWidth: 2,
    borderTopWidth: 2,
    right: 18,
    top: 18,
    borderTopRightRadius: 6,
  },
  cornerBottomLeft: {
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    bottom: 18,
    left: 18,
    borderBottomLeftRadius: 6,
  },
  cornerBottomRight: {
    borderBottomWidth: 2,
    borderRightWidth: 2,
    bottom: 18,
    right: 18,
    borderBottomRightRadius: 6,
  },
  qrTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    textAlign: 'center',
  },
  qrHint: {
    color: colors.text3,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 18,
    marginTop: 8,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
});
