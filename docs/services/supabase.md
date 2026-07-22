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

- **Client factory**: [`/app/lib/supabase-db.js`](../../lib/supabase-db.js) — a single server-only client that uses the service role key.
- **Env vars**:
  - `NEXT_PUBLIC_SUPABASE_URL` — your project URL, e.g. `https://abcd.supabase.co`
  - `SUPABASE_SERVICE_ROLE_KEY` — full-access key, server-only
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — restricted key, safe for browser
- **Where it's used**: Every API route in `app/api/[[...path]]/route.js` imports `db` from `lib/supabase-db.js`. `db.users`, `db.meals`, and `db.meal_plans` expose Mongo-like methods (`.find`, `.findOne`, `.insertOne`, …) that internally translate to Supabase queries.

See [operations/database-schema.md](../operations/database-schema.md) for the actual tables and columns.

## 🆕 Setting up a fresh Supabase project

If you're cloning the repo and creating a new Supabase project (or resetting the current one), you need to create the tables before the app will work.

1. Create a new project at <https://supabase.com/dashboard>. Pick a region close to your users and set a strong Postgres password.
2. Grab the project URL and the two keys from **Project Settings → API** and put them in your `.env`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Open **SQL Editor → New query**, paste the contents of [`/app/db/schema.sql`](../../db/schema.sql), and run it. This creates the `users`, `meals`, and `meal_plans` tables with the right columns, defaults, and foreign keys.
4. Verify with a quick sanity query:
   ```sql
   select table_name from information_schema.tables
   where table_schema = 'public'
   order by table_name;
   ```
   You should see `meal_plans`, `meals`, `users`.
5. Hit `GET /api/health` from your running app — it should return `"db": "ok"`.

> If you add columns later, add them to `db/schema.sql` **and** run the equivalent `ALTER TABLE` in the SQL Editor. Keep the file in sync with reality so a future dev can reproduce the DB from scratch.

## 🔐 Row Level Security (RLS)

Forkcast uses the **service role key** on the server for every DB read/write, which bypasses RLS. But `NEXT_PUBLIC_SUPABASE_ANON_KEY` is **shipped inside the browser JS bundle** — anyone who inspects the deployed frontend can pull it, hit `<project>.supabase.co/rest/v1/…` directly, and read whatever the anon role is allowed to read. **With RLS off, that meant every row in every table, including the bcrypt password hashes in `users`.**

Because of this, RLS is now **ON and forced** on `users`, `meals`, and `meal_plans`, with **no permissive policies** (default-deny). See [`/app/db/schema.sql`](../../db/schema.sql) and [`/app/db/enable_rls.sql`](../../db/enable_rls.sql).

What this means in practice:

- ✅ The server (service role) continues to work unchanged — service role bypasses RLS.
- ✅ Anon and authenticated PostgREST calls get **zero rows** for these tables.
- ✅ Even direct table SELECTs from anon/authenticated are blocked (we also `REVOKE ALL` at the role level for defense in depth).
- ⚠️ **Do not add permissive policies without scoping them.** A blanket `USING (true)` policy re-opens the same hole.
- 🛡️ If you ever wire the anon key up to browser queries (Supabase realtime, direct table selects, etc.), add scoped `CREATE POLICY` statements — one per action per role, keyed off `auth.uid()`.

### If Supabase's Security Advisor is flagging this project

If **Advisors → Security** shows `rls_disabled_in_public` or `sensitive_columns_exposed`:

1. Open **SQL Editor → New query**.
2. Paste the contents of [`/app/db/enable_rls.sql`](../../db/enable_rls.sql).
3. Click **Run**. Safe to re-run — every statement is idempotent.
4. Refresh **Advisors → Security**; both Critical issues should clear.

Dashboard path: **Authentication → Policies** to view/edit policies; **Table Editor → pick table → the RLS toggle** to view the RLS state.

## 💾 Backups & recovery

What Supabase gives you depends on the plan:

| Plan     | Backups                                                                 |
|----------|-------------------------------------------------------------------------|
| Free     | Daily automated backups, retained for 7 days. **No** point-in-time recovery (PITR). |
| Pro      | Daily backups + PITR (down to the minute), retained 7 days by default.  |
| Team/Ent | Longer retention windows, physical backup downloads.                    |

Action items regardless of plan:

- **Before destructive SQL** (`DROP`, `TRUNCATE`, wide `UPDATE`s), take a manual snapshot: *Database → Backups → "Create backup now"* (Pro+) or run `pg_dump` locally against the connection string.
- **For anything close to real user data**, upgrade to Pro so you have PITR. Free-tier restore = last night's snapshot, not "5 minutes before I fat-fingered the DELETE".
- **Local backup on demand:**
  ```bash
  pg_dump "postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres" \
    --no-owner --no-privileges > forkcast-$(date +%F).sql
  ```
  Restore later with `psql <conn> < forkcast-YYYY-MM-DD.sql`.

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
2. Go to **Settings → Secrets and variables → Actions → New repository secret** and add:
   - **Name:** `HEALTHCHECK_URL`
   - **Value:** `https://<your-deployment>/api/health` (the full URL to the deployed `/api/health` endpoint — the same URL you'd `curl` from your laptop)
3. GitHub Actions must be enabled for the repo (default on for public repos; on private repos, check **Settings → Actions → General → "Allow all actions"**).
4. Trigger the workflow manually to verify: **Actions tab → "Supabase Keepalive" → "Run workflow" → Run workflow**. The run should complete green in ~5s.
5. If it fails with `HEALTHCHECK_URL secret is not set`, step 2 didn't take — re-add the secret and re-run.
6. If it fails with `Health endpoint reports DB is not OK`, the DB is paused — click **Restore project** in the Supabase dashboard, then re-run the workflow.

See [workflow/github-actions.md](../workflow/github-actions.md) for a general primer on how GitHub Actions fits into this repo.

### Option 3 — Upgrade
If you'd rather not depend on a cron, upgrading to Supabase Pro removes the auto-pause behaviour entirely.

## 🧭 Common tasks in the Supabase dashboard

- **See the data**: *Table Editor* → pick a table.
- **Run SQL**: *SQL Editor* → paste a query, hit *Run*.
- **See DB errors**: *Logs → Postgres logs* (or *Logs → API* for PostgREST-level errors).
- **Reset a user's password (dev only)**: Update the `password` column directly (it's a bcrypt hash; you can insert a known hash from a scratch script — see [operations/debugging.md](../operations/debugging.md)).
- **Reset the DB (dev only)**: *SQL Editor* → `TRUNCATE meals, meal_plans, users RESTART IDENTITY CASCADE;` — irreversible, use with care.
