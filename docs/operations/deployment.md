# 🚀 Deployment

Forkcast is designed to be deployed to **Vercel** (see [services/vercel.md](../services/vercel.md) for the full explanation of why and how).

The live URL for the current deployment is whatever `NEXT_PUBLIC_BASE_URL` points to in your production env vars.

## Steps for a fresh deploy

1. Push the repository to GitHub.
2. Import the repo in Vercel (**Add New → Project → Import Git Repository**).
3. Add every env var listed in [services/vercel.md](../services/vercel.md) → "Environment variables on Vercel".
4. Click **Deploy**. Vercel will run `yarn install` and `yarn build`.
5. Once green, share the production URL. Every subsequent push to `main` redeploys automatically; PRs get preview URLs.

## Self-hosting / local production build

If you'd rather run it yourself (Docker, VPS, Emergent preview, …):

```bash
yarn build
yarn start
```

Because `VERCEL` is not set, `next.config.js` falls back to `output: 'standalone'` and produces a self-contained Node server under `.next/standalone`. Point a process manager (systemd, supervisor, pm2) at it and expose port 3000.

## Post-deploy checks

1. Open the site — the login page should render.
2. `GET /api/health` should return `200` with a `db: "ok"` field. If it doesn't, jump to [operations/debugging.md](./debugging.md).
3. Register a throwaway user and create a meal to smoke-test the auth + upload + DB path end to end.
