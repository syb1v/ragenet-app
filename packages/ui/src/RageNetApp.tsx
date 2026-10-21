import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { colors } from '@ragenet/design';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RageNetMark } from './components/Logo';
import { SettingsModal } from './components/SettingsModal';
import { SubscriptionMenu } from './components/SubscriptionMenu';
import { Toast } from './components/Toast';
import { HomeScreen } from './screens/HomeScreen';
import { LogsScreen } from './screens/LogsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { AddKeySheet } from './sheets/AddKeySheet';
import { DeleteSubscriptionSheet } from './sheets/DeleteSubscriptionSheet';
import { QrSheet } from './sheets/QrSheet';
import { ResetSheet } from './sheets/ResetSheet';
import { ServersSheet } from './sheets/ServersSheet';
import { useAppStore } from './store/useAppStore';

function parseDeepLink(url: string): string | null {
  const pathMatch = url.match(/^ragenet:\/\/add\/(.+)$/i);
  if (pathMatch) {
    try {
      return decodeURIComponent(pathMatch[1]);
    } catch {
      return pathMatch[1];
    }
  }

  const queryMatch = url.match(/[?&]url=([^&]+)/i);
  if (queryMatch) {
    try {
      return decodeURIComponent(queryMatch[1]);
    } catch {
      return queryMatch[1];
    }
  }

  return null;
}

export function RageNetApp() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  const subscription = useAppStore((state) => state.subscription);
  const screen = useAppStore((state) => state.screen);
  const loadDemo = useAppStore((state) => state.loadDemo);
  const navigate = useAppStore((state) => state.navigate);
  const addSubscription = useAppStore((state) => state.addSubscription);
  const showToast = useAppStore((state) => state.showToast);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1' && !useAppStore.getState().subscription) {
      loadDemo();
    }
    const target = params.get('screen');
    if (target === 'settings' || target === 'logs') {
      navigate(target);
    }
  }, [loadDemo, navigate]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleUrl = (url: string | null | undefined) => {
      if (!url) return;
      const subscriptionUrl = parseDeepLink(url);
      if (!subscriptionUrl) return;
      addSubscription(subscriptionUrl)
        .then(() => showToast('Подписка добавлена'))
        .catch((error: unknown) => {
          showToast(error instanceof Error ? error.message : 'Не удалось добавить подписку');
        });
    };

    Linking.getInitialURL()
      .then(handleUrl)
      .catch(() => undefined);
    const listener = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => listener.remove();
  }, [addSubscription, showToast]);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <RageNetMark size={42} color={colors.brandStrong} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.root}>
        {!subscription ? (
          <OnboardingScreen />
        ) : (
          <>
            <HomeScreen />
            {screen === 'logs' ? <LogsScreen /> : null}
            <SettingsModal visible={screen === 'settings'} onClose={() => navigate('home')} />
          </>
        )}
        <AddKeySheet />
        <ServersSheet />
        <QrSheet />
        <DeleteSubscriptionSheet />
        <ResetSheet />
        <SubscriptionMenu />
        <Toast />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loading: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    flex: 1,
    justifyContent: 'center',
  },
});
