/**
 * Tests for the style notes add/remove/clear logic and buildStyleSystem.
 *
 * The hook logic is extracted as pure functions here so they can be tested
 * without React. The patterns mirror useSettings.js exactly.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_STYLE_SYSTEM } from "../constants.js";

// Pure simulation of the styleNotes mutations (mirrors useSettings.js).
// Each returns { notes, savedToLocalKey } — we don't actually call localStorage
// but we verify the value that would be stored.

function addNote(current, note) {
  return [...current, note];
}

function removeNote(current, idx) {
  return current.filter((_, j) => j !== idx);
}

function clearNotes() {
  return [];
}

/**
 * Pure extraction of buildStyleSystem logic (mirrors useSettings.js).
 */
function buildStyleSystem({ styleProfile, styleNotes, extraInstructions }) {
  const profile = (styleProfile || "").trim() || DEFAULT_STYLE_SYSTEM;
  const parts = [profile];
  if (styleNotes.length)
    parts.push(`Learned preferences:\n${styleNotes.map(n => `- ${n}`).join("\n")}`);
  if (extraInstructions.trim())
    parts.push(`Current instructions:\n${extraInstructions.trim()}`);
  return parts.join("\n\n");
}

// ── addNote ───────────────────────────────────────────────────────────────────

describe("addNote", () => {
  it("appends a note to an empty list", () => {
    expect(addNote([], "loves linen")).toEqual(["loves linen"]);
  });

  it("appends to an existing list without mutation", () => {
    const original = ["wears neutrals"];
    const next = addNote(original, "avoids polyester");
    expect(next).toEqual(["wears neutrals", "avoids polyester"]);
    expect(original).toEqual(["wears neutrals"]); // not mutated
  });

  it("allows duplicate notes", () => {
    expect(addNote(["note"], "note")).toEqual(["note", "note"]);
  });
});

// ── removeNote ────────────────────────────────────────────────────────────────

describe("removeNote", () => {
  it("removes a note by index", () => {
    expect(removeNote(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });

  it("removes the first note", () => {
    expect(removeNote(["a", "b"], 0)).toEqual(["b"]);
  });

  it("removes the last note, leaving empty array", () => {
    expect(removeNote(["only"], 0)).toEqual([]);
  });

  it("does not mutate the original array", () => {
    const original = ["x", "y"];
    removeNote(original, 0);
    expect(original).toEqual(["x", "y"]);
  });

  it("is a no-op for out-of-bounds index (filter behaviour)", () => {
    expect(removeNote(["a", "b"], 99)).toEqual(["a", "b"]);
  });
});

// ── clearNotes ────────────────────────────────────────────────────────────────

describe("clearNotes", () => {
  it("returns an empty array regardless of input", () => {
    expect(clearNotes(["a", "b", "c"])).toEqual([]);
    expect(clearNotes([])).toEqual([]);
  });
});

// ── buildStyleSystem ──────────────────────────────────────────────────────────

describe("buildStyleSystem", () => {
  it("returns only the profile when no notes or extra instructions", () => {
    const result = buildStyleSystem({
      styleProfile: "Classic and minimal",
      styleNotes: [],
      extraInstructions: "",
    });
    expect(result).toBe("Classic and minimal");
  });

  it("falls back to DEFAULT_STYLE_SYSTEM when styleProfile is empty", () => {
    const result = buildStyleSystem({
      styleProfile: "",
      styleNotes: [],
      extraInstructions: "",
    });
    expect(result).toBe(DEFAULT_STYLE_SYSTEM);
  });

  it("falls back to DEFAULT_STYLE_SYSTEM when styleProfile is whitespace", () => {
    const result = buildStyleSystem({
      styleProfile: "   ",
      styleNotes: [],
      extraInstructions: "",
    });
    expect(result).toBe(DEFAULT_STYLE_SYSTEM);
  });

  it("appends style notes section when notes are present", () => {
    const result = buildStyleSystem({
      styleProfile: "Minimalist",
      styleNotes: ["loves linen", "avoids polyester"],
      extraInstructions: "",
    });
    expect(result).toContain("Learned preferences:");
    expect(result).toContain("- loves linen");
    expect(result).toContain("- avoids polyester");
  });

  it("appends extra instructions section when present", () => {
    const result = buildStyleSystem({
      styleProfile: "Minimalist",
      styleNotes: [],
      extraInstructions: "Packing for Italy for 10 days",
    });
    expect(result).toContain("Current instructions:");
    expect(result).toContain("Packing for Italy for 10 days");
  });

  it("joins all three sections with double newline when all present", () => {
    const result = buildStyleSystem({
      styleProfile: "My style",
      styleNotes: ["note 1"],
      extraInstructions: "some context",
    });
    const parts = result.split("\n\n");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("My style");
    expect(parts[1]).toContain("Learned preferences:");
    expect(parts[2]).toContain("Current instructions:");
  });

  it("omits extra instructions section when it is only whitespace", () => {
    const result = buildStyleSystem({
      styleProfile: "My style",
      styleNotes: [],
      extraInstructions: "   ",
    });
    expect(result).not.toContain("Current instructions:");
    expect(result).toBe("My style");
  });

  it("round-trips: adding then clearing notes leaves only profile", () => {
    let notes = [];
    notes = addNote(notes, "prefers loose fits");
    notes = addNote(notes, "earth tones only");

    const withNotes = buildStyleSystem({
      styleProfile: "Casual",
      styleNotes: notes,
      extraInstructions: "",
    });
    expect(withNotes).toContain("prefers loose fits");

    notes = clearNotes(notes);
    const cleared = buildStyleSystem({
      styleProfile: "Casual",
      styleNotes: notes,
      extraInstructions: "",
    });
    expect(cleared).toBe("Casual");
  });
});
