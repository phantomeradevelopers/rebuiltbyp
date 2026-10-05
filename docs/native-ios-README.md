# REBUILT — iOS native build & TestFlight guide

The web app already runs everywhere. This wraps it with Capacitor so we can
ship to the App Store, get real HealthKit / Apple Watch data, and hand a
TestFlight build to testers.

You need a **Mac with Xcode 16+**, an Apple Developer account ($99/yr), and
this repo checked out locally. Everything below runs on your Mac — the
Lovable web sandbox can't build iOS binaries.

---

## 1. One-time setup (your Mac)

```bash
# From the repo root:
bun install
bun add -d @capacitor/cli @capacitor/ios
bun add @capacitor/app @capacitor/haptics @capacitor/status-bar \
        @capacitor/splash-screen @capacitor/push-notifications

# Health plugin — already added to package.json:
#   capacitor-health
# (Works on both iOS HealthKit and Android Health Connect.)

# Add the iOS platform (creates the ios/ folder Xcode opens):
npx cap add ios
```

`capacitor.config.ts` lives at the repo root and is already configured
(`appId: app.rebuilt.playboyp`, `appName: REBUILT`, `webDir: dist`).

---

## 2. Configure HealthKit in Xcode

```bash
npx cap open ios
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities**.
2. Sign with your Team.
3. Click **+ Capability** and add:
   - **HealthKit**
   - **Push Notifications**
   - **Background Modes** → check *Remote notifications*
4. Open `App/Info.plist` (source view) and paste the entries from
   `ios/App/App/Info.plist.additions.md` (or set them via the Info tab).

The `HealthKit` capability writes the entitlements — a reference file is
included at `ios/App/App/App.entitlements`.

---

## 3. Build a dev build

```bash
bun run build           # produces dist/
npx cap sync ios        # copies web assets + updates native deps
npx cap open ios
```

In Xcode: pick a Simulator or your connected iPhone, hit **Run** (⌘R).
On first launch the app asks for HealthKit permission — grant *Sleep,
Resting Heart Rate, HRV, Steps*. Open **Settings → Devices** in REBUILT and
Apple Watch will now show "Connected via iOS app".

### Live-reload against the deployed preview (optional)

Edit `capacitor.config.ts` and add:

```ts
server: {
  url: "https://project--98bf644e-b0ab-46c3-84c4-2b601172e7c7-dev.lovable.app",
  cleartext: false,
},
```

Then `npx cap sync ios && npx cap open ios`. Web edits published to that
preview URL show up in the app immediately — no rebuild. **Remove
`server.url` before shipping to TestFlight** so the bundle serves the local
`dist/` inside the binary.

---

## 4. TestFlight

1. In Xcode: **Product → Archive** (choose *Any iOS Device (arm64)* as the
   destination).
2. When Organizer opens: **Distribute App → App Store Connect → Upload**.
3. Wait ~10 min for processing in App Store Connect → **TestFlight** tab.
4. Add internal testers (up to 100, no review needed) or create an
   external test group (needs a short Beta App Review, usually <24h).
5. Testers install the **TestFlight** app on their iPhone and accept the
   invite you send from App Store Connect.

Each new build: bump the build number in Xcode (General → Identity →
Build), Archive again, upload.

---

## 5. What lives where

- `capacitor.config.ts` — native shell config (repo root).
- `src/lib/health-sync.ts` — cross-platform reader. Uses `capacitor-health`
  on device, mock data in the browser. `readRecentHealth()` returns
  sleep_hours / resting_hr / hrv_ms / steps for the last 24h.
- `src/components/AppleHealthImport.tsx` — web bridge: parses
  `export.xml` from Apple Health export on iPhone and imports the last
  90 days of daily aggregates. Available in **Account** page.
- `src/components/ConnectedAppsCard.tsx` — device list. Apple Watch shows
  *Connect via iOS app* on device (auto-triggers HealthKit permission)
  and stays on the "join the list" copy in the browser.

---

## 6. Ship checklist

- [ ] App icons + splashes generated with `@capacitor/assets`
      (`bun add -d @capacitor/assets && npx capacitor-assets generate`).
- [ ] `server.url` removed from `capacitor.config.ts`.
- [ ] Build number bumped.
- [ ] Health, Push, Background capabilities enabled and signed with your
      distribution profile.
- [ ] Privacy nutrition labels in App Store Connect declare:
      **Health data** — used in-app, not linked to user, not tracking.
      **Audio** — used in-app, not linked.
- [ ] Screenshots (6.7" and 6.1" required) and description filled in.
- [ ] TestFlight build validates and passes internal review.

---

## 7. Common gotchas

- **HealthKit permission dialog never shows**: check `NSHealthShareUsageDescription`
  is set and the HealthKit capability is enabled. Also HealthKit is unavailable
  on iPad — test on iPhone or a Simulator running iOS 17+.
- **White screen on launch**: usually means `webDir` doesn't exist. Run
  `bun run build` before `npx cap sync ios`.
- **Live-reload URL doesn't load**: `limitsNavigationsToAppBoundDomains` is
  on. Add your preview host under `Info.plist → WKAppBoundDomains`, or
  temporarily set it to `false` while iterating.
- **Push notifications**: the `aps-environment` entitlement is included as
  `development`. Xcode swaps it to `production` at Archive time when signing
  with an App Store distribution profile.
