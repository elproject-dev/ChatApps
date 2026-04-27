import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chat2goo.app',
  appName: 'ChatApps',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    PushNotifications: {
      presentationOptions: []
    }
  }
};

export default config;
