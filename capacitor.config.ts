import type { CapacitorConfig } from "@capacitor/cli";

/**
 * REBUILT — Capacitor native shell config (App Store: "REBUILT by P").
 *
 * The app loads the live REBUILT app (server-rendered) inside a native shell
 * with native plugins (Apple In-App Purchase, HealthKit, push). `native-shell/`
 * is bundled into the binary and provides the offline screen shown when the
 * device has no connection.
 */
const config: CapacitorConfig = {
  appId: "app.rebuilt.playboyp",
  appName: "REBUILT",
  webDir: "native-shell",
  server: {
    url: "https://rebuiltbyp.com/app",
    hostname: "rebuiltbyp.com",
    iosScheme: "https",
    errorPath: "offline.html",
    allowNavigation: ["rebuiltbyp.com", "www.rebuiltbyp.com"],
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#000000",
    limitsNavigationsToAppBoundDomains: true,
    appendUserAgent: "RebuiltApp/1.0",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: false,
      backgroundColor: "#000000",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000000",
      overlaysWebView: true,
    },
  },
};

export default config;
