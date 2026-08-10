import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

// Runs once, at app startup, native platforms only - see main.tsx. No-ops
// on web (Capacitor.isNativePlatform() is false there), so this never
// affects the Vercel-deployed web app.
export async function initNativeApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // CourtConnect's header (src/components/Header.tsx) is a light/white
    // bar on every screen, so dark status bar text (Style.Light - see
    // capacitor.config.ts for why the naming is inverted) reads correctly
    // app-wide. overlaysWebView is already false in capacitor.config.ts,
    // giving the status bar its own solid white strip above the WebView.
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
  } catch {
    // StatusBar.setBackgroundColor is Android-only and rejects on iOS -
    // setStyle above is what actually matters there.
  }

  // Hide the launch splash once React has mounted and painted, instead of
  // the default auto-hide-on-load, so users see the branded splash
  // (CourtConnect logo) through to first paint rather than a flash of
  // bare white in between.
  requestAnimationFrame(() => {
    void SplashScreen.hide();
  });
}
