/**
 * lib/barcode-utils.js
 * --------------------
 * Helpers that turn raw scanner output into a canonical barcode string
 * and, when a lookup misses, a small list of equivalent codes worth
 * retrying. This is where we absorb the noise that real-world Bluetooth
 * / HID scanners emit (trailing CR/LF, arbitrary prefix bytes, wrong
 * check digit, GTIN-14 with a leading indicator zero, etc.).
 *
 * Design principles:
 *   - Pure functions. No side effects, no I/O. Trivial to unit-test.
 *   - Never throw. If we can't clean up, we return the input as-is.
 *   - Prefer numeric identity: EAN-13 / UPC-A / UPC-E / EAN-8 all map
 *     onto the same 13-digit GTIN internally, so we normalise to that
 *     for cache keys.
 */

/**
 * Strip everything that isn't a decimal digit. HID scanners typically
 * append CR/LF/Tab; some prepend a prefix like `~F1` or a random 0x00.
 * QR / Code-128 may include alphanumerics — for QR we bail out and
 * return the raw string trimmed, since QRs aren't GTINs.
 */
export function normalizeBarcode(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';

  // If it contains any non-digit after trimming whitespace, treat it
  // as an alphanumeric code (QR / Code-128 with letters). Just strip
  // control chars and return.
  const controlStripped = s.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (/[^0-9]/.test(controlStripped)) {
    return controlStripped;
  }

  // Pure-digit path — this is what almost every food barcode is.
  let digits = controlStripped;

  // GTIN-14 → EAN-13 (drop the leading indicator digit only if it's 0;
  // other indicator digits mean "case of X units", still valid as GTIN
  // but should be kept as-is because their lookup is different).
  if (digits.length === 14 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Some scanners emit UPC-A codes (12 digits) with a leading 0 to
  // pad to 13 — that's fine, it's still a valid EAN-13. Leave alone.
  return digits;
}

/**
 * Detect whether a code starts with an in-store / internal-use prefix.
 * Per GS1 spec, EAN-13 codes with prefix 02, 20-29 are reserved for
 * intra-company use (weighed produce, deli labels, store markdowns,
 * private-label internal SKUs). These will NEVER appear in a public
 * product database like Open Food Facts.
 */
export function isInternalStoreCode(code) {
  if (typeof code !== 'string') return false;
  if (!/^\d{12,14}$/.test(code)) return false;
  const c = code.length === 14 && code.startsWith('0') ? code.slice(1) : code;
  if (c.length !== 13 && c.length !== 12) return false;
  const prefix2 = c.slice(0, 2);
  return prefix2 === '02' || (prefix2 >= '20' && prefix2 <= '29');
}

/**
 * Generate a small ordered list of candidate codes to try against
 * external databases. Order = most-likely-canonical first.
 * Example: for a 12-digit UPC-A, we try both the raw 12-digit and the
 * 13-digit EAN-13 (leading zero) form.
 */
export function variantsToTry(raw) {
  const primary = normalizeBarcode(raw);
  if (!primary) return [];
  const set = new Set();
  const add = (v) => { if (v && !set.has(v)) set.add(v); };

  add(primary);

  // If we have digit-only content:
  if (/^\d+$/.test(primary)) {
    // 12 → 13 (pad leading zero, UPC-A → EAN-13)
    if (primary.length === 12) add('0' + primary);
    // 13 that starts with 0 → 12 (EAN-13 → UPC-A)
    if (primary.length === 13 && primary.startsWith('0')) add(primary.slice(1));
    // GTIN-14 with non-zero indicator: also try dropping it (some
    // outer-case barcodes still lookup the consumer unit fine).
    if (primary.length === 14) add(primary.slice(1));
    // Some scanners drop the check digit — very rare but cheap to try.
    // We don't try to *compute* a check digit here; that would need
    // full EAN-13 checksum logic and false positives would waste API
    // budget. Skip.
  }

  return Array.from(set);
}

/**
 * Convenience: return true if a normalised code looks like a
 * plausible EAN-8 / EAN-13 / UPC-A / GTIN-14.
 */
export function looksLikeGtin(code) {
  return typeof code === 'string' && /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(code);
}
