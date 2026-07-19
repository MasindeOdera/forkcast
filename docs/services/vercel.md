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

> Any change to env vars requires a **redeploy** to take effect — Vercel doesn't hot-swap them.

## Deploy flow

1. Push to GitHub.
2. Vercel detects the push, runs `yarn install` → `yarn build`.
3. On success:
   - `main` → replaces production.
   - Other branches / PRs → get a unique **preview URL** you can share.
4. On failure, the deployment fails and the previous production stays live. Read the build log under **Deployments → the failed deploy → View Build Logs**.

## 🧭 Common tasks

- **See production logs**: *Deployments → Production → Runtime Logs* (server-side `console.log`s show up here).
- **Roll back**: *Deployments →* pick a previous green build → **Promote to Production**.
- **Trigger a redeploy without a commit**: *Deployments → ⋯ → Redeploy* on the latest build.
- **Check env var propagation**: *Settings → Environment Variables* → confirm the variable exists in the target environment, then redeploy.
