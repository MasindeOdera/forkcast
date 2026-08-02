# Forkcast — Google Play Store Submission Kit

This folder contains everything you need to ship Forkcast to the Google
Play Store as a Capacitor-wrapped Android app. Nothing here is
auto-published — the files are references you copy into the Play
Console UI (or the Bubblewrap CLI, for a TWA build).

## Contents

| File | What it's for |
|---|---|
| `SUBMISSION_CHECKLIST.md` | The full end-to-end checklist, from `npx cap add android` to the "Send for review" button. **Start here.** |
| `STORE_LISTING.md` | Copy-paste app name, short & full descriptions, keywords, category. |
| `PRIVACY_POLICY.md` | Hostable privacy policy (also rendered by the app at `/privacy`). Update the placeholder contact fields before publishing. |
| `DATA_SAFETY.md` | Answers for Play Console → App content → Data safety form, derived from what the code actually collects. |
| `PERMISSIONS_JUSTIFICATION.md` | The written justification you'll paste into Play Console when it flags CAMERA / BLUETOOTH permissions. |
| `SCREENSHOTS.md` | Screenshot spec (sizes, DPI) + a curated shot list for Forkcast. |
| `FEATURE_GRAPHIC.md` | 1024×500 feature-graphic spec + a ready-to-render SVG template. |

## Why a Capacitor build (and not a TWA)

Forkcast already ships `capacitor.config.json` and consumes native
plugins (`@capacitor-mlkit/barcode-scanning`,
`@capacitor-community/bluetooth-le`, `@capacitor/share`) via the
runtime detection in `lib/native/index.js`. A Trusted Web Activity
(TWA) would strip those features. See `SUBMISSION_CHECKLIST.md` §1
for the full reasoning.

## The app runs its own privacy policy

Google requires a **publicly-accessible URL** for the privacy policy.
We host it in-app at `/privacy` (see `app/privacy/page.js`) so it
deploys wherever Forkcast is deployed. On Vercel this becomes
`https://forkcast-six.vercel.app/privacy` — paste that URL into Play
Console → App content → Privacy policy.
