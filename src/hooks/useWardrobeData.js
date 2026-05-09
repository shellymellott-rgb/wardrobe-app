import { useState } from "react";
import { sbDel, sbUpsert, sbLoad, sbLoadSettings, sbUploadImage, sbGetSignedUrls, sbUploadImageAndGetPath } from "../supabase.js";
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
// The image cache stores signed URL entries only:
//   { imageData: signedUrl, imageThumb: signedUrl, expiry: timestamp }
//
// Entries are written by cacheSignedUrls() after sbGetSignedUrls() resolves.
// loadFromStorage() reads them back so items display immediately on reload
// without waiting for a full sync to regenerate signed URLs.

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
 * Called immediately after sbGetSignedUrls resolves so offline/reload loads
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

// ── localStorage helpers ────────────────────────────────────────────────────

export function loadFromStorage() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    const parsed = r ? JSON.parse(r) : [];
    const cache  = loadImageCache();
    const now    = Date.now();
    const FIVE_MIN = 5 * 60 * 1000;

    // Restore signed URLs from cache for items that have unexpired entries.
    // imageData/imageThumb are never written to localStorage (stripped on every save),
    // so items always load without images initially — the cache provides fast restore
    // while syncFromSupabase runs in the background.
    const merged = parsed.map(item => {
      const cached = cache[String(item.id)];
      if (!cached?.expiry || cached.expiry < now + FIVE_MIN) return item;
      return {
        ...item,
        imageData:  item.imageData  || cached.imageData  || null,
        imageThumb: item.imageThumb || cached.imageThumb || null,
      };
    });

    console.log("[storage] loadFromStorage:", merged.length, "items");
    return merged;
  }
  catch (e) { console.error("[storage] loadFromStorage parse error:", e.message); return []; }
}

export function saveToStorage(items) {
  // Strip imageData and imageThumb from all items — base64 is never persisted
  // to localStorage; Supabase Storage is the only image source of truth.
  // image_path and image_thumb_path are metadata and remain.
  const toSave = items.map(i => ({ ...i, imageData: null, imageThumb: null }));

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    console.log(`[storage] saved ${toSave.length} items (images stripped)`);
  } catch (e) {
    console.error("[storage] saveToStorage failed:", e.message);
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
  const [customCategories, setCustomCategories] = useState(() => {
    try { const c = localStorage.getItem("wardrobe-custom-categories"); return c ? JSON.parse(c) : []; }
    catch { return []; }
  });
  const [syncing, setSyncing] = useState(false);

  /**
   * Save items. If any item has a new base64 image (imageData starts with "data:"
   * and no image_path yet), uploads to Supabase Storage FIRST — blocking.
   * Throws on upload failure so callers can show an error and not save.
   *
   * Items with no image at all (no imageData, no image_path) save immediately
   * without any upload attempt.
   *
   * Returns finalItems (with signed URLs applied) so callers can update
   * selectedItem or other derived state without a stale reference.
   */
  async function persist(newItems) {
    const uid = user?.id;
    const prevItems = items;

    // No user — update state only, no Storage/Supabase
    if (!uid) {
      setItems(newItems);
      saveToStorage(newItems);
      return newItems;
    }

    // Upload images FIRST — blocking — before any state or DB changes.
    // Only items with base64 imageData and no image_path need uploading.
    // Items with no imageData and no image_path (no image at all) pass through.
    const needsUpload = newItems.some(i => isBase64(i.imageData) && !i.image_path);

    let finalItems = newItems;
    if (needsUpload) {
      const uploadedPaths = [];

      const uploaded = await Promise.all(
        newItems.map(async item => {
          const needsFull  = isBase64(item.imageData)  && !item.image_path;
          const needsThumb = isBase64(item.imageThumb) && !item.image_thumb_path;
          if (!needsFull && !needsThumb) return item;

          console.log(`[persist] uploading images for "${item.name}" (id=${item.id})`);
          const updated = { ...item };

          if (needsFull) {
            const path = await sbUploadImageAndGetPath(uid, String(item.id), item.imageData, false);
            updated.image_path = path;
            uploadedPaths.push(path);
            console.log(`[persist] ✓ full uploaded: ${path}`);
          }
          if (needsThumb) {
            const path = await sbUploadImageAndGetPath(uid, String(item.id), item.imageThumb, true);
            updated.image_thumb_path = path;
            uploadedPaths.push(path);
            console.log(`[persist] ✓ thumb uploaded: ${path}`);
          }
          return updated;
        })
      );

      // Generate signed URLs for newly uploaded paths so images display immediately
      if (uploadedPaths.length) {
        const signedUrlMap = await sbGetSignedUrls(uploadedPaths);
        finalItems = applySignedUrls(uploaded, signedUrlMap);
        cacheSignedUrls(finalItems, signedUrlMap);
      } else {
        finalItems = uploaded;
      }
    }

    setItems(finalItems);
    saveToStorage(finalItems);

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

    return finalItems;
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

  function addCustomCategory(cat) {
    if (!cat || customCategories.includes(cat)) return;
    const updated = [...customCategories, cat].sort();
    setCustomCategories(updated);
    try { localStorage.setItem("wardrobe-custom-categories", JSON.stringify(updated)); } catch {}
  }

  /**
   * Pull data from Supabase and merge with local state.
   *
   * Image restore priority for each item:
   *  1. image_path in DB row → batch-generate signed URLs (most authoritative)
   *  2. Current in-memory React state (may have valid signed URL from this session)
   *  3. Image cache (signed URL with valid expiry)
   *
   * Signed URLs are generated in one batch call after merging, then cached.
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

      console.log(`[sync] image restore maps: stateMap=${stateMap.size}, imageCache=${Object.keys(imageCache).length}`);

      const now = Date.now();
      const FIVE_MIN = 5 * 60 * 1000;

      // Merge: prefer DB paths (most authoritative); restore signed URLs from
      // state/cache for items that already have a fresh URL this session.
      const withImages = normalized.map(i => {
        const id       = String(i.id);
        const stateSrc = stateMap.get(id);
        const cached   = imageCache[id];
        const localSrc = localMap.get(id);

        const cachedValid = cached && (!cached.expiry || cached.expiry > now + FIVE_MIN);

        // imageData/imageThumb: prefer in-memory state (fresh signed URL),
        // then image cache (unexpired signed URL).
        // localStorage no longer stores imageData/imageThumb — not consulted.
        const imageData  = stateSrc?.imageData  ||
                           (cachedValid ? cached.imageData  : null) || null;
        const imageThumb = stateSrc?.imageThumb ||
                           (cachedValid ? cached.imageThumb : null) || null;

        // originalImageData and outfitPhotos come from state or local storage
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
      const pathsToSign = [];
      withImages.forEach(i => {
        const id = String(i.id);
        const cached = loadImageCache()[id];
        const urlFresh = cached?.expiry && cached.expiry > Date.now() + FIVE_MIN;
        if (i.image_path       && (!i.imageData?.startsWith("https://")  || !urlFresh)) pathsToSign.push(i.image_path);
        if (i.image_thumb_path && (!i.imageThumb?.startsWith("https://") || !urlFresh)) pathsToSign.push(i.image_thumb_path);
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
    customCategories, addCustomCategory,
    syncing, syncFromSupabase,
  };
}
