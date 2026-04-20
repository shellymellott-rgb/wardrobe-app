-- Run this once in the Supabase SQL Editor (https://supabase.com/dashboard)
-- Project: lkyxzwjsxjjfrhfdohot

create table if not exists wardrobe_items (
  id          text        primary key,
  user_id     text        not null,
  data        jsonb       not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists wardrobe_items_user_id_idx on wardrobe_items (user_id);
-- Composite index covers the query pattern: WHERE user_id = ? ORDER BY created_at ASC
create index if not exists wardrobe_items_user_created_idx on wardrobe_items (user_id, created_at);

create table if not exists wardrobe_wishlist (
  id          text        primary key,
  user_id     text        not null,
  data        jsonb       not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists wardrobe_wishlist_user_id_idx on wardrobe_wishlist (user_id);

-- ── Outfits (added 2026-04-19) ────────────────────────────────────────────────
-- An outfit is a named collection of wardrobe item IDs, with an optional date worn.
-- outfit_items links outfits to items by item_id (matches wardrobe_items.id : text).

create table if not exists outfits (
  id         text        primary key,          -- client-generated: crypto.randomUUID()
  user_id    text        not null,             -- auth.uid() cast to text
  name       text        not null,
  date_worn  date,                             -- nullable; set when the outfit is logged as worn
  created_at timestamptz default now()
);
create index if not exists outfits_user_id_idx on outfits (user_id);

create table if not exists outfit_items (
  outfit_id  text  not null references outfits(id) on delete cascade,
  item_id    text  not null,                  -- references wardrobe_items.id (no FK — items can be deleted independently)
  primary key (outfit_id, item_id)
);
create index if not exists outfit_items_outfit_id_idx on outfit_items (outfit_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- user_id is stored as text matching auth.uid()::text (Google OAuth UUID).
-- Each policy uses auth.uid()::text so the comparison type-matches.

alter table wardrobe_items    enable row level security;
alter table wardrobe_wishlist enable row level security;
alter table outfits           enable row level security;
alter table outfit_items      enable row level security;

-- wardrobe_items: users can only read/write their own rows
drop policy if exists "users own their items"    on wardrobe_items;
create policy "users own their items"
  on wardrobe_items for all
  using  (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

-- wardrobe_wishlist: same
drop policy if exists "users own their wishlist" on wardrobe_wishlist;
create policy "users own their wishlist"
  on wardrobe_wishlist for all
  using  (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

-- outfits: same
drop policy if exists "users own their outfits"  on outfits;
create policy "users own their outfits"
  on outfits for all
  using  (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

-- outfit_items: access allowed if the parent outfit belongs to the user
drop policy if exists "users own their outfit items" on outfit_items;
create policy "users own their outfit items"
  on outfit_items for all
  using  (exists (select 1 from outfits where outfits.id = outfit_id and outfits.user_id = auth.uid()::text))
  with check (exists (select 1 from outfits where outfits.id = outfit_id and outfits.user_id = auth.uid()::text));
