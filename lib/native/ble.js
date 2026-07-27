/**
 * lib/native/ble.js
 * -----------------
 * V2: Direct phone-to-phone Bluetooth-LE transfer of a meal plan.
 *
 * ARCHITECTURE
 * ============
 * BLE peer-to-peer requires TWO capabilities:
 *   - CENTRAL (client) mode  \u2014 scan + connect + read
 *   - PERIPHERAL (server) mode \u2014 advertise + expose a GATT server
 *
 * Central mode is available on Web (via `navigator.bluetooth`, Chrome
 * only) AND inside Capacitor via `@capacitor-community/bluetooth-le`
 * (iOS + Android). This module uses the Capacitor plugin when running
 * inside a native shell because that gives us iOS + Android; web-only
 * Chrome would be a rounding error of users.
 *
 * Peripheral mode is NOT possible from a browser at all. Inside
 * Capacitor it requires an additional plugin that exposes a BLE
 * peripheral bridge under `window.Capacitor.Plugins.BlePeripheral`.
 * Any plugin that registers under that key with the API surface
 * documented in `docs/features/plan-sharing.md` will light up the
 * send-side. If no peripheral plugin is present, the send-side throws
 * a clear error and the UI falls back to the QR-code transport.
 *
 * Both sides use the same well-known UUIDs (below) so a Forkcast
 * device on any platform can find and talk to any other.
 */

import { hasWebBluetooth, isCapacitorNative } from './index';

// -------------------------------------------------------------------------
// Constants \u2014 well-known Bluetooth GATT identifiers for the Forkcast plan
// exchange service. These are custom 128-bit UUIDs; the "0000\u2026-0000-1000-
// 8000-00805f9b34fb" tail is the standard Bluetooth base UUID, and the
// leading 32 bits are the Forkcast-specific service / characteristic ids.
// -------------------------------------------------------------------------
export const FORKCAST_SERVICE_UUID        = '0000f0cc-0000-1000-8000-00805f9b34fb';
export const FORKCAST_PLAN_CHARACTERISTIC = '0000f0cd-0000-1000-8000-00805f9b34fb';
export const FORKCAST_ADVERTISED_NAME     = 'Forkcast-Plan';

// Cap payloads at 4 KB \u2014 well within one BLE MTU exchange after
// negotiation and far above what a typical week plan needs. Anything
// bigger, we chunk (the receiver reassembles by reading until it sees
// the "\u241E" (record separator) terminator we append).
const MAX_PAYLOAD_BYTES = 4 * 1024;
const RECORD_TERMINATOR = '\x1e';

// -------------------------------------------------------------------------
// Capability probes
// -------------------------------------------------------------------------

/**
 * Is a real BLE peer-to-peer transport available on this device?
 * Returns true when either side is possible \u2014 the UI can then offer
 * the option and let the specific send/receive flow surface a more
 * detailed error if the CURRENT direction isn't supported.
 */
export function isBlePeerAvailable() {
  return canReceiveViaBle() || canSendViaBle();
}

/**
 * True if this device can act as a BLE central (scan + read a plan).
 * Native shell OR Web Bluetooth both qualify. In Capacitor we require
 * the community BLE plugin's runtime bridge.
 */
export function canReceiveViaBle() {
  if (hasWebBluetooth()) return true;
  if (!isCapacitorNative()) return false;
  return hasCentralPlugin();
}

/**
 * True if this device can act as a BLE peripheral (advertise + serve).
 * Peripheral mode is impossible on any web browser and requires a
 * dedicated Capacitor plugin exposing a `BlePeripheral` bridge. See
 * docs/native/capacitor-setup.md for compatible plugins.
 */
export function canSendViaBle() {
  if (!isCapacitorNative()) return false;
  return hasPeripheralPlugin();
}

function hasCentralPlugin() {
  if (typeof window === 'undefined') return false;
  const cap = /** @type {any} */ (window).Capacitor;
  return Boolean(cap?.Plugins?.BluetoothLe);
}

