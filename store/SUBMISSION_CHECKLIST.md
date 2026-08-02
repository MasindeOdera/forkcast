# Forkcast — Play Store Submission Checklist

A step-by-step, do-in-order checklist. Times assume you already have a
Google account and can pay the $25 Play developer registration fee.

---

## 0. Prereqs (do once, ~1 week including Google's ID verification)

- [ ] **Google Play developer account** — [play.google.com/console](https://play.google.com/console). Pay the one-time $25 fee.
- [ ] **Identity verification** — upload government ID + address. Google now
      requires this for all *new* individual developer accounts; expect
      1–5 business days.
- [ ] **Local dev machine**: macOS / Windows / Linux with:
      - Node 18+
      - JDK 17 (Android Gradle 8.x needs it)
      - Android Studio (Iguana or newer)
      - Android SDK Platform 34 + Build-Tools 34.0.0
      - `adb` on your PATH

> The Emergent sandbox this repo is developed in **cannot** produce Android
> builds — there's no Android SDK. All the Gradle steps below must happen
> on your local machine.

---

## 1. Decide the shell: Capacitor (recommended) vs TWA

**Capacitor** (what this checklist assumes):
- Real native app that hosts your web bundle in a WebView.
- Keeps working: `@capacitor-mlkit/barcode-scanning`, `@capacitor-community/bluetooth-le`, `@capacitor/share`.
- Existing `capacitor.config.json` + `docs/native/capacitor-setup.md` are already set up for it.

**TWA** (alternative, cheaper but lossy):
- Chrome renders your PWA full-screen inside a shell.
- **Loses** the native barcode scanner and BLE plan-sharing features.
- Only worth it if you decide those features aren't shipping v1.

👉 **Recommended: Capacitor.**

---

## 2. Prepare the code on your dev machine

```bash
git clone <your fork of forkcast>
cd forkcast
yarn install --ignore-engines   # ignore-engines needed for supabase-js on Node 20

yarn add -D @capacitor/cli
yarn add @capacitor/android
yarn add @capacitor-mlkit/barcode-scanning
yarn add @capacitor-community/bluetooth-le
# Optional — only if you want the peer-to-peer BLE plan share:
yarn add capacitor-blep
```

### 2a. Decide how the WebView loads the app

Easiest: point Capacitor at the deployed Vercel URL. Edit
`capacitor.config.json`:

```json
{
  "appId": "app.forkcast.mobile",
  "appName": "Forkcast",
  "webDir": "out",
  "server": {
    "url": "https://forkcast-six.vercel.app",
    "cleartext": false,
    "androidScheme": "https"
  },
  "plugins": { "BarcodeScanner": { "cameraDirection": "back" } }
}
```

(You can still keep `webDir: "out"` — it's a required field, just unused
when `server.url` is set.)

---

## 3. Generate the Android project

```bash
npx cap add android
npx cap sync
```

Output: an `android/` folder with a standard Android Studio project.

---

## 4. Wire permissions

Edit `android/app/src/main/AndroidManifest.xml` — add inside
`<manifest>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature   android:name="android.hardware.camera" android:required="false" />

<!-- BLE (Kitchen → Plan Sharing over Bluetooth) -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"
    android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-feature   android:name="android.hardware.bluetooth_le" android:required="false" />
```

`neverForLocation` on `BLUETOOTH_SCAN` prevents Android 12+ from
triggering a location prompt — you're not deriving location.

---

## 5. App identity, icons, version

In `android/app/build.gradle`:

```gradle
android {
  defaultConfig {
    applicationId "app.forkcast.mobile"
    minSdkVersion 23        // Capacitor 8 needs ≥ 23
    targetSdkVersion 34
    versionCode 1
    versionName "1.0.0"
  }
}
```

Generate launcher icons:

- Android Studio → right-click `app` → **New → Image Asset** →
  *Launcher Icons (Adaptive & Legacy)*.
- Foreground image: `public/icons/icon-maskable-512.png` (the maskable
  variant already respects Android's 20% crop zone).
- Background: solid color `#10B981` (Forkcast emerald).
- Legacy: pick *Legacy only* PNG at 48/72/96/144/192.
- Save → Studio writes into `android/app/src/main/res/mipmap-*`.

---

## 6. Create the release signing key

**Do this once, and back it up. Losing this key means you can never
update the app under the same listing again.**

```bash
keytool -genkey -v \
  -keystore forkcast-release.keystore \
  -alias forkcast \
  -keyalg RSA -keysize 2048 -validity 10000
```

Store the resulting `.keystore` in a password manager or your
team's secrets store. NEVER commit it to git — it's already gitignored
by default in fresh Capacitor projects, but double-check.

Add to `android/app/build.gradle`:

```gradle
android {
  signingConfigs {
    release {
      storeFile file(System.getenv("FORKCAST_KEYSTORE") ?: "")
      storePassword System.getenv("FORKCAST_KEYSTORE_PW")
      keyAlias "forkcast"
      keyPassword System.getenv("FORKCAST_KEY_PW")
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
      minifyEnabled false
      shrinkResources false
    }
  }
}
```

Read credentials from env vars so nothing sensitive lives in the repo:

```bash
export FORKCAST_KEYSTORE=/absolute/path/to/forkcast-release.keystore
export FORKCAST_KEYSTORE_PW='********'
export FORKCAST_KEY_PW='********'
```

---

## 7. Build the release App Bundle (.aab)

Play Store requires the AAB format (since August 2021).

```bash
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

Quick sanity check on your phone with a debug APK first:

```bash
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

---

## 8. Play Console setup

Open [play.google.com/console](https://play.google.com/console) → **Create app**.

- **App name:** Forkcast
- **Default language:** English (United States) — en-US
- **App or game:** App
- **Free or paid:** Free
- Confirm developer program policies + US export laws boxes.

### 8a. Store listing → Main store listing

Copy from `STORE_LISTING.md`:

- App name
- Short description (≤ 80 chars)
- Full description (≤ 4000 chars)
- App icon: `public/icons/icon-512.png`
- Feature graphic: render `FEATURE_GRAPHIC.md`'s SVG at 1024×500 PNG.
- Phone screenshots: ≥ 2, per `SCREENSHOTS.md`.
- Category: **Food & Drink**
- Tags: meal planning, recipes, cooking
- Contact email: (yours)
- External marketing: leave off unless you have a landing page.

### 8b. App content

- **Privacy policy URL:** `https://<your-vercel-domain>/privacy` (the
  `/privacy` page in this repo renders `store/PRIVACY_POLICY.md`).
- **App access:** *All features available without special access* —
  unless you gate premium features behind auth. If Forkcast requires
  sign-up before content is visible, provide a test account
  (email + password) so the review team can log in.
- **Ads:** No
- **Content ratings:** run the IARC questionnaire — Forkcast is a
  cooking app with no violence / substances → typically rates *Everyone*.
- **Target audience:** 13+ (safer given user-generated meal content).
- **News app:** No.
- **Data safety:** copy from `DATA_SAFETY.md`.
- **Government app:** No.
- **Financial features:** No.
- **Health features:** No.

### 8c. Store settings

- App category: Food & Drink
- Store listing contact details (email required, website optional).

---

## 9. Release: internal → closed → open → production

Release Google-recommended path:

1. **Internal testing** — create a release, upload `app-release.aab`,
   add your own Google account as a tester, install via the opt-in URL.
2. **Closed testing** — optional. Invite 20+ friends / beta users.
3. **Production** — the real submission. Fill out:
   - Release name (e.g. `1.0.0`)
   - Release notes (≤ 500 chars per language)
   - Upload the same `.aab`
   - **Countries/regions**: worldwide (or a subset)

Hit **Send for review**.

---

## 10. Review timeline & likely feedback

- First-time reviews: **3–7 business days**.
- Almost every food/utility app that requests CAMERA and BLUETOOTH is
  asked to justify them. Have `PERMISSIONS_JUSTIFICATION.md` ready —
  paste it verbatim.
- If they reject, they'll cite a specific Play policy. Address it,
  bump `versionCode`, upload a new AAB, click **Send for review** again.

---

## 11. Post-launch

- Enable **Play App Signing** (Google keeps the upload key; you keep
  a signing key) — do this on the first upload, it's a one-way switch.
- Add crash reporting: Firebase Crashlytics or Sentry Capacitor plugin.
- Set up **automated internal releases** from CI:
  - GitHub Actions: `r0adkll/upload-google-play` action.
- Every release: `versionCode++`, bump `versionName`, `npx cap sync`,
  `./gradlew bundleRelease`, upload.

---

## Common pitfalls

| Symptom | Fix |
|---|---|
| "Your app has an intent filter but no launcher activity" | Regenerate `AndroidManifest.xml` from the Capacitor scaffold; don't hand-edit `<intent-filter>`. |
| "App is not compliant with target API level" | Bump `targetSdkVersion` to the current Play minimum (34 for 2025 submissions). |
| "Camera permission not properly declared" | Also add `<uses-feature android:name="android.hardware.camera" android:required="false" />` — without this you can't ship on tablets that lack cameras. |
| App shows blank white screen on device | You forgot `npx cap sync` after the last web change, or `server.url` points to a domain that returns X-Frame-Options DENY. |
| BLE scan silently returns nothing on Android 12+ | You added `BLUETOOTH_SCAN` but not `neverForLocation`, so Android is asking for location permission at runtime and you haven't. Add the flag. |
