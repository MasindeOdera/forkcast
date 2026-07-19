# 📚 Forkcast Documentation

Welcome to the Forkcast documentation. This folder contains detailed guides organized by topic. For a high-level overview of features, see the [root README](../README.md).

## 🗺️ Structure

```
docs/
├── getting-started.md          # Set up the project locally
├── services/                   # Third-party services we depend on
│   ├── supabase.md             # Database (Postgres) — how it's used & keepalive
│   ├── cloudinary.md           # Image hosting & upload flow
│   └── vercel.md               # Deployment platform
├── workflow/                   # How we develop and collaborate
│   ├── github.md               # Branching, commits, PRs (for humans & AI agents)
│   └── contributing.md         # MVP checklist & license
├── operations/                 # Running, debugging, and managing data
│   ├── debugging.md            # Comprehensive debugging guide (frontend → backend → DB)
│   ├── database-schema.md      # Tables, columns, relationships
│   └── deployment.md           # How the app is deployed
└── reference/                  # Reference material
    ├── api-reference.md        # All API endpoints
    ├── ui-components.md        # Key React components
    └── security.md             # Auth, hashing, validation, CORS
```

## 🚀 I want to…

| Goal                                            | Start here                                              |
|-------------------------------------------------|---------------------------------------------------------|
| Run the app on my machine                       | [getting-started.md](./getting-started.md)              |
| Understand what Supabase / Cloudinary / Vercel do here | [services/](./services)                          |
| Fix or extend an API endpoint                   | [reference/api-reference.md](./reference/api-reference.md) |
| Figure out why something is broken              | [operations/debugging.md](./operations/debugging.md)    |
| Look at or edit real data                       | [operations/debugging.md](./operations/debugging.md) → "Manipulating data" |
| Open a pull request                             | [workflow/github.md](./workflow/github.md)              |
| Know why the DB "went to sleep"                 | [services/supabase.md](./services/supabase.md) → "Auto-pause & keepalive" |