function hasPeripheralPlugin() {
  if (typeof window === 'undefined') return false;
  const cap = /** @type {any} */ (window).Capacitor;
  return Boolean(cap?.Plugins?.BlePeripheral);
}

// -------------------------------------------------------------------------
// SEND side (peripheral)
// -------------------------------------------------------------------------
/**
 * Begin advertising the local Forkcast plan for a nearby device to
 * receive. Returns an object with `stop()` so the UI can cancel.
 *
 * @param {string} payload  Plan JSON (already stringified)
 * @param {object} [callbacks]
 * @param {() => void}      [callbacks.onAdvertising]
 * @param {(peer: string) => void} [callbacks.onConnected]
 * @param {() => void}      [callbacks.onSent]
 */
export async function sendPlanViaBle(payload, callbacks = {}) {
  if (!canSendViaBle()) {
    throw new Error(
      'BLE peripheral mode is not available on this device. Install a ' +
      'Capacitor BLE peripheral plugin (see docs/features/plan-sharing.md), ' +
      'or use the QR code transport instead.'
    );
  }

  const bytes = new TextEncoder().encode(payload + RECORD_TERMINATOR);
  if (bytes.byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error(
      `Plan is too large for BLE transfer (${bytes.byteLength} bytes; ` +
      `max ${MAX_PAYLOAD_BYTES}). Use the Share Sheet transport instead.`
    );
  }

  const BlePeripheral = window.Capacitor.Plugins.BlePeripheral;

  // Convert the payload to base64 because Capacitor bridges only pass
  // JSON-friendly primitives; every peripheral plugin I've seen accepts
  // b64 for characteristic values.
  const b64 = toBase64(bytes);

  await BlePeripheral.addService({
    service: FORKCAST_SERVICE_UUID,
    characteristics: [
      {
        uuid: FORKCAST_PLAN_CHARACTERISTIC,
        // "read" is enough for a one-shot pull; "notify" would let the
        // sender push, but read keeps the receiver logic simple and
        // works on every stack.
        properties: { read: true },
        // Some plugins use `value`, others use `initialValue`. Pass
        // both keys; the extraneous one is harmlessly ignored.
        value: b64,
        initialValue: b64,
      },
    ],
  });

  await BlePeripheral.startAdvertising({
    localName: FORKCAST_ADVERTISED_NAME,
    serviceUuids: [FORKCAST_SERVICE_UUID],
  });
  callbacks.onAdvertising?.();

  // Some peripheral plugins expose a connection callback. If the one
  // installed does, we hook it; if not, we still return a stop handle
  // so the UI can tear down after a timeout or user action.
  if (typeof BlePeripheral.addListener === 'function') {
    try {
      const sub = await BlePeripheral.addListener('centralConnected', (evt) => {
        callbacks.onConnected?.(evt?.central || 'peer');
      });
      const readSub = await BlePeripheral.addListener('characteristicRead', () => {
        callbacks.onSent?.();
      });
      return {
        async stop() {
          try { await sub.remove?.(); } catch { /* noop */ }
          try { await readSub.remove?.(); } catch { /* noop */ }
          try { await BlePeripheral.stopAdvertising(); } catch { /* noop */ }
          try { await BlePeripheral.removeService?.({ service: FORKCAST_SERVICE_UUID }); } catch { /* noop */ }
        },
      };
    } catch {
      // Plugin doesn't support listeners \u2014 fall through to plain stop.
    }
  }

  return {
    async stop() {
      try { await BlePeripheral.stopAdvertising(); } catch { /* noop */ }
      try { await BlePeripheral.removeService?.({ service: FORKCAST_SERVICE_UUID }); } catch { /* noop */ }
    },
  };
}

// -------------------------------------------------------------------------
// RECEIVE side (central)
// -------------------------------------------------------------------------
/**
 * Scan for a nearby Forkcast peripheral, connect, and read the plan.
 * Returns the decoded plan payload (already JSON-parsed) or throws.
 *
 * @param {object} [opts]
 * @param {number} [opts.scanMs=15000]  How long to scan before giving up
 * @param {AbortSignal} [opts.signal]   Cancel the scan externally
 * @param {(state: 'scanning'|'connecting'|'reading') => void} [opts.onProgress]
 */
