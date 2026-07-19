# ▲ Vercel (Hosting)

**Vercel** is the platform that runs the deployed Next.js app. It builds the project from GitHub, hosts the frontend, and runs the API routes as serverless functions.

## Why Vercel?

- First-class Next.js support (built by the same company).
- Automatic HTTPS, CDN, and preview deployments per PR.
- Serverless functions for `/api/*` routes with generous free-tier limits.
- Zero-config once the repo is connected — every push to `main` deploys.

## How Forkcast is configured for Vercel

The project supports two build modes and switches automatically:

- **Local / Docker / Emergent preview**: `next.config.js` sets `output: 'standalone'` for a self-contained Node server.
- **Vercel**: When the `VERCEL` env var is present at build time, `standalone` is disabled — Vercel supplies its own runtime and injects env vars via `process.env`, so a standalone bundle would actually fail with `EnvFileReadError`.

See [`/app/next.config.js`](../../next.config.js).

## Environment variables on Vercel

Every variable from your local `.env` must be added in **Vercel → Project → Settings → Environment Variables**, scoped as appropriate:

| Variable                              | Environment scope       |
|---------------------------------------|-------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`            | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY`           | Production, Preview     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`       | Production, Preview, Development |
| `NEXT_PUBLIC_BASE_URL`                | Production, Preview     |
| `JWT_SECRET`                          | Production, Preview     |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`   | Production, Preview, Development |
| `CLOUDINARY_API_KEY`                  | Production, Preview     |
| `CLOUDINARY_API_SECRET`               | Production, Preview     |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`| Production, Preview, Development |
| `EMERGENT_LLM_KEY`                    | Production, Preview     |

### ⚠️ `NEXT_PUBLIC_*` vars are baked in at **build time**

This is the single most common Vercel gotcha, so it deserves its own section.

- Any variable prefixed with `NEXT_PUBLIC_` is **inlined into the JavaScript bundle at build time**, because it needs to be available in the browser. It's not read from the environment at runtime.
- Any variable **without** the prefix is server-only and *is* read from `process.env` at runtime.

Practical consequences:

| You changed…                        | To take effect you need…                                             |
|-------------------------------------|----------------------------------------------------------------------|
| A `NEXT_PUBLIC_*` variable          | A **new build** — either push a commit, or *Deployments → ⋯ → Redeploy* **with "Use existing Build Cache" turned OFF**. A plain "Redeploy" of the same commit does *not* rebuild the client bundle by default. |
| A server-only variable              | Just a redeploy is enough (or sometimes even a function cold start). |
| Both                                | Do a full clean redeploy to be safe.                                 |

If you find the site "still using the old Cloudinary cloud name" after updating env vars, this is why.

## Deploy flow

1. Push to GitHub.
2. Vercel detects the push, runs `yarn install` → `yarn build`.
3. On success:
   - `main` → replaces production.
   - Other branches / PRs → get a unique **preview URL** you can share.
4. On failure, the deployment fails and the previous production stays live. Read the build log under **Deployments → the failed deploy → View Build Logs**.

## 🌐 Custom domains

By default, Vercel gives every project an auto-generated domain like `forkcast-six.vercel.app` (the `-six` suffix is Vercel picking a random word to disambiguate). This is fine for demos but usually not what you want long-term.

To add a custom domain:

1. In Vercel: **Project → Settings → Domains → Add**.
2. Type the domain (e.g. `forkcast.app` or `app.mydomain.com`) and click **Add**.
3. Vercel shows you DNS records to create at your registrar:
   - **Apex domain** (e.g. `forkcast.app`): one **A record** → `76.76.21.21`.
   - **Subdomain** (e.g. `app.mydomain.com`): one **CNAME** → `cname.vercel-dns.com`.
4. Wait for DNS to propagate (usually minutes; occasionally hours). Vercel provisions the HTTPS certificate automatically via Let's Encrypt.
5. Once verified:
   - Update `NEXT_PUBLIC_BASE_URL` to point at the new domain and redeploy.
   - Update `HEALTHCHECK_URL` in the GitHub Actions secrets so the keepalive hits the right host.
   - Update any hardcoded links in docs.

You can also set one domain as **primary** so the others 308-redirect to it — useful if you want `www.forkcast.app` to redirect to `forkcast.app`.

## 🧭 Common tasks

- **See production logs**: *Deployments → Production → Runtime Logs* (server-side `console.log`s show up here).
- **Roll back**: *Deployments →* pick a previous green build → **Promote to Production**.
- **Trigger a redeploy without a commit**: *Deployments → ⋯ → Redeploy* on the latest build. Uncheck **"Use existing Build Cache"** if you changed `NEXT_PUBLIC_*` env vars.
- **Check env var propagation**: *Settings → Environment Variables* → confirm the variable exists in the target environment, then redeploy.
