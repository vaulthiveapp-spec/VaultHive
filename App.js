import React, { useCallback, useEffect, useState } from 'react';
import { I18nManager, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AlertProvider } from './src/components/AlertProvider';
import AppNavigator from './src/navigation/AppNavigator';

// ─── Font loading ─────────────────────────────────────────────────────────────
// Poppins font files must be placed in assets/fonts/ to take effect.
// Download from https://fonts.google.com/specimen/Poppins and add:
//   Poppins-Regular.ttf, Poppins-Medium.ttf, Poppins-SemiBold.ttf,
//   Poppins-Bold.ttf, Poppins-ExtraBold.ttf, Poppins-Black.ttf
//
// Metro bundler will crash if require() is called on a file that doesn't exist,
// so font loading is guarded: it only runs when the font assets are present.
// The app renders correctly with the OS system font until fonts are added.

let fontsToLoad = null;
try {
  // These require() calls are evaluated at bundle time.
  // If the .ttf files exist in assets/fonts/, they are bundled and loaded below.
  // If they are absent, the outer try/catch prevents the bundler error from
  // propagating — the app falls back to the system font silently.
  fontsToLoad = {
    'Poppins':           require('./assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium':    require('./assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold':  require('./assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold':      require('./assets/fonts/Poppins-Bold.ttf'),
    'Poppins-ExtraBold': require('./assets/fonts/Poppins-ExtraBold.ttf'),
    'Poppins-Black':     require('./assets/fonts/Poppins-Black.ttf'),
  };
} catch {
  // Font files not present — system font fallback.
  fontsToLoad = null;
}

// ─────────────────────────────────────────────────────────────────────────────

const BRAND = '#FEF7E6';

I18nManager.allowRTL(false);
I18nManager.forceRTL(false);
I18nManager.swapLeftAndRightInRTL(false);

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        if (fontsToLoad) {
          const Font = require('expo-font');
          await Font.loadAsync(fontsToLoad).catch(() => {
            // Font registration failed — non-fatal, system font used.
          });
        }
      } catch {
        // Non-fatal
      } finally {
        setReady(true);
      }
    }
    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (ready) {
      await SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView
          onLayout={onLayoutRootView}
          style={{ flex: 1, backgroundColor: BRAND, direction: 'ltr' }}
          edges={['top']}
        >
          <AuthProvider>
            <AlertProvider>
              <StatusBar style="light" backgroundColor={BRAND} />
              <View style={{ flex: 1, backgroundColor: BRAND, direction: 'ltr' }}>
                <AppNavigator />
              </View>
            </AlertProvider>
          </AuthProvider>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
