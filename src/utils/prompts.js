import { fmtMaterials } from "./normalizeItem.js";

export function OUTFIT_PROMPT(items, occasion) {
  return `Shelly's wardrobe:
${items.map(i=>`- [${i.category}] ${i.name}${i.color?` / ${i.color}`:""}${fmtMaterials(i)?` / ${fmtMaterials(i)}`:""} (worn ${i.wornDates?.length||0}x)`).join("\n")}
${occasion?`Occasion: ${occasion}`:"Everyday outfits."}
Give 3 outfit combos using ONLY items listed above. For each outfit return JSON with this exact structure. Return ONLY a JSON array, nothing else:
[{"name":"Outfit name","pieces":["exact item name 1","exact item name 2","exact item name 3"],"why":"one sentence why it works","tip":"one concrete styling tip"},...]`;
}

export function EVALUATE_PROMPT(item) {
  return `Evaluate for Shelly:\n${item.name} / ${item.category}${item.brand?` / ${item.brand}`:""}${item.color?` / ${item.color}`:""}${fmtMaterials(item)?` / ${fmtMaterials(item)}`:""}${item.tags?.length?` / Tags: ${item.tags.join(", ")}`:""}\n${item.keepNote?`Note: ${item.keepNote}\n`:""}${item.stylingNotes?`Styling notes: ${item.stylingNotes}\n`:""}1. Verdict: KEEP/USE DIFFERENTLY\n2. What works\n3. What doesn't\n4. Best outfit formula\nTwo sentences max per point. Direct.`;
}

export function INSPO_PROMPT(items) {
  return `Shelly uploaded an outfit inspiration photo. Her wardrobe:
${items.map(i=>`- [${i.category}] ${i.name}${i.color?` / ${i.color}`:""}${fmtMaterials(i)?` / ${fmtMaterials(i)}`:""}`).join("\n")}
Based on what you see in the inspiration photo, suggest how to recreate this look using ONLY items from her wardrobe above. Return JSON:
{"outfitName":"name","pieces":["exact item name"],"why":"why this recreates the vibe","tip":"styling tip","gaps":["items she'd need to buy to complete this look"]}`;
}
