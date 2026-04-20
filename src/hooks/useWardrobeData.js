import { useState } from "react";
import { sbDel, sbUpsert, sbLoad, sbLoadSettings } from "../supabase.js";
import { normalizeItem } from "../utils/normalizeItem.js";
import { STORAGE_KEY, WISHLIST_KEY } from "../constants.js";

// Strip all image data before writing to Supabase — images live in localStorage only
function stripImages({ imageData, imageThumb, originalImageData, outfitPhotos, imageMigrated, ...rest }) {
  return rest;
}

// ── localStorage helpers ────────────────────────────────────────────────────
export function loadFromStorage() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    const parsed = r ? JSON.parse(r) : [];
    console.log("[storage] loadFromStorage:", parsed.length, "items");
    return parsed;
  }
  catch (e) { console.error("[storage] loadFromStorage parse error:", e.message); return []; }
}

export function saveToStorage(items) {
  // Try full save with images. If quota exceeded, save metadata-only so at least
  // names/brands/categories appear instantly on next load even if photos must wait.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    console.log("[storage] saveToStorage: saved", items.length, "items (full, with images)");
  } catch (e) {
    if (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014) {
      console.warn("[storage] QuotaExceededError — images too large for localStorage. Saving metadata-only fallback.");
      try {
        const stripped = items.map(({ imageData, originalImageData, outfitPhotos, ...rest }) => rest);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
        console.log("[storage] saveToStorage: saved", stripped.length, "items (metadata only, no images)");
      } catch (e2) {
        console.error("[storage] saveToStorage failed even without images:", e2.message);
      }
    } else {
      console.error("[storage] saveToStorage unexpected error:", e.message);
    }
  }
}

export function loadWishlistFromStorage() {
  try { const r = localStorage.getItem(WISHLIST_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
export function saveWishlistToStorage(w) {
  try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(w)); } catch {}
}

// ── Hook ────────────────────────────────────────────────────────────────────
export function useWardrobeData(user) {
  const [items, setItems] = useState(() => loadFromStorage().map(normalizeItem));
  const [wishlist, setWishlist] = useState(() => loadWishlistFromStorage());
  const [brands, setBrands] = useState(() => {
    try { const b = localStorage.getItem("wardrobe-brands"); return b ? JSON.parse(b) : []; }
    catch { return []; }
  });
  const [syncing, setSyncing] = useState(false);

  function persist(newItems) {
    const uid = user?.id;
    const prevItems = items; // capture before state update for diff

    setItems(newItems);
    saveToStorage(newItems);

    if (!uid) return;

    // Diff against pre-persist snapshot to decide what to upsert/delete
    const newIds = new Set(newItems.map(i => String(i.id)));
    const removed = prevItems.filter(i => !newIds.has(String(i.id)));
    const upserted = newItems.filter(i => {
      const old = prevItems.find(j => String(j.id) === String(i.id));
      // Compare metadata only (no images) for the diff
      return !old || JSON.stringify(stripImages(old)) !== JSON.stringify(stripImages(i));
    });
    removed.forEach(i => sbDel("wardrobe_items", i.id, uid));
    if (upserted.length)
      sbUpsert("wardrobe_items", upserted.map(i => ({ id: String(i.id), user_id: uid, data: stripImages(i) })));
  }

  function persistWishlist(w) {
    const uid = user?.id;
    const newIds = new Set(w.map(i => String(i.id)));
    const removed = wishlist.filter(i => !newIds.has(String(i.id)));
    const upserted = w.filter(i => {
      const old = wishlist.find(j => String(j.id) === String(i.id));
      return !old || JSON.stringify(old) !== JSON.stringify(i);
    });
    setWishlist(w);
    saveWishlistToStorage(w);
    if (uid) {
      removed.forEach(i => sbDel("wardrobe_wishlist", i.id, uid));
      if (upserted.length)
        sbUpsert("wardrobe_wishlist", upserted.map(i => ({ id: String(i.id), user_id: uid, data: stripImages(i) })));
    }
  }

  function addBrand(brand) {
    if (!brand || brands.includes(brand)) return;
    const updated = [...brands, brand].sort();
    setBrands(updated);
    try { localStorage.setItem("wardrobe-brands", JSON.stringify(updated)); } catch {}
  }

  /**
   * Pull data from Supabase and merge with local state.
   * Calls `syncSettingsFrom` (from useSettings) with whatever settings row we find.
   */
  async function syncFromSupabase(uid, syncSettingsFrom) {
    if (!uid) return;
    setSyncing(true);
    const t0 = performance.now();
    console.log(`[sync] START`);

    const timed = (label, promise) => {
      const ts = performance.now();
      console.log(`[sync]   → ${label} fetch started`);
      return promise.then(r => {
        const dur = (performance.now() - ts).toFixed(0);
        const info = Array.isArray(r) ? `${r.length} rows` : r === null ? "null (error)" : "ok";
        console.log(`[sync]   ← ${label}: ${dur}ms (${info})`);
        return r;
      }).catch(e => {
        console.log(`[sync]   ✗ ${label}: ${(performance.now()-ts).toFixed(0)}ms FAILED:`, e.message);
        return null;
      });
    };

    const [dbItems, dbWish, dbSettings] = await Promise.all([
      timed("wardrobe_items",    sbLoad("wardrobe_items", uid)),
      timed("wardrobe_wishlist", sbLoad("wardrobe_wishlist", uid)),
      timed("settings",          sbLoadSettings(uid)),
    ]);
    console.log(`[sync] all fetches done: ${(performance.now() - t0).toFixed(0)}ms total`);

    if (dbSettings) syncSettingsFrom(dbSettings);

    if (dbItems !== null) {
      const normalized = dbItems.map(normalizeItem).filter(Boolean);

      // Restore images from localStorage — Supabase stores metadata only
      const localItems = loadFromStorage().map(normalizeItem);
      const localImageMap = new Map(localItems.map(i => [String(i.id), i]));
      const withImages = normalized.map(i => {
        const local = localImageMap.get(String(i.id));
        if (!local) return i;
        return {
          ...i,
          imageData:         local.imageData         ?? i.imageData,
          imageThumb:        local.imageThumb        ?? i.imageThumb,
          originalImageData: local.originalImageData ?? i.originalImageData,
          outfitPhotos:      local.outfitPhotos      ?? i.outfitPhotos,
        };
      });

      const sbIds = new Set(normalized.map(i => String(i.id)));
      const localOnly = localItems.filter(i => !sbIds.has(String(i.id)));
      const merged = normalized.length > 0 ? [...withImages, ...localOnly] : localOnly;
      setItems(merged);
      saveToStorage(merged);
      if (normalized.length > 0 && localOnly.length)
        sbUpsert("wardrobe_items", localOnly.map(i => ({ id: String(i.id), user_id: uid, data: stripImages(i) })));
    }

    if (dbWish !== null) {
      if (dbWish.length > 0) {
        setWishlist(dbWish);
        saveWishlistToStorage(dbWish);
      } else {
        const loc = loadWishlistFromStorage();
        if (loc.length)
          sbUpsert("wardrobe_wishlist", loc.map(i => ({ id: String(i.id), user_id: uid, data: stripImages(i) })));
      }
    }

    console.log(`[sync] DONE — total: ${(performance.now() - t0).toFixed(0)}ms`);
    setSyncing(false);
  }

  return {
    items, setItems, persist,
    wishlist, setWishlist, persistWishlist,
    brands, addBrand,
    syncing, syncFromSupabase,
  };
}
