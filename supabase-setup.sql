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

create table if not exists wardrobe_wishlist (
  id          text        primary key,
  user_id     text        not null,
  data        jsonb       not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists wardrobe_wishlist_user_id_idx on wardrobe_wishlist (user_id);

-- Allow public read/write (no login required — user_id is a random UUID per device)
alter table wardrobe_items    disable row level security;
alter table wardrobe_wishlist disable row level security;

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
alter table outfits disable row level security;

create table if not exists outfit_items (
  outfit_id  text  not null references outfits(id) on delete cascade,
  item_id    text  not null,                  -- references wardrobe_items.id (no FK — items can be deleted independently)
  primary key (outfit_id, item_id)
);
create index if not exists outfit_items_outfit_id_idx on outfit_items (outfit_id);
alter table outfit_items disable row level security;
