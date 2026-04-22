# Wardrobe App — CLAUDE.md

Developer reference for Claude Code sessions. Read this before touching any code.

---

## Architecture Overview

**Frontend:** React 18 + Vite 4 (JSX, no TypeScript). Deployed to Vercel.
**Backend:** Supabase (Postgres + Auth + Storage). No custom server — all DB access goes through the Supabase JS client.
**API proxy:** `api/claude.js` — a Vercel serverless function that proxies requests to the Anthropic API. The key (`ANTHROPIC_API_KEY`) lives in Vercel environment variables, never in the client bundle.
**Deploy:** `git push origin main` → Vercel auto-deploys. No CI pipeline.

---

## Supabase Tables

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `wardrobe_items` | Clothing items + a special `__settings__` row | `id` (text), `user_id` (text), `data` (jsonb) |
| `wardrobe_wishlist` | Wishlist items | `id`, `user_id`, `data` (jsonb) |
| `outfits` | Named saved outfits | `id`, `user_id`, `name`, `date_worn`, `created_at` |
| `outfit_items` | Many-to-many: outfit ↔ wardrobe item | `outfit_id`, `item_id` |

The `data` JSONB column on `wardrobe_items` stores all item metadata **except** images. It also stores `image_path` and `image_thumb_path` (Storage paths). It never stores base64 or signed URLs.

Settings (style profile, extra instructions, style notes) live in a special row where `id = "__settings__"` in `wardrobe_items`.

---

## Storage

**Bucket:** `wardrobe-images` (private)
**Paths:** `{userId}/items/{itemId}/full.jpg` and `{userId}/items/{itemId}/thumb.jpg`

Images are stored in a **private** bucket. The DB stores only the path, not a URL. Signed URLs are generated on-demand and never persisted to the DB.

---

## Image Pipeline

### Upload (new item or edit)

1. User picks or drops a file → `readFile()` → raw base64 data URL
2. `handleImageFile()` in `App.jsx` triggers auto-scan with Claude (`IMAGE_SCAN_PROMPT`) to fill in item metadata
3. `CropModal` shows; user crops → `applyCrop()` outputs full-quality JPEG (quality 1.0, no resize)
4. `onCropDone()` in `App.jsx` calls `generateImageVersions()`:
   - `full` — 2000px max, quality 0.95
   - `thumb` — 600px max, quality 0.90
   Compression happens exactly once here, never earlier.
5. Images are stored in form state as base64 (`addForm.imageData`, `addForm.imageThumb`)
6. On save, `persist(newItems)` is called:
   - Immediately saves to localStorage (optimistic, still base64)
   - Calls `uploadItemImages(uid, items)` which calls `sbUploadImage()` for full and thumb
   - `sbUploadImage()` returns the **storage path** on success, null on failure
   - On success: sets `image_path` / `image_thumb_path` on the item
   - Batch-generates signed URLs via `sbGetSignedUrls()` and sets them as `imageData` / `imageThumb` in memory
   - Saves again to localStorage (now with paths; signed URLs stripped by `saveToStorage`)
   - Upserts metadata (including paths) to Supabase DB via `sbUpsert()`

### Read (app load / sync)

1. `loadFromStorage()` reads items from `wardrobe-v3` localStorage key
2. Merges from image cache (`wardrobe-image-cache`) for items whose `imageData` was stripped by a quota fallback
3. Signed URL cache entries are only used if `expiry > now + 5min`
4. After auth resolves, `syncFromSupabase()` runs:
   - Loads rows from Supabase (metadata + paths, no images)
   - Restores `imageData`/`imageThumb` from: in-memory state → cache → localStorage
   - Collects all `image_path`/`image_thumb_path` values that don't have a fresh signed URL
   - One batch call to `sbGetSignedUrls()` → sets `imageData`/`imageThumb` in memory
   - Calls `cacheSignedUrls()` to persist them to the image cache with a 1-hour expiry
5. Components render using `item.imageThumb ?? item.imageData`

### What persists where

| Data | localStorage `wardrobe-v3` | localStorage `wardrobe-image-cache` | Supabase DB `data` column | Supabase Storage |
|------|---------------------------|-------------------------------------|--------------------------|-----------------|
| Item metadata (name, brand, etc.) | ✓ | — | ✓ | — |
| `image_path` / `image_thumb_path` | ✓ | — | ✓ | — |
| Base64 `imageData` / `imageThumb` | ✓ (if quota allows) | ✓ (quota backup) | ✗ never | — |
| Signed URLs | ✗ stripped before save | ✓ with expiry timestamp | ✗ never | — |
| Actual image files | — | — | — | ✓ |

---

## Key Technical Decisions

### Private bucket + signed URLs
Signed URLs expire (1h), so they're never stored in the DB — only the path is. On every session, `syncFromSupabase()` does one batch `createSignedUrls()` call to refresh them. This means images briefly appear missing on first load until sync completes (~1-2s), which is acceptable.

### Path-based storage (not public URLs)
Old system stored public URLs in localStorage. If the bucket policy changed or URLs rotated, images would silently break. The path is permanent and always sufficient to regenerate access.

