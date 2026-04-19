import { createClient } from "@supabase/supabase-js";

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SB_URL || !SB_KEY) {
  throw new Error(
    "Missing Supabase environment variables. " +
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local (local dev) " +
    "or Vercel Environment Variables (production)."
  );
}

export const supabase = createClient(SB_URL, SB_KEY);

export async function sbUpsert(table, rows) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) console.error(`[sb] upsert ${table} FAILED:`, error.message);
}

export async function sbDel(table, id, uid) {
  const { error } = await supabase.from(table).delete().eq("id", String(id)).eq("user_id", uid);
  if (error) console.error(`[sb] delete ${table} FAILED:`, error.message);
}

export async function sbLoad(table, uid) {
  const { data, error } = await supabase
    .from(table)
    .select("data")
    .eq("user_id", uid)
    .neq("id", "__settings__")
    .order("created_at", { ascending: true });
  if (error) { console.error(`[sb] load ${table} FAILED:`, error.message); return null; }
  return Array.isArray(data) ? data.map(r => r.data) : null;
}

export async function sbSaveSettings(settings, uid) {
  await sbUpsert("wardrobe_items", [{ id: "__settings__", user_id: uid, data: settings }]);
}

export async function sbLoadSettings(uid) {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("data")
    .eq("id", "__settings__")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) { console.error("[sb] loadSettings FAILED:", error.message); return null; }
  return data?.data ?? null;
}

// ── Outfits ───────────────────────────────────────────────────────────────────

/**
 * Create a new outfit row and write its item linkage in outfit_items.
 * Returns the outfit id on success, null on failure.
 */
export async function sbCreateOutfit({ id, user_id, name, date_worn = null }, itemIds = []) {
  const { error: outfitErr } = await supabase
    .from("outfits")
    .insert({ id, user_id, name, date_worn });
  if (outfitErr) { console.error("[sb] createOutfit FAILED:", outfitErr.message); return null; }
  if (itemIds.length) {
    const rows = itemIds.map(item_id => ({ outfit_id: id, item_id: String(item_id) }));
    const { error: itemsErr } = await supabase.from("outfit_items").insert(rows);
    if (itemsErr) console.error("[sb] saveOutfitItems FAILED:", itemsErr.message);
  }
  return id;
}

/**
 * Load all outfits for a user, each with its item_ids as an array of strings.
 * Returns [{ id, name, date_worn, created_at, itemIds: string[] }] or null.
 */
export async function sbLoadOutfits(uid) {
  const { data, error } = await supabase
    .from("outfits")
    .select("id, name, date_worn, created_at, outfit_items(item_id)")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) { console.error("[sb] loadOutfits FAILED:", error.message); return null; }
  return data.map(row => ({
    id:         row.id,
    name:       row.name,
    date_worn:  row.date_worn,
    created_at: row.created_at,
    itemIds:    (row.outfit_items || []).map(r => r.item_id),
  }));
}

/**
 * Update outfit fields (name and/or date_worn).
 */
export async function sbUpdateOutfit(id, patch) {
  const { error } = await supabase.from("outfits").update(patch).eq("id", id);
  if (error) console.error("[sb] updateOutfit FAILED:", error.message);
}

/**
 * Delete an outfit and its items (cascades via FK).
 */
export async function sbDeleteOutfit(id) {
  const { error } = await supabase.from("outfits").delete().eq("id", id);
  if (error) console.error("[sb] deleteOutfit FAILED:", error.message);
}
