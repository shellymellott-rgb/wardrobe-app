import { useState } from "react";
import { sbDel, sbUpsert, sbLoad, sbLoadSettings, sbUploadImage, sbGetSignedUrls } from "../supabase.js";
import { normalizeItem } from "../utils/normalizeItem.js";
import { STORAGE_KEY, WISHLIST_KEY, IMAGE_CACHE_KEY } from "../constants.js";

// Strip transient/binary image fields before writing to Supabase DB.
// image_path and image_thumb_path are in ...rest and pass through to the DB —
// they are the only persistent image references.
function stripImages({ imageData, imageThumb, originalImageData, outfitPhotos, imageMigrated, ...rest }) {
  return rest;
}

// ── Image-cache helpers ──────────────────────────────────────────────────────
//
// Two kinds of entries:
//   Base64 items  (no image_path): { imageData, imageThumb }
//   Path-based    (has image_path): { imageData, imageThumb, expiry }
//     where expiry = Date.now() + signedUrlExpiresIn*1000
//     and imageData/imageThumb are signed URLs
//
// Signed URL cache entries are only used while expiry > now + 5 min.
// After that, sync regenerates them from the stored image_path.

const SIGNED_URL_EXPIRES_IN = 3600; // seconds (1 hour)

function loadImageCache() {
  try {
    const raw = localStorage.getItem(IMAGE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Persist signed URLs into the image cache with an expiry timestamp.
 * Called immediately after sbGetSignedUrls resolves so offline loads
 * can use the cached URLs for up to ~1 hour without re-syncing.
 */
function cacheSignedUrls(items, signedUrlMap) {
  if (!Object.keys(signedUrlMap).length) return;
  const expiry = Date.now() + SIGNED_URL_EXPIRES_IN * 1000;
  try {
    const cache = loadImageCache();
    items.forEach(i => {
      const id        = String(i.id);
      const imageData  = i.image_path       ? (signedUrlMap[i.image_path]       || null) : null;
      const imageThumb = i.image_thumb_path ? (signedUrlMap[i.image_thumb_path] || null) : null;
      if (imageData || imageThumb) {
        cache[id] = {
          imageData:  imageData  || cache[id]?.imageData  || null,
          imageThumb: imageThumb || cache[id]?.imageThumb || null,
          expiry,
        };
      }
    });
    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(cache));
    console.log(`[imgcache] cached signed URLs for ${items.length} items (expiry +${SIGNED_URL_EXPIRES_IN}s)`);
  } catch (e) {
    console.warn("[imgcache] failed to cache signed URLs:", e.message);
  }
}

function isBase64(s) { return typeof s === "string" && s.startsWith("data:"); }

/**
 * Save base64 images to the dedicated cache key.
 * - Path-based items (image_path set): removes any stale base64 cache entry
 *   since the image is now in Storage; signed URLs are handled by cacheSignedUrls.
 * - Base64 items (no image_path): saves imageData/imageThumb for quota fallback.
 */
function saveImageCache(items) {
  try {
    const existing = loadImageCache();
    const updated = { ...existing };
    items.forEach(i => {
      const id = String(i.id);
      if (i.image_path) {
        // Uploaded to Storage — remove stale base64 entries (not signed URL entries)
        if (updated[id] && !updated[id].expiry) {
          delete updated[id];
        }
        // Leave valid signed URL entries (those with expiry) untouched.
      } else if (isBase64(i.imageData) || isBase64(i.imageThumb)) {
        updated[id] = {
          imageData:  i.imageData  || null,
          imageThumb: i.imageThumb || null,
          // no expiry — base64 never expires
        };
      }
    });
    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(updated));
    console.log(`[imgcache] saved ${Object.keys(updated).length} image entries`);
  } catch (e) {
    console.warn("[imgcache] quota on full cache, falling back to batch-only save:", e.message);
    try {
      const batchCache = {};
      items.forEach(i => {
        if (!i.image_path && (isBase64(i.imageData) || isBase64(i.imageThumb))) {
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
 * Apply signed URLs (or cached signed URLs) onto an array of items.
 * signedUrlMap maps storage path → signed URL string.
 * Items without image_path are unchanged.
 */
function applySignedUrls(items, signedUrlMap) {
  return items.map(i => {
    if (!i.image_path && !i.image_thumb_path) return i;
    const imageData  = i.image_path       ? (signedUrlMap[i.image_path]       || i.imageData  || null) : i.imageData;
    const imageThumb = i.image_thumb_path ? (signedUrlMap[i.image_thumb_path] || i.imageThumb || null) : i.imageThumb;
    if (imageData === i.imageData && imageThumb === i.imageThumb) return i;
    return { ...i, imageData, imageThumb };
  });
}

/**
 * For any item whose imageData/imageThumb is still a base64 data URL,
 * upload it to Supabase Storage and store the path in image_path/image_thumb_path.
 * On success, generates signed URLs and sets imageData/imageThumb in memory.
 * On failure, keeps base64 so localStorage retains the image.
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

  let uploadedPaths = [];

  const result = await Promise.all(items.map(async item => {
    const needsFull  = item.imageData?.startsWith("data:");
    const needsThumb = item.imageThumb?.startsWith("data:");
    if (!needsFull && !needsThumb) return item;

    console.log(`[persist] uploading images for "${item.name}" (id=${item.id})`);
    const updated = { ...item };

    if (needsFull) {
      const path = await sbUploadImage(uid, String(item.id), item.imageData, false);
      if (path) {
        updated.image_path = path;
        uploadedPaths.push(path);
        console.log(`[persist] ✓ full uploaded for "${item.name}": ${path}`);
      } else {
        console.error(`[persist] ✗ Storage upload FAILED for "${item.name}" — keeping base64 in localStorage`);
      }
    }
    if (needsThumb) {
      const path = await sbUploadImage(uid, String(item.id), item.imageThumb, true);
      if (path) {
        updated.image_thumb_path = path;
        uploadedPaths.push(path);
        console.log(`[persist] ✓ thumb uploaded for "${item.name}": ${path}`);
      } else {
        console.error(`[persist] ✗ Storage thumb upload FAILED for "${item.name}"`);
      }
    }

    return updated;
  }));

  // Batch-generate signed URLs for all newly uploaded paths and apply to items.
  // This gives immediate display while keeping only paths in persistent storage.
  if (uploadedPaths.length) {
    const signedUrlMap = await sbGetSignedUrls(uploadedPaths);
    const withUrls = applySignedUrls(result, signedUrlMap);
    cacheSignedUrls(withUrls, signedUrlMap);
    return withUrls;
  }

  return result;
}

// ── localStorage helpers ────────────────────────────────────────────────────

export function loadFromStorage() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    const parsed = r ? JSON.parse(r) : [];
    const cache  = loadImageCache();
    const now    = Date.now();
    const FIVE_MIN = 5 * 60 * 1000;

    const cacheHits = [];
    const merged = parsed.map(item => {
      // Items that already have both images (e.g., base64 in main array) need no patch.
      if (item.imageData && item.imageThumb) return item;

      const cached = cache[String(item.id)];
      if (!cached) return item;

      // Signed URL cache entries respect expiry — skip if < 5 min remaining.
      if (cached.expiry && cached.expiry < now + FIVE_MIN) return item;

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
  // Strip transient signed URLs from path-based items before persisting.
  // Signed URLs expire; image_path/image_thumb_path are permanent and stay.
  // Items without image_path keep their imageData/imageThumb (base64 fallback).
  const toSave = items.map(i =>
    i.image_path ? { ...i, imageData: null, imageThumb: null } : i
  );

  // Save base64 image cache for non-path items (quota fallback backup).
  saveImageCache(toSave);

  const totalItems = toSave.length;
  const withImages = toSave.filter(i => i.imageData || i.imageThumb || i.image_path).length;

  // Level 1 — full save
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    console.log(`[storage] saved ${totalItems} items (${withImages} with image ref) — level 1 (full)`);
    return;
  } catch (e) {
    if (e.name !== "QuotaExceededError" && e.code !== 22 && e.code !== 1014) {
      console.error("[storage] saveToStorage error:", e.message);
      return;
    }
    console.warn("[storage] level-1 quota exceeded, trying level 2");
  }

  // Level 2 — drop originalImageData + outfitPhotos
  try {
    const l2 = toSave.map(({ originalImageData, outfitPhotos, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(l2));
    console.warn(`[storage] saved ${totalItems} items — level 2 (no originals/outfit photos)`);
    return;
  } catch {
    console.warn("[storage] level-2 quota exceeded, trying level 3");
  }

  // Level 3 — strip any remaining base64 (path-based items already have null imageData)
  try {
    const l3 = toSave.map(i => ({
      ...i,
      imageData:         isBase64(i.imageData)  ? null : i.imageData,
      imageThumb:        isBase64(i.imageThumb) ? null : i.imageThumb,
      originalImageData: null,
      outfitPhotos:      null,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(l3));
    console.warn(`[storage] saved ${totalItems} items — level 3 (base64 stripped to cache; paths kept)`);
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
    const prevItems = items;

    console.log(`[persist] called with ${newItems.length} items, uid=${uid || "none"}`);
    const newWithImg = newItems.filter(i => i.imageData || i.imageThumb || i.image_path);
    console.log(`[persist] items with image refs: ${newWithImg.length}`);
    newWithImg.forEach(i => {
      const full  = i.imageData  ? (isBase64(i.imageData)  ? `base64 (${Math.round(i.imageData.length/1024)}KB)` : "URL") : "null";
      const thumb = i.imageThumb ? (isBase64(i.imageThumb) ? `base64 (${Math.round(i.imageThumb.length/1024)}KB)` : "URL") : "null";
      const path  = i.image_path ? i.image_path : "none";
      console.log(`[persist]   "${i.name}" full=${full} thumb=${thumb} path=${path}`);
    });

    setItems(newItems);
    saveToStorage(newItems);

    if (!uid) {
      console.log("[persist] no uid — saved to localStorage only, skipping Storage/Supabase");
      return;
    }

    const finalItems = await uploadItemImages(uid, newItems);
    if (finalItems !== newItems) {
      console.log("[persist] uploadItemImages done, saving finalItems");
      setItems(finalItems);
      saveToStorage(finalItems);
    } else {
      console.log("[persist] uploadItemImages: no work done");
    }

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
   *
   * Image restore priority for each item:
   *  1. image_path in DB row → batch-generate signed URLs (most authoritative)
   *  2. Current in-memory React state (may have valid signed URL from this session)
   *  3. Image cache (signed URL with valid expiry, or base64)
   *  4. localStorage items map
   *
   * Signed URLs are generated in one batch call after merging, then cached.
   * "Broken rows" (Storage file exists but image_path missing from DB) are fixed
   * during persist() — the next edit+save of that item will set image_path.
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

      const stateMap   = new Map(items.map(i => [String(i.id), i]));
      const imageCache = loadImageCache();
      const localItems = loadFromStorage().map(normalizeItem);
      const localMap   = new Map(localItems.map(i => [String(i.id), i]));

      console.log(`[sync] image restore maps: stateMap=${stateMap.size}, imageCache=${Object.keys(imageCache).length}, localMap=${localMap.size}`);

      const now = Date.now();
      const FIVE_MIN = 5 * 60 * 1000;

      // Merge: prefer DB paths (most authoritative); restore other image fields from
      // state/cache/local for items the DB doesn't have paths for yet.
      const withImages = normalized.map(i => {
        const id       = String(i.id);
        const stateSrc = stateMap.get(id);
        const cached   = imageCache[id];
        const localSrc = localMap.get(id);

        // image_path/image_thumb_path come from DB via normalizeItem — they are canonical.
        // imageData/imageThumb: prefer state (may be fresh signed URL from this session),
        // then cache (if not expired), then local.
        const cachedValid = cached && (!cached.expiry || cached.expiry > now + FIVE_MIN);

        const imageData  = stateSrc?.imageData  ||
                           (cachedValid ? cached.imageData  : null) ||
                           localSrc?.imageData  || null;
        const imageThumb = stateSrc?.imageThumb ||
                           (cachedValid ? cached.imageThumb : null) ||
                           localSrc?.imageThumb || null;
        const originalImageData = stateSrc?.originalImageData || localSrc?.originalImageData || null;
        const outfitPhotos      = stateSrc?.outfitPhotos      || localSrc?.outfitPhotos      || null;

        const patch = {};
        if (imageData)         patch.imageData         = imageData;
        if (imageThumb)        patch.imageThumb        = imageThumb;
        if (originalImageData) patch.originalImageData = originalImageData;
        if (outfitPhotos)      patch.outfitPhotos      = outfitPhotos;
        return { ...i, ...patch };
      });

      // Collect all Storage paths that need signed URLs.
      // Items that already have a fresh signed URL in memory can skip.
      const pathsToSign = [];
      withImages.forEach(i => {
        if (i.image_path       && !i.imageData?.startsWith("https://"))  pathsToSign.push(i.image_path);
        if (i.image_thumb_path && !i.imageThumb?.startsWith("https://")) pathsToSign.push(i.image_thumb_path);
      });

      let mergedWithUrls = withImages;
      if (pathsToSign.length) {
        console.log(`[sync] generating signed URLs for ${pathsToSign.length} paths`);
        const signedUrlMap = await sbGetSignedUrls(pathsToSign);
        mergedWithUrls = applySignedUrls(withImages, signedUrlMap);
        cacheSignedUrls(mergedWithUrls, signedUrlMap);
      }

      const sbIds     = new Set(normalized.map(i => String(i.id)));
      const localOnly = localItems.filter(i => !sbIds.has(String(i.id)));
      const merged    = normalized.length > 0 ? [...mergedWithUrls, ...localOnly] : localOnly;
      console.log(`[sync] merged: ${merged.length} items (${mergedWithUrls.length} from Supabase, ${localOnly.length} local-only)`);
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

    setSyncing(false);
  }

  return {
    items, setItems, persist,
    wishlist, setWishlist, persistWishlist,
    brands, addBrand,
    syncing, syncFromSupabase,
  };
}
