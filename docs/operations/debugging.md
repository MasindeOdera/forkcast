# 🐛 Debugging Guide

This is the doc to read when *something is wrong*. It's written for a **frontend developer who wants to understand the full stack** — we'll explain the flow at each layer, not just "run this command".

---

## 🧭 Mental model: request lifecycle

When a user clicks something in the UI, this is what happens end-to-end. Any bug lives somewhere on this chain — the trick to debugging is figuring out *where*.

```
① Browser (React)
   │  fetch('/api/meals', { method: 'POST', body: JSON.stringify({...}) })
   ▼
② Vercel / Next.js server
   │  routes the request to app/api/[[...path]]/route.js  (POST handler)
   ▼
③ Auth check
   │  parses JWT from Authorization header → resolves req.user
   ▼
④ Business logic
   │  validates body, maybe uploads to Cloudinary
   ▼
⑤ Database layer (lib/supabase-db.js)
   │  db.meals.insertOne({...})  →  supabaseAdmin.from('meals').insert(...)
   ▼
⑥ Supabase (Postgres)
   │  actual SQL runs
   ▼
⑦ Response bubbles back up → JSON returned to the browser → React updates state
```

When debugging, ask: **"Which step is the first one where the observed value is wrong?"** Then look at that step.

---

## 🔍 Where to look, in order

### 1. The browser (steps ① and ⑦)

Open DevTools:

