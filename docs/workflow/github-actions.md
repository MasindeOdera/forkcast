# ⚙️ GitHub Actions

GitHub Actions is GitHub's built-in CI/CD system. It runs YAML-defined workflows on triggers like "push to main", "pull request opened", or "on a schedule". This doc explains how it fits into Forkcast.

## What we use it for today

Exactly one workflow: **Supabase keepalive**.

- **File**: [`.github/workflows/supabase-keepalive.yml`](../../.github/workflows/supabase-keepalive.yml)
- **Trigger**: cron `0 9 */3 * *` (every 3 days at 09:00 UTC), plus a manual **Run workflow** button.
- **What it does**: `curl`s `GET /api/health` and fails the job if the response body doesn't contain `"db":"ok"`.
- **Why**: Supabase's free tier auto-pauses a project after ~7 days of inactivity. Pinging every 3 days keeps it awake. See [services/supabase.md → Auto-pause & keepalive](../services/supabase.md#-auto-pause--keepalive-important).

## Secrets

Workflows access secrets via `${{ secrets.NAME }}`. Ours needs one:

| Secret name         | Value                                              |
|---------------------|----------------------------------------------------|
| `HEALTHCHECK_URL`   | `https://<your-deployment>/api/health`             |

Add it under **Repo → Settings → Secrets and variables → Actions → New repository secret**.

### Secret scoping tips
- **Repository secrets** are available to all workflows in the repo.
- **Environment secrets** (Settings → Environments) let you scope a secret to `production`, `preview`, etc., and even require manual approval before a job that uses them runs. Overkill for the keepalive but useful if we ever add a deploy-from-CI workflow.
- **Never** echo a secret in a workflow step — GitHub masks known secrets in logs, but only if they were passed via the `secrets` context. `echo "$SOMETHING"` where you built the value yourself may leak.

## Running & inspecting workflows

- **See runs**: Repo → **Actions** tab → pick a workflow on the left → click a run to see per-step logs.
- **Run manually**: On any workflow with `workflow_dispatch:` in its triggers (ours has it), the **Run workflow** button appears in the top-right. Handy for verifying setup without waiting for the cron.
- **Disable temporarily**: Actions tab → select the workflow → **⋯ → Disable workflow**. This stops the cron without deleting the file.
- **Skip a specific commit**: put `[skip ci]` in the commit message.

## Notifications on failure

By default, GitHub emails the person who last edited the workflow file when a scheduled run fails. Two ways to widen that:

- **Watch → Custom → Actions**: subscribes you to workflow failure notifications.
- **Add a notification step** in the workflow (Slack webhook, Discord webhook, email) that only runs `if: failure()`.

Since the keepalive is intentionally noisy on failure (the DB is asleep and users are broken), we treat a failed run as an actionable alert.

## Adding a new workflow — conventions

When you add a workflow, follow these to keep things consistent:

1. **One workflow, one purpose**. Don't chain "lint + deploy + notify Slack" into one giant YAML — split into jobs, or into separate workflows that trigger each other.
2. **Name it clearly**: file name in kebab-case (`lint-and-test.yml`), `name:` field human-readable.
3. **Pin actions to versions**: `uses: actions/checkout@v4`, not `@main`. Version pinning avoids silent breakage when the action updates.
4. **`workflow_dispatch:`** — include this trigger on almost any workflow so you can manually re-run it during debugging.
5. **Fail loud**: use `set -euo pipefail` in bash steps, don't swallow non-zero exit codes with `|| true` unless you really mean it.
6. **Document**: add a comment block at the top of the file explaining *what* the workflow does, *why*, and any secrets it needs.

## Debugging a failing workflow

1. Open the failed run and expand the failing step — GitHub shows the exact command and its output.
2. If the failure is intermittent, re-run just the failed job: **⋯ → Re-run failed jobs**.
3. If the workflow uses secrets, verify they exist and are non-empty (a common failure mode is a workflow trying `${{ secrets.MISSING }}` which silently expands to empty string).
4. To reproduce locally, install [`act`](https://github.com/nektos/act) — it runs GitHub Actions workflows in Docker.
5. If you suspect the runner environment, temporarily add a debug step:
   ```yaml
   - name: Debug
     run: |
       env | sort
       whoami
       pwd
       ls -la
   ```
   Remove it after the fix.
