# Camera & Bluetooth Permission Justifications

Google Play's review team almost always asks for a written
justification when an app declares sensitive permissions. Paste these
verbatim into Play Console → Policy → App content → Sensitive
permissions when prompted. Update them if the feature set changes.

---

## `android.permission.CAMERA`

**Feature that uses it:** Kitchen → Shopping List → *Scan* button, and
Weekly Planner → Share → *Scan QR code*.

**Justification (paste into Play Console):**

> Forkcast uses the camera in two places, both initiated by an
> explicit user action:
>
> 1. **Barcode scanning for pantry items.** In the Kitchen → Shopping
>    List and Pantry screens, tapping the Scan button opens a camera
>    viewfinder. The user aims at a product barcode; we decode the
>    EAN/UPC number, look up the product name via Open Food Facts, and
>    add it to the list. The camera feed is *not* recorded, stored, or
>    sent to any server — only the decoded barcode string is
>    transmitted.
>
> 2. **QR-code scanning for received meal plans.** When another user
>    shares a weekly meal plan via QR code, tapping "Scan QR" opens
>    the camera. We decode the QR payload (a JSON meal plan) and
>    import it locally. Again, the camera stream is never persisted or
>    transmitted.
>
> The camera is optional — users can add pantry items and receive
> plans by other means (manual entry, native share sheet, Bluetooth).
> Denying the camera permission does not break any other feature.

---

## `android.permission.BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_ADVERTISE`

**Feature that uses it:** Weekly Planner → Share Plan → *Bluetooth
peer-to-peer* ("Raw Bluetooth v2").

**Justification (paste into Play Console):**

> Forkcast lets two users share a weekly meal plan directly between
> phones, without either device requiring an internet connection.
> The sender advertises a short-lived custom BLE service; the receiver
> scans for that service and connects to pull the meal-plan JSON over
> a GATT characteristic. All discovery and transfer is initiated by
> the user tapping "Share via Bluetooth" — no background scanning
> occurs.
>
> - `BLUETOOTH_SCAN` is declared with
>   `android:usesPermissionFlags="neverForLocation"`. We do not derive,
>   store, or transmit location from BLE scan results.
> - `BLUETOOTH_ADVERTISE` is used only while the user is actively on
>   the "Share via Bluetooth" screen; it is stopped when the screen
>   closes.
> - `BLUETOOTH_CONNECT` is used to open the GATT session to the
>   receiver.
>
> Users who deny Bluetooth can still share plans via QR code or the
> native OS share sheet.

---

## Notes for the reviewer video (if Play requests one)

If review asks for a screencast demonstrating the permission use:

1. Sign in on a fresh install so the reviewer can see the permission
   prompt happen the first time.
2. Kitchen tab → Shopping List → Scan → aim at any barcode. Show that
   the product is added and no photo is saved to the gallery.
3. Planner → Share Plan → Bluetooth → show the advertising indicator
   and the paired-device confirmation. Cancel before actually
   transferring if you don't have a second device handy.
