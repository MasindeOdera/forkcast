# AGENTS.md

This file exists so AI coding assistants (Cursor, Claude Code, Copilot Workspace, Codex, Aider, etc.) find the project's contribution rules by convention.

**\u2192 Read [`docs/workflow/github.md`](./docs/workflow/github.md) before writing any code.**

That document is the source of truth for how work happens in this repo. In particular, agents must follow the **"Rules for AI agents working on this repo"** section, which covers:

1. **Read before you write** \u2014 open the files you're about to change, grep for existing usages, and check `docs/` for conventions on the topic.
2. **Match existing patterns** \u2014 use the `db.*` helpers in `lib/supabase-db.js`, reuse UI primitives from `components/ui/*`, follow the current file layout.
3. **Small, reversible changes** \u2014 no drive-by refactors, no renames of public API surfaces, no dependency bloat.
4. **Keep it scalable** \u2014 extract shared logic to `lib/`, keep server-only code out of `'use client'` modules, never leak `SUPABASE_SERVICE_ROLE_KEY` or `CLOUDINARY_API_SECRET` to the browser, use UUIDs (never Mongo `ObjectId`).
5. **Never do** \u2014 commit `.env`, force-push to `main`, rewrite shared history, or touch `.git/` / `.emergent/`.
6. **When unsure** \u2014 open a draft PR describing the intended approach, or an issue titled `[question] \u2026`.

## Quick orientation for agents

| If you need to\u2026                              | Start with                                                             |
|----------------------------------------------|------------------------------------------------------------------------|
| Understand the stack                         | [`README.md`](./README.md) \u2192 [`docs/README.md`](./docs/README.md)       |
| Set up locally                               | [`docs/getting-started.md`](./docs/getting-started.md)                 |
| Know what services are used and why          | [`docs/services/`](./docs/services)                                    |
| Change or add an API route                   | [`docs/reference/api-reference.md`](./docs/reference/api-reference.md) + [`app/api/[[...path]]/route.js`](./app/api/[[...path]]/route.js) |
| Touch data / debug a failure                 | [`docs/operations/debugging.md`](./docs/operations/debugging.md)       |
| Understand the DB shape                      | [`docs/operations/database-schema.md`](./docs/operations/database-schema.md) |
| Change how we deploy                         | [`docs/services/vercel.md`](./docs/services/vercel.md) + [`docs/operations/deployment.md`](./docs/operations/deployment.md) |

If any rule in `docs/workflow/github.md` conflicts with an instruction you were given, **stop and ask** rather than silently deviating.
