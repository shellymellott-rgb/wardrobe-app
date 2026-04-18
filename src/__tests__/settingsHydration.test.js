/**
 * Tests for the syncSettingsFrom logic.
 *
 * The hook uses `"key" in dbSettings` checks so that empty arrays and empty
 * strings from the DB intentionally overwrite local state. We simulate that
 * logic here as a pure function so it can be tested without React.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_STYLE_SYSTEM } from "../constants.js";

/**
 * Pure extraction of the syncSettingsFrom merge logic (mirrors useSettings.js).
 * Returns what each state setter would receive, keyed by field name.
 * If a field is absent from dbSettings, its key is not present in the return value.
 */
function applyDbSettings(dbSettings) {
  if (!dbSettings || typeof dbSettings !== "object") return {};
  const result = {};

  if ("customCategories" in dbSettings) {
    result.customCategories = Array.isArray(dbSettings.customCategories)
      ? dbSettings.customCategories
      : [];
  }
  if ("styleProfile" in dbSettings) {
    result.styleProfile = dbSettings.styleProfile || DEFAULT_STYLE_SYSTEM;
  }
  if ("extraInstructions" in dbSettings) {
    result.extraInstructions = dbSettings.extraInstructions || "";
  }
  if ("chatHistory" in dbSettings) {
    result.chatHistory = Array.isArray(dbSettings.chatHistory)
      ? dbSettings.chatHistory
      : [];
  }
  if ("styleNotes" in dbSettings) {
    result.styleNotes = Array.isArray(dbSettings.styleNotes)
      ? dbSettings.styleNotes
      : [];
  }

  return result;
}

// ── empty-array overwrite ─────────────────────────────────────────────────────

describe("syncSettingsFrom — empty-array overwrite (key-in check)", () => {
  it("overwrites customCategories with an empty array from DB", () => {
    const applied = applyDbSettings({ customCategories: [] });
    expect(applied).toHaveProperty("customCategories");
    expect(applied.customCategories).toEqual([]);
  });

  it("overwrites chatHistory with an empty array from DB", () => {
    const applied = applyDbSettings({ chatHistory: [] });
    expect(applied).toHaveProperty("chatHistory");
    expect(applied.chatHistory).toEqual([]);
  });

  it("overwrites styleNotes with an empty array from DB", () => {
    const applied = applyDbSettings({ styleNotes: [] });
    expect(applied).toHaveProperty("styleNotes");
    expect(applied.styleNotes).toEqual([]);
  });

  it("overwrites extraInstructions with an empty string from DB", () => {
    const applied = applyDbSettings({ extraInstructions: "" });
    expect(applied).toHaveProperty("extraInstructions");
    expect(applied.extraInstructions).toBe("");
  });
});

// ── absent keys do NOT overwrite ──────────────────────────────────────────────

describe("syncSettingsFrom — absent keys are ignored", () => {
  it("does not include customCategories if absent from dbSettings", () => {
    const applied = applyDbSettings({ styleProfile: "My style" });
    expect(applied).not.toHaveProperty("customCategories");
  });

  it("does not include chatHistory if absent from dbSettings", () => {
    const applied = applyDbSettings({ extraInstructions: "Pack light" });
    expect(applied).not.toHaveProperty("chatHistory");
  });

  it("does not include styleNotes if absent from dbSettings", () => {
    const applied = applyDbSettings({});
    expect(applied).not.toHaveProperty("styleNotes");
  });
});

// ── valid non-empty values ────────────────────────────────────────────────────

describe("syncSettingsFrom — valid non-empty values applied", () => {
  it("applies non-empty customCategories", () => {
    const applied = applyDbSettings({ customCategories: ["Loungewear", "Swimwear"] });
    expect(applied.customCategories).toEqual(["Loungewear", "Swimwear"]);
  });

  it("applies styleProfile from DB", () => {
    const applied = applyDbSettings({ styleProfile: "Minimalist" });
    expect(applied.styleProfile).toBe("Minimalist");
  });

  it("falls back to DEFAULT_STYLE_SYSTEM when styleProfile is null", () => {
    const applied = applyDbSettings({ styleProfile: null });
    expect(applied.styleProfile).toBe(DEFAULT_STYLE_SYSTEM);
  });

  it("applies styleNotes array from DB", () => {
    const applied = applyDbSettings({ styleNotes: ["loves linen", "avoids polyester"] });
    expect(applied.styleNotes).toEqual(["loves linen", "avoids polyester"]);
  });

  it("applies chatHistory array from DB", () => {
    const history = [{ role: "user", content: "hi" }];
    const applied = applyDbSettings({ chatHistory: history });
    expect(applied.chatHistory).toEqual(history);
  });
});

// ── non-array values coerced to arrays ────────────────────────────────────────

describe("syncSettingsFrom — non-array values coerced to []", () => {
  it("coerces non-array customCategories to []", () => {
    const applied = applyDbSettings({ customCategories: "Tops" });
    expect(applied.customCategories).toEqual([]);
  });

  it("coerces non-array chatHistory to []", () => {
    const applied = applyDbSettings({ chatHistory: null });
    expect(applied.chatHistory).toEqual([]);
  });

  it("coerces non-array styleNotes to []", () => {
    const applied = applyDbSettings({ styleNotes: 42 });
    expect(applied.styleNotes).toEqual([]);
  });
});

// ── null / invalid input ──────────────────────────────────────────────────────

describe("syncSettingsFrom — null / invalid input", () => {
  it("returns empty object for null input", () => {
    expect(applyDbSettings(null)).toEqual({});
  });

  it("returns empty object for undefined input", () => {
    expect(applyDbSettings(undefined)).toEqual({});
  });

  it("returns empty object for non-object input", () => {
    expect(applyDbSettings("string")).toEqual({});
  });
});
