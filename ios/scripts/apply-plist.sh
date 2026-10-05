#!/usr/bin/env bash
# Applies REBUILT's required Info.plist keys, privacy manifest and entitlements
# to the generated Capacitor iOS project. Run after `npx cap add ios` / `cap sync`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$ROOT/ios/App/App"
PLIST="$APP/Info.plist"
PB=/usr/libexec/PlistBuddy

setk() { $PB -c "Delete :$1" "$PLIST" >/dev/null 2>&1 || true; $PB -c "Add :$1 $2 $3" "$PLIST"; }

setk NSHealthShareUsageDescription string "REBUILT reads your recent sleep, resting heart rate, HRV, steps and workouts from Apple Health to prefill your daily readiness check-in. You can decline and enter these manually — every feature still works."
setk NSHealthUpdateUsageDescription string "REBUILT does not write data to Apple Health. Apple requires this description alongside read access."
setk NSMicrophoneUsageDescription string "Used to record voice journal entries and talk to your coach."
setk NSCameraUsageDescription string "Used to take progress photos and photos of meals you log."
setk NSPhotoLibraryUsageDescription string "Used to choose progress or meal photos from your library."
setk NSPhotoLibraryAddUsageDescription string "Used to save your progress comparison images to your library."
setk NSLocationWhenInUseUsageDescription string "Used to recognize when you arrive at your gym and to show outdoor workout routes."
setk NSSpeechRecognitionUsageDescription string "Used to turn your spoken journal entries into text."
setk ITSAppUsesNonExemptEncryption bool false
setk UIStatusBarStyle string UIStatusBarStyleLightContent
setk UIUserInterfaceStyle string Dark
$PB -c "Delete :WKAppBoundDomains" "$PLIST" >/dev/null 2>&1 || true
$PB -c "Add :WKAppBoundDomains array" "$PLIST"
$PB -c "Add :WKAppBoundDomains:0 string rebuiltbyp.com" "$PLIST"
$PB -c "Add :WKAppBoundDomains:1 string www.rebuiltbyp.com" "$PLIST"

# Privacy manifest + entitlements are kept in the repo; make sure Xcode picks them up.
gem install xcodeproj --no-document >/dev/null 2>&1 || true
ruby - "$ROOT" <<'RUBY'
require 'xcodeproj'
root = ARGV[0]
proj = Xcodeproj::Project.open("#{root}/ios/App/App.xcodeproj")
target = proj.targets.find { |t| t.name == 'App' }
group = proj.main_group['App']
unless group.files.any? { |f| f.path == 'PrivacyInfo.xcprivacy' }
  ref = group.new_reference('PrivacyInfo.xcprivacy')
  target.resources_build_phase.add_file_reference(ref)
end
target.build_configurations.each do |c|
  c.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
  c.build_settings['DEVELOPMENT_TEAM'] = 'Q3L694RFDK'
  c.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
end
proj.save
RUBY
echo "Info.plist, privacy manifest and entitlements applied."
