import { fmtMaterials } from "./normalizeItem.js";

export function getCurrentSeason(override) {
  if (override && override !== "auto") return override;
  const m = new Date().getMonth();
  if (m <= 1 || m === 11) return "Winter";
  if (m <= 4) return "Spring";
  if (m <= 7) return "Summer";
  return "Fall";
}

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
  return [...pool].sort((a, b) => (b.wornDates?.length || 0) - (a.wornDates?.length || 0)).slice(0, 200);
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

export function buildChatSystem(items, question, buildStyleSystem, profile = null, weather = null, season = "auto", rotationDays = 14, journalEntries = null) {
  const stripped = items.map(stripForClaude);
  const isOutfitQuery = question && /\b(wear|outfit|dress|tomorrow|today|suggest|what should)\b/i.test(question);
  let ctx;
  if (stripped.length <= 999 || !question || isOutfitQuery) {
    ctx = `Her complete wardrobe (${stripped.length} pieces):\n${stripped.map(fmtItem).join("\n")}`;
  } else {
    const rel = filterRelevantItems(stripped, question);
    ctx = `${buildWardrobeSummary(stripped)}\n\nMost relevant items (${rel.length} of ${stripped.length} shown):\n${rel.map(fmtItem).join("\n")}`;
  }
  const today = new Date().toISOString().split("T")[0];
  const cutoff = new Date(Date.now() - rotationDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const recentlyWorn = stripped.filter(i => (i.wornDates || []).some(d => d >= cutoff && d <= today));
  const recentNote = recentlyWorn.length > 0
    ? `\nIMPORTANT: Do NOT suggest these items — worn in the last ${rotationDays} days: ${recentlyWorn.map(i => i.name).join(", ")}`
    : "";
  const weatherLine = weather
    ? `Current weather: ${weather.condition}, high ${weather.tempHigh}°F / low ${weather.tempLow}°F${weather.isRainy ? ", rainy" : ""}.\n\n`
    : "Weather data not yet loaded — if the user asks about what to wear, ask them about current weather conditions or temperature before suggesting an outfit.\n\n";
  const shoeRule = weather && weather.tempLow < 60
    ? `SHOE RULE: Temperature low is ${weather.tempLow}°F — do NOT suggest open-toe shoes, sandals, or slides. Closed-toe shoes only.\n\n`
    : "";
  const currentSeason = getCurrentSeason(season);
  const inSeason = stripped.filter(i => {
    const s = i.season;
    if (!s || s === "All Year") return true;
    if (s === currentSeason) return true;
    if ((currentSeason === "Spring" || currentSeason === "Summer") && s === "Spring/Summer") return true;
    if ((currentSeason === "Fall" || currentSeason === "Winter") && s === "Fall/Winter") return true;
    return false;
  });
  const offSeason = stripped.filter(i => !inSeason.includes(i));
  const seasonLine = `Current season: ${currentSeason}. Off-season items (${offSeason.length} pieces) are deprioritized — focus recommendations on in-season pieces unless the user specifically asks.\n\n`;
  const offSeasonNote = offSeason.length > 0 ? `\n\nOff-season (stored): ${offSeason.slice(0, 20).map(i => i.name).join(", ")}` : "";
  const dressingNote = profile?.dressing_seasons?.length > 0
    ? `This person dresses for ${profile.dressing_seasons.length} season${profile.dressing_seasons.length > 1 ? "s" : ""} (${profile.dressing_seasons.join(", ")}), so their wardrobe size reflects seasonal rotation — do not suggest they have too many clothes.\n\n`
    : "";
  const PERSONALITY_MAP = {
    editorial: "You are direct, opinionated, and have fashion-magazine energy. You give honest assessments.",
    supportive: "You are warm, encouraging, and focus on what works. You celebrate wins.",
    practical: "You are efficient and factual. Minimal commentary, maximum usefulness.",
  };
  let botIdentity = "";
  if (profile?.bot_name) botIdentity += `Your name is ${profile.bot_name}.\n`;
  if (profile?.bot_personality) botIdentity += (PERSONALITY_MAP[profile.bot_personality] || profile.bot_personality) + "\n";
  if (botIdentity) botIdentity += "\n";
  // Build planned outfits context from future-dated journal entries
  let plannedNote = "";
  if (journalEntries?.length) {
    const today = new Date().toISOString().split("T")[0];
    const upcoming = journalEntries
      .filter(e => e.date >= today && (e.item_ids?.length || e.notes))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (upcoming.length) {
      const lines = upcoming.map(e => {
        const names = e.item_ids
          .map(id => items.find(i => String(i.id) === String(id))?.name)
          .filter(Boolean)
          .join(", ");
        const notePart = e.notes ? ` — ${e.notes}` : "";
        return names ? `- ${e.date}${notePart}: ${names}` : `- ${e.date}${notePart} (outfit not yet chosen)`;
      });
      plannedNote = `\n\nAlready planned outfits (do not re-suggest these items for these dates):\n${lines.join("\n")}\n`;
    }
  }
  const base = `${botIdentity}${buildStyleSystem()}\n\n${weatherLine}${shoeRule}${seasonLine}${dressingNote}${recentNote}${plannedNote}\n\n${ctx}${offSeasonNote}\n\nAnswer questions about her wardrobe, suggest outfits, identify gaps, give honest style advice. Reference specific items by name. Always check worn counts and avoid recently worn items. Follow learned preferences exactly. Be concise and direct. If the user mentions a trip or travel, use the planned journal entries above to understand what's already decided, identify days still marked 'outfit not yet chosen', and suggest outfits for those remaining days without repeating already-planned items. You cannot directly write to the journal or log outfits yourself. However, when you suggest outfits using labeled format (**Top:** ItemName, **Pants:** ItemName, **Shoes:** ItemName), the app automatically detects this and shows the user a save card to log the outfit to their journal with one tap. So always use the labeled outfit format — it triggers the journal save feature automatically. When suggesting outfits, ALWAYS factor in the current weather — mention the temperature and explain why each piece works for those conditions. Never suggest an outfit without referencing the weather context provided.`;
  if (!profile) return base;
  const SKIP = new Set(["id", "user_id", "created_at", "updated_at", "height_ft", "height_in", "bot_name", "bot_personality", "dressing_seasons"]);
  const profileLines = Object.entries(profile)
    .filter(([k, v]) => !SKIP.has(k) && v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join(", ") : v}`);
  if (profile.height_ft != null) profileLines.unshift(`height: ${profile.height_ft}'${profile.height_in ?? 0}"`);
  if (!profileLines.length) return base;
  return `What I know about you:\n${profileLines.join("\n")}\n\n${base}`;
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
