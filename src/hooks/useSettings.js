import { useState } from "react";
import { sbSaveSettings } from "../supabase.js";
import { CATEGORIES, DEFAULT_STYLE_SYSTEM } from "../constants.js";

export function useSettings(user) {
  const uid = () => user?.id;

  const [customCategories, setCustomCategories] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem("wardrobe-custom-categories") || "[]"); return Array.isArray(p) ? p : []; }
    catch { return []; }
  });

  const [styleProfile, setStyleProfile] = useState(() => {
    try { return localStorage.getItem("wardrobe-style-profile") || DEFAULT_STYLE_SYSTEM; }
    catch { return DEFAULT_STYLE_SYSTEM; }
  });

  const [extraInstructions, setExtraInstructions] = useState(() => {
    try { return localStorage.getItem("wardrobe-extra-instructions") || ""; }
    catch { return ""; }
  });

  const [chatHistory, setChatHistory] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("wardrobe-chat-history") ||
        localStorage.getItem("wardrobe-chat") ||
        "[]"
      );
    } catch { return []; }
  });

  const [styleNotes, setStyleNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wardrobe-style-notes") || "[]"); }
    catch { return []; }
  });

  const [weatherEnabled, setWeatherEnabled] = useState(() => {
    try { return localStorage.getItem("wardrobe-weather-enabled") === "true"; }
    catch { return false; }
  });

  const [homeCity, setHomeCity] = useState(() => {
    try { return localStorage.getItem("wardrobe-home-city") || ""; }
    catch { return ""; }
  });

  // ── Core save helper ───────────────────────────────────────────────────────
  // Accepts an optional patch to override any individual field before saving.
  // Uses the current state values for everything else, so callers must pass
  // new values through `patch` when calling right after a state update (async).
  function saveSettings(patch = {}) {
    const id = uid();
    if (!id) return;
    sbSaveSettings({
      customCategories: Array.isArray(customCategories) ? customCategories : [],
      styleProfile,
      extraInstructions,
      chatHistory: chatHistory.slice(-30),
      styleNotes,
      weatherEnabled,
      homeCity,
      ...patch,
    }, id);
  }

  // ── Hydrate from DB ────────────────────────────────────────────────────────
  // Fix: use `"key" in` checks so empty arrays / empty strings from DB overwrite
  // local state (instead of the old falsy-check approach that ignored them).
  function syncSettingsFrom(dbSettings) {
    if (!dbSettings || typeof dbSettings !== "object") return;
    if ("customCategories" in dbSettings) {
      const v = Array.isArray(dbSettings.customCategories) ? dbSettings.customCategories : [];
      setCustomCategories(v);
      try { localStorage.setItem("wardrobe-custom-categories", JSON.stringify(v)); } catch {}
    }
    if ("styleProfile" in dbSettings) {
      setStyleProfile(dbSettings.styleProfile || DEFAULT_STYLE_SYSTEM);
      try { localStorage.setItem("wardrobe-style-profile", dbSettings.styleProfile || ""); } catch {}
    }
    if ("extraInstructions" in dbSettings) {
      setExtraInstructions(dbSettings.extraInstructions || "");
      try { localStorage.setItem("wardrobe-extra-instructions", dbSettings.extraInstructions || ""); } catch {}
    }
    if ("chatHistory" in dbSettings) {
      const v = Array.isArray(dbSettings.chatHistory) ? dbSettings.chatHistory : [];
      setChatHistory(v);
      try { localStorage.setItem("wardrobe-chat-history", JSON.stringify(v)); } catch {}
    }
    if ("styleNotes" in dbSettings) {
      const v = Array.isArray(dbSettings.styleNotes) ? dbSettings.styleNotes : [];
      setStyleNotes(v);
      try { localStorage.setItem("wardrobe-style-notes", JSON.stringify(v)); } catch {}
    }
    if ("weatherEnabled" in dbSettings) {
      setWeatherEnabled(!!dbSettings.weatherEnabled);
      try { localStorage.setItem("wardrobe-weather-enabled", String(!!dbSettings.weatherEnabled)); } catch {}
    }
    if ("homeCity" in dbSettings) {
      setHomeCity(dbSettings.homeCity || "");
      try { localStorage.setItem("wardrobe-home-city", dbSettings.homeCity || ""); } catch {}
    }
  }

  // ── Custom categories ──────────────────────────────────────────────────────
  function addCustomCategory(name) {
    const c = name.trim();
    if (!c) return false;
    const safe = Array.isArray(customCategories) ? customCategories : [];
    const all = [...CATEGORIES, ...safe];
    if (all.map(x => x.toLowerCase()).includes(c.toLowerCase())) return false;
    const next = [...safe, c];
    setCustomCategories(next);
    try { localStorage.setItem("wardrobe-custom-categories", JSON.stringify(next)); } catch {}
    saveSettings({ customCategories: next });
    return true;
  }

  function removeCustomCategory(idx) {
    const safe = Array.isArray(customCategories) ? customCategories : [];
    const next = safe.filter((_, j) => j !== idx);
    setCustomCategories(next);
    try { localStorage.setItem("wardrobe-custom-categories", JSON.stringify(next)); } catch {}
    saveSettings({ customCategories: next });
  }

  // ── Style notes (centralized) ──────────────────────────────────────────────
  // All three mutations (add / remove / clear) write React state + localStorage + Supabase.
  function addStyleNote(note) {
    const next = [...styleNotes, note];
    setStyleNotes(next);
    try { localStorage.setItem("wardrobe-style-notes", JSON.stringify(next)); } catch {}
    saveSettings({ styleNotes: next });
  }

  function removeStyleNote(idx) {
    const next = styleNotes.filter((_, j) => j !== idx);
    setStyleNotes(next);
    try { localStorage.setItem("wardrobe-style-notes", JSON.stringify(next)); } catch {}
    saveSettings({ styleNotes: next });
  }

  function clearStyleNotes() {
    setStyleNotes([]);
    try { localStorage.removeItem("wardrobe-style-notes"); } catch {}
    saveSettings({ styleNotes: [] });
  }

  // ── Style system builder ───────────────────────────────────────────────────
  function buildStyleSystem() {
    const profile = styleProfile.trim() || DEFAULT_STYLE_SYSTEM;
    const parts = [profile];
    if (styleNotes.length)
      parts.push(`Learned preferences:\n${styleNotes.map(n => `- ${n}`).join("\n")}`);
    if (extraInstructions.trim())
      parts.push(`Current instructions:\n${extraInstructions.trim()}`);
    return parts.join("\n\n");
  }

  return {
    customCategories, setCustomCategories,
    addCustomCategory, removeCustomCategory,
    styleProfile, setStyleProfile,
    extraInstructions, setExtraInstructions,
    chatHistory, setChatHistory,
    styleNotes, addStyleNote, removeStyleNote, clearStyleNotes,
    weatherEnabled, setWeatherEnabled,
    homeCity, setHomeCity,
    saveSettings, syncSettingsFrom, buildStyleSystem,
  };
}
