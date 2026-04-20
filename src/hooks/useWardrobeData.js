import { useState } from "react";
import { sbDel, sbUpsert, sbLoad, sbLoadSettings, sbUploadImage } from "../supabase.js";
import { normalizeItem } from "../utils/normalizeItem.js";
import { STORAGE_KEY, WISHLIST_KEY, IMAGE_CACHE_KEY } from "../constants.js";

// Strip all image fields before writing to Supabase — images live in Storage/localStorage
function stripImages({ imageData, imageThumb, originalImageData, outfitPhotos, imageMigrated, ...rest }) {
  return rest;
}

// ── Image-cache helpers ──────────────────────────────────────────────────────
// A dedicated localStorage key that maps itemId → {imageData, imageThumb}.
// This survives the level-3 quota fallback which strips images from the main
// items array. On load, items without imageData check here first.

function loadImageCache() {
  try {
    const raw = localStorage.getItem(IMAGE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveImageCache(items) {
  // Build the new cache entries from this batch of items.
  // Merge with the existing cache so items not in this batch aren't evicted.
  try {
    const existing = loadImageCache();
    const updated = { ...existing };
    items.forEach(i => {
      const id = String(i.id);
      if (i.imageData || i.imageThumb) {
        updated[id] = {
          imageData:  i.imageData  || null,
          imageThumb: i.imageThumb || null,
        };
      }
      // If both are null/missing, leave the existing cache entry alone —
      // the image may have been stripped from the item but not from the cache yet.
    });
    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(updated));
    console.log(`[imgcache] saved ${Object.keys(updated).length} image entries`);
  } catch (e) {
    // Quota hit on the image cache itself — try saving only the entries that
    // have changed in this batch (most important: newly-added images).
    console.warn("[imgcache] quota on full cache, falling back to batch-only save:", e.message);
    try {
      const batchCache = {};
      items.forEach(i => {
        if (i.imageData || i.imageThumb) {
          batchCache[String(i.id)] = {
            imageData:  i.imageData  || null,
            imageThumb: i.imageThumb || null,
          };
        }
      });
      localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(batchCache));
      console.warn(`[imgcache] saved ${Object.keys(batchCache).length} entries (batch-only)`);
    } catch (e2) {
      console.error("[imgcache] could not save even batch-only cache:", e2.message);
    }
  }
}

// Remove stale cache entries for items that no longer exist.
function pruneImageCache(currentIds) {
  try {
    const cache = loadImageCache();
    const keep = {};
    currentIds.forEach(id => {
      if (cache[String(id)]) keep[String(id)] = cache[String(id)];
    });
    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(keep));
  } catch {}
}

/**
 * For any item whose imageData/imageThumb is still a base64 data URL,
 * upload it to Supabase Storage and replace with the permanent public URL.
 * If an upload fails the base64 is preserved so localStorage retains the image.
 * Returns the same array reference only when there was nothing to upload.
 */
async function uploadItemImages(uid, items) {
  const needsWork = items.some(i =>
    i.imageData?.startsWith("data:") || i.imageThumb?.startsWith("data:")
  );
  if (!needsWork) {
    console.log("[persist] uploadItemImages: no base64 to upload");
    return items;
  }

  const toUpload = items.filter(i =>
    i.imageData?.startsWith("data:") || i.imageThumb?.startsWith("data:")
  );
  console.log(`[persist] uploadItemImages: uploading ${toUpload.length} item(s) to Storage`);

  const result = await Promise.all(items.map(async item => {
    const needsFull  = item.imageData?.startsWith("data:");
    const needsThumb = item.imageThumb?.startsWith("data:");
    if (!needsFull && !needsThumb) return item;

    console.log(`[persist] uploading images for "${item.name}" (id=${item.id})`);
    const updated = { ...item };

    if (needsFull) {
      const url = await sbUploadImage(uid, String(item.id), item.imageData, "");
      if (url) {
        console.log(`[persist] ✓ full image uploaded for "${item.name}": ${url.substring(0, 80)}...`);
        updated.imageData = url;
      } else {
        console.error(`[persist] ✗ Storage upload FAILED for "${item.name}" — keeping base64 in localStorage`);
        // updated.imageData remains as base64
      }
    }
    if (needsThumb) {
      const url = await sbUploadImage(uid, String(item.id), item.imageThumb, "_thumb");
      if (url) {
        console.log(`[persist] ✓ thumb uploaded for "${item.name}": ${url.substring(0, 80)}...`);
        updated.imageThumb = url;
      } else {
        console.error(`[persist] ✗ Storage thumb upload FAILED for "${item.name}"`);
      }
    }

    return updated;
  }));
  return result;
}

