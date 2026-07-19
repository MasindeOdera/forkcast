# 🗄️ Supabase (Postgres)

Forkcast uses **Supabase** as its primary database. Supabase is a hosted Postgres service that also provides authentication, storage, and realtime features — we currently use it for the **Postgres database only**.

## Why Supabase?

| Concern           | What Supabase gives us                                       |
|-------------------|--------------------------------------------------------------|
| Storage           | Managed Postgres (SQL, relational, ACID)                     |
| Access            | REST + client SDK (`@supabase/supabase-js`)                  |
| Authorization     | Service-role key for server-side full access; anon key for browser access with Row Level Security |
| Ops               | Web dashboard with Table Editor, SQL Editor, and Logs        |

We use the **service role key** on the server (inside `/app/api/*` routes) to bypass Row Level Security. This key must **never** reach the browser.

## How it's wired up

- **Client factory**: [`/app/lib/supabase.js`](../../lib/supabase.js) and [`/app/lib/supabase-db.js`](../../lib/supabase-db.js)
- **Env vars**:
  - `NEXT_PUBLIC_SUPABASE_URL` — your project URL, e.g. `https://abcd.supabase.co`
  - `SUPABASE_SERVICE_ROLE_KEY` — full-access key, server-only
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — restricted key, safe for browser
- **Where it's used**: Every API route in `app/api/[[...path]]/route.js` imports `db` from `lib/supabase-db.js`. `db.users`, `db.meals`, and `db.meal_plans` expose Mongo-like methods (`.find`, `.findOne`, `.insertOne`, …) that internally translate to Supabase queries.

See [operations/database-schema.md](../operations/database-schema.md) for the actual tables and columns.

## 💤 Auto-pause & keepalive (important!)

**Supabase free-tier projects auto-pause after ~7 days of inactivity.** When paused, every API call to the database fails until someone clicks *Restore project* in the Supabase dashboard. This is why the app can appear to "randomly die" after a quiet week.

### Option 1 — Restore manually (one-off)
1. Log into <https://supabase.com/dashboard>
2. Open the Forkcast project
3. Click **Restore project** (usually a big yellow banner)
4. Wait ~1 minute for Postgres to come back online

### Option 2 — Prevent it (recommended)

We ship two things that together keep the project awake:

1. **`GET /api/health`** — a lightweight endpoint that runs a trivial Supabase query. Any successful hit counts as "activity" and resets the inactivity timer. See [`app/api/health/route.js`](../../app/api/health/route.js).
2. **A GitHub Actions cron** — [`.github/workflows/supabase-keepalive.yml`](../../.github/workflows/supabase-keepalive.yml) pings that endpoint every ~3 days. Well under the 7-day pause threshold, so the project never idles out.

#### To enable the cron on your fork:
1. Push the repo to GitHub.
2. Go to **Settings → Secrets and variables → Actions** and add a secret:
   - `HEALTHCHECK_URL` = `https://<your-deployment>/api/health`
3. GitHub Actions must be enabled for the repo (it is by default on public repos; for private repos you may need to enable it explicitly).
4. You can manually trigger the workflow from the **Actions** tab ("Run workflow") to verify it works.

### Option 3 — Upgrade
If you'd rather not depend on a cron, upgrading to Supabase Pro removes the auto-pause behaviour entirely.

## 🧭 Common tasks in the Supabase dashboard

- **See the data**: *Table Editor* → pick a table.
- **Run SQL**: *SQL Editor* → paste a query, hit *Run*.
- **See DB errors**: *Logs → Postgres logs* (or *Logs → API* for PostgREST-level errors).
- **Reset a user's password (dev only)**: Update the `password` column directly (it's a bcrypt hash; you can insert a known hash from a scratch script — see [operations/debugging.md](../operations/debugging.md)).
- **Reset the DB (dev only)**: *SQL Editor* → `TRUNCATE meals, meal_plans, users RESTART IDENTITY CASCADE;` — irreversible, use with care.
