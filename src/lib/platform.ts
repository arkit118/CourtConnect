// Capacitor serves the app from a custom `capacitor:` scheme on iOS/Android,
// so this check works without depending on @capacitor/core.
export function isNativeApp(): boolean {
  return window.location.protocol === 'capacitor:';
}
