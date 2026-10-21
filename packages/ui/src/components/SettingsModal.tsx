import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform } from 'react-native';
import { SettingsScreen } from '../screens/SettingsScreen';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * iOS gets a real page sheet with the native grabber and swipe-to-dismiss.
 * Android/web use a short custom slide so the screen never pops in abruptly.
 */
export function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.setValue(0);
      Animated.spring(progress, {
        toValue: 1,
        damping: 24,
        stiffness: 260,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
      return;
    }

    if (!mounted) return;
    Animated.timing(progress, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setMounted(false));
  }, [mounted, progress, visible]);

  if (Platform.OS === 'ios') {
    return (
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={visible}
        onRequestClose={onClose}
        allowSwipeDismissal
      >
        <SettingsScreen onClose={onClose} />
      </Modal>
    );
  }

  if (!mounted) return null;

  return (
    <Modal animationType="none" visible onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        style={{
          flex: 1,
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }),
            },
          ],
        }}
      >
        <SettingsScreen onClose={onClose} />
      </Animated.View>
    </Modal>
  );
}
