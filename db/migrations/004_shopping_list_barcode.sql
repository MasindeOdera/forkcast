-- Forkcast — Migration 004: Shopping-list barcode column
--
-- Adds a `barcode` column to `public.shopping_list_items` so scanned
-- items can carry their code alongside the product name — matching the
-- existing behaviour of `public.pantry_items`. Motivation: user asked
-- for feature parity ("The goal is to also have it appear in the
-- list") and reported that scanning the same barcode twice into the
-- shopping list produced confusing "did anything happen?" outcomes.
--
-- Also enables a deterministic match-by-barcode dedup path in the
-- client (see components/kitchen/ShoppingList.js
-- tickOffByProductName): with a stored barcode we can find an existing
-- item without relying on OFF returning the exact same product_name
-- between two scans, which was the root cause of "8710437003216 not
-- displaying" — the item WAS added the first time, ticked off on the
-- second scan via name match, and moved to the "Already in the cart"
-- section where the user missed it.
--
-- Nullable because manually-added items (typed name only) have no
-- barcode. Not unique because the same product can legitimately appear
-- twice on a list (e.g. "buy 2 bottles of milk") — the dedup /
-- tick-off decision is a UX choice, not a data-integrity one, so it
-- lives on the client.
--
-- Run in Supabase SQL Editor. Safe to re-run (uses `if not exists`
-- semantics via a guarded DO block since ADD COLUMN doesn't accept
-- that clause pre-PG 15 — see the block below).

do $$
begin
    if not exists (
        select 1
        from   information_schema.columns
        where  table_schema = 'public'
        and    table_name   = 'shopping_list_items'
        and    column_name  = 'barcode'
    ) then
        alter table public.shopping_list_items add column barcode text;
    end if;
end
$$;

-- Column comment. Kept OUTSIDE the DO block because COMMENT ON only
-- accepts a plain string literal (no `||` concatenation inside the
-- IS clause), and it's idempotent by nature — re-running just
-- overwrites the existing comment. Wrap it in an IF-column-exists
-- guard so this whole file remains safe to re-run even against a
-- pristine DB that hasn't yet had the ALTER TABLE above execute.
do $$
begin
    if exists (
        select 1
        from   information_schema.columns
        where  table_schema = 'public'
        and    table_name   = 'shopping_list_items'
        and    column_name  = 'barcode'
    ) then
        comment on column public.shopping_list_items.barcode is
            'Nullable. Populated by scans via /api/shopping-list POST when the scanner resolves a product; NULL for manually-typed items. See migration 004.';
    end if;
end
$$;

-- Non-unique index so the client can look up "do I already have this
-- barcode on my list?" cheaply. Filtered index keeps it tiny — we
-- never search for `barcode is null` rows.
create index if not exists shopping_list_items_user_barcode_idx
    on public.shopping_list_items (user_id, barcode)
    where barcode is not null;

-- End of migration 004.