- **Console** — client-side JS errors, warnings, `console.log`s you added.
- **Network** — click the failing request:
  - **Headers** tab — is the URL right? Is the `Authorization` header set?
  - **Payload / Request** — is the body what you expected? (A common bug is a missing field silently sending `undefined`.)
  - **Response** — did the server return `200` with data, `401`, `500`? What's in the response body? Servers usually put the reason there.
  - **Timing** — a request that hangs for 30s+ usually means the DB is asleep (see [supabase.md → Auto-pause](../services/supabase.md#-auto-pause--keepalive-important)).
- **Application → Local Storage** — for auth bugs, check that the JWT is actually stored under the expected key.

> 💡 **Frontend dev tip:** if the request *never leaves the browser* (nothing in Network), the bug is in your React code — you're probably not calling `fetch` at all, or an event handler is swallowing the click.

### 2. The API route (steps ② – ④)

All HTTP endpoints live in **`app/api/[[...path]]/route.js`**. This is a catch-all: the file inspects `params.path` (e.g. `['meals', '<id>']`) and dispatches to the right handler.

- Look at the specific handler function for the endpoint you're hitting.
- Add `console.log` liberally — server logs show up in:
  - **Local**: the terminal where you ran `yarn dev`.
  - **Vercel**: *Deployments → the current build → Runtime Logs*.
  - **Emergent / supervisor**: `sudo tail -n 200 /var/log/supervisor/nextjs.err.log` and `/var/log/supervisor/nextjs.out.log`.

### 3. The DB layer (step ⑤)

`lib/supabase-db.js` exposes a `db` object with a Mongo-shaped API (`db.meals.find(...)`, `db.users.findOne(...)`, …) that internally calls `supabaseAdmin.from(...)`.

If a query returns unexpected data:
- Log the *input* to the helper and the *output* from Supabase (`console.log('supabase response', { data, error })`).
- Reproduce the query directly in the Supabase SQL editor (see below) — this rules out a bug in the helper vs the query itself.

### 4. Postgres itself (step ⑥)

See the next section for how to poke at the DB directly.

---

## 🛠️ Manipulating and inspecting data

You have three ways to look at (or edit) real data. Pick whichever fits.

### A. Supabase Dashboard — easiest

<https://supabase.com/dashboard> → Forkcast project.

- **Table Editor** (`Database → Tables`)
  - Point-and-click view of every row. Great for a quick "is my user actually there?" check.
  - You can edit cells inline, add rows, delete rows. Deletes are **not** soft — no undo.
  - Watch out: editing `password` here writes plaintext into a column the app expects to be a bcrypt hash — auth will break for that user.

- **SQL Editor** (`SQL → New query`)
  - Full SQL. Examples:
    ```sql
    -- How many meals per user?
    select u.username, count(m.id) as meal_count
    from users u left join meals m on m.user_id = u.id
    group by u.username order by meal_count desc;

    -- Find meals mentioning "chicken"
    select id, title from meals where ingredients ilike '%chicken%';

    -- Wipe all meal_plans (dev only!)
    truncate meal_plans restart identity;
    ```
  - Query history is saved per project — great for building up a "debug snippets" collection.

- **Logs** (`Logs → Postgres logs` / `Logs → API`)
  - Every failed query lands here with the exact SQL and error. If your API returned a mysterious 500 and there's nothing useful in the Vercel log, check here.

### B. `psql` from your laptop — most powerful

1. In the Supabase dashboard: *Project Settings → Database → Connection string → URI*.
2. Copy the connection string (it looks like `postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres`).
3. Then:
   ```bash
   psql "postgresql://postgres:..."
   # you're now in an interactive psql session
   \dt                       # list tables
   \d meals                  # describe the meals table
   select count(*) from meals;
   ```
4. `\q` to quit.

> Never hardcode this URL — it contains a password. Store it in your local secrets manager.

### C. Hitting the API directly — end-to-end sanity check

When you want to test the *whole path* excluding the browser:

```bash
# Public: is the app alive and DB reachable?
curl -s http://localhost:3000/api/health | jq

# Register a user
curl -s -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"correct-horse"}' | jq

# Log in — grab the token from the response
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"correct-horse"}' | jq -r .token)

# Use the token to create a meal
curl -s -X POST http://localhost:3000/api/meals \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Test meal","ingredients":"salt\npepper","instructions":"stir"}' | jq

# List all meals
curl -s http://localhost:3000/api/meals | jq
```

A passing curl but a failing UI = the bug is in the browser code. A failing curl = the bug is somewhere in ②–⑥.

---

## 🩺 Health check

`GET /api/health` returns:

```json
{
  "status": "ok",
  "db": "ok",
  "timestamp": "2025-07-04T12:34:56.789Z"
}
```

- `db: "ok"` → Supabase is reachable and the users table can be counted.
- `db: "error"` → the DB is unreachable. Most common cause: the Supabase project auto-paused. Open the dashboard and click *Restore project*. See [services/supabase.md](../services/supabase.md).
- HTTP `500` altogether → the Next.js server is up but crashed processing the request. Check server logs.
- No response / connection refused → the Next.js server itself is down. Check `sudo supervisorctl status` (Emergent) or the Vercel Deployments page.

The same endpoint is pinged by our GitHub Actions cron every ~3 days to prevent Supabase auto-pause — killing the cron is a valid way to "turn off" the keepalive.

---

## 🧯 Common failure modes

### The site loads but every API call returns 500
- **Likely:** DB is asleep. Check `/api/health`. If `db: "error"`, restore Supabase.
- **Also possible:** `SUPABASE_SERVICE_ROLE_KEY` is missing or wrong in the deployment env. Check Vercel → Settings → Environment Variables → *Production*.

### Login used to work, now returns 401 for a specific user
- Their `password` column was probably edited manually in the dashboard, turning the bcrypt hash into plaintext.
- Fix: reset that user's password via the register endpoint (delete the row and re-register), or generate a fresh bcrypt hash in a scratch Node script and paste it into the column.

### Image upload fails with 400
- File > 10 MB, or wrong MIME type. See [services/cloudinary.md → Validation](../services/cloudinary.md#validation).
- If it's a valid file: check `CLOUDINARY_API_SECRET` — a rotated/wrong secret returns a Cloudinary error that we surface as 400/500.

### AI suggestions endpoint returns 500
- `EMERGENT_LLM_KEY` missing/expired.
- Prompt exceeded the model's context window (unlikely with meal-suggestion prompts, but possible with pathological input).

### Everything "went to sleep" over the weekend
- Classic Supabase free-tier auto-pause. See [services/supabase.md → Auto-pause & keepalive](../services/supabase.md#-auto-pause--keepalive-important). The keepalive workflow should prevent this — check that it's actually running under **GitHub → Actions**.

### CORS error in the browser console
- The API is at a different origin than the frontend. `next.config.js` sets `Access-Control-Allow-Origin` from `CORS_ORIGINS` — add the frontend origin to that env var and redeploy.

---

## 📓 Where logs actually live

| Environment           | Log location                                                        |
|-----------------------|---------------------------------------------------------------------|
| Local `yarn dev`      | The terminal it's running in                                        |
| Vercel                | Deployments → *your deployment* → **Runtime Logs**                  |
| Emergent / supervisor | `/var/log/supervisor/nextjs.err.log`, `/var/log/supervisor/nextjs.out.log` |
| Supabase (DB errors)  | Supabase Dashboard → Logs → Postgres logs / API                     |
| GitHub Actions        | GitHub → Actions → the workflow run                                 |


---

## 🏷️ Debugging barcode-scan misses

**Symptom**: a user scans a barcode and the app shows the "What is this?" (`UnknownBarcodeDialog`) even though the product clearly exists in Open Food Facts.

The scanner reads the digits correctly *and* the server calls the right endpoints — the problem is almost never the barcode library itself. Follow this order:

### Step 0 — Rule out the three client-side gotchas

Since Jul 2026 the client (`components/kitchen/ShoppingList.js`, `components/kitchen/Pantry.js`) distinguishes three outcomes and only the last one opens the `UnknownBarcodeDialog`. If a user reports "the scanner doesn't recognize this product", make sure you know which of the three fired:

- **HTTP failure** (5xx / network / rate-limit) → `toast.error` "Product lookup service is unavailable…". This should **never** open the dialog anymore.
- **Genuine hit with brand-only** (`{ found: true, name: null, brand: "Crownfield" }`) → we now fall back to the brand as `productName`. Older clients (pre-fix) treated this as unknown — if you see this happening again, look for that regression first.
- **Genuine miss** (`{ found: false }`) → dialog opens. Correct behaviour.

Turn on `NEXT_PUBLIC_DEBUG_BARCODE=1` (or flip the `DEBUG_BARCODE` const at the top of each Kitchen component) to mirror `[barcode]` scan/lookup logs to the browser console.

### Step 1 — Reproduce with the diagnose endpoint

Every barcode-lookup miss can be inspected with the sister endpoint `GET /api/barcode-diagnose?code=<code>`. It queries **every** source in the chain (never short-circuits on first hit) and returns a per-source verdict.

```bash
curl -H "Authorization: Bearer <your-jwt>" \
  "https://forkcast-six.vercel.app/api/barcode-diagnose?code=4056489592068" | jq
```

Example response:

```json
{
  "requestedCode": "4056489592068",
  "variants": ["4056489592068"],
  "attempts": [
    { "code": "4056489592068", "source": "off",       "sourceName": "Open Food Facts",     "hit": true,  "durationMs": 234, "product": {...} },
    { "code": "4056489592068", "source": "obf",       "sourceName": "Open Beauty Facts",   "hit": false, "durationMs": 87 },
    { "code": "4056489592068", "source": "opf",       "sourceName": "Open Products Facts", "hit": false, "durationMs": 74 },
    { "code": "4056489592068", "source": "opff",      "sourceName": "Open Pet Food Facts", "hit": false, "durationMs": 65 },
    { "code": "4056489592068", "source": "upcitemdb", "sourceName": "UPCitemdb (trial)",   "hit": false, "durationMs": 421 }
  ],
  "summary": { "anyHit": true, "firstHit": "off", "totalDurationMs": 881 }
}
```

Read the `attempts[]` array top-to-bottom:

- **All hits are false** but the product genuinely exists → shared-IP rate limit or network flake. Jump to Step 3.
- **Open Food Facts says false, sister catalogs true** → we already prefer OFF; make sure the sister DB entry is complete enough to pass our `normaliseProduct` gate (name OR brand required).
- **UPCitemdb returns `code: "OK"` but `total: 0`** → they simply don't index this SKU. Not a bug; the "teach it once" flow is the correct outcome.

### Step 2 — Compare to a direct upstream call

If diagnose says all sources miss, curl the source directly from your machine:

```bash
curl "https://world.openfoodfacts.org/api/v2/product/4056489592068.json" | jq .status
```

- If **your machine** gets `status: 1` but **the server** doesn't, you're being rate-limited on the hosting provider's shared outbound IP. This is the most common failure mode on Vercel because many customers share the same egress IPs and Open Food Facts applies a ~10 req/min per-IP soft limit.
- If **both** miss, the product truly isn't indexed. Move to Step 4.

### Step 3 — Mitigating shared-IP rate limits

Options in ascending order of effort:

1. **Do nothing** — the "teach once, remember forever" flow (`lib/barcode-cache.js` + `UnknownBarcodeDialog`) already handles this gracefully. The cache is per-device, so a rate-limited scan that becomes a user-taught mapping never has to hit OFF again.
2. **Add server-side caching** — parking successful OFF responses in Supabase (or KV) for 24h means one hit per barcode per day is enough. See "Future work" in `docs/features/kitchen.md`.
3. **Pay for API access** — the paid tiers of go-upc / UPCitemdb / Barcode Lookup use dedicated IPs and higher limits. The lookup module already leaves comments for where to slot the keys.

### Step 4 — Recognising GS1 internal-use codes

If the barcode starts with **`02`** or **`20`–`29`**, it's a GS1-reserved *in-store* code. Supermarkets print these locally for deli labels, weighed produce, private markdowns, and their own numbered SKUs. **No public database will ever have them**, and no library / paid key will fix this. The client-side `isInternalStoreCode()` in `lib/barcode-utils.js` detects this and the dialog explains it to the user.

### Step 5 — Adding a new source

Open `lib/barcode-lookup.js` and follow the "ADDING A NEW SOURCE" checklist in the header comment. It's a one-liner in the `SOURCES` array plus a `lookupFoo()` helper. Environments that don't set the key for that source will simply skip it — no branching required at call sites.

### Step 6 — Local reproduction with the dev JWT

Even without a real user account you can hit the endpoints locally:

```js
// One-off in Node — mint a JWT that the dev fallback secret accepts:
const jwt = require('jsonwebtoken');
console.log(jwt.sign(
  { userId: 'dev-user', username: 'dev' },
  'dev-only-insecure-secret-do-not-use-in-prod',
  { expiresIn: '7d' }
));
```

Then:

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/barcode-diagnose?code=4056489592068" | jq
```

Note: this only works locally because production has a real `JWT_SECRET` in the Vercel env. Production diagnostics need a real user login.


## 🧪 A minimum reproducible bug report

When filing an issue (or asking an AI agent for help), include:

1. What you did (step-by-step, including the URL / route).
2. What you expected.
3. What actually happened (exact error message, screenshot of the Network tab, response body).
4. What you already tried.
5. Which environment (local / preview / production).

That's usually enough to skip the guessing phase and go straight to the fix.
