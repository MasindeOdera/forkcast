-- Forkcast — Enable Row-Level Security on all public tables
--
-- WHY THIS EXISTS
-- ---------------
-- Supabase's security advisor flagged this project with:
--   • rls_disabled_in_public       — tables in `public` had RLS turned off
--   • sensitive_columns_exposed    — users.password (bcrypt hash) reachable
--                                    via the anon key
--
-- Forkcast's server code (`lib/supabase-db.js`) uses SUPABASE_SERVICE_ROLE_KEY,
-- which BYPASSES RLS entirely. So turning RLS ON with NO permissive policies
-- keeps the server working while locking out any anon/authenticated caller
-- (including anyone who scrapes NEXT_PUBLIC_SUPABASE_ANON_KEY from the
-- deployed frontend bundle).
--
-- SAFE TO RE-RUN
-- --------------
-- Every statement is idempotent (ENABLE RLS on an already-enabled table is
-- a no-op; REVOKE of a privilege that isn't granted is a no-op).
--
-- HOW TO APPLY
-- ------------
-- Supabase Dashboard → SQL Editor → New query → paste this file → Run.
-- Then re-check Advisors — the two Critical issues should clear.
--
-- WHAT THIS DOES
-- --------------
--   1. Enables and FORCES RLS on users, meals, meal_plans.
--   2. Revokes all direct-table privileges from anon + authenticated roles,
--      so even without RLS in the picture, PostgREST can't return rows.
--   3. Deliberately creates NO policies → default-deny for anon/authenticated.
--
-- The service_role role (used by the server via SUPABASE_SERVICE_ROLE_KEY)
-- keeps full access because it bypasses RLS and retains its default
-- privileges. Nothing in the app changes.

begin;

-- ---------------------------------------------------------------------------
-- 1) Turn on RLS + FORCE it (so even table owners have to obey policies;
--    service_role still bypasses RLS at the auth layer).
-- ---------------------------------------------------------------------------
alter table public.users       enable row level security;
alter table public.users       force  row level security;

alter table public.meals       enable row level security;
alter table public.meals       force  row level security;

alter table public.meal_plans  enable row level security;
alter table public.meal_plans  force  row level security;

-- ---------------------------------------------------------------------------
-- 2) Drop any legacy policies that might have been left behind from earlier
--    experiments. We want a clean default-deny state.
-- ---------------------------------------------------------------------------
do $$
declare
    r record;
begin
    for r in
        select schemaname, tablename, policyname
        from   pg_policies
        where  schemaname = 'public'
          and  tablename in ('users', 'meals', 'meal_plans')
    loop
        execute format(
            'drop policy if exists %I on %I.%I',
            r.policyname, r.schemaname, r.tablename
        );
    end loop;
end$$;

-- ---------------------------------------------------------------------------
-- 3) Belt-and-suspenders: revoke table-level privileges from the two roles
--    the anon key and any signed-in user can assume via PostgREST.
--    Service role is unaffected.
-- ---------------------------------------------------------------------------
revoke all on public.users       from anon, authenticated;
revoke all on public.meals       from anon, authenticated;
revoke all on public.meal_plans  from anon, authenticated;

-- Sequences (if any get added later — currently none, since we use UUIDs).

-- ---------------------------------------------------------------------------
-- 4) No CREATE POLICY statements → default-deny. If we ever expose the anon
--    key to the browser for direct queries (realtime, etc.), add scoped
--    policies here — one CREATE POLICY per action (SELECT/INSERT/UPDATE/DELETE)
--    per role, keyed off auth.uid().
-- ---------------------------------------------------------------------------

commit;

-- ---------------------------------------------------------------------------
-- Verification queries (run these after the COMMIT above)
-- ---------------------------------------------------------------------------
--   -- Should show rowsecurity = t and forcerowsecurity = t for all three:
--   select schemaname, tablename, rowsecurity, forcerowsecurity
--   from   pg_tables
--   where  schemaname = 'public'
--     and  tablename in ('users', 'meals', 'meal_plans');
--
--   -- Should return zero rows (no policies = default-deny):
--   select schemaname, tablename, policyname
--   from   pg_policies
--   where  schemaname = 'public'
--     and  tablename in ('users', 'meals', 'meal_plans');
--
-- After running, open Supabase → Advisors → Security and the two Critical
-- issues (rls_disabled_in_public, sensitive_columns_exposed) should be gone.
