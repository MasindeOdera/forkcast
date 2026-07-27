/**
 * lib/native/index.js
 * -------------------
 * Runtime environment helpers. Forkcast is designed to run in three
 * different shells:
 *
 *   1. Plain browser (Chrome, Safari, Firefox on desktop / mobile)
 *   2. Chrome / Edge with Web Bluetooth support
 *   3. Capacitor-wrapped native app (iOS / Android)
 *
 * Any component that touches hardware (camera, Bluetooth, Share sheet)
 * MUST branch on these helpers so the same code path works in every
 * shell and degrades gracefully when a capability is missing.
 *
 * Why we use dynamic imports for Capacitor plugins elsewhere in the
 * codebase: `@capacitor-community/bluetooth-le` and
 * `@capacitor-mlkit/barcode-scanning` are documented but intentionally
 * NOT installed in package.json — they add native binary hooks that
 * would break the standalone web build. When you wrap Forkcast in
 * Capacitor (see docs/native/capacitor-setup.md), you install those
 * plugins locally and the dynamic imports resolve at runtime.
 */

// SSR-safe: `window` is undefined during Next.js server rendering.
const hasWindow = () => typeof window !== 'undefined';

/**
 * True when the app is running inside a Capacitor native shell (iOS or
 * Android). Detected via the `Capacitor` global injected by the runtime.
 */
export function isCapacitorNative() {
  if (!hasWindow()) return false;
  const cap = /** @type {any} */ (window).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/**
 * Which native platform we're on, when isCapacitorNative() is true.
 * Returns 'ios' | 'android' | 'web' | 'unknown'.
 */
export function getPlatform() {
  if (!hasWindow()) return 'unknown';
  const cap = /** @type {any} */ (window).Capacitor;
  return cap?.getPlatform?.() || 'web';
}

/**
 * True when the browser exposes the `BarcodeDetector` API. Available on
 * Chrome (all platforms), Edge, and Android WebView. Notably missing on
 * iOS Safari and Firefox — for those we fall back to ZXing.
 */
export function hasBarcodeDetector() {
  return hasWindow() && 'BarcodeDetector' in window;
}

/**
 * True when the browser exposes Web Bluetooth. Currently Chrome + Edge
 * on desktop and Android only. iOS Safari, Firefox and Safari-on-Mac
 * return false. This is the browser-side signal — inside Capacitor we
 * use `@capacitor-community/bluetooth-le` instead (see lib/native/ble.js).
 */
export function hasWebBluetooth() {
  return hasWindow() && Boolean(navigator?.bluetooth);
}

/**
 * True when the browser exposes `navigator.share`. Used by the plan
 * sharing dialog to hand off to the OS share sheet (AirDrop, Nearby
 * Share, WhatsApp, etc.).
 */
export function hasWebShare() {
  return hasWindow() && typeof navigator?.share === 'function';
}
