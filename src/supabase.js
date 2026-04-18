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

const SB_HDR = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
};

export async function sbUpsert(table, rows) {
  if (!rows.length) return;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...SB_HDR, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error(`[sb] upsert ${table} FAILED ${r.status}:`, txt);
    }
  } catch (e) {
    console.error("[sb] upsert error:", e.message);
  }
}

export async function sbDel(table, id, uid) {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(String(id))}&user_id=eq.${encodeURIComponent(uid)}`,
      { method: "DELETE", headers: { ...SB_HDR, Prefer: "return=minimal" } }
    );
    if (!r.ok) console.error(`[sb] delete ${table} FAILED ${r.status}`);
  } catch (e) {
    console.error("[sb] delete error:", e.message);
  }
}

export async function sbLoad(table, uid) {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/${table}?user_id=eq.${encodeURIComponent(uid)}&id=neq.__settings__&select=data&order=created_at.asc`,
      { headers: SB_HDR }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) ? rows.map(r => r.data) : null;
  } catch {
    return null;
  }
}

export async function sbSaveSettings(settings, uid) {
  await sbUpsert("wardrobe_items", [{ id: "__settings__", user_id: uid, data: settings }]);
}

export async function sbLoadSettings(uid) {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/wardrobe_items?id=eq.__settings__&user_id=eq.${encodeURIComponent(uid)}&select=data`,
      { headers: SB_HDR }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0]?.data ?? null;
  } catch {
    return null;
  }
}
