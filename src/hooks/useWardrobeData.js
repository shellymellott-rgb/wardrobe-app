import { useState } from "react";
import { sbDel, sbUpsert, sbLoad, sbLoadSettings, sbUploadImage } from "../supabase.js";
import { normalizeItem } from "../utils/normalizeItem.js";
import { STORAGE_KEY, WISHLIST_KEY } from "../constants.js";

// Upload any items whose imageData is still a base64 string to Supabase Storage.
// Returns a new array with publicURLs substituted; returns the same reference if nothing changed.
async function uploadItemImages(uid, items) {
  let anyUploaded = false;
  const result = await Promise.all(items.map(async item => {
    if (!item.imageData || !item.imageData.startsWith("data:")) return item;
    const url = await sbUploadImage(uid, String(item.id), item.imageData);
    if (url) { anyUploaded = true; return { ...item, imageData: url }; }
    return item; // keep base64 as fallback if upload fails
  }));
  return anyUploaded ? result : items;
}

// ── localStorage helpers ────────────────────────────────────────────────────
export function loadFromStorage() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    const parsed = r ? JSON.parse(r) : [];
    console.log("[storage] loadFromStorage:", parsed.length, "items", parsed.length ? `(first: "${parsed[0]?.name}")` : "(empty — cache miss)");
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

  async function persist(newItems) {
    const uid = user?.id;
    const prevItems = items; // capture before any state update for diff later

    // Optimistic update immediately — UI sees new items at once (may briefly show base64)
    setItems(newItems);
    saveToStorage(newItems);

    if (!uid) return;

    // Upload any base64 images to Storage; replace with public URLs
    const finalItems = await uploadItemImages(uid, newItems);
    if (finalItems !== newItems) {
      // Some images were uploaded — update state + cache with the URL versions
      setItems(finalItems);
      saveToStorage(finalItems);
    }

    // Diff against pre-persist snapshot to decide what to upsert/delete
    const newIds = new Set(finalItems.map(i => String(i.id)));
    const removed = prevItems.filter(i => !newIds.has(String(i.id)));
    const upserted = finalItems.filter(i => {
      const old = prevItems.find(j => String(j.id) === String(i.id));
      return !old || JSON.stringify(old) !== JSON.stringify(i);
    });
    removed.forEach(i => sbDel("wardrobe_items", i.id, uid));
    if (upserted.length)
      sbUpsert("wardrobe_items", upserted.map(i => ({ id: String(i.id), user_id: uid, data: i })));
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
        sbUpsert("wardrobe_wishlist", upserted.map(i => ({ id: String(i.id), user_id: uid, data: i })));
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
    const [dbItems, dbWish, dbSettings] = await Promise.all([
      sbLoad("wardrobe_items", uid),
      sbLoad("wardrobe_wishlist", uid),
      sbLoadSettings(uid),
    ]);

    if (dbSettings) syncSettingsFrom(dbSettings);

    if (dbItems !== null) {
      let normalized = dbItems.map(normalizeItem).filter(Boolean);

      // ── Migrate base64 images to Supabase Storage ──────────────────────────
      // Any item still storing a full base64 string gets uploaded once here.
      // After this point all items in Supabase will have public URLs.
      const needsMigration = normalized.filter(i => i.imageData?.startsWith("data:"));
      if (needsMigration.length > 0) {
        console.log("[storage] migrating", needsMigration.length, "base64 image(s) to Supabase Storage…");
        const migrated = await Promise.all(needsMigration.map(async item => {
          const url = await sbUploadImage(uid, String(item.id), item.imageData);
          return url ? { ...item, imageData: url } : item;
        }));
        const migratedMap = new Map(migrated.map(i => [String(i.id), i]));
        normalized = normalized.map(i => migratedMap.get(String(i.id)) || i);
        // Write migrated items back to Supabase so the base64 blobs are gone
        const uploaded = migrated.filter(i => !i.imageData?.startsWith("data:"));
        if (uploaded.length)
          sbUpsert("wardrobe_items", uploaded.map(i => ({ id: String(i.id), user_id: uid, data: i })));
        console.log("[storage] migration complete —", uploaded.length, "image(s) now stored as URLs");
      }

      const sbIds = new Set(normalized.map(i => String(i.id)));
      const localOnly = loadFromStorage().map(normalizeItem).filter(i => !sbIds.has(String(i.id)));
      const merged = normalized.length > 0 ? [...normalized, ...localOnly] : localOnly;
      console.log("[storage] syncFromSupabase: db returned", normalized.length, "items,", localOnly.length, "local-only → merged", merged.length);
      setItems(merged);
      saveToStorage(merged);   // write here so next refresh is instant
      if (normalized.length > 0 && localOnly.length)
        sbUpsert("wardrobe_items", localOnly.map(i => ({ id: String(i.id), user_id: uid, data: i })));
    }

    if (dbWish !== null) {
      if (dbWish.length > 0) {
        setWishlist(dbWish);
        saveWishlistToStorage(dbWish);
      } else {
        const loc = loadWishlistFromStorage();
        if (loc.length)
          sbUpsert("wardrobe_wishlist", loc.map(i => ({ id: String(i.id), user_id: uid, data: i })));
      }
    }

    setSyncing(false);
  }

  return {
    items, setItems, persist,
    wishlist, setWishlist, persistWishlist,
    brands, addBrand,
    syncing, syncFromSupabase,
  };
}
