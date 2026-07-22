-- Forkcast — Supabase (Postgres) schema
--
-- Run this in the Supabase SQL Editor once, in a fresh project, to create
-- every table Forkcast expects. Safe to re-run: uses IF NOT EXISTS.
--
-- See docs/services/supabase.md and docs/operations/database-schema.md.

-- Ensure UUID generation is available (available by default on Supabase, but
-- being explicit lets this file work on any Postgres 13+).
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create table if not exists public.users (
    id          uuid            primary key default gen_random_uuid(),
    username    text            not null unique,
    password    text            not null,  -- bcrypt hash, never plaintext
    created_at  timestamptz     not null default now()
);

create index if not exists users_username_idx on public.users (username);

-- ---------------------------------------------------------------------------
-- meals
-- ---------------------------------------------------------------------------
create table if not exists public.meals (
    id              uuid            primary key default gen_random_uuid(),
    user_id         uuid            not null references public.users(id) on delete cascade,
    title           text            not null,
    ingredients     text            not null default '',
    instructions    text            not null default '',
    image_url       text,
    gallery_images  text,           -- JSON-encoded array of Cloudinary URLs
    created_at      timestamptz     not null default now(),
    updated_at      timestamptz     not null default now()
);

create index if not exists meals_user_id_idx    on public.meals (user_id);
create index if not exists meals_created_at_idx on public.meals (created_at desc);

-- Trigram index for cheap ILIKE search on meal fields. Requires pg_trgm.
create extension if not exists pg_trgm;
create index if not exists meals_title_trgm_idx        on public.meals using gin (title        gin_trgm_ops);
create index if not exists meals_ingredients_trgm_idx  on public.meals using gin (ingredients  gin_trgm_ops);
create index if not exists meals_instructions_trgm_idx on public.meals using gin (instructions gin_trgm_ops);

-- Auto-bump updated_at on any UPDATE.
create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists meals_set_updated_at on public.meals;
create trigger meals_set_updated_at
    before update on public.meals
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- meal_plans
-- ---------------------------------------------------------------------------
create table if not exists public.meal_plans (
    id           uuid            primary key default gen_random_uuid(),
    user_id      uuid            not null references public.users(id) on delete cascade,
    meal_id      uuid            not null references public.meals(id) on delete cascade,
    planned_for  date            not null,
    created_at   timestamptz     not null default now()
);

create index if not exists meal_plans_user_id_idx     on public.meal_plans (user_id);
create index if not exists meal_plans_planned_for_idx on public.meal_plans (planned_for);
create unique index if not exists meal_plans_unique_per_day
    on public.meal_plans (user_id, meal_id, planned_for);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Forkcast's server accesses these tables with the SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS. But NEXT_PUBLIC_SUPABASE_ANON_KEY ships in the browser
-- bundle, and without RLS anyone could hit PostgREST with that anon key and
-- read every row (including users.password bcrypt hashes).
--
-- We therefore enable + FORCE RLS on all three tables with NO permissive
-- policies (default-deny). The server keeps working; anon/authenticated get
-- zero rows. If you ever wire the anon key up to browser queries, add
-- scoped CREATE POLICY statements below, keyed off auth.uid().
--
-- See docs/services/supabase.md → "Row Level Security" for the reasoning.

alter table public.users       enable row level security;
alter table public.users       force  row level security;

alter table public.meals       enable row level security;
alter table public.meals       force  row level security;

alter table public.meal_plans  enable row level security;
alter table public.meal_plans  force  row level security;

-- Extra hardening: revoke direct-table privileges from the two PostgREST
-- roles the anon key and any authenticated JWT can assume. Belt-and-
-- suspenders vs RLS. service_role keeps full access.
revoke all on public.users       from anon, authenticated;
revoke all on public.meals       from anon, authenticated;
revoke all on public.meal_plans  from anon, authenticated;

-- End of schema.
