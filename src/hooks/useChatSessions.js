import { supabase } from "../supabase.js";

export function useChatSessions() {
  async function loadProfile(userId) {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("wardrobe_profile")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error) { console.warn("[profile] load failed:", error.message); return null; }
    return data;
  }

  async function upsertProfile(userId, updates) {
    if (!userId) return;
    const { error } = await supabase
      .from("wardrobe_profile")
      .upsert({ user_id: userId, ...updates }, { onConflict: "user_id" });
    if (error) console.warn("[profile] upsert failed:", error.message);
  }

  async function createSession(userId) {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({ user_id: userId, status: "active" })
      .select("id")
      .single();
    if (error) { console.warn("[session] create failed:", error.message); return null; }
    return data?.id ?? null;
  }

  async function endSession(sessionId) {
    if (!sessionId) return;
    const { error } = await supabase
      .from("chat_sessions")
      .update({ status: "ended" })
      .eq("id", sessionId);
    if (error) console.warn("[session] end failed:", error.message);
  }

  async function saveMessage(sessionId, role, content) {
    if (!sessionId) return;
    const { error } = await supabase
      .from("chat_messages")
      .insert({ session_id: sessionId, role, content });
    if (error) console.warn("[message] save failed:", error.message);
  }

  return { loadProfile, upsertProfile, createSession, endSession, saveMessage };
}
