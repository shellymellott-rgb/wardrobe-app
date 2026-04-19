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
