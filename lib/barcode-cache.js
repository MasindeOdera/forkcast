/**
 * lib/barcode-cache.js
 * --------------------
 * A thin IndexedDB wrapper that remembers barcode → product name
 * mappings on the user's device. Two purposes:
 *
 *   1. Cache successful external lookups so repeat scans are instant
 *      and work offline (a real superpower in a supermarket basement
 *      with no signal).
 *   2. Store user-taught mappings ("this store-internal code is
 *      Simon Lévelt coffee") so unknown codes only need to be named
 *      once ever.
 *
 * Entries are keyed by the *normalised* barcode string. `source` tells
 * us where the data came from so we can prefer high-trust sources when
 * merging:
 *   - 'user'      — the user told us this. Highest trust; only wiped
 *                    when the caller explicitly calls deleteCached().
 *   - 'off'       — Open Food Facts.
 *   - 'obf'       — Open Beauty Facts.
 *   - 'opf'       — Open Products Facts.
 *   - 'opff'      — Open Pet Food Facts.
 *   - 'upcitemdb' — UPCitemdb fallback.
 *   - 'unknown'   — reserved for "not found" outcomes with a short TTL.
 *                    Not currently written by client callers, but the
 *                    read path handles it so we can turn it on later
 *                    without a schema migration.
 *
 * All operations are best-effort: if IndexedDB is unavailable (private
 * mode on iOS, ancient browsers, SSR) every function silently returns
 * a no-op result so the caller doesn't have to branch.
 */

const DB_NAME = 'forkcast-barcodes';
const DB_VERSION = 1;
const STORE = 'entries';

/** Time-to-live for negative ("not found") entries, in ms. */
const NEGATIVE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'code' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      try {
        result = fn(store);
      } catch (e) {
        reject(e);
        return;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    return undefined;
  }
}

/**
 * Look up a barcode in the local cache.
 * Returns an object like
 *   { code, name, brand?, image?, source, updatedAt }
 * or null if we've never seen it (or the cached entry is a stale
 * negative).
 */
export async function getCached(code) {
  if (!code) return null;
  const entry = await withStore('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const r = store.get(code);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  });
  if (!entry) return null;
  // Stale negative? Discard.
  if (entry.source === 'unknown') {
    const age = Date.now() - (entry.updatedAt || 0);
    if (age > NEGATIVE_TTL_MS) return null;
  }
  return entry;
}

/**
 * Persist a mapping. Overwrites any existing entry for the same code,
 * with one exception: user-taught mappings (source:'user') are treated
 * as authoritative and are NOT clobbered by external sources.
 * `source` should be one of: 'user' | 'off' | 'obf' | 'opf' | 'opff' |
 * 'upcitemdb' | 'unknown'.
 *
 * We silently drop entries with an empty `name` for non-'unknown'
 * sources — caching a "found:true but no name" record would just make
 * future scans think the item is known when it isn't. This defends
 * against the "phantom hit" class of bug.
 */
export async function setCached(code, data) {
  if (!code || !data) return;
  const source = data.source || 'user';
  const name = (data.name || '').trim() || null;

  // Positive entries MUST have a name; otherwise we'd cache a useless
  // "found" record. Negative ('unknown') entries are allowed to have
  // no name — they exist purely to short-circuit repeated 404s.
  if (source !== 'unknown' && !name) return;

  const entry = {
    code,
    name,
    brand: data.brand || null,
    image: data.image || null,
    quantity: data.quantity || null,
    source,
    updatedAt: Date.now(),
  };
  await withStore('readwrite', (store) => {
    // If we already have a 'user'-taught mapping, don't let external
    // sources overwrite it — the user is authoritative. (If the user
    // ever needs to correct a wrong mapping, use deleteCached() first.)
    if (entry.source !== 'user') {
      const existing = store.get(code);
      existing.onsuccess = () => {
        if (existing.result && existing.result.source === 'user') return;
        store.put(entry);
      };
      return;
    }
    store.put(entry);
  });
}

/**
 * Remove a cached entry — useful if the user wants to "forget" a
 * previously-taught mapping.
 */
export async function deleteCached(code) {
  if (!code) return;
  await withStore('readwrite', (store) => store.delete(code));
}

/**
 * Convenience: quick check whether we have any positive record for a
 * code (name populated).
 */
export async function isKnown(code) {
  const entry = await getCached(code);
  return !!(entry && entry.name);
}
