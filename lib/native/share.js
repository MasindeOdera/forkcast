/**
 * lib/native/share.js
 * -------------------
 * Unified share API. Callers pass a payload; we route it to the best
 * available transport:
 *
 *   1. Capacitor native — uses @capacitor/share, invokes the OS share
 *      sheet (AirDrop on iOS, Nearby Share on Android). Both of those
 *      transports use Bluetooth + WiFi Direct under the hood, no
 *      internet required.
 *   2. Browser Web Share API — navigator.share; opens the OS share
 *      sheet on Android Chrome and Safari.
 *   3. Clipboard fallback — copies the payload's JSON to clipboard so
 *      the user can paste it into any messaging app.
 *
 * All paths return { transport, ok, cancelled } so the caller can
 * distinguish "user cancelled" from "actually failed".
 */

import { isCapacitorNative, hasWebShare } from './index';

/**
 * @param {object} payload
 * @param {string} payload.title
 * @param {string} payload.text   Human readable summary
 * @param {string} [payload.url]  Optional deep-link (encoded plan JSON)
 */
export async function sharePayload(payload) {
  // --- Capacitor path ----------------------------------------------
  if (isCapacitorNative()) {
    try {
      const { Share } = await import(/* webpackIgnore: true */ '@capacitor/share');
      await Share.share({
        title: payload.title,
        text:  payload.text,
        url:   payload.url,
        dialogTitle: payload.title,
      });
      return { transport: 'capacitor', ok: true, cancelled: false };
    } catch (err) {
      // Capacitor throws a specific message when user cancels.
      if (String(err?.message || '').toLowerCase().includes('cancel')) {
        return { transport: 'capacitor', ok: false, cancelled: true };
      }
      // Fall through to web share on any other failure.
    }
  }

  // --- Web Share API path ------------------------------------------
  if (hasWebShare()) {
    try {
      await navigator.share({
        title: payload.title,
        text:  payload.text,
        url:   payload.url,
      });
      return { transport: 'web_share', ok: true, cancelled: false };
    } catch (err) {
      if (err?.name === 'AbortError') {
        return { transport: 'web_share', ok: false, cancelled: true };
      }
      // Fall through to clipboard.
    }
  }

  // --- Clipboard fallback ------------------------------------------
  try {
    const blob = payload.url || payload.text;
    await navigator.clipboard.writeText(blob);
    return { transport: 'clipboard', ok: true, cancelled: false };
  } catch {
    return { transport: 'none', ok: false, cancelled: false };
  }
}
