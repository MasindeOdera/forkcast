# 🐙 GitHub Workflow

This document defines how we develop, review, and merge code in Forkcast. It applies to **both human developers and AI coding agents** working on the repo.

The goals are:
1. **Best practices** — keep the codebase readable and easy to change.
2. **Codebase awareness** — read before writing; don't propose changes that fight existing patterns.
3. **Scalability** — small, reviewable increments that don't paint us into a corner.

---

## 🌿 Branching

- `main` is always deployable. **Never commit directly to `main`.**
- Create a branch per unit of work. Naming:
  - `feat/<short-description>` — new feature
  - `fix/<short-description>` — bug fix
  - `chore/<short-description>` — tooling, deps, docs
  - `refactor/<short-description>` — no behaviour change

Example: `feat/meal-plan-drag-drop`, `fix/cloudinary-upload-timeout`.

## ✏️ Commits

Use short, present-tense messages that describe **what changed and why**. Prefix with the type from above when it helps:

```
feat: add gallery images to MealForm
fix: reject Cloudinary uploads above 10MB before hitting the API
chore: bump next to 14.2.3
docs: split README into docs/ folder
```

One logical change per commit. If you did two unrelated things, make two commits.

## 🔃 Pull Requests

Every change ships via a PR into `main`. A good PR:

- Has a **clear title** (same style as commit messages).
- Explains **what** and **why** in the description — not just *what* the diff shows.
- Links any related issue.
- Includes screenshots or a short clip for UI changes.
- Stays small (aim for < 400 lines diff). Split large work into multiple PRs.

### PR checklist (paste into the description)

```
- [ ] I read the existing code in the files I'm changing before editing.
- [ ] I ran `yarn dev` locally and manually tested the change.
- [ ] I hit any affected API endpoint(s) at least once (see docs/operations/debugging.md).
- [ ] I did not introduce hardcoded URLs, ports, or secrets.
- [ ] I updated relevant docs under `docs/` if behaviour or setup changed.
- [ ] The diff only contains changes needed for this PR (no drive-by refactors).
```

## 🤖 Rules for AI agents working on this repo

AI coding assistants are welcome, but they **must** follow the rules below. These exist so the codebase stays coherent as it grows.

### 1. Read before you write
Before proposing a change, the agent must:
- Read the file(s) it's about to modify.
- Grep for existing usages of any function/component it's touching.
- Check `docs/` for existing conventions on the topic (e.g. don't invent a new upload flow — see `docs/services/cloudinary.md`).

### 2. Match existing patterns
- Use the existing DB helper (`db.users`, `db.meals`, …) — don't call `supabaseAdmin` directly from route handlers unless there's no equivalent helper.
- Reuse existing UI primitives from `components/ui/*` — don't add a new dialog library.
- Follow the file layout already in place. New API routes go under `app/api/…/route.js`.

### 3. Prefer small, reversible changes
- No mass refactors bundled with a feature.
- No renames of public API surfaces without a migration note.
- No dependency additions without justifying why an existing dep can't do the job.

### 4. Keep it scalable
- If a piece of logic is used in more than one place, extract it to `lib/` — don't copy-paste.
- Server-only code stays out of `'use client'` files.
- Never leak the `SUPABASE_SERVICE_ROLE_KEY` or `CLOUDINARY_API_SECRET` into any file that runs in the browser (i.e. anything imported by a `'use client'` module).
- Add an index or a query filter before adding pagination hacks. Postgres will thank you.

### 5. Never do
- Commit `.env` or any file containing real credentials.
- Force-push to `main` or rewrite shared history.
- Modify `.git/` or `.emergent/` directories.
- Introduce Mongo `ObjectId` values — we use UUIDs everywhere.
- Skip the PR flow "because it's a small change".

### 6. When unsure
- Open a **draft PR** with a description of the intended approach and ask for review before finishing the implementation.
- Or open an issue titled `[question] …` describing the ambiguity.
