# Native shell (Capacitor) — getting to App Store / Play

The web app already works as a PWA. To ship to the App Store and Play Store,
wrap it with Capacitor. This is intentionally NOT installed by default — it
only matters at packaging time and adds native build prerequisites (Xcode,
Android Studio).

## One-time setup

```bash
bun add @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
bun add @capacitor/push-notifications @capacitor/haptics \
        @capacitor/status-bar @capacitor/splash-screen @capacitor/app
# Optional, for real HealthKit / Health Connect data:
bun add @capacitor-community/health
```

Create `capacitor.config.ts` at the project root:

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.rebuilt.playboyp",
  appName: "REBUILT",
  webDir: "dist",
  server: {
    // For live-reload during development against the deployed preview:
    url: "https://project--98bf644e-b0ab-46c3-84c4-2b601172e7c7-dev.lovable.app",
    cleartext: false,
  },
  ios: { contentInset: "always" },
  android: { allowMixedContent: false },
};

export default config;
```

Then:

```bash
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios       # builds in Xcode
npx cap open android   # builds in Android Studio
```

## iOS — Info.plist additions

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Used to record your voice journal entries on this device.</string>
<key>NSHealthShareUsageDescription</key>
<string>Used to pre-fill your daily readiness check-in with sleep and heart-rate data.</string>
<key>NSHealthUpdateUsageDescription</key>
<string>REBUILT does not write to Health; this is required by Apple to read.</string>
```

Capabilities (in Xcode → Signing & Capabilities):
- Push Notifications
- Background Modes → Remote notifications
- HealthKit (if using the Health plugin)

## Android — AndroidManifest.xml additions

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.health.READ_SLEEP" />
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />
<uses-permission android:name="android.permission.health.READ_STEPS" />
```

## What the app already does for native

- `src/lib/health-sync.ts` detects `Capacitor.isNativePlatform()` and falls
  back to a realistic mock in the browser. Wire the native branch to
  `@capacitor-community/health` when you install it.
- `src/components/SwUpdatePrompt.tsx` skips inside iframes — works fine in the
  native WebView.
- Push subscriptions and the offline write queue (`src/lib/offline-queue.ts`)
  are already platform-agnostic.

## Suggested ship checklist

1. App icons + splash screens generated via `@capacitor/assets`.
2. Production build pinned to a tagged web URL (remove `server.url` for
   stores — bundle the web build inside the binary).
3. TestFlight / internal-test track before public release.
4. Privacy nutrition labels (App Store) declare: health data (used in-app,
   not linked to user), audio (used in-app, not linked).
