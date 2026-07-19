# 🚀 Getting Started

This guide walks you through setting up Forkcast for local development.

## Prerequisites
- **Node.js 18+** and **Yarn**
- A **Supabase** project (free tier works — see [services/supabase.md](./services/supabase.md))
- A **Cloudinary** account (free tier works — see [services/cloudinary.md](./services/cloudinary.md))
- An **Emergent LLM key** (for AI meal suggestions)

## Environment Setup

### 1. Install dependencies

```bash
cd /app
yarn install
```

> Always use **yarn**, not npm. Mixing lockfiles will cause dependency drift.

### 2. Environment Variables

Create a `.env` file in the project root with the following keys. Placeholder values are shown — replace them with your own.

```env
# --- Supabase (Postgres) ---
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>          # server-only, keep secret
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>              # safe to expose

# --- Application ---
NEXT_PUBLIC_BASE_URL=https://your-deployment-url.example.com
JWT_SECRET=<a-long-random-string>

# --- Cloudinary (Image Upload) ---
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=Forkcast

# --- AI Features ---
EMERGENT_LLM_KEY=<emergent-llm-key>
```

> ⚠️ **Never** commit real secrets to git. `.env` is gitignored — keep it that way.
> Anything prefixed with `NEXT_PUBLIC_` is shipped to the browser; everything else stays server-side only.

### 3. Start the development server

```bash
yarn dev
```

### 4. Verify it works

- Open `http://localhost:3000` in a browser.
- Hit the health endpoint to confirm the DB is reachable: `GET /api/health`.
- See [operations/debugging.md](./operations/debugging.md) if anything looks off.
