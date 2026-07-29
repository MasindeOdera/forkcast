# Kitchen (Shopping List + Pantry)

The Kitchen tab adds two related workflows to Forkcast:

1. **Shopping List** — items you still need to buy for the week.
2. **Pantry** — items you already have at home.

Both are wired up to a **barcode / QR scanner** (camera on any device,
BLE HID scanner if you own one, or native ML Kit on Capacitor). The
pantry's contents also feed into the **AI Ideas** prompt so
suggestions respect what you can actually cook right now.

---

## User flows

### Shopping List (`components/kitchen/ShoppingList.js`)

- **Generate from this week's plan** — hits `POST /api/shopping-list/generate`,
  which walks the current-week `meal_plans` rows for the user, splits
  every meal's `ingredients` field into lines, and inserts each unique
  line as a shopping-list item. Case-insensitive dedupe so re-generating
  never creates duplicates.
- **Add manually** — typing an item name and pressing Add posts to
  `POST /api/shopping-list`.
- **Tick off items** — `PUT /api/shopping-list/:id` with `{ checked: true }`.
  Ticked items collapse to the bottom of the list with a strikethrough.
- **Scan to add or tick off** — the scanner resolves the barcode via
  `GET /api/barcode-lookup?code=...` (Open Food Facts family +
  UPCitemdb chain) and fuzzy-matches the product name against
  unchecked items. If a scanned product is *not yet* on the list, we
  add it automatically so the scan is never wasted. If the lookup
  service itself fails (5xx / network / rate-limit), the client shows
  a toast rather than treating the transient failure as a genuine
  miss.
- **Clear checked** — `DELETE /api/shopping-list?checked=true`.

### Pantry (`components/kitchen/Pantry.js`)

- **Add manually or via barcode** — `POST /api/pantry`.
- **Expiry buckets** — items are auto-grouped into three buckets by
  the client: expired (red), expiring in 3 days (amber), fresh. Each
  expired / expiring row has a one-tap Remove button so the UX for
  "clean up" is one swipe of the eyes and one click, on any device.
- **AI Ideas integration** — when the user asks for meal suggestions,
  the client can pass `usePantry: true` and the server appends fresh
  (non-expired) pantry items to the LLM's ingredient list.

---

## Backend surface (`app/api/[[...path]]/route.js`)

| Method | Path                              | Purpose                                       |
|--------|-----------------------------------|-----------------------------------------------|
| GET    | `/api/pantry`                     | List current user's pantry items              |
| POST   | `/api/pantry`                     | Add an item                                   |
| PUT    | `/api/pantry/:id`                 | Update a field                                |
| DELETE | `/api/pantry/:id`                 | Remove an item                                |
| GET    | `/api/shopping-list`              | List shopping list                            |
| POST   | `/api/shopping-list`              | Add manual item                               |
| POST   | `/api/shopping-list/generate`     | Regenerate from a date range's meal plans     |
| PUT    | `/api/shopping-list/:id`          | Toggle checked / rename                       |
| DELETE | `/api/shopping-list/:id`          | Remove one item                               |
| DELETE | `/api/shopping-list?checked=true` | Clear all checked items                       |
| GET    | `/api/barcode-lookup?code=X`      | Fast product lookup across the free-source chain (stops on first hit) |
| GET    | `/api/barcode-diagnose?code=X`    | Verbose per-source breakdown for debugging misses (never stops early) |

All routes require the `Authorization: Bearer <jwt>` header and are
scoped by `user_id` at the query level.

---

## Database (Supabase / Postgres)

Added in `db/migrations/002_kitchen.sql` (pantry + shopping list) and
`db/migrations/003_barcode_cache.sql` (server-side scanner cache).
Also present in `db/schema.sql`. See
`docs/operations/database-schema.md` for the full table map.

```sql
create table public.pantry_items (
    id, user_id, name, barcode, quantity, unit, expires_at, added_at
);

create table public.shopping_list_items (
    id, user_id, name, barcode, checked, source_meal_id, added_at
);

-- barcode column added in migration 004. Nullable — manually-typed
-- items have no code, only scan-added items do. There's a filtered
-- index on (user_id, barcode) WHERE barcode IS NOT NULL for the
-- client's "do I already have this scanned code on my list?" lookup
-- (see components/kitchen/ShoppingList.js tickOffByProductName).

-- Cross-user cache backing the scanner. Not user-scoped: a barcode →
-- product mapping is universal knowledge.
create table public.barcode_cache (
    code, found, name, brand, image, quantity, source, cached_at, expires_at
);
```

