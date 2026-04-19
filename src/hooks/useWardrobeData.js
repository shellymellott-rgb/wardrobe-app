import { useState } from "react";
import { sbDel, sbUpsert, sbLoad, sbLoadSettings } from "../supabase.js";
import { normalizeItem } from "../utils/normalizeItem.js";
import { STORAGE_KEY, WISHLIST_KEY } from "../constants.js";

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

  function persist(newItems) {
    const uid = user?.id;
    const newIds = new Set(newItems.map(i => String(i.id)));
    const removed = items.filter(i => !newIds.has(String(i.id)));
    const upserted = newItems.filter(i => {
      const old = items.find(j => String(j.id) === String(i.id));
      return !old || JSON.stringify(old) !== JSON.stringify(i);
    });
    setItems(newItems);
    saveToStorage(newItems);
    if (uid) {
      removed.forEach(i => sbDel("wardrobe_items", i.id, uid));
      if (upserted.length)
        sbUpsert("wardrobe_items", upserted.map(i => ({ id: String(i.id), user_id: uid, data: i })));
    }
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
      const normalized = dbItems.map(normalizeItem).filter(Boolean);
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
