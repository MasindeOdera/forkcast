/**
 * lib/native/scanner.js
 * ---------------------
 * Unified barcode / QR scanner that adapts to the runtime shell.
 *
 * Fallback chain (best → worst):
 *   1. Capacitor + @capacitor-mlkit/barcode-scanning — native, fast
 *   2. Browser BarcodeDetector API              — Chrome / Edge / Android
 *   3. @zxing/browser (video stream)            — iOS Safari / Firefox
 *   4. Manual entry only                        — typed / HID scanner
 *
 * Each function returns / accepts a small, plain object so callers
 * don't need to know which backend was used.
 *
 * NOTE ON DYNAMIC IMPORTS
 * -----------------------
 * We import Capacitor plugins via dynamic import() inside a try/catch
 * so the standalone web build never sees them. Users who wrap Forkcast
 * in Capacitor install those plugins locally (see
 * docs/native/capacitor-setup.md); at that point the dynamic imports
 * resolve to the real modules.
 */

import { BrowserMultiFormatReader } from '@zxing/browser';
import { isCapacitorNative, hasBarcodeDetector } from './index';

/** Barcode formats we care about for pantry / shopping. */
const BARCODE_FORMATS = [
  'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code',
];

/**
 * Which scanner strategy is available on the current runtime?
 * Returns 'capacitor' | 'barcode_detector' | 'zxing' | 'manual'.
 */
export function detectStrategy() {
  if (isCapacitorNative()) return 'capacitor';
  if (hasBarcodeDetector()) return 'barcode_detector';
  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
    return 'zxing';
  }
  return 'manual';
}

/**
 * Scan a single barcode. Returns { code: string, format: string } or
 * null if the user cancels.
 *
 * @param {object} opts
 * @param {HTMLVideoElement} [opts.videoEl] Required for zxing / barcode_detector.
 * @param {AbortSignal}       [opts.signal] Cancel the scan externally.
 */
export async function scanOnce({ videoEl, signal } = {}) {
  const strategy = detectStrategy();

  // --- 1. Capacitor native path ------------------------------------
  if (strategy === 'capacitor') {
    try {
      // Dynamic import so the web build doesn't try to resolve this.
      const mod = await import(
        /* webpackIgnore: true */ '@capacitor-mlkit/barcode-scanning'
      ).catch(() => null);
      if (!mod) throw new Error('mlkit-barcode-scanning not installed');
      const { BarcodeScanner } = mod;
      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) throw new Error('scanner_unsupported');
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== 'granted') throw new Error('permission_denied');
      const { barcodes } = await BarcodeScanner.scan();
      if (!barcodes?.length) return null;
      return { code: barcodes[0].rawValue, format: barcodes[0].format };
    } catch (err) {
      // If native path fails, fall through to the web ones (except
      // permission_denied — that we propagate so the UI can prompt).
      if (String(err?.message).includes('permission_denied')) throw err;
      console.warn('Capacitor scan failed, falling back:', err?.message);
    }
  }

  // --- 2 & 3. Web paths (need a <video> element) -------------------
  if (!videoEl) {
    throw new Error('videoEl is required for web-based scanning');
  }

  // BarcodeDetector API — fastest of the web options.
  if (strategy === 'barcode_detector') {
    return scanWithBarcodeDetector(videoEl, signal);
  }

  // ZXing fallback (iOS Safari, Firefox).
  return scanWithZXing(videoEl, signal);
}

async function scanWithBarcodeDetector(videoEl, signal) {
  // eslint-disable-next-line no-undef
  const detector = new BarcodeDetector({ formats: BARCODE_FORMATS });
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  try {
    while (true) {
      if (signal?.aborted) return null;
      const barcodes = await detector.detect(videoEl).catch(() => []);
      if (barcodes.length) {
        return { code: barcodes[0].rawValue, format: barcodes[0].format };
      }
      // Yield the main thread — ~10 fps polling is plenty for barcodes.
      await new Promise((r) => setTimeout(r, 100));
    }
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    videoEl.srcObject = null;
  }
}

async function scanWithZXing(videoEl, signal) {
  const reader = new BrowserMultiFormatReader();
  return new Promise((resolve, reject) => {
    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoEl,
        (result, err, controls) => {
          if (signal?.aborted) { controls.stop(); resolve(null); return; }
          if (result) {
            controls.stop();
            resolve({ code: result.getText(), format: result.getBarcodeFormat() });
          }
          // err is expected on frames without a barcode — ignore.
        }
      )
      .catch(reject);
  });
}
