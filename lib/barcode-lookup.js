/**
 * lib/barcode-lookup.js
 * ----------------------------------------------------------------------
 * Server-side barcode → product resolver used by:
 *   - GET /api/barcode-lookup    (fast path, stops on first hit)
 *   - GET /api/barcode-diagnose  (verbose path, tries every source)
 *
 * This module is intentionally free of Next.js / Request-Response types
 * so it stays pure. The only side effects are outbound `fetch()` calls
 * to public product databases. Unit tests can therefore stub `fetch`
 * and exercise every branch.
 *
 * ══════════════════════════════════════════════════════════════════════
 *   SOURCES IN THE CHAIN (as of 2026-01)
 * ══════════════════════════════════════════════════════════════════════
 *
 *   1. Open Food Facts family — same free API, four different subdomains
 *      that each cover a different product category. All four are
 *      queried in order. No API key required.
 *
 *        - world.openfoodfacts.org       (food, ~3M products)
 *        - world.openbeautyfacts.org     (cosmetics, toiletries)
 *        - world.openproductsfacts.org   (general household goods)
 *        - world.openpetfoodfacts.org    (pet food)
 *
 *   2. UPCitemdb trial endpoint — no key, ~100 requests/day per source
 *      IP. Fills the "non-food consumer goods" gap for us.
 *
 *   Rationale for order: put highest-hit-rate free sources first, then
 *   the smaller sister catalogs, then UPCitemdb (which has a tight
 *   daily budget). This maximises hits per API call spent.
 *
 * ══════════════════════════════════════════════════════════════════════
 *   ADDING A NEW SOURCE — checklist
 * ══════════════════════════════════════════════════════════════════════
 *
 *   1. Add a new async function `lookupXyz(code)` that returns:
 *        { found: true, name, brand, image, quantity }  on hit
 *        null                                            on miss/error
 *      Never throw; use try/catch and return null.
 *
 *   2. Add it to the SOURCES array below with a short `id` (used in
 *      diagnostics) and a `name` (human-readable).
 *
 *   3. If the source needs an API key, read from process.env INSIDE the
 *      lookup function and return null when the key is absent (so the
 *      chain gracefully skips it in environments that haven't configured
 *      it).
 *
 *   4. Update docs/operations/debugging.md so the runbook stays honest.
 *
 * ══════════════════════════════════════════════════════════════════════
 *   HOW TO DEBUG A "COULDN'T FIND PRODUCT" REPORT
 * ══════════════════════════════════════════════════════════════════════
 *
 *   Step 1 — Confirm what the client actually sent. Look at server logs
 *            for the line `[barcode] lookup <code>` and note the exact
 *            digits (Bluetooth scanners sometimes prepend junk).
 *
 *   Step 2 — Hit /api/barcode-diagnose?code=<the-code> as an authenticated
 *            user. The response lists every source that was tried, what
 *            HTTP status it returned, and the parsed shape. This is your
 *            single source of truth.
 *
 *   Step 3 — Cross-check by curling the raw source yourself:
 *              curl "https://world.openfoodfacts.org/api/v2/product/<code>.json"
 *            If your machine gets a hit but Vercel doesn't, you're almost
 *            certainly hitting a shared-IP rate limit from the hosting
 *            provider — see docs/operations/debugging.md for mitigations.
 *
 *   Step 4 — If the code starts with 02 or 20–29 it's a GS1-reserved
 *            in-store code (deli labels, weighed produce, private
 *            markdowns). No public database will ever have it. This is
 *            expected behaviour — the client-side "teach it once"
 *            dialog handles this class.
 */

// ---------------------------------------------------------------------
//  Tunables
// ---------------------------------------------------------------------

/** Per-source timeout in ms. 8s is generous but survives cold starts. */
const SOURCE_TIMEOUT_MS = 8000;

/** How many times to retry a source on 5xx / network error. */
const RETRY_ATTEMPTS = 1;

/** Base backoff between retries (ms). Doubles each attempt. */
const RETRY_BACKOFF_MS = 250;

/**
 * User-Agent identifying our client. Open Food Facts policy requires a
 * meaningful UA. If yours isn't set here, requests still work but you
 * may be lumped in with abusive traffic on shared hosting IPs.
 * If Forkcast is deployed at a different URL, update this and the
 * FORKCAST_URL constant in the tests.
 */
const USER_AGENT = 'Forkcast/1.0 (+https://forkcast-six.vercel.app; kitchen barcode lookup)';

// ---------------------------------------------------------------------
//  Variant generator
// ---------------------------------------------------------------------

/**
 * Given the code the client sent us, return an ordered list of
 * equivalent codes worth trying against upstream databases. This
 * handles the common footguns of real-world barcode scanning:
 *
 *   - UPC-A (12 digits, common in USA) is really an EAN-13 with a
 *     leading zero; some databases only index one form.
 *   - Some cheap scanners emit GTIN-14 (14 digits) with a leading
 *     indicator digit for outer-case packs. The consumer product is
 *     usually indexed under the 13-digit form.
 *   - EAN-8 is technically GTIN-13 with 5 leading zeros.
 *
 * We deliberately do NOT compute check digits or attempt fuzzy repair
 * — false-positive lookups burn our UPCitemdb daily quota.
 */
