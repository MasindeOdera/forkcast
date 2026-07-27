# 📚 Forkcast Documentation

Welcome to the Forkcast documentation. This folder contains detailed guides organized by topic. For a high-level overview of features, see the [root README](../README.md).

## 🗺️ Structure

```
docs/
├── getting-started.md          # Set up the project locally
├── services/                   # Third-party services we depend on
│   ├── supabase.md             # Database (Postgres) — usage, RLS, backups, keepalive
│   ├── cloudinary.md           # Image hosting, upload preset, transformations
│   ├── vercel.md               # Deployment platform, env vars, custom domains
│   └── emergent-llm.md         # AI provider for meal suggestions
├── workflow/                   # How we develop and collaborate
│   ├── github.md               # Branching, commits, PRs (for humans & AI agents)
│   ├── github-actions.md       # CI/CD basics + keepalive workflow
│   └── contributing.md         # MVP checklist & license
├── operations/                 # Running, debugging, and managing data
│   ├── debugging.md            # Comprehensive debugging guide (frontend → backend → DB)
│   ├── database-schema.md      # Tables, columns, relationships
│   └── deployment.md           # How the app is deployed
├── features/                   # Product features that span multiple files
│   ├── kitchen.md              # Shopping list + Pantry + barcode scanner
│   └── plan-sharing.md         # Phone-to-phone plan sharing (Native Share / QR / v2 BLE)
├── native/                     # Wrapping Forkcast as a native app
│   └── capacitor-setup.md      # Adding Capacitor for iOS / Android + native BLE + native scanner
└── reference/                  # Reference material
    ├── api-reference.md        # All API endpoints
    ├── ui-components.md        # Key React components
    └── security.md             # Auth, hashing, validation, CORS
```

Related files at the repo root:

- [`AGENTS.md`](../AGENTS.md) — discovery file for AI coding assistants; points them at `docs/workflow/github.md`.
- [`db/schema.sql`](../db/schema.sql) — runnable Postgres schema for a fresh Supabase project.
- [`db/migrations/`](../db/migrations/) — additive migrations you apply to an existing project.
- [`capacitor.config.json`](../capacitor.config.json) — Capacitor config; see [native/capacitor-setup.md](./native/capacitor-setup.md).
- [`.github/workflows/supabase-keepalive.yml`](../.github/workflows/supabase-keepalive.yml) — the cron that keeps Supabase from auto-pausing.

## 🚀 I want to…

| Goal                                            | Start here                                              |
|-------------------------------------------------|---------------------------------------------------------|
| Run the app on my machine                       | [getting-started.md](./getting-started.md)              |
| Understand what Supabase / Cloudinary / Vercel / Emergent LLM do here | [services/](./services)         |
| Fix or extend an API endpoint                   | [reference/api-reference.md](./reference/api-reference.md) |
| Add the Kitchen (Pantry + Shopping) feature     | [features/kitchen.md](./features/kitchen.md)            |
| Share a meal plan phone-to-phone                | [features/plan-sharing.md](./features/plan-sharing.md)  |
| Wrap Forkcast as an iOS / Android app           | [native/capacitor-setup.md](./native/capacitor-setup.md)|
| Figure out why something is broken              | [operations/debugging.md](./operations/debugging.md)    |
| Look at or edit real data                       | [operations/debugging.md](./operations/debugging.md) → "Manipulating data" |
| Open a pull request                             | [workflow/github.md](./workflow/github.md)              |
| Understand our CI / cron jobs                   | [workflow/github-actions.md](./workflow/github-actions.md) |
| Know why the DB "went to sleep"                 | [services/supabase.md](./services/supabase.md) → "Auto-pause & keepalive" |
| Set up a brand-new Supabase project             | [services/supabase.md](./services/supabase.md) → "Setting up a fresh Supabase project" |
