import { fmtMaterials } from "./normalizeItem.js";

export function stripForClaude({ imageData, originalImageData, outfitPhotos, ...rest }) {
  return rest;
}

export function buildWardrobeSummary(items) {
  const byCat = {};
  items.forEach(i => { byCat[i.category] = (byCat[i.category] || 0) + 1; });
  const catStr = Object.entries(byCat).filter(([, n]) => n > 0)
    .map(([c, n]) => `${n} ${c.toLowerCase()}`).join(", ");
  const brandCounts = {};
  items.forEach(i => { if (i.brand) brandCounts[i.brand] = (brandCounts[i.brand] || 0) + 1; });
  const topBrands = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])
    .slice(0, 10).map(([b]) => b).join(", ");
  const colorCounts = {};
  items.forEach(i => { if (i.color) colorCounts[i.color] = (colorCounts[i.color] || 0) + 1; });
  const topColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])
    .slice(0, 6).map(([c, n]) => `${c}(${n})`).join(", ");
  const mostWorn = [...items].sort((a, b) => (b.wornDates?.length || 0) - (a.wornDates?.length || 0))
    .slice(0, 5).map(i => i.name).join(", ");
  return `Shelly owns ${items.length} pieces: ${catStr}.\nTop brands: ${topBrands || "none listed"}.\nColors: ${topColors || "mixed"}.\nMost worn: ${mostWorn || "none yet"}.`;
}

const CAT_KEYWORDS = {
  Tops:["top","shirt","blouse","tee","sweater","knit","tank","cami","tunic"],
  Bottoms:["pant","pants","jean","jeans","skirt","short","trouser","bottom","legging"],
  Dresses:["dress","gown","jumpsuit","romper"],
  Outerwear:["jacket","coat","blazer","cardigan","vest","outerwear"],
  Shoes:["shoe","shoes","boot","boots","sandal","sneaker","heel","flat","loafer","mule","pump"],
  Accessories:["bag","belt","scarf","hat","jewelry","accessory","accessories","purse"],
};
const COMPLEMENTS = {
  Tops:["Bottoms","Shoes"],Bottoms:["Tops","Shoes"],Dresses:["Shoes","Outerwear"],
  Shoes:["Tops","Bottoms","Dresses"],Outerwear:["Tops","Bottoms"],
};

export function filterRelevantItems(items, question) {
  const q = question.toLowerCase();
  const cats = new Set();
  Object.entries(CAT_KEYWORDS).forEach(([cat, kws]) => {
    if (kws.some(k => q.includes(k))) cats.add(cat);
  });
  items.filter(i => i.name && q.includes(i.name.toLowerCase().slice(0, 8)))
    .forEach(i => cats.add(i.category));
  [...cats].forEach(c => (COMPLEMENTS[c] || []).forEach(x => cats.add(x)));
  const pool = cats.size > 0 ? items.filter(i => cats.has(i.category)) : items;
  return [...pool].sort((a, b) => (b.wornDates?.length || 0) - (a.wornDates?.length || 0)).slice(0, 80);
}

export function buildContextHistory(history) {
  return history.length > 20 ? history.slice(-20) : history;
}

/** Format a single item for Claude context. Uses fmtMaterials to handle both legacy and current data models. */
export function fmtItem(i) {
  return (
    `- [${i.category}] ${i.name}` +
    (i.brand ? ` / ${i.brand}` : "") +
    (i.color ? ` / ${i.color}` : "") +
    (fmtMaterials(i) ? ` / ${fmtMaterials(i)}` : "") +
    (i.tags?.length ? ` / Tags: ${i.tags.join(", ")}` : "") +
    ` (worn ${i.wornDates?.length || 0}x)` +
    (i.stylingNotes ? ` [Styling: ${i.stylingNotes}]` : "") +
    (i.keepNote ? ` [${i.keepNote}]` : "")
  );
}

export function buildChatSystem(items, question, buildStyleSystem) {
  const stripped = items.map(stripForClaude);
  let ctx;
  if (stripped.length <= 50 || !question) {
    ctx = `Her complete wardrobe (${stripped.length} pieces):\n${stripped.map(fmtItem).join("\n")}`;
  } else {
    const rel = filterRelevantItems(stripped, question);
    ctx = `${buildWardrobeSummary(stripped)}\n\nMost relevant items (${rel.length} of ${stripped.length} shown):\n${rel.map(fmtItem).join("\n")}`;
  }
  return `${buildStyleSystem()}\n\n${ctx}\n\nAnswer questions about her wardrobe, suggest outfits, identify gaps, give honest style advice. Reference specific items by name. Be concise and direct.`;
}

export function itemFocusCtx(item) {
  if (!item) return "";
  return (
    `\n\nFocus item: [${item.category}] ${item.name}` +
    (item.brand ? ` / ${item.brand}` : "") +
    (item.color ? ` / ${item.color}` : "") +
    (fmtMaterials(item) ? ` / ${fmtMaterials(item)}` : "") +
    (item.stylingNotes ? `\nStyling notes: ${item.stylingNotes}` : "") +
    (item.keepNote ? `\nNote: ${item.keepNote}` : "")
  );
}
