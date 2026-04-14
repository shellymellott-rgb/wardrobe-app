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
