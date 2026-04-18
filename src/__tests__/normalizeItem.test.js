import { describe, it, expect } from "vitest";
import {
  getMaterials,
  fmtMaterials,
  normalizeItem,
  buildItem,
  emptyForm,
} from "../utils/normalizeItem.js";

// ── getMaterials ──────────────────────────────────────────────────────────────

describe("getMaterials", () => {
  it("returns materials array when present and non-empty", () => {
    expect(getMaterials({ materials: ["Cotton", "Linen"] })).toEqual(["Cotton", "Linen"]);
  });

  it("falls back to legacy singular `material` string", () => {
    expect(getMaterials({ material: "Silk" })).toEqual(["Silk"]);
  });

  it("prefers materials array over legacy material when both present", () => {
    expect(getMaterials({ materials: ["Wool"], material: "Cotton" })).toEqual(["Wool"]);
  });

  it("returns [] when materials is an empty array and no legacy field", () => {
    expect(getMaterials({ materials: [] })).toEqual([]);
  });

  it("falls back to legacy material when materials array is empty", () => {
    expect(getMaterials({ materials: [], material: "Cashmere" })).toEqual(["Cashmere"]);
  });

  it("returns [] when neither field is present", () => {
    expect(getMaterials({})).toEqual([]);
  });
});

// ── fmtMaterials ──────────────────────────────────────────────────────────────

describe("fmtMaterials", () => {
  it("joins multiple materials with ' / '", () => {
    expect(fmtMaterials({ materials: ["Cotton", "Linen"] })).toBe("Cotton / Linen");
  });

  it("returns single material without separator", () => {
    expect(fmtMaterials({ materials: ["Wool"] })).toBe("Wool");
  });

  it("returns empty string when no materials", () => {
    expect(fmtMaterials({})).toBe("");
  });

  it("handles legacy material field", () => {
    expect(fmtMaterials({ material: "Silk" })).toBe("Silk");
  });
});

// ── normalizeItem ─────────────────────────────────────────────────────────────

describe("normalizeItem", () => {
  it("preserves existing materials array", () => {
    const item = { id: 1, name: "Shirt", materials: ["Cotton"], tags: [], wornDates: [] };
    const result = normalizeItem(item);
    expect(result.materials).toEqual(["Cotton"]);
    expect(result).not.toHaveProperty("material");
  });

  it("migrates legacy `material` string to `materials` array", () => {
    const legacy = { id: 2, name: "Jeans", material: "Denim", tags: [], wornDates: [] };
    const result = normalizeItem(legacy);
    expect(result.materials).toEqual(["Denim"]);
    expect(result).not.toHaveProperty("material");
  });

  it("does not carry over legacy `material` when materials array exists", () => {
    const item = { id: 3, name: "Dress", materials: ["Silk"], material: "Polyester" };
    const result = normalizeItem(item);
    expect(result.materials).toEqual(["Silk"]);
    expect(result).not.toHaveProperty("material");
  });

  it("sets default arrays for missing tags and wornDates", () => {
    const item = { id: 4, name: "Jacket" };
    const result = normalizeItem(item);
    expect(result.tags).toEqual([]);
    expect(result.wornDates).toEqual([]);
  });

  it("preserves existing tags array", () => {
    const item = { id: 5, name: "Coat", tags: ["Formal", "Winter"], wornDates: [] };
    const result = normalizeItem(item);
    expect(result.tags).toEqual(["Formal", "Winter"]);
  });

  it("sets default strings for sleeveLength, length, season", () => {
    const item = { id: 6, name: "Top" };
    const result = normalizeItem(item);
    expect(result.sleeveLength).toBe("N/A");
    expect(result.length).toBe("N/A");
    expect(result.season).toBe("All Year");
  });

  it("preserves non-default values for sleeveLength, length, season", () => {
    const item = { id: 7, name: "Blouse", sleeveLength: "Short", length: "Cropped", season: "Summer" };
    const result = normalizeItem(item);
    expect(result.sleeveLength).toBe("Short");
    expect(result.length).toBe("Cropped");
    expect(result.season).toBe("Summer");
  });

  it("returns non-object input unchanged", () => {
    expect(normalizeItem(null)).toBe(null);
    expect(normalizeItem(undefined)).toBe(undefined);
  });

  it("does not mutate the original object", () => {
    const original = { id: 8, name: "Skirt", material: "Cotton", tags: [] };
    normalizeItem(original);
    expect(original).toHaveProperty("material", "Cotton");
  });
});

// ── buildItem ─────────────────────────────────────────────────────────────────

describe("buildItem", () => {
  it("builds a complete item from a form with all fields", () => {
    const form = {
      name: "Linen Shirt", brand: "Everlane", category: "Tops",
      color: "White", customColor: "", season: "Summer",
      sleeveLength: "Short", length: "N/A",
      materials: ["Linen"], customMaterial: "",
      tags: ["Casual"], comments: "Light and airy",
      datePurchased: "2024-03-01", price: "89.00",
      imageData: null, originalImageData: null,
    };
    const item = buildItem(form);
    expect(item.name).toBe("Linen Shirt");
    expect(item.brand).toBe("Everlane");
    expect(item.materials).toEqual(["Linen"]);
    expect(item.price).toBe(89.0);
    expect(item.wornDates).toEqual([]);
    expect(typeof item.id).toBe("number");
    expect(typeof item.addedAt).toBe("string");
    expect(item).not.toHaveProperty("material");
    expect(item).not.toHaveProperty("customColor");
    expect(item).not.toHaveProperty("customMaterial");
  });

  it("uses customColor when color is 'Other'", () => {
    const form = { ...emptyForm(), name: "Shirt", color: "Other", customColor: "Sage Green" };
    expect(buildItem(form).color).toBe("Sage Green");
  });

  it("uses color directly when not 'Other'", () => {
    const form = { ...emptyForm(), name: "Shirt", color: "Blue" };
    expect(buildItem(form).color).toBe("Blue");
  });

  it("sets price to null when price is empty string", () => {
    const form = { ...emptyForm(), name: "Shirt", price: "" };
    expect(buildItem(form).price).toBeNull();
  });

  it("always produces materials array, never legacy material", () => {
    const form = { ...emptyForm(), name: "Dress", materials: ["Silk", "Cotton"] };
    const item = buildItem(form);
    expect(Array.isArray(item.materials)).toBe(true);
    expect(item).not.toHaveProperty("material");
  });
});

// ── emptyForm ─────────────────────────────────────────────────────────────────

describe("emptyForm", () => {
  it("returns a fresh object each call", () => {
    const a = emptyForm();
    const b = emptyForm();
    a.name = "modified";
    expect(b.name).toBe("");
  });

  it("has empty materials array", () => {
    expect(emptyForm().materials).toEqual([]);
  });
});
