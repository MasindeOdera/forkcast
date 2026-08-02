# Data Safety Form Answers

The answers below match what Forkcast's code actually does today. When
filling out **Play Console → App content → Data safety**, work through
the form in order and copy each answer verbatim.

If you later ship a feature that touches new data types (advertising
ID, location, contacts, etc.), update this file **and** re-answer the
form — Play requires the form to be truthful.

---

## Section 1: Data collection & security

### "Does your app collect or share any of the required user data types?"

**Yes.**

(We collect email address, meal photos, and meal content to sync
between devices.)

### "Is all of the user data collected by your app encrypted in transit?"

**Yes.**

(All API calls go over HTTPS. MongoDB Atlas / Supabase connections are
TLS-only. Cloudinary uploads use `https://`.)

### "Do you provide a way for users to request that their data be deleted?"

**Yes.**

(Users can delete individual meals from the UI, and can request full
account deletion at `support@forkcast.app`. If you add a self-serve
"Delete my account" button, upgrade this answer to reference it.)

---

## Section 2: Data types

For each data type below, mark **Collected: Yes** unless noted, then
select the purposes.

| Data type | Collected | Shared | Purposes | Optional / Required |
|---|---|---|---|---|
| **Email address** | Yes | No | Account management, app functionality | Required |
| **User IDs** | Yes | No | Account management, app functionality | Required |
| **Name** (username) | Yes | No | Account management, app functionality | Required |
| **Photos** (meal + gallery images) | Yes | No | App functionality | Optional |
| **App interactions** (meals, plans, pantry) | Yes | No | App functionality | Optional |
| **Diagnostics / Crash logs** | *No* — the app currently does not ship crash reporting. If you add Sentry / Crashlytics later, flip this to Yes. | — | — | — |
| **Approximate location** | No | No | — | — |
| **Precise location** | No | No | — | — |
| **Contacts** | No | No | — | — |
| **Financial info** | No | No | — | — |
| **Health & fitness** | No | No | — | — |
| **Messages / SMS / email content** | No | No | — | — |
| **Files & docs** (other than the photos above) | No | No | — | — |
| **Calendar events** | No | No | — | — |
| **Web browsing** | No | No | — | — |

---

## Section 3: Data usage & handling

For **every** "Yes" row above, Play asks:

1. **Is this data collected or shared with third parties?**
   → *Collected only. Not shared.*  
   (Cloudinary and MongoDB/Supabase are storage providers, not
   "third parties" per Play's definition — they're processors acting
   on our behalf. Do NOT mark them as shared.)

2. **Is this data processed ephemerally?**
   → *No, persisted.*

3. **Is this data required for the app to function, or is collection optional?**
   - Email + user ID + name: **Required** (auth)
   - Photos + meal content: **Optional** (a user can use the app
     without uploading a photo)

4. **What purpose does the data serve?**
   - Email + user ID: *Account management, App functionality*
   - Name (username): *Account management, App functionality*
   - Photos: *App functionality*
   - App interactions: *App functionality*

---

## Section 4: Security practices

When Play asks:

- **Is your data encrypted in transit?** → Yes
- **Do you follow the Families Policy?** → No (target audience is 13+, not children).
- **Has your app been independently validated against a global security standard?** → No.
- **Do you provide a way for users to request their data be deleted?** → Yes
  (see PRIVACY_POLICY.md § "Your rights" for the current process).

---

## If you add features later, revisit this file

| New feature | New data-safety answer |
|---|---|
| Google Sign-in | Add *Emails* + *User IDs* row if not already there; disclose sharing with Google. |
| Push notifications | Add *Device or other IDs* (FCM token). |
| Crash reporting (Sentry/Crashlytics) | Add *Diagnostics* + *App performance data* rows. |
| Advertising | Add *Advertising ID*, mark shared with the ad network. |
| Location-based recipe recommendations | Add *Approximate location*. |
