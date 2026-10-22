import { colors, fonts } from '@ragenet/design';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { PlatformIcon } from '../components/PlatformIcon';
import { useAppStore } from '../store/useAppStore';

export function DeleteSubscriptionSheet() {
  const sheet = useAppStore((state) => state.sheet);
  const subscription = useAppStore((state) => state.subscription);
  const closeSheet = useAppStore((state) => state.closeSheet);
  const deleteSubscription = useAppStore((state) => state.deleteSubscription);
  const showToast = useAppStore((state) => state.showToast);

  const header = (
    <View style={styles.header}>
      <IconButton accessibilityLabel="Закрыть" onPress={closeSheet}>
        <PlatformIcon name="close" size={21} color={colors.text} />
      </IconButton>
      <Text style={styles.title}>Удалить подписку</Text>
      <View style={styles.spacer} />
    </View>
  );

  return (
    <BottomSheet visible={sheet === 'delete'} onClose={closeSheet} header={header}>
      <View style={styles.body}>
        <Text style={styles.heading}>{subscription?.meta.title ?? 'RageNet VPN'}</Text>
        <Text style={styles.text}>
          Ключ будет удалён с этого устройства. VPN-профиль и сохранённые настройки сервера тоже
          исчезнут. ID устройства сохранится.
        </Text>
        <Button
          label="Удалить подписку"
          onPress={() => {
            deleteSubscription();
            showToast('Подписка удалена');
          }}
          variant="danger"
        />
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
    paddingTop: 18,
  },
  heading: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 19,
  },
  text: {
    color: colors.text2,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
});
