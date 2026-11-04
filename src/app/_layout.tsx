import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts as useInter } from '@expo-google-fonts/inter';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic, useFonts as useSerif } from '@expo-google-fonts/instrument-serif';
import { Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppStoreProvider, useStore } from '@/store/app-store';
import { InboxProvider } from '@/store/inbox';
import { UpdatesProvider } from '@/updates/updates';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

/** Light status bar text over the dark Today header, dark text on every light screen. */
function ThemedStatusBar() {
  const segments = useSegments() as string[];
  const onToday = segments[0] === '(tabs)' && (segments.length === 1 || segments[1] === 'index');
  return <StatusBar style={onToday ? 'light' : 'dark'} />;
}

function Navigator() {
  const { ready } = useStore();
  const [interLoaded] = useInter({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [serifLoaded] = useSerif({ InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic });
  const fontsReady = interLoaded && serifLoaded;

  useEffect(() => {
    if (ready && fontsReady) SplashScreen.hideAsync();
  }, [ready, fontsReady]);
  if (!ready || !fontsReady) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="import" />
      <Stack.Screen name="recent" />
      <Stack.Screen
        name="add"
        options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }}
      />
      <Stack.Screen
        name="update"
        options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }}
      />
      <Stack.Screen name="calendar" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen
        name="birthday"
        options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }}
      />
      <Stack.Screen
        name="task/[id]"
        options={{ presentation: 'modal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: colors.card } }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppStoreProvider>
        <ThemedStatusBar />
        <InboxProvider>
          <UpdatesProvider>
            <Navigator />
          </UpdatesProvider>
        </InboxProvider>
      </AppStoreProvider>
    </GestureHandlerRootView>
  );
}
