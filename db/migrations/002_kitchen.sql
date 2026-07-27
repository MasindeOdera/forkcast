-- Forkcast — Migration 002: Kitchen (pantry + shopping list)
--
-- Adds two new tables backing the /kitchen feature:
--   * pantry_items         — ingredients the user has at home
--   * shopping_list_items  — items the user needs to buy for the week
--
-- Run this in the Supabase SQL Editor once. Safe to re-run (uses IF NOT
-- EXISTS). RLS is enabled + forced with default-deny, matching the rest of
-- the schema (server uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS).
--
-- See docs/features/kitchen.md for the product logic and
-- docs/operations/database-schema.md for the full schema map.

-- ---------------------------------------------------------------------------
-- pantry_items
-- ---------------------------------------------------------------------------
-- One row per ingredient the user has stocked. Barcode is nullable because
-- users can add items manually (no scanner needed). expires_at is nullable
-- because non-perishables (e.g. rice) don't have a meaningful expiry.
create table if not exists public.pantry_items (
    id          uuid            primary key default gen_random_uuid(),
    user_id     uuid            not null references public.users(id) on delete cascade,
    name        text            not null,
    barcode     text,
    quantity    numeric,
    unit        text,
    expires_at  date,
    added_at    timestamptz     not null default now()
);

create index if not exists pantry_items_user_id_idx    on public.pantry_items (user_id);
create index if not exists pantry_items_expires_at_idx on public.pantry_items (expires_at)
    where expires_at is not null;

-- Trigram index so the AI-Ideas prompt can quickly fuzzy-match pantry names
-- against recipe ingredients client-side, and so future search stays cheap.
create index if not exists pantry_items_name_trgm_idx on public.pantry_items
    using gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- shopping_list_items
-- ---------------------------------------------------------------------------
-- One row per line on the shopping list. `source_meal_id` is nullable
-- because users can add items manually (e.g. "toothpaste") that aren't
-- tied to any planned meal. `checked` toggles when the user ticks the box
-- (manually) or when the scanner recognises a barcode that matches the
-- item's name.
create table if not exists public.shopping_list_items (
    id             uuid            primary key default gen_random_uuid(),
    user_id        uuid            not null references public.users(id) on delete cascade,
    name           text            not null,
    checked        boolean         not null default false,
    source_meal_id uuid            references public.meals(id) on delete set null,
    added_at       timestamptz     not null default now()
);

create index if not exists shopping_list_items_user_id_idx on public.shopping_list_items (user_id);
create index if not exists shopping_list_items_checked_idx on public.shopping_list_items (user_id, checked);

-- ---------------------------------------------------------------------------
-- Row Level Security — default deny, service-role bypasses
-- ---------------------------------------------------------------------------
alter table public.pantry_items         enable row level security;
alter table public.pantry_items         force  row level security;
alter table public.shopping_list_items  enable row level security;
alter table public.shopping_list_items  force  row level security;

revoke all on public.pantry_items        from anon, authenticated;
revoke all on public.shopping_list_items from anon, authenticated;

-- End of migration 002.
