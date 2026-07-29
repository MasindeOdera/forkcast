-- Forkcast — Migration 003: Barcode cache
--
-- Adds a shared, cross-user cache for barcode → product lookups. This
-- exists to solve the "Open Food Facts rate-limits Vercel's shared
-- outbound IP" problem: without a cache every scan hits OFF from a
-- pool of IPs that OFF often throttles, so real users see "unknown"
-- for products that clearly exist. Once ANY user has scanned a
-- product, every subsequent scan by any user resolves in ~30ms from
-- Postgres without touching the internet.
--
-- Design notes:
--   * The cache is GLOBAL (not per-user). A barcode → product mapping
--     is universal knowledge — there is no privacy or personalisation
--     concern with sharing it between users. Same rationale as why
--     Open Food Facts itself is a public database.
--   * We cache BOTH hits and misses. Misses get a shorter TTL (7 days)
--     so we don't hammer OFF for a product they haven't ingested yet,
--     but ALSO don't cache a miss forever (new products get added
--     every day).
--   * We do NOT store PII here — just barcode + product metadata that
--     is already public. Safe for cross-user visibility.
--   * `source` records which upstream populated the row (off / obf /
--     opf / opff / upcitemdb). If we ever need to purge one source
--     (e.g. bad data from UPCitemdb), a single DELETE WHERE source=…
--     wipes it in one shot.
--
-- Run this in the Supabase SQL Editor once. Safe to re-run (uses IF
-- NOT EXISTS). RLS is enabled + forced with default-deny; the server
-- uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
--
-- See lib/barcode-lookup.js (readCache / writeCache) for the runtime
-- code and docs/operations/debugging.md for the ops runbook.

-- ---------------------------------------------------------------------------
-- barcode_cache
-- ---------------------------------------------------------------------------
create table if not exists public.barcode_cache (
    -- Normalised code (leading zeros trimmed for GTIN-14, etc — see
    -- normalizeBarcode() on the client). Primary key so upserts are cheap.
    code        text        primary key,

    -- Was the upstream chain able to identify this code?
    found       boolean     not null,

    -- Product metadata. All nullable because a genuine "found" hit may
    -- have only a brand (Open Food Facts quirk) and a miss has neither.
    name        text,
    brand       text,
    image       text,
    quantity    text,

    -- Which source populated the row. For hits, one of the SOURCES ids
    -- (off, obf, opf, opff, upcitemdb). For misses, 'none'.
    source      text        not null default 'none',

    -- Bookkeeping. cached_at is when we wrote the row; expires_at is when
    -- a read should treat it as stale and re-query the upstream chain.
    cached_at   timestamptz not null default now(),
    expires_at  timestamptz not null
);

-- Fast expiry sweep. We only ever SELECT WHERE code = ? AND expires_at
-- > now(), so an index on expires_at also lets us periodically DELETE
-- stale rows cheaply if the table grows.
create index if not exists barcode_cache_expires_at_idx on public.barcode_cache (expires_at);

-- ---------------------------------------------------------------------------
-- Row Level Security — default deny, service-role bypasses
-- ---------------------------------------------------------------------------
alter table public.barcode_cache enable row level security;
alter table public.barcode_cache force  row level security;

revoke all on public.barcode_cache from anon, authenticated;

-- End of migration 003.
