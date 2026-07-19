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

## 🧪 A minimum reproducible bug report

When filing an issue (or asking an AI agent for help), include:

1. What you did (step-by-step, including the URL / route).
2. What you expected.
3. What actually happened (exact error message, screenshot of the Network tab, response body).
4. What you already tried.
5. Which environment (local / preview / production).

That's usually enough to skip the guessing phase and go straight to the fix.
