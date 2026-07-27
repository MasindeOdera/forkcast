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
- **Scan to tick off** — the scanner resolves the barcode via
  `GET /api/barcode-lookup?code=...` (Open Food Facts) and fuzzy-matches
  the product name against unchecked items.
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
| GET    | `/api/barcode-lookup?code=X`      | Server-side Open Food Facts proxy             |

All routes require the `Authorization: Bearer <jwt>` header and are
scoped by `user_id` at the query level.

---

## Database (Supabase / Postgres)

Added in `db/migrations/002_kitchen.sql`, also present in `db/schema.sql`.
See `docs/operations/database-schema.md` for the full table map.

```sql
create table public.pantry_items (
    id, user_id, name, barcode, quantity, unit, expires_at, added_at
);

create table public.shopping_list_items (
    id, user_id, name, checked, source_meal_id, added_at
);
```

Both tables have RLS enabled + forced with no permissive policies
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

## Open Food Facts

Barcode-to-product resolution uses the free
[Open Food Facts](https://world.openfoodfacts.org/data) API. No key
required, ~3M food products. We proxy through `/api/barcode-lookup` to
avoid CORS issues on iOS Safari and to keep a place to add caching or
rate limiting later.
