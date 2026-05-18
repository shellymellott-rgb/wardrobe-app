import { fmtMaterials } from "./normalizeItem.js";

const MAX_DETAILED_ITEMS = 45;
const MAX_OUTFIT_DETAILED_ITEMS = 60;
const MAX_COMPACT_INDEX_ITEMS = 90;
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "what", "wear", "should", "could",
  "would", "have", "from", "into", "about", "your", "you", "are", "not", "but",
  "outfit", "outfits", "item", "items", "piece", "pieces", "closet", "wardrobe",
]);

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

function truncate(value, max = 90) {
  const text = String(value || "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function buildWardrobeSummary(items) {
  const byCat = countBy(items, i => i.category);
  const byType = countBy(items, i => i.itemType);
  const byColor = countBy(items, i => i.color);
  const byBrand = countBy(items, i => i.brand);
  const bySeason = countBy(items, i => i.season);
  const catStr = formatCounts(byCat, 10, c => c.toLowerCase());
  const topTypes = formatCounts(byType, 12);
  const topBrands = formatCounts(byBrand, 10);
  const topColors = formatCounts(byColor, 10);
  const seasons = formatCounts(bySeason, 6);
  const mostWorn = [...items].sort((a, b) => (b.wornDates?.length || 0) - (a.wornDates?.length || 0))
    .slice(0, 5).map(i => i.name).join(", ");
  const neverWorn = items.filter(i => !i.wornDates?.length).length;
  return [
    `Full closet summary: ${items.length} pieces${catStr ? ` (${catStr})` : ""}.`,
    `Types: ${topTypes || "not tagged yet"}.`,
    `Colors: ${topColors || "mixed/unknown"}.`,
    `Seasons: ${seasons || "not tagged yet"}.`,
    `Top brands: ${topBrands || "none listed"}.`,
    `Wear signals: ${neverWorn} never logged as worn; most worn: ${mostWorn || "none yet"}.`,
  ].join("\n");
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
  return selectClosetContext(items, question).detailedItems;
}

export function buildContextHistory(history) {
  return history.length > 20 ? history.slice(-20) : history;
}

/** Format a single item for Claude context. Uses fmtMaterials to handle both legacy and current data models. */
export function fmtItem(i) {
  return (
    `- [${i.category}] ${truncate(i.name, 80)}` +
    (i.itemType ? ` / ${truncate(i.itemType, 30)}` : "") +
    (i.brand ? ` / ${truncate(i.brand, 35)}` : "") +
    (i.color ? ` / ${truncate(i.color, 35)}` : "") +
    (fmtMaterials(i) ? ` / ${truncate(fmtMaterials(i), 50)}` : "") +
    (i.tags?.length ? ` / Tags: ${i.tags.slice(0, 4).map(t => truncate(t, 24)).join(", ")}` : "") +
    ` (worn ${i.wornDates?.length || 0}x)` +
    (i.stylingNotes ? ` [Styling: ${truncate(i.stylingNotes, 110)}]` : "") +
    (i.keepNote ? ` [${truncate(i.keepNote, 80)}]` : "")
  );
}

function countBy(items, getValue) {
  const counts = {};
  items.forEach(item => {
    const raw = getValue(item);
    const values = Array.isArray(raw) ? raw : [raw];
    values.filter(Boolean).forEach(value => {
      counts[value] = (counts[value] || 0) + 1;
    });
  });
  return counts;
}

function formatCounts(counts, max, label = x => x) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([key, count]) => `${label(key)} ${count}`)
    .join(", ");
}

function tokensFor(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, " ")
    .split(/[\s/,-]+/)
    .filter(token => token.length >= 3 && !STOP_WORDS.has(token));
}

function itemSearchText(item) {
  return [
    item.name,
    item.brand,
    item.category,
    item.itemType,
    item.color,
    fmtMaterials(item),
    ...(item.tags || []),
    item.comments,
    item.stylingNotes,
    item.keepNote,
  ].filter(Boolean).join(" ").toLowerCase();
}

function scoreItem(item, question, queryTokens, wantedCats) {
  const q = String(question || "").toLowerCase();
  const text = itemSearchText(item);
  const name = String(item.name || "").toLowerCase();
  let score = 0;

  if (name && q.includes(name)) score += 120;
  if (name && name.length >= 8 && q.includes(name.slice(0, 14))) score += 45;
  if (item.brand && q.includes(String(item.brand).toLowerCase())) score += 25;
  if (item.itemType && q.includes(String(item.itemType).toLowerCase())) score += 30;
  if (item.category && wantedCats.has(item.category)) score += 20;
  if (item.color && q.includes(String(item.color).toLowerCase())) score += 16;
  if (fmtMaterials(item) && tokensFor(fmtMaterials(item)).some(t => queryTokens.includes(t))) score += 12;
  if ((item.tags || []).some(tag => q.includes(String(tag).toLowerCase()))) score += 18;

  queryTokens.forEach(token => {
    if (text.includes(token)) score += name.includes(token) ? 10 : 4;
  });

  return score;
}

function inferWantedCategories(question) {
  const q = String(question || "").toLowerCase();
  const cats = new Set();
  Object.entries(CAT_KEYWORDS).forEach(([cat, kws]) => {
    if (kws.some(k => q.includes(k))) cats.add(cat);
  });
  [...cats].forEach(cat => (COMPLEMENTS[cat] || []).forEach(c => cats.add(c)));
  return cats;
}

