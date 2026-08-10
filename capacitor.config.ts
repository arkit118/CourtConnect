import type { CapacitorConfig } from '@capacitor/cli';

// Note: `bundledWebRuntime` was removed from Capacitor's config schema in v3+
// and no longer applies on this project's Capacitor 8 install.
const config: CapacitorConfig = {
  appId: 'com.courtconnect.app',
  appName: 'CourtConnect',
  webDir: 'dist',
  server: {
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      // We hide it ourselves once the app is mounted (src/lib/nativeInit.ts)
      // rather than on a fixed timer, so a slow first paint never shows bare
      // white before the branded splash goes away.
      launchAutoHide: false,
      backgroundColor: '#FFFFFFFF',
      androidSplashResourceName: 'splash',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Capacitor's Style naming is the inverse of what it sounds like:
      // Style.Light = dark text (for CourtConnect's white header). The
      // header (src/components/Header.tsx) is always a light/white sticky
      // bar across every screen, so dark status bar text is correct
      // app-wide - see src/lib/nativeInit.ts for the runtime call that
      // actually applies this (the static config value alone isn't
      // reliably picked up on iOS before the WebView loads).
      style: 'LIGHT',
      overlaysWebView: false,
      backgroundColor: '#FFFFFFFF',
    },
  },
};

export default config;
