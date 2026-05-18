import { describe, expect, it } from "vitest";
import { buildChatSystem, filterRelevantItems } from "../utils/wardrobeContext.js";

function makeItem(idx, overrides = {}) {
  return {
    id: String(idx),
    name: `Generic piece ${idx}`,
    category: idx % 2 ? "Tops" : "Bottoms",
    itemType: idx % 2 ? "Tee" : "Trousers",
    brand: "Brand",
    color: idx % 3 ? "Black" : "White",
    materials: ["Cotton"],
    wornDates: [],
    ...overrides,
  };
}

describe("wardrobe context retrieval", () => {
  it("keeps large closet chat context capped while preserving exact item matches", () => {
    const items = Array.from({ length: 337 }, (_, idx) => makeItem(idx));
    items[280] = makeItem(280, {
      name: "Aritzia Effortless Linen Shorts",
      category: "Bottoms",
      itemType: "Shorts",
      brand: "Aritzia",
      color: "Cream",
      materials: ["Linen"],
    });

    const system = buildChatSystem(
      items,
      "Can you style my Aritzia linen shorts for dinner?",
      () => "Style system",
      null,
      { condition: "Clear", tempHigh: 78, tempLow: 66, isRainy: false },
      "Summer",
    );

    expect(system).toContain("Full closet summary: 337 pieces");
    expect(system).toContain("showing 80 detailed items from 337 total");
    expect(system).toContain("Aritzia Effortless Linen Shorts");
    expect(system).not.toContain("Generic piece 336");
  });

  it("retrieves a balanced set for outfit questions", () => {
    const items = [
      makeItem(1, { category: "Tops", name: "White tee" }),
      makeItem(2, { category: "Bottoms", name: "Black trousers" }),
      makeItem(3, { category: "Shoes", name: "Black loafers" }),
      makeItem(4, { category: "Outerwear", name: "Tan blazer" }),
    ];

    const relevant = filterRelevantItems(items, "What should I wear today?");
    expect(relevant.map(i => i.category)).toEqual(expect.arrayContaining(["Tops", "Bottoms", "Shoes"]));
  });
});
