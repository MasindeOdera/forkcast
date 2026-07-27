/**
 * lib/native/ble.js
 * -----------------
 * V2 stub: direct phone-to-phone Bluetooth transfer of a meal plan.
 *
 * Why this is a stub in v1
 * ------------------------
 * Browsers cannot advertise as BLE peripherals — Web Bluetooth is
 * central-only. Inside Capacitor we CAN do peripheral mode via
 * `@capacitor-community/bluetooth-le`, but the UX involves pairing,
 * chunked transfers, and OS-specific quirks (iOS restricts advertising
 * when the app is backgrounded). We chose to ship v1 with the OS-native
 * Share Sheet (AirDrop / Nearby Share) which already uses Bluetooth +
 * WiFi Direct under the hood, needs no internet, and requires zero
 * custom code.
 *
 * This file exposes the *shape* of a future BLE transport so the Share
 * dialog can offer users the "Raw Bluetooth" option today and we can
 * light it up in v2 without changing the UI contract.
 *
 * Implementation notes for the future:
 *   - GATT service UUID:            00001234-0000-1000-8000-00805f9b34fb
 *   - "Plan" characteristic UUID:   00001235-0000-1000-8000-00805f9b34fb
 *   - Advertise as "Forkcast-Plan", receiver scans for that name.
 *   - MTU is ~20 bytes on iOS by default — chunk the JSON payload.
 */

import { hasWebBluetooth, isCapacitorNative } from './index';

/** Is a real BLE peer-to-peer transport available on this device? */
export function isBlePeerAvailable() {
  // In v1 the answer is always "not yet" — we only know we CAN light
  // this up once we're wrapped in Capacitor with the BLE plugin. Web
  // Bluetooth alone can't do peripheral mode.
  return isCapacitorNative() && hasBluetoothLePlugin();
}

function hasBluetoothLePlugin() {
  // Lazy check — the plugin registers a Capacitor bridge under this key.
  if (typeof window === 'undefined') return false;
  const cap = /** @type {any} */ (window).Capacitor;
  return Boolean(cap?.Plugins?.BluetoothLe);
}

/**
 * Send a payload over raw BLE peer-to-peer. Not implemented in v1;
 * throws so callers know to fall back to the Share Sheet path.
 */
export async function sendPlanViaBle(/* payload */) {
  throw new Error(
    'Raw BLE peer-to-peer sharing is coming in v2. ' +
    'Use the "Share via device" option (AirDrop / Nearby Share) for now.'
  );
}

/**
 * Enter receive mode. Not implemented in v1.
 */
export async function receivePlanViaBle() {
  throw new Error(
    'Raw BLE peer-to-peer sharing is coming in v2. ' +
    'Use the "Scan QR code" option to receive a plan for now.'
  );
}

// Web Bluetooth helper (works in Chrome only) — kept here so the same
// module owns everything BLE-related. Not currently called by the UI
// but available for future hardware integrations (kitchen scale,
// thermometer, etc.).
export async function connectWebBleDevice(services) {
  if (!hasWebBluetooth()) throw new Error('Web Bluetooth not supported');
  return navigator.bluetooth.requestDevice({
    acceptAllDevices: !services?.length,
    optionalServices: services || [],
  });
}
