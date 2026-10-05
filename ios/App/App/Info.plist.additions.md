# iOS Info.plist — required entries

`codemagic.yaml` applies all of these automatically with PlistBuddy during the
cloud build (script `ios/scripts/apply-plist.sh`). Listed here for reference.

| Key | Value |
| --- | --- |
| NSHealthShareUsageDescription | REBUILT reads your recent sleep, resting heart rate, HRV, steps and workouts from Apple Health to prefill your daily readiness check-in. You can decline and enter these manually — every feature still works. |
| NSHealthUpdateUsageDescription | REBUILT does not write data to Apple Health. Apple requires this description alongside read access. |
| NSMicrophoneUsageDescription | Used to record voice journal entries and talk to your coach. |
| NSCameraUsageDescription | Used to take progress photos and photos of meals you log. |
| NSPhotoLibraryUsageDescription | Used to choose progress or meal photos from your library. |
| NSPhotoLibraryAddUsageDescription | Used to save your progress comparison images to your library. |
| NSLocationWhenInUseUsageDescription | Used to recognize when you arrive at your gym and to show outdoor workout routes. |
| NSSpeechRecognitionUsageDescription | Used to turn your spoken journal entries into text. |
| ITSAppUsesNonExemptEncryption | NO |
| WKAppBoundDomains | rebuiltbyp.com, www.rebuiltbyp.com |
| UIStatusBarStyle | UIStatusBarStyleLightContent |
| UIUserInterfaceStyle | Dark |

Capabilities (entitlements in `App.entitlements`): HealthKit, Push Notifications,
Sign in with Apple, In-App Purchase. Enable the same on the App ID
`app.rebuilt.playboyp` in the Apple Developer portal (team Q3L694RFDK).