function isOutfitQuery(question) {
  return /\b(wear|outfit|dress|pack|packing|trip|travel|tomorrow|today|suggest|style|pair|with)\b/i.test(question || "");
}

function isAuditQuery(question) {
  return /\b(missing|gap|gaps|buy|purchase|need|too many|enough|replace|duplicate|duplicates|donate|sell|keep)\b/i.test(question || "");
}

function takeBalanced(items, max, existingIds = new Set()) {
  const quotas = {
    Tops: 16,
    Bottoms: 16,
    Dresses: 10,
    Shoes: 14,
    Outerwear: 8,
    Accessories: 8,
    Swimwear: 4,
  };
  const selected = [];
  Object.entries(quotas).forEach(([cat, quota]) => {
    items
      .filter(item => item.category === cat && !existingIds.has(String(item.id)))
      .sort((a, b) => (b.wornDates?.length || 0) - (a.wornDates?.length || 0))
      .slice(0, quota)
      .forEach(item => {
        if (selected.length < max && !existingIds.has(String(item.id))) {
          selected.push(item);
          existingIds.add(String(item.id));
        }
      });
  });
  return selected;
}

export function selectClosetContext(items, question, options = {}) {
  const maxDetailed = options.maxDetailed || (isOutfitQuery(question) ? MAX_OUTFIT_DETAILED_ITEMS : MAX_DETAILED_ITEMS);
  const stripped = items.map(stripForClaude);
  const queryTokens = tokensFor(question);
  const wantedCats = inferWantedCategories(question);
  const scored = stripped
    .map(item => ({ item, score: scoreItem(item, question, queryTokens, wantedCats) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || (b.item.wornDates?.length || 0) - (a.item.wornDates?.length || 0));

  const selected = [];
  const selectedIds = new Set();
  scored.forEach(({ item }) => {
    if (selected.length < maxDetailed && !selectedIds.has(String(item.id))) {
      selected.push(item);
      selectedIds.add(String(item.id));
    }
  });

  const shouldBalance = isOutfitQuery(question) || selected.length < Math.min(30, maxDetailed);
  if (shouldBalance) {
    takeBalanced(stripped, maxDetailed - selected.length, selectedIds).forEach(item => selected.push(item));
  }

  if (isAuditQuery(question)) {
    stripped
      .filter(item => !selectedIds.has(String(item.id)))
      .sort((a, b) => (a.wornDates?.length || 0) - (b.wornDates?.length || 0))
      .slice(0, Math.max(0, maxDetailed - selected.length))
      .forEach(item => {
        selected.push(item);
        selectedIds.add(String(item.id));
      });
  }

  const compactIndex = scored
    .map(({ item }) => item)
    .concat(stripped)
    .filter((item, idx, arr) => arr.findIndex(other => String(other.id) === String(item.id)) === idx)
    .slice(0, MAX_COMPACT_INDEX_ITEMS);

  return {
    detailedItems: selected.slice(0, maxDetailed),
    compactIndex,
    matchedCount: scored.length,
    totalCount: stripped.length,
  };
}

function compactItemLine(i) {
  return `- ${truncate(i.name, 70)}${i.category ? ` [${i.category}]` : ""}${i.itemType ? ` / ${truncate(i.itemType, 24)}` : ""}${i.brand ? ` / ${truncate(i.brand, 30)}` : ""}${i.color ? ` / ${truncate(i.color, 30)}` : ""}`;
}

function buildClosetContext(items, question) {
  const { detailedItems, compactIndex, matchedCount, totalCount } = selectClosetContext(items, question);
  const detailLines = detailedItems.map(fmtItem).join("\n");
  const indexLines = compactIndex
    .filter(item => !detailedItems.some(d => String(d.id) === String(item.id)))
    .slice(0, 45)
    .map(compactItemLine)
    .join("\n");
  return [
    buildWardrobeSummary(items),
    `Retrieval: showing ${detailedItems.length} detailed items from ${totalCount} total. ${matchedCount} matched the user's words exactly/structurally before balanced closet coverage was added.`,
    "Detailed item context available for exact recommendations:",
    detailLines || "No detailed items available.",
    indexLines ? `\nCompact closet index (names only, for broader awareness):\n${indexLines}` : "",
    "If the user asks for a specific item and it is not in detailed context, say you need to search/open that item rather than pretending it is absent from the closet.",
  ].filter(Boolean).join("\n\n");
}

export function buildChatSystem(items, question, buildStyleSystem, profile = null, weather = null, season = "auto", rotationDays = 14, journalEntries = null) {
  const stripped = items.map(stripForClaude);
  const ctx = buildClosetContext(stripped, question);
  const today = new Date().toISOString().split("T")[0];
  const cutoff = new Date(Date.now() - rotationDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const recentlyWorn = stripped.filter(i => (i.wornDates || []).some(d => d >= cutoff && d <= today));
  const recentNote = recentlyWorn.length > 0
    ? `\nIMPORTANT: Do NOT suggest these items — worn in the last ${rotationDays} days: ${recentlyWorn.slice(0, 40).map(i => i.name).join(", ")}${recentlyWorn.length > 40 ? `, plus ${recentlyWorn.length - 40} more` : ""}`
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
  const offSeasonNote = offSeason.length > 0 ? `\n\nOff-season examples (stored): ${offSeason.slice(0, 12).map(i => i.name).join(", ")}${offSeason.length > 12 ? `, plus ${offSeason.length - 12} more` : ""}` : "";
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