export async function receivePlanViaBle({
  scanMs = 15000,
  signal,
  onProgress,
} = {}) {
  if (!canReceiveViaBle()) {
    throw new Error(
      'BLE central mode is not available on this device. Use the ' +
      'QR-code transport instead.'
    );
  }

  onProgress?.('scanning');

  // --- Native Capacitor path ---------------------------------------
  if (isCapacitorNative() && hasCentralPlugin()) {
    return receiveViaCapacitor({ scanMs, signal, onProgress });
  }

  // --- Web Bluetooth fallback (Chrome / Edge only) -----------------
  return receiveViaWebBluetooth({ signal, onProgress });
}

async function receiveViaCapacitor({ scanMs, signal, onProgress }) {
  // Dynamic import so the web build doesn't try to resolve this.
  const mod = await import(
    /* webpackIgnore: true */ '@capacitor-community/bluetooth-le'
  ).catch(() => null);
  if (!mod) throw new Error('@capacitor-community/bluetooth-le is not installed');
  const { BleClient } = mod;

  await BleClient.initialize({ androidNeverForLocation: true });

  // Race scan against timeout + external abort.
  const scanResult = await new Promise((resolve, reject) => {
    let done = false;
    const finish = (r, err) => {
      if (done) return;
      done = true;
      BleClient.stopLEScan().catch(() => {});
      if (err) reject(err); else resolve(r);
    };

    BleClient.requestLEScan(
      { services: [FORKCAST_SERVICE_UUID], allowDuplicates: false },
      (r) => finish(r)
    ).catch((err) => finish(null, err));

    const timeout = setTimeout(() => finish(null, new Error('No Forkcast device found')), scanMs);
    signal?.addEventListener('abort', () => { clearTimeout(timeout); finish(null, new Error('Aborted')); });
  });

  onProgress?.('connecting');
  const deviceId = scanResult.device.deviceId;
  await BleClient.connect(deviceId);
  try {
    onProgress?.('reading');
    const dv = await BleClient.read(
      deviceId,
      FORKCAST_SERVICE_UUID,
      FORKCAST_PLAN_CHARACTERISTIC
    );
    const text = new TextDecoder().decode(dv.buffer || dv);
    return JSON.parse(text.replace(RECORD_TERMINATOR, ''));
  } finally {
    try { await BleClient.disconnect(deviceId); } catch { /* noop */ }
  }
}

async function receiveViaWebBluetooth({ onProgress }) {
  // Web Bluetooth cannot scan by service UUID silently \u2014 it MUST
  // prompt the user with the device picker. That's fine here since the
  // user tapped "Receive" a moment ago.
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [FORKCAST_SERVICE_UUID] }],
  });
  onProgress?.('connecting');
  const server = await device.gatt.connect();
  try {
    onProgress?.('reading');
    const service = await server.getPrimaryService(FORKCAST_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(FORKCAST_PLAN_CHARACTERISTIC);
    const value = await characteristic.readValue();
    const text = new TextDecoder().decode(value);
    return JSON.parse(text.replace(RECORD_TERMINATOR, ''));
  } finally {
    try { device.gatt.disconnect(); } catch { /* noop */ }
  }
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

// Web Bluetooth helper (unchanged from v1) \u2014 still useful for future
// kitchen scale / thermometer integrations.
export async function connectWebBleDevice(services) {
  if (!hasWebBluetooth()) throw new Error('Web Bluetooth not supported');
  return navigator.bluetooth.requestDevice({
    acceptAllDevices: !services?.length,
    optionalServices: services || [],
  });
}

function toBase64(bytes) {
  // Small, dependency-free base64 encoder that works in both browser
  // and Capacitor WebView contexts.
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  // btoa is available in every WebView we target.
  return btoa(bin);
}
