-- Run this once in the Supabase SQL Editor (https://supabase.com/dashboard)
-- Project: lkyxzwjsxjjfrhfdohot

create extension if not exists pgcrypto;

create table if not exists wardrobe_items (
  id          text        primary key,
  user_id     text        not null,
  data        jsonb       not null,
  embedding   jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table wardrobe_items add column if not exists created_at timestamptz default now();
alter table wardrobe_items add column if not exists updated_at timestamptz default now();
alter table wardrobe_items add column if not exists embedding jsonb;
create index if not exists wardrobe_items_user_id_idx on wardrobe_items (user_id);
-- Composite index covers the query pattern: WHERE user_id = ? ORDER BY created_at ASC
create index if not exists wardrobe_items_user_created_idx on wardrobe_items (user_id, created_at);
create index if not exists wardrobe_items_missing_embedding_idx on wardrobe_items (user_id) where embedding is null;

create table if not exists wardrobe_wishlist (
  id          text        primary key,
  user_id     text        not null,
  data        jsonb       not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table wardrobe_wishlist add column if not exists created_at timestamptz default now();
alter table wardrobe_wishlist add column if not exists updated_at timestamptz default now();
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
alter table outfits add column if not exists created_at timestamptz default now();
create index if not exists outfits_user_id_idx on outfits (user_id);

create table if not exists outfit_items (
  outfit_id  text  not null references outfits(id) on delete cascade,
  item_id    text  not null,                  -- references wardrobe_items.id (no FK — items can be deleted independently)
  primary key (outfit_id, item_id)
);
create index if not exists outfit_items_outfit_id_idx on outfit_items (outfit_id);

-- ── Journal entries (added 2026-05-07) ───────────────────────────────────────
-- One row per logged or planned outfit day.

create table if not exists journal_entries (
  id         text        primary key,          -- client-generated: crypto.randomUUID()
  user_id    text        not null,
  date       date        not null,
  photo      text,
  item_ids   text[]      default '{}',
  notes      text        default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table journal_entries add column if not exists created_at timestamptz default now();
alter table journal_entries add column if not exists updated_at timestamptz default now();
create index if not exists journal_entries_user_date_idx on journal_entries (user_id, date desc);

-- ── AI profile and chat memory (added 2026-05-17) ──────────────────────────────
-- Stores the personal styling profile, stylist preferences, and chat sessions.

create table if not exists wardrobe_profile (
  user_id                 text primary key,
  bot_name                text,
  bot_personality         text,
  height_ft               integer,
  height_in               integer,
  sizes                   text,
  color_season            text,
  color_undertone         text,
  best_colors             text[] default '{}',
  avoid_colors            text[] default '{}',
  body_type               text,
  flattering_silhouettes  text[] default '{}',
  flattering_necklines    text[] default '{}',
  flattering_lengths      text[] default '{}',
  avoid_silhouettes       text[] default '{}',
  rotation_days           integer default 14,
  dressing_seasons        text[] default '{}',
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);
alter table wardrobe_profile add column if not exists bot_name text;
alter table wardrobe_profile add column if not exists bot_personality text;
alter table wardrobe_profile add column if not exists height_ft integer;
alter table wardrobe_profile add column if not exists height_in integer;
alter table wardrobe_profile add column if not exists sizes text;
alter table wardrobe_profile add column if not exists color_season text;
alter table wardrobe_profile add column if not exists color_undertone text;
alter table wardrobe_profile add column if not exists best_colors text[] default '{}';
alter table wardrobe_profile add column if not exists avoid_colors text[] default '{}';
alter table wardrobe_profile add column if not exists body_type text;
alter table wardrobe_profile add column if not exists flattering_silhouettes text[] default '{}';
alter table wardrobe_profile add column if not exists flattering_necklines text[] default '{}';
alter table wardrobe_profile add column if not exists flattering_lengths text[] default '{}';
alter table wardrobe_profile add column if not exists avoid_silhouettes text[] default '{}';
alter table wardrobe_profile add column if not exists rotation_days integer default 14;
alter table wardrobe_profile add column if not exists dressing_seasons text[] default '{}';
alter table wardrobe_profile add column if not exists created_at timestamptz default now();
alter table wardrobe_profile add column if not exists updated_at timestamptz default now();

create table if not exists chat_sessions (
  id         text primary key default gen_random_uuid()::text,
  user_id    text not null,
  status     text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table chat_sessions add column if not exists status text default 'active';
alter table chat_sessions add column if not exists created_at timestamptz default now();
alter table chat_sessions add column if not exists updated_at timestamptz default now();
create index if not exists chat_sessions_user_created_idx on chat_sessions (user_id, created_at desc);

create table if not exists chat_messages (
  id         bigint generated by default as identity primary key,
  session_id text not null references chat_sessions(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant', 'system')),
  content    text not null,
  created_at timestamptz default now()
);
alter table chat_messages add column if not exists role text;
alter table chat_messages add column if not exists content text;
alter table chat_messages add column if not exists created_at timestamptz default now();
create index if not exists chat_messages_session_created_idx on chat_messages (session_id, created_at);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- user_id is stored as text matching auth.uid()::text (Google OAuth UUID).
-- Each policy uses auth.uid()::text so the comparison type-matches.

alter table wardrobe_items    enable row level security;
alter table wardrobe_wishlist enable row level security;
alter table outfits           enable row level security;
alter table outfit_items      enable row level security;
alter table journal_entries   enable row level security;
alter table wardrobe_profile  enable row level security;
alter table chat_sessions     enable row level security;
alter table chat_messages     enable row level security;

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

-- journal_entries: users can only read/write their own entries
drop policy if exists "users own their journal entries" on journal_entries;
create policy "users own their journal entries"
  on journal_entries for all
  using  (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

-- wardrobe_profile: users can only read/write their own styling profile
drop policy if exists "users own their wardrobe profile" on wardrobe_profile;
create policy "users own their wardrobe profile"
  on wardrobe_profile for all
  using  (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);

-- chat_sessions: users can only read/write their own chat sessions
drop policy if exists "users own their chat sessions" on chat_sessions;
create policy "users own their chat sessions"
  on chat_sessions for all
  using  (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);

-- chat_messages: access allowed if the parent chat session belongs to the user
drop policy if exists "users own their chat messages" on chat_messages;
create policy "users own their chat messages"
  on chat_messages for all
  using  (exists (select 1 from chat_sessions where chat_sessions.id::text = chat_messages.session_id::text and chat_sessions.user_id::text = auth.uid()::text))
  with check (exists (select 1 from chat_sessions where chat_sessions.id::text = chat_messages.session_id::text and chat_sessions.user_id::text = auth.uid()::text));

-- ── One-time data cleanup: strip base64 image blobs from existing rows ────────
-- Run this ONCE in the Supabase SQL Editor to remove base64 imageData that was
-- written before the client-side stripping code was deployed.  Safe to re-run —
-- the `-` operator is a no-op when the key is already absent.
--
-- Before: rows can be 50–500 KB each (full base64 JPEG/PNG inside JSONB)
-- After:  rows are < 1 KB each (metadata only); wardrobe_items query goes from
--         10+ seconds to < 500 ms.

UPDATE wardrobe_items
SET data = data - 'imageData' - 'imageThumb' - 'originalImageData' - 'outfitPhotos' - 'imageMigrated'
WHERE data ?| array['imageData','imageThumb','originalImageData','outfitPhotos','imageMigrated'];

UPDATE wardrobe_wishlist
SET data = data - 'imageData' - 'imageThumb' - 'originalImageData' - 'outfitPhotos'
WHERE data ?| array['imageData','imageThumb','originalImageData','outfitPhotos'];

-- Confirm: check average row size after cleanup (should be < 1 KB)
-- SELECT round(avg(octet_length(data::text)) / 1024.0, 2) AS avg_kb,
--        round(max(octet_length(data::text)) / 1024.0, 2) AS max_kb,
--        count(*) AS rows
-- FROM wardrobe_items;