### `stripImages()` function (`useWardrobeData.js`)
```js
function stripImages({ imageData, imageThumb, originalImageData, outfitPhotos, imageMigrated, ...rest }) {
  return rest;
}
```
Called on every item before writing to Supabase. Removes all transient/binary fields. Critically, `image_path` and `image_thumb_path` are NOT in the destructure list — they're in `...rest` and pass through to the DB. This is intentional and load-bearing. Do not add them to the destructure list.

### 3-level localStorage quota fallback (`saveToStorage`)
localStorage has a ~5MB limit. When a write fails with `QuotaExceededError`:
- **Level 1:** Full save (everything)
- **Level 2:** Strip `originalImageData` + `outfitPhotos` (largest fields)
- **Level 3:** Strip base64 `imageData`/`imageThumb` from the main array; keep Storage paths and URLs; base64 is backed up to `wardrobe-image-cache` first

Level 3 is safe because `loadFromStorage()` merges the image cache back in on every read.

### Image cache (`wardrobe-image-cache`)
A separate localStorage key mapping `{itemId: {imageData, imageThumb, expiry?}}`. Two entry types:
- **Base64 entries** (no `expiry`): for items not yet in Storage. Never expire.
- **Signed URL entries** (with `expiry`): for path-based items. Only used if `expiry > now + 5min`.

When an item is promoted to Storage (gets `image_path`), its stale base64 cache entry is deleted by `saveImageCache()`.

### Sync suppression after persist
`App.jsx` stores `lastPersistAt` in localStorage after any save. The `visibilitychange` listener skips sync if a persist happened within the last 30 seconds. This prevents a tab-switch from triggering a sync that could overwrite in-flight image data.

---

## File Ownership

| File | Owns |
|------|------|
| `src/supabase.js` | All Supabase client calls: `sbUploadImage`, `sbGetSignedUrls`, `sbDeleteImage`, `sbUpsert`, `sbDel`, `sbLoad`, `sbLoadSettings`, `sbCreateOutfit`, `sbLoadOutfits` |
| `src/hooks/useWardrobeData.js` | localStorage persistence, image cache, upload orchestration, Supabase sync, `persist()`, `syncFromSupabase()` |
| `src/utils/normalizeItem.js` | Item data model: `normalizeItem()`, `buildItem()`, `emptyForm()`. All fields including `image_path`/`image_thumb_path` defined here |
| `src/utils/imageUtils.js` | `readFile()`, `compressImage()`, `generateImageVersions()` — pure image processing, no side effects |
| `src/App.jsx` | File picking, crop orchestration, `handleImageFile()`, `onCropDone()`, auth, tab-focus sync suppression |
| `src/components/CropModal.jsx` | Crop UI; outputs JPEG at quality 1.0 (no resize — compression happens in `generateImageVersions`) |
| `src/components/ImageEditor.jsx` | Background removal via `@imgly/background-removal` (dynamic import, ~30MB WASM model on first use) |
| `src/components/FormFields.jsx` | Add/edit form fields including image upload zone and drag-and-drop |
| `api/claude.js` | Vercel serverless proxy for Anthropic API calls; reads `ANTHROPIC_API_KEY` from env |

---

## Known Migration State

Some existing items in Supabase may have been uploaded to Storage under the **old path pattern** (`{userId}/{itemId}.jpg`) before this codebase switched to deterministic paths (`{userId}/items/{itemId}/full.jpg`).

Those rows will have no `image_path` in the DB. They will show images from localStorage/cache as long as the cached data is valid. The next time a user edits and saves that item, `persist()` will re-upload using the new path and write `image_path` to the DB, repairing the row automatically.

No bulk migration script is needed — it self-heals on first edit.

---

## Required Manual Supabase Setup

These steps are **not in code** and must be done in the Supabase dashboard.

### 1. Make the Storage bucket private
Dashboard → Storage → `wardrobe-images` → Settings → uncheck "Public bucket"

### 2. Add Storage RLS policies
In the SQL editor, run:
```sql
-- Allow authenticated users to manage their own images
CREATE POLICY "Users manage own images"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'wardrobe-images' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'wardrobe-images' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### 3. Database RLS (already applied)
All four tables have RLS enabled with policies requiring `user_id = auth.uid()::text`. The SQL for this is in `supabase-setup.sql`.

---

## Environment Variables

| Variable | Where set | Purpose |
|----------|-----------|---------|
| `VITE_SUPABASE_URL` | Vercel env + `.env.local` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Vercel env + `.env.local` | Supabase anon/public key |
| `ANTHROPIC_API_KEY` | Vercel env only (never client) | Anthropic API key for serverless proxy |

`.env.local` is gitignored. Never commit secrets.

---

## Deploy Process

```
git push origin main
```

Vercel is connected to the GitHub repo and auto-deploys on every push to `main`. No build command to run manually — Vite builds in the Vercel pipeline.

The `vercel.json` configures the `api/` directory as serverless functions and rewrites `/api/*` accordingly.
