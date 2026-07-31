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
};

export default config;
