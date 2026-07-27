# Wrapping Forkcast in Capacitor

Forkcast is a Next.js web app; it also runs beautifully inside a
[Capacitor](https://capacitorjs.com) shell on iOS and Android. The
web code paths remain identical; native features (camera scanning,
OS share sheet, Bluetooth) automatically light up when Capacitor is
detected at runtime (see `lib/native/index.js`).

This document walks through the one-time setup on your dev machine.
The container that hosts the dev preview cannot run Xcode / Android
SDK, so we intentionally do **not** run `npx cap add` here.

---

## Prerequisites

- Node 18+ and Yarn
- **iOS**: macOS with Xcode 15+
- **Android**: Android Studio + JDK 17+
- A physical device is strongly recommended for BLE / camera testing
  (the simulator can't access the camera or Bluetooth).

---

## 1. Install the Capacitor CLI + platform packages

The web-safe pieces (`@capacitor/core`, `@capacitor/share`) are already
in `package.json`. Add the CLI and the native platforms on your local
machine:

```bash
cd forkcast
yarn add -D @capacitor/cli
yarn add @capacitor/ios @capacitor/android

# Native plugins for the Kitchen + Sharing features:
yarn add @capacitor-mlkit/barcode-scanning
yarn add @capacitor-community/bluetooth-le

# For the "Raw Bluetooth" peer-to-peer share (Option 2 in
# docs/features/plan-sharing.md), you ALSO need a BLE peripheral
# plugin. `@capacitor-community/bluetooth-le` is central-only.
# Any plugin that registers a bridge under
# `window.Capacitor.Plugins.BlePeripheral` will work. Options:
#   - capacitor-blep (community, small, actively maintained)
#   - your own custom plugin wrapping CoreBluetooth (iOS) +
#     BluetoothGattServer (Android) with the API surface documented
#     in docs/features/plan-sharing.md
yarn add capacitor-blep   # OR skip if you don't need Option 2
```

> These plugins are intentionally **not** in the committed
> `package.json` so the standalone web build stays lean. Add them
> only on the machine that will produce native builds.

---

## 2. Build the web assets

Capacitor needs static output. Forkcast is a Next.js app; the simplest
recipe is to enable static export in `next.config.js`:

```js
// next.config.js
module.exports = {
  output: 'export',
  images: { unoptimized: true },
};
```

Then:

```bash
yarn build
```

Output lands in `out/`, matching `webDir` in `capacitor.config.json`.

> If you run Forkcast with server-side features that don't survive
> static export (e.g. Cloudinary uploads via `/api` routes), keep the
> API deployed on Vercel and configure Capacitor's `server.url` to
> point at the deployed domain. See
> [Capacitor server config](https://capacitorjs.com/docs/config#server).

---

## 3. Initialise the native projects

```bash
npx cap init          # already done — capacitor.config.json is committed
npx cap add ios
npx cap add android
npx cap sync
```

This reads the config, creates `ios/` and `android/` folders, and
copies the web bundle into each native project.

---

## 4. Wire up native permissions

### iOS — `ios/App/App/Info.plist`

```xml
<key>NSCameraUsageDescription</key>
<string>Scan barcodes for shopping and pantry, and QR codes to receive meal plans.</string>
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Share meal plans directly between phones over Bluetooth.</string>
```

### Android — `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature   android:name="android.hardware.camera" android:required="false" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"    android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
```

The `neverForLocation` flag on `BLUETOOTH_SCAN` avoids the Android 12+
location-permission prompt, which is not appropriate here (we're not
using BLE to derive location).

---

## 5. Run on a device

```bash
# iOS
npx cap open ios       # opens Xcode → select device → Run

# Android
npx cap open android   # opens Android Studio → select device → Run
```

---

## 6. Verifying the native code paths

Inside the app:

- Kitchen → Shopping List → **Scan** → the OS-native ML Kit scanner
  opens (not the web `<video>` fallback). If you still see the web
  scanner, `@capacitor-mlkit/barcode-scanning` is not installed.
- Weekly Planner → **Share Plan** → *Share via device* → iOS shows
  the AirDrop sheet, Android shows Nearby Share.
- Weekly Planner → **Share Plan** → *Raw Bluetooth (v2)* — the option
  becomes enabled once `@capacitor-community/bluetooth-le` is present
  and its Capacitor bridge registers under
  `window.Capacitor.Plugins.BluetoothLe`.

All of these are runtime-detected in `lib/native/index.js` — no build
flag is needed.

---

## Troubleshooting

- **`Capacitor is undefined` in the browser** — expected. The web
  build never sees Capacitor at runtime; the detection helpers just
  return `false`.
- **`Cannot find module '@capacitor-mlkit/barcode-scanning'`** — the
  dynamic import in `lib/native/scanner.js` is wrapped in a try/catch;
  the fallback (BarcodeDetector or ZXing) takes over automatically.
  Install the plugin on your local machine to enable the native path.
- **Camera permission denied on iOS** — double-check the
  `NSCameraUsageDescription` string above; iOS silently refuses the
  permission if it's missing.