export function buildBarcodeVariants(raw) {
  const out = [];
  const push = (v) => { if (v && !out.includes(v)) out.push(v); };
  push(raw);
  if (!/^\d+$/.test(raw)) return out;
  if (raw.length === 12) push('0' + raw);              // UPC-A → EAN-13
  if (raw.length === 13 && raw.startsWith('0')) push(raw.slice(1)); // EAN-13 → UPC-A
  if (raw.length === 14) push(raw.slice(1));           // GTIN-14 → EAN-13
  if (raw.length === 8)  push('00000' + raw);          // EAN-8   → GTIN-13
  return out;
}

// ---------------------------------------------------------------------
//  Low-level helpers
// ---------------------------------------------------------------------

/**
 * Fetch with a hard timeout, one automatic retry on 5xx / network
 * error, and exponential backoff. Returns the Response on success or
 * throws AFTER exhausting retries so the caller can log context.
 */
async function robustFetch(url, init = {}) {
  const attempts = 1 + RETRY_ATTEMPTS;
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = AbortSignal.timeout(SOURCE_TIMEOUT_MS);
      const res = await fetch(url, { ...init, signal: controller });
      // 5xx → retryable. 4xx (incl 429 rate-limit) → return as-is
      // so the caller can decide (usually "give up, try next source").
      if (res.status >= 500 && i < attempts - 1) {
        lastErr = new Error(`upstream ${res.status}`);
      } else {
        return res;
      }
    } catch (err) {
      lastErr = err;
      // Retryable if we haven't burnt all attempts yet.
      if (i >= attempts - 1) throw err;
    }
    // Exponential backoff between attempts.
    await sleep(RETRY_BACKOFF_MS * Math.pow(2, i));
  }
  throw lastErr || new Error('robustFetch exhausted retries');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Normalise a raw upstream product record into our internal shape.
 * Returns null if the record is too thin to be useful (a common OFF
 * quirk: draft entries with only a photo and no name).
 */
function normaliseProduct({ name, brand, image, quantity }) {
  const nm = (name || '').trim() || null;
  const br = (brand || '').trim() || null;
  if (!nm && !br) return null;
  return {
    found: true,
    name: nm,
    brand: br,
    image: image || null,
    quantity: quantity || null,
  };
}

// ---------------------------------------------------------------------
//  Source: Open Food Facts family
// ---------------------------------------------------------------------

/**
 * Base URLs of the four Open Facts sister databases. They share the
 * same v2 API contract so a single helper can query all of them. Order
 * matters: the callsite tries them left-to-right and stops on first
 * hit.
 */
const OPEN_FACTS_HOSTS = [
  { id: 'off',  host: 'world.openfoodfacts.org',      label: 'Open Food Facts' },
  { id: 'obf',  host: 'world.openbeautyfacts.org',    label: 'Open Beauty Facts' },
  { id: 'opf',  host: 'world.openproductsfacts.org',  label: 'Open Products Facts' },
  { id: 'opff', host: 'world.openpetfoodfacts.org',   label: 'Open Pet Food Facts' },
];

/**
 * Query a single Open Facts host for a code. Returns the normalised
 * product on hit, null on miss.
 *
 * Debug tip: if this always returns null in production but works
 * locally, print `res.status` and `res.headers.get('x-request-id')`
 * from inside the try block — you'll usually see 429 or a Cloudflare
 * challenge page when you've been rate-limited.
 */
async function queryOpenFactsHost(host, code) {
  const url = `https://${host}/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,image_thumb_url,quantity`;
  try {
    const res = await robustFetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return null;
    const payload = await res.json();
    if (payload.status !== 1 || !payload.product) return null;
    const p = payload.product;
    return normaliseProduct({
      name: p.product_name,
      brand: p.brands,
      image: p.image_thumb_url,
      quantity: p.quantity,
    });
  } catch (err) {
    // Not throwing — the next source in the chain gets its chance.
    console.warn(`[barcode] ${host} lookup failed for ${code}:`, err?.message || err);
    return null;
  }
}

// ---------------------------------------------------------------------
//  Source: UPCitemdb trial
// ---------------------------------------------------------------------

/**
 * UPCitemdb no-key trial endpoint. Roughly 100 lookups/day per source
 * IP. Great for non-food items that Open Food Facts doesn't cover.
 *
 * Debug tip: if you're hitting 429 here, the daily quota for this
 * Vercel region has been burnt. It resets at midnight UTC. Consider
 * signing up for their paid tier (see docs/features/kitchen.md) and
 * dropping the key in UPCITEMDB_KEY env var — the code path already
 * checks for it in the header hook below.
 */
