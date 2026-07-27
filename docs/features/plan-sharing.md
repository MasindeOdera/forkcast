# Plan sharing (phone-to-phone)

The "Share Plan" button on the Weekly Planner lets a user send their
week's meal plan to another device — no account, no internet, no
account on the receiving device.

---

## Transports

The dialog (`components/SharePlanDialog.js`) exposes three send
options plus a QR-based receive flow.

### 1. Share via device (default)

- **Browser**   → `navigator.share()` (Web Share API)
- **Capacitor** → `@capacitor/share` plugin

Both call the operating system's native share sheet. On iOS this
includes **AirDrop**, which uses Bluetooth + peer-to-peer WiFi under
the hood — no internet needed. On Android it includes **Nearby Share**,
which uses the same Bluetooth + WiFi Direct combo.

> This is the recommended path. It works today, requires zero custom
> code, and users already know how to use it.

### 2. Raw Bluetooth (peer-to-peer)

Direct BLE transfer between two Forkcast devices, no internet needed
and no accounts required on the receiving device. Uses a well-known
GATT service:

| Item                          | UUID                                       |
|-------------------------------|--------------------------------------------|
| Service                       | `0000f0cc-0000-1000-8000-00805f9b34fb`     |
| Plan characteristic (read)    | `0000f0cd-0000-1000-8000-00805f9b34fb`     |
| Advertised local name         | `Forkcast-Plan`                            |

Implemented in `lib/native/ble.js`.

**Sender side (peripheral)** — requires a Capacitor plugin that exposes
a peripheral bridge under `window.Capacitor.Plugins.BlePeripheral`. The
implementation calls the following API surface:

```ts
BlePeripheral.addService({
  service: FORKCAST_SERVICE_UUID,
  characteristics: [{
    uuid: FORKCAST_PLAN_CHARACTERISTIC,
    properties: { read: true },
    value: <base64 plan JSON>,
    initialValue: <base64 plan JSON>,
  }]
});
BlePeripheral.startAdvertising({
  localName: 'Forkcast-Plan',
  serviceUuids: [FORKCAST_SERVICE_UUID],
});
// optional listeners: 'centralConnected', 'characteristicRead'
BlePeripheral.stopAdvertising();
```

Any plugin conforming to this shape will work. If no peripheral plugin
is present, the send-side throws a descriptive error and the UI keeps
the option disabled.

**Receiver side (central)** — works on:

- **Capacitor (iOS + Android)** via `@capacitor-community/bluetooth-le`
- **Chrome / Edge on desktop or Android** via Web Bluetooth

Flow: `initialize → requestLEScan({ services: [SERVICE_UUID] }) →
connect(deviceId) → read(service, char) → JSON.parse → disconnect`.
Scan times out after 15 s by default and can be cancelled via
`AbortSignal`.

**Payload limits.** We cap the payload at 4 KB — well above what any
realistic week plan needs — and append the ASCII record-separator
`\x1e` as a terminator so we can trim padding safely on the receiver.
Anything bigger falls back to the Share Sheet.

**Why not `@capacitor-community/bluetooth-le` for BOTH sides?** It's
central-only. Peripheral / GATT-server mode isn't in its API. That's
why the send side needs a separate peripheral plugin. See
`docs/native/capacitor-setup.md` for compatible peripheral plugins.

### 3. QR code (always available)

Encodes the plan JSON as a QR (`qrcode.react`) and shows it on-screen.
The other device opens Forkcast → Weekly Planner → Share → **Receive**
tab → taps *Scan a plan QR* → points the camera at the code. Uses the
same `BarcodeScanner` component in QR mode. Guaranteed offline
transfer, works between any two devices with a camera.

### Clipboard fallback

One button at the bottom of the Send tab copies the plan JSON to the
clipboard for power users who want to paste it into a messaging app or
their own tooling.

---

## Payload shape

The plan payload is intentionally lean because QR codes have limited
capacity. Emitted by `MealPlanningCalendar.js`:

```json
{
  "title": "Week of Nov 3, 2025",
  "weekStart": "2025-11-03",
  "entries": [
    { "key": "2025-11-03-dinner", "title": "Pasta primavera", "ingredients": "..." }
  ]
}
```

On the receiving side, `SharePlanDialog` decodes the QR, parses the
JSON, and calls its `onImport` prop. In v1 no automatic import handler
is wired — the receiving user reads the plan on-screen and can create
the meals manually. A future v2 will offer "Add all to my planner".

---

## Why not just Web Bluetooth?

Web Bluetooth is central-only in every current browser. A page cannot
advertise itself as a peripheral, so page A cannot beam data that page
B will discover. This is a browser sandbox constraint, not a hardware
one. Native apps (Capacitor-wrapped) *can* do peripheral mode; that's
what unlocks Option 2 in v2.
