import { colors, radii, shadows } from '@ragenet/design';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast } from './Toast';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function BottomSheet({ visible, onClose, children, header, style }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        dragY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 110 || gesture.vy > 1.1) {
          dragY.setValue(0);
          closeRef.current();
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            damping: 22,
            stiffness: 260,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          damping: 22,
          stiffness: 260,
          useNativeDriver: false,
        }).start();
      },
    }),
  ).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      dragY.setValue(0);
      progress.setValue(0);
      Animated.spring(progress, {
        toValue: 1,
        damping: 24,
        stiffness: 260,
        mass: 0.82,
        useNativeDriver: false,
      }).start();
      return;
    }

    if (!mounted) return;
    Animated.timing(progress, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [progress, visible]);

  if (!mounted) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [520, 0],
  });

  return (
    <Modal
      animationType="none"
      transparent
      visible={mounted}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root} testID="bottom-sheet-root">
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable
            accessibilityLabel="Закрыть"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.backdropPress}
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboard}
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, 16),
                transform: [{ translateY: Animated.add(translateY, dragY) }],
              },
              style,
            ]}
            testID="bottom-sheet"
          >
            <View style={styles.dragZone} {...panResponder.panHandlers}>
              <View style={styles.handle} />
            </View>
            {header}
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
      <Toast />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.black70,
  },
  backdropPress: {
    flex: 1,
  },
  keyboard: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0B1220',
    borderColor: colors.line,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    ...shadows.sheet,
  },
  dragZone: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    marginTop: -4,
  },
  handle: {
    backgroundColor: colors.white16,
    borderRadius: radii.pill,
    height: 4,
    width: 38,
  },
});