All three tables have RLS enabled + forced with no permissive policies
(default-deny), matching the existing security posture. The server
accesses them with the service role which bypasses RLS.

---

## Scanner strategy

See `lib/native/scanner.js`. Fallback chain (best → worst):

1. `@capacitor-mlkit/barcode-scanning` — native, fastest, all formats
2. `BarcodeDetector` browser API — Chrome / Edge / Android WebView
3. `@zxing/browser` fallback — iOS Safari, Firefox, older browsers
4. Manual entry — typed by the user OR streamed by a BLE HID scanner
   (which acts as a keyboard — no configuration needed)

The UI (`components/BarcodeScanner.js`) auto-detects which is available
and shows the appropriate tab. The Manual tab is always mounted so
BLE HID scanners "just work" by focusing that input.

---

## Product-database chain

Barcode-to-product resolution is a **two-layer cache + multi-source
fallback chain**. See `lib/barcode-lookup.js` and the runbook in
`docs/operations/debugging.md`.

The resolution order for a single scan is:

1. **Client-side IndexedDB cache** (`lib/barcode-cache.js`) — instant,
   offline-friendly, includes user-taught mappings. Zero network.
2. **Server-side Supabase cache** (`barcode_cache` table, migration 003)
   — shared across all users, ~30ms Postgres read. Both hits and
   misses are cached (30-day TTL for hits, 7-day for misses).
3. **Upstream chain** — only reached on a full cache miss. Sources are
   queried in order and the first hit wins. All are free, no API key.
4. **UnknownBarcodeDialog** — genuine miss; user teaches us once.

Upstream sources (step 3):

| Order | Source                         | Coverage                              |
|-------|--------------------------------|---------------------------------------|
| 1     | Open Food Facts                | ~3M food products                     |
| 2     | Open Beauty Facts              | Cosmetics, toiletries                 |
| 3     | Open Products Facts            | General household goods               |
| 4     | Open Pet Food Facts            | Pet food                              |
| 5     | UPCitemdb (trial)              | Non-food consumer goods, ~100/day/IP  |

Each source is called with:

- 8-second timeout (survives Vercel cold starts + slow upstreams).
- One automatic retry with exponential backoff on 5xx / network error.
- A meaningful `User-Agent` (Open Food Facts policy asks for one).

The three most common reasons a **cold** scan misses even when the
product exists:

1. **Shared-IP rate limits** — Vercel serverless functions share
   outbound IPs across many customers, so Open Food Facts occasionally
   returns 429 to our region. The **server-side cache eliminates this
   for repeat scans**: after any single user resolves a barcode
   successfully, every subsequent scan of that code across all users
   skips the network entirely. If you're diagnosing a first-time cold
   miss, see the debugging runbook for `?bypassCache=1` + cache
   invalidation.
2. **Cold-start timeout** — first request after idle can breach 8s if
   the upstream is also slow.
3. **GS1-reserved in-store codes** — any barcode with prefix `02` or
   `20`–`29` will **never** be in a public database. Detected by
   `isInternalStoreCode()` in `lib/barcode-utils.js`; the client-side
   `UnknownBarcodeDialog` explains this to the user and lets them
   teach it once.

The client-side flow (`components/kitchen/ShoppingList.js`,
`components/kitchen/Pantry.js`) already does the right thing in all
three cases via `lib/barcode-cache.js`:

- Client cache hit?  → zero network, instant match.
- Server cache hit?  → ~30ms Postgres round-trip, then cached client-side.
- API hit?           → cached at *both* layers + used. Accepts `name`
  **or** `brand` as the product name (OFF sometimes populates only one).
- API failure?       → toast the user; do **not** open UnknownBarcodeDialog.
  Transient failures should never train users to teach wrong names.
  401s trigger the global auto-logout listener (see `app/page.js`).
- Miss?              → open `UnknownBarcodeDialog`, save the taught
  mapping under `source: 'user'` (highest trust — never overwritten by
  later external lookups).

### Adding another source

The header comment in `lib/barcode-lookup.js` has a step-by-step
checklist. Short version: define a `lookupFoo(code)` returning the
normalised product shape (or null), then add
`{ id: 'foo', name: 'Foo DB', run: lookupFoo }` to the `SOURCES`
array. Sources that need an API key should read it from `process.env`
inside the lookup and return null when absent, so environments that
don't configure the key just skip that source.