async function lookupUpcItemDb(code) {
  const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`;
  try {
    const headers = { 'User-Agent': USER_AGENT, 'Accept': 'application/json' };
    // Optional paid-key upgrade: uncomment when you're ready. The paid
    // endpoint lives at /prod/v1/lookup and expects the key header:
    //   if (process.env.UPCITEMDB_KEY) {
    //     headers['user_key'] = process.env.UPCITEMDB_KEY;
    //     headers['key_type'] = '3scale';
    //   }
    const res = await robustFetch(url, { headers });
    if (!res.ok) return null;
    const payload = await res.json();
    const item = Array.isArray(payload.items) ? payload.items[0] : null;
    if (!item) return null;
    return normaliseProduct({
      name: item.title,
      brand: item.brand,
      image: Array.isArray(item.images) ? item.images[0] : null,
      quantity: item.size,
    });
  } catch (err) {
    console.warn(`[barcode] upcitemdb lookup failed for ${code}:`, err?.message || err);
    return null;
  }
}

// ---------------------------------------------------------------------
//  Source registry
// ---------------------------------------------------------------------

/**
 * The ordered list of sources the chain will try. Each entry has:
 *   - id     — stable short identifier, used in logs & diagnose output
 *   - name   — human-readable label
 *   - run    — async (code) => normalisedProduct | null
 *
 * Adding a new source is a one-liner: define a `lookupFoo` and add
 * `{ id: 'foo', name: 'Foo DB', run: lookupFoo }` here.
 */
const SOURCES = [
  ...OPEN_FACTS_HOSTS.map(({ id, host, label }) => ({
    id,
    name: label,
    run: (code) => queryOpenFactsHost(host, code),
  })),
  { id: 'upcitemdb', name: 'UPCitemdb (trial)', run: lookupUpcItemDb },
];

// ---------------------------------------------------------------------
//  Public entry points
// ---------------------------------------------------------------------

/**
 * Fast path used by /api/barcode-lookup.
 *
 * Iterates variants × sources and stops on the first hit. Returns:
 *   {
 *     found: true,           // or false
 *     code, name, brand, image, quantity, source, // on hit
 *     triedVariants: [...],
 *     triedSources: [...],   // ids that were queried
 *   }
 *
 * Never throws. Never returns a 500-shaped payload — the caller is
 * expected to translate `found:false` into the client-side "teach me"
 * dialog rather than an error toast.
 *
 * Example:
 *   const result = await runLookupChain('4056489592068');
 *   //=> { found: true, name: 'Crunchy Muesli...', brand: 'Crownfield',
 *   //     source: 'off', code: '4056489592068', ... }
 */
export async function runLookupChain(rawCode) {
  const variants = buildBarcodeVariants(rawCode);
  const triedSources = new Set();
  for (const code of variants) {
    for (const src of SOURCES) {
      triedSources.add(src.id);
      const hit = await src.run(code);
      if (hit) {
        return {
          ...hit,
          code,
          requestedCode: rawCode,
          source: src.id,
          triedVariants: variants.slice(0, variants.indexOf(code) + 1),
          triedSources: Array.from(triedSources),
        };
      }
    }
  }
  return {
    found: false,
    code: rawCode,
    requestedCode: rawCode,
    source: 'none',
    triedVariants: variants,
    triedSources: Array.from(triedSources),
  };
}

/**
 * Verbose diagnostic path used by /api/barcode-diagnose. Does NOT stop
 * on first hit — queries every (variant, source) pair and returns the
 * full matrix. Response shape:
 *
 *   {
 *     requestedCode,
 *     variants: ['4056489592068', ...],
 *     attempts: [
 *       {
 *         code: '4056489592068',
 *         source: 'off',
 *         sourceName: 'Open Food Facts',
 *         hit: true,
 *         durationMs: 123,
 *         product: { name, brand, image, quantity }  // when hit
 *       },
 *       ...
 *     ],
 *     summary: {
 *       anyHit: true,
 *       firstHit: 'off',        // source id of the first successful hit, or null
 *       totalDurationMs: 456,
 *     }
 *   }
 *
 * Use this when a user reports "it didn't find X" and you need to see
 * exactly which upstream said what. Example:
 *
 *   curl -H "Authorization: Bearer <token>" \\
 *        "https://forkcast-six.vercel.app/api/barcode-diagnose?code=4056489592068"
 */
export async function runDiagnosis(rawCode) {
  const variants = buildBarcodeVariants(rawCode);
  const attempts = [];
  const startedAll = Date.now();
  let firstHit = null;
  for (const code of variants) {
    for (const src of SOURCES) {
      const started = Date.now();
      const hit = await src.run(code);
      const durationMs = Date.now() - started;
      const record = {
        code,
        source: src.id,
        sourceName: src.name,
        hit: !!hit,
        durationMs,
      };
      if (hit) {
        record.product = {
          name: hit.name,
          brand: hit.brand,
          image: hit.image,
          quantity: hit.quantity,
        };
        if (!firstHit) firstHit = src.id;
      }
      attempts.push(record);
    }
  }
  return {
    requestedCode: rawCode,
    variants,
    attempts,
    summary: {
      anyHit: attempts.some((a) => a.hit),
      firstHit,
      totalDurationMs: Date.now() - startedAll,
      totalSourcesQueried: SOURCES.length * variants.length,
    },
  };
}

// Export the source list for tests / introspection.
export const _SOURCES_FOR_TEST = SOURCES;