// ── localStorage helpers ────────────────────────────────────────────────────

function isBase64(s) { return typeof s === "string" && s.startsWith("data:"); }

export function loadFromStorage() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    const parsed = r ? JSON.parse(r) : [];

    // Merge image cache into any items that lost their images due to quota fallback
    const cache = loadImageCache();
    const cacheHits = [];
    const merged = parsed.map(item => {
      if (item.imageData && item.imageThumb) return item; // already has both
      const cached = cache[String(item.id)];
      if (!cached) return item;
      const patched = {
        ...item,
        imageData:  item.imageData  || cached.imageData  || null,
        imageThumb: item.imageThumb || cached.imageThumb || null,
      };
      if (patched.imageData !== item.imageData || patched.imageThumb !== item.imageThumb) {
        cacheHits.push(item.id);
      }
      return patched;
    });

    if (cacheHits.length) {
      console.log(`[storage] loadFromStorage: restored images from cache for ${cacheHits.length} item(s):`, cacheHits);
    }
    console.log("[storage] loadFromStorage:", merged.length, "items");
    return merged;
  }
  catch (e) { console.error("[storage] loadFromStorage parse error:", e.message); return []; }
}

export function saveToStorage(items) {
  // Always write the image cache first — this is a backup that survives
  // the level-3 fallback below and lets loadFromStorage restore images.
  saveImageCache(items);

  const totalItems = items.length;
  const withImages = items.filter(i => i.imageData || i.imageThumb).length;

  // Level 1 — full save including all images
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    console.log(`[storage] saved ${totalItems} items (${withImages} with images) — level 1 (full)`);
    return;
  } catch (e) {
    if (e.name !== "QuotaExceededError" && e.code !== 22 && e.code !== 1014) {
      console.error("[storage] saveToStorage error:", e.message);
      return;
    }
    console.warn("[storage] level-1 quota exceeded, trying level 2");
  }

  // Level 2 — drop originalImageData + outfitPhotos (largest fields)
  try {
    const l2 = items.map(({ originalImageData, outfitPhotos, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(l2));
    console.warn(`[storage] saved ${totalItems} items — level 2 (no originals/outfit photos)`);
    return;
  } catch {
    console.warn("[storage] level-2 quota exceeded, trying level 3");
  }

  // Level 3 — strip base64 imageData/imageThumb from the main array.
  // The image cache (saved above) still has the base64 values, so
  // loadFromStorage will restore them on the next read.
  try {
    const l3 = items.map(i => ({
      ...i,
      imageData:         isBase64(i.imageData)  ? null : i.imageData,
      imageThumb:        isBase64(i.imageThumb) ? null : i.imageThumb,
      originalImageData: null,
      outfitPhotos:      null,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(l3));
    console.warn(`[storage] saved ${totalItems} items — level 3 (base64 stripped to cache; Storage URLs kept)`);
  } catch (e3) {
    console.error("[storage] saveToStorage failed at all levels:", e3.message);
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

    console.log(`[persist] called with ${newItems.length} items, uid=${uid || "none"}`);
    const newWithImg = newItems.filter(i => i.imageData || i.imageThumb);
    console.log(`[persist] items with imageData/imageThumb: ${newWithImg.length}`);
    newWithImg.forEach(i => {
      const full  = i.imageData  ? (isBase64(i.imageData)  ? `base64 (${Math.round(i.imageData.length/1024)}KB)` : "URL: "+i.imageData.substring(0,60)) : "null";
      const thumb = i.imageThumb ? (isBase64(i.imageThumb) ? `base64 (${Math.round(i.imageThumb.length/1024)}KB)` : "URL: "+i.imageThumb.substring(0,60)) : "null";
      console.log(`[persist]   "${i.name}" imageData=${full} imageThumb=${thumb}`);
    });

    // Optimistic update — show immediately (images may still be base64 briefly)
    setItems(newItems);
    saveToStorage(newItems);

    if (!uid) {
      console.log("[persist] no uid — saved to localStorage only, skipping Storage/Supabase");
      return;
    }

    // Upload any base64 images to Supabase Storage; replace with permanent URLs.
    // On upload failure, the returned items still carry the original base64 —
    // we save that to localStorage so the image is never silently lost.
    const finalItems = await uploadItemImages(uid, newItems);
    if (finalItems !== newItems) {
      // uploadItemImages did work — save result (URLs where upload succeeded,
      // base64 where it failed, so localStorage always has the image)
      console.log("[persist] uploadItemImages done, saving finalItems to state + localStorage");
      setItems(finalItems);
      saveToStorage(finalItems);
    } else {
      console.log("[persist] uploadItemImages: no work done (already URLs or no images)");
    }

    // Diff against pre-persist snapshot and upsert only changed metadata rows
    const newIds = new Set(finalItems.map(i => String(i.id)));
    const removed = prevItems.filter(i => !newIds.has(String(i.id)));
    const upserted = finalItems.filter(i => {
      const old = prevItems.find(j => String(j.id) === String(i.id));
      return !old || JSON.stringify(stripImages(old)) !== JSON.stringify(stripImages(i));
    });
    console.log(`[persist] Supabase diff: ${removed.length} removed, ${upserted.length} upserted`);
    removed.forEach(i => sbDel("wardrobe_items", i.id, uid));
    if (upserted.length)
      sbUpsert("wardrobe_items", upserted.map(i => ({ id: String(i.id), user_id: uid, data: stripImages(i) })));

    // Prune stale image cache entries
    pruneImageCache(finalItems.map(i => i.id));
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
   * Image restore priority: current in-memory state → image cache → localStorage → nothing.
   * In-memory state takes priority because it may already hold Storage URLs from this session.
   * Image cache is checked before localStorage because it's the dedicated backup for images
   * that were stripped from the main items array by the level-3 quota fallback.
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

      // Build image lookup maps:
      // 1. stateMap — current React state (may have Storage URLs from this session)
      // 2. imageCache — dedicated image backup (survives level-3 quota fallback)
      // 3. localMap — full localStorage items (may have base64 from before quota)
      const stateMap  = new Map(items.map(i => [String(i.id), i]));
      const imageCache = loadImageCache();
      const localItems = loadFromStorage().map(normalizeItem);
      const localMap  = new Map(localItems.map(i => [String(i.id), i]));

      console.log(`[sync] image restore maps: stateMap=${stateMap.size}, imageCache=${Object.keys(imageCache).length}, localMap=${localMap.size}`);

      const withImages = normalized.map(i => {
        const id = String(i.id);
        const stateSrc = stateMap.get(id);
        const cacheSrc = imageCache[id];
        const localSrc = localMap.get(id);

        const imageData  = stateSrc?.imageData  || cacheSrc?.imageData  || localSrc?.imageData  || null;
        const imageThumb = stateSrc?.imageThumb || cacheSrc?.imageThumb || localSrc?.imageThumb || null;
        const originalImageData = stateSrc?.originalImageData || localSrc?.originalImageData || null;
        const outfitPhotos = stateSrc?.outfitPhotos || localSrc?.outfitPhotos || null;

        if (imageData || imageThumb) {
          console.log(`[sync] restored image for "${i.name || id}": ${imageData ? (isBase64(imageData) ? 'base64' : 'URL') : 'none'}`);
        }

        const patch = {};
        if (imageData)         patch.imageData         = imageData;
        if (imageThumb)        patch.imageThumb        = imageThumb;
        if (originalImageData) patch.originalImageData = originalImageData;
        if (outfitPhotos)      patch.outfitPhotos      = outfitPhotos;
        return { ...i, ...patch };
      });

      const sbIds = new Set(normalized.map(i => String(i.id)));
      const localOnly = localItems.filter(i => !sbIds.has(String(i.id)));
      const merged = normalized.length > 0 ? [...withImages, ...localOnly] : localOnly;
      console.log(`[sync] merged: ${merged.length} items (${withImages.length} from Supabase, ${localOnly.length} local-only)`);
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
