import { colors, fonts, radii } from '@ragenet/design';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { PlatformIcon } from './PlatformIcon';
import { useAppStore } from '../store/useAppStore';

const MENU_WIDTH = 224;
const MENU_HEIGHT = 196;

export function SubscriptionMenu() {
  const anchor = useAppStore((state) => state.subscriptionMenuAnchor);
  const subscription = useAppStore((state) => state.subscription);
  const closeMenu = useAppStore((state) => state.closeSubscriptionMenu);
  const openSheet = useAppStore((state) => state.openSheet);
  const showToast = useAppStore((state) => state.showToast);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!anchor) return;
    progress.setValue(0);
    Animated.spring(progress, {
      toValue: 1,
      damping: 22,
      stiffness: 280,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [anchor, progress]);

  const position = useMemo(() => {
    if (!anchor) return { left: 0, top: 0 };
    const left = Math.max(
      12,
      Math.min(windowWidth - MENU_WIDTH - 12, anchor.x + anchor.width - MENU_WIDTH),
    );
    const below = anchor.y + anchor.height + 6;
    const above = anchor.y - MENU_HEIGHT - 6;
    const top = below + MENU_HEIGHT > windowHeight - 12 ? Math.max(12, above) : below;
    return { left, top };
  }, [anchor, windowHeight, windowWidth]);

  if (!anchor || !subscription) return null;

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(subscription.url);
      showToast('Ссылка скопирована');
      setTimeout(closeMenu, 80);
    } catch {
      showToast('Не удалось скопировать ссылку');
      closeMenu();
    }
  };

  const share = async () => {
    closeMenu();
    if (Platform.OS === 'web') {
      try {
        await Clipboard.setStringAsync(subscription.url);
        showToast('Ссылка скопирована');
      } catch {
        showToast('Не удалось скопировать ссылку');
      }
      return;
    }
    try {
      await Share.share({ message: subscription.url, url: subscription.url });
    } catch {
      showToast('Не удалось поделиться ссылкой');
    }
  };

  const openQr = () => {
    closeMenu();
    openSheet('qr');
  };

  const remove = () => {
    closeMenu();
    openSheet('delete');
  };

  return (
    <>
      <Pressable
        accessibilityLabel="Закрыть меню"
        accessibilityRole="button"
        onPress={closeMenu}
        style={styles.backdrop}
      />
      <Animated.View
        style={[
          styles.menu,
          position,
          {
            opacity: progress,
            transform: [
              {
                translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }),
              },
              {
                scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }),
              },
            ],
          },
        ]}
      >
        <MenuRow
          icon={<PlatformIcon name="qr" size={18} color={colors.brandStrong} />}
          label="Показать QR-код"
          onPress={openQr}
        />
        <MenuRow
          icon={<PlatformIcon name="share" size={17} color={colors.brandStrong} />}
          label="Поделиться"
          onPress={share}
        />
        <MenuRow
          icon={<PlatformIcon name="copy" size={17} color={colors.brandStrong} />}
          label="Скопировать ссылку"
          onPress={copy}
        />
        <View style={styles.divider} />
        <MenuRow
          danger
          icon={<PlatformIcon name="trash" size={18} color={colors.danger} />}
          label="Удалить подписку"
          onPress={remove}
        />
      </Animated.View>
    </>
  );
}

interface MenuRowProps {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

function MenuRow({ icon, label, onPress, danger }: MenuRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.icon}>{icon}</View>
      <Text style={[styles.label, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 70,
  },
  menu: {
    position: 'absolute',
    zIndex: 80,
    width: MENU_WIDTH,
    backgroundColor: colors.surfaceSolid,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 18,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  pressed: {
    backgroundColor: colors.surface2,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
  },
  label: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  danger: {
    color: colors.danger,
  },
  divider: {
    backgroundColor: colors.line,
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 10,
    marginVertical: 3,
  },
});
