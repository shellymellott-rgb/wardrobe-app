import { useState } from "react";
import { sbDel, sbUpsert, sbLoad, sbLoadSettings, sbUploadImage } from "../supabase.js";
import { normalizeItem } from "../utils/normalizeItem.js";
import { STORAGE_KEY, WISHLIST_KEY } from "../constants.js";

// Strip all image fields before writing to Supabase — images live in Storage/localStorage
function stripImages({ imageData, imageThumb, originalImageData, outfitPhotos, imageMigrated, ...rest }) {
  return rest;
}

/**
 * For any item whose imageData/imageThumb is still a base64 data URL,
 * upload it to Supabase Storage and replace with the permanent public URL.
 * If an upload fails, the base64 is preserved in the returned item so
 * localStorage retains the image — Storage is best-effort, not required.
 * Returns the same array reference only when there was nothing to upload.
 */
async function uploadItemImages(uid, items) {
  const needsWork = items.some(i =>
    i.imageData?.startsWith("data:") || i.imageThumb?.startsWith("data:")
  );
  if (!needsWork) return items;

  const result = await Promise.all(items.map(async item => {
    const needsFull  = item.imageData?.startsWith("data:");
    const needsThumb = item.imageThumb?.startsWith("data:");
    if (!needsFull && !needsThumb) return item;

    const updated = { ...item };

    if (needsFull) {
      const url = await sbUploadImage(uid, String(item.id), item.imageData, "");
      if (url) {
        updated.imageData = url;
      } else {
        console.error(`[persist] Storage upload failed for "${item.name}" — image kept in localStorage`);
        // updated.imageData remains as base64 — localStorage will hold it
      }
    }
    if (needsThumb) {
      const url = await sbUploadImage(uid, String(item.id), item.imageThumb, "_thumb");
      if (url) {
        updated.imageThumb = url;
      } else {
        console.error(`[persist] Storage thumb upload failed for "${item.name}"`);
      }
    }

    return updated;
  }));
  return result;
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    if (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014) {
      // Images are now Storage URLs (tiny strings), so quota issues should be rare.
      // Fallback: save without any remaining base64 blobs.
      try {
        const stripped = items.map(({ originalImageData, outfitPhotos, ...rest }) => rest);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
      } catch (e2) {
        console.error("[storage] saveToStorage failed:", e2.message);
      }
    } else {
      console.error("[storage] saveToStorage error:", e.message);
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
    const prevItems = items; // capture before state update for diff

    // Optimistic update — show immediately (images may still be base64 briefly)
    setItems(newItems);
    saveToStorage(newItems);

    if (!uid) return;

    // Upload any base64 images to Supabase Storage; replace with permanent URLs.
    // uploadItemImages always returns a new array when there was work to do.
    // On upload failure, the returned items still carry the original base64 —
    // we save that to localStorage so the image is never silently lost.
    const finalItems = await uploadItemImages(uid, newItems);
    if (finalItems !== newItems) {
      // uploadItemImages did work — save result (URLs where upload succeeded,
      // base64 where it failed, so localStorage always has the image)
      setItems(finalItems);
      saveToStorage(finalItems);
    }

    // Diff against pre-persist snapshot and upsert only changed metadata rows
    const newIds = new Set(finalItems.map(i => String(i.id)));
    const removed = prevItems.filter(i => !newIds.has(String(i.id)));
    const upserted = finalItems.filter(i => {
      const old = prevItems.find(j => String(j.id) === String(i.id));
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
   * Image restore priority: current in-memory state → localStorage → nothing.
   * In-memory state takes priority because it may already hold Storage URLs from
   * this session; localStorage is the fallback for images not yet in Storage.
   */
  async function syncFromSupabase(uid, syncSettingsFrom) {
    if (!uid) return;
    setSyncing(true);
    const t0 = performance.now();
    console.log(`[sync] START`);

    const timed = (label, promise) => {
      const ts = performance.now();
      return promise.then(r => {
        const dur = (performance.now() - ts).toFixed(0);
        const info = Array.isArray(r) ? `${r.length} rows` : r === null ? "null (error)" : "ok";
        console.log(`[sync] ${label}: ${dur}ms (${info})`);
        return r;
      }).catch(e => {
        console.error(`[sync] ${label} FAILED:`, e.message);
        return null;
      });
    };

    const [dbItems, dbWish, dbSettings] = await Promise.all([
      timed("wardrobe_items",    sbLoad("wardrobe_items", uid)),
      timed("wardrobe_wishlist", sbLoad("wardrobe_wishlist", uid)),
      timed("settings",          sbLoadSettings(uid)),
    ]);
    console.log(`[sync] DONE — ${(performance.now() - t0).toFixed(0)}ms total`);

    if (dbSettings) syncSettingsFrom(dbSettings);

    if (dbItems !== null) {
      const normalized = dbItems.map(normalizeItem).filter(Boolean);

      // Build image maps for restore.
      // `items` (closure) = current React state, already populated from localStorage
      // on first render and may contain Storage URLs from earlier this session.
      const stateMap = new Map(items.map(i => [String(i.id), i]));
      const localItems = loadFromStorage().map(normalizeItem);
      const localMap  = new Map(localItems.map(i => [String(i.id), i]));

      const withImages = normalized.map(i => {
        const src = stateMap.get(String(i.id)) ?? localMap.get(String(i.id));
        if (!src) return i;
        // Only restore fields that actually exist in the source
        const patch = {};
        if (src.imageData)         patch.imageData         = src.imageData;
        if (src.imageThumb)        patch.imageThumb        = src.imageThumb;
        if (src.originalImageData) patch.originalImageData = src.originalImageData;
        if (src.outfitPhotos)      patch.outfitPhotos      = src.outfitPhotos;
        return { ...i, ...patch };
      });

      const sbIds = new Set(normalized.map(i => String(i.id)));
      const localOnly = localItems.filter(i => !sbIds.has(String(i.id)));
      const merged = normalized.length > 0 ? [...withImages, ...localOnly] : localOnly;
      setItems(merged);
      saveToStorage(merged);
      // Push any local-only items up to Supabase (metadata only)
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

    setSyncing(false);
  }

  return {
    items, setItems, persist,
    wishlist, setWishlist, persistWishlist,
    brands, addBrand,
    syncing, syncFromSupabase,
  };
}
