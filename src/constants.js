export const CATEGORIES = ["Tops","Bottoms","Dresses","Outerwear","Shoes","Accessories"];
export const COLORS = ["Black","White","Cream","Tan","Camel","Navy","Grey","Brown","Olive","Blush","Red","Blue","Green","Other"];
export const SEASONS = ["All Year","Spring/Summer","Fall/Winter"];
export const SLEEVE_LENGTHS = ["N/A","Sleeveless","Short Sleeve","Long Sleeve"];
export const LENGTHS = ["N/A","Cropped","Mini","Midi","Full"];
export const MATERIALS = ["Cotton","Linen","Silk","Wool","Cashmere","Denim","Knit","Leather","Polyester","Other"];
export const PRESET_TAGS = {
  Style:["Casual","Dressy","Work","Beach/Boat","Travel"],
  Practical:["Needs Under Layer","Needs Tailoring","Travel-Friendly","Runs Small","Runs Large"],
};

export const STORAGE_KEY = "wardrobe-v3";
export const WISHLIST_KEY = "wardrobe-wishlist";
export const IMAGE_CACHE_KEY = "wardrobe-image-cache";

export const DEFAULT_STYLE_SYSTEM =
  `You are Shelly's personal stylist. She works from home and her life is real-life elevated — errands, boat trips, casual dining out, travel. Not corporate, ever. Style: polished but not stiff, minimal but not boring, slightly edgy, never feminine or frilly. Loves clean lines, structure, quality fabric, neutral palette. Wide-leg or straight-leg pants, defined waist, structured dresses. Supportive flat shoes only. Be direct, opinionated, no fluff.`;

export const URL_PROMPT =
  `Extract clothing item details from this webpage content. Return ONLY valid JSON:
{"name":"descriptive product name with color+style","brand":"brand name","color":"Black/White/Cream/Tan/Camel/Navy/Grey/Brown/Olive/Blush/Red/Blue/Green/Other","category":"Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories","material":"Cotton/Linen/Silk/Wool/Cashmere/Denim/Knit/Leather/Polyester/Other or null","price":"numeric string","season":"All Year/Spring/Summer/Fall/Winter","sleeveLength":"N/A/Sleeveless/Short Sleeve/Long Sleeve","length":"N/A/Cropped/Mini/Midi/Full"}`;

export const IMAGE_SCAN_PROMPT =
  `Analyze this clothing product image or order screenshot. Extract all visible details. Return ONLY valid JSON:
{"name":"descriptive name with color+style","brand":"brand name if visible or null","color":"Black/White/Cream/Tan/Camel/Navy/Grey/Brown/Olive/Blush/Red/Blue/Green/Other","category":"Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories","material":"Cotton/Linen/Silk/Wool/Cashmere/Denim/Knit/Leather/Polyester/Other or null","price":"numeric string if visible or null","datePurchased":"YYYY-MM-DD if visible or null","season":"All Year/Spring/Summer/Fall/Winter","sleeveLength":"N/A/Sleeveless/Short Sleeve/Long Sleeve","length":"N/A/Cropped/Mini/Midi/Full"}
Read ALL text in the image including product titles, brand names, prices.`;

export const WEATHER_OUTFIT_PROMPT = (items, weather, occasion) =>
  `Today: ${weather.summary}${occasion ? ` · ${occasion}` : ""}.

Available pieces (${items.length}, pre-filtered for today's conditions):
${items.map(i => {
  const sleeve = i.sleeveLength && i.sleeveLength !== "N/A" ? ` / ${i.sleeveLength}` : "";
  const len    = i.length     && i.length     !== "N/A" ? ` / ${i.length}`     : "";
  const mats   = (i.materials||[]).length ? ` / ${i.materials.join("+")}` : "";
  return `- [${i.category}] ${i.name}${i.color ? ` / ${i.color}` : ""}${sleeve}${len}${mats}`;
}).join("\n")}

Suggest two complete outfits using ONLY items listed above. Return ONLY valid JSON:
{"main":["exact item name"],"mainWhy":"one sentence","backup":["exact item name"],"backupWhy":"one sentence","layer":"optional layer or accessory tip or null","avoid":"what to skip given conditions or null","gaps":["key item missing from closet for these conditions — omit if closet is fine"]}`;

export const RECEIPT_PROMPT =
  `Extract clothing items from this receipt or order confirmation. Return ONLY valid JSON:
{"purchaseDate":"YYYY-MM-DD or null","items":[{"name":"descriptive name with color+style","brand":"brand name or null","color":"Black/White/Cream/Tan/Camel/Navy/Grey/Brown/Olive/Blush/Red/Blue/Green/Other or null","category":"Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories","price":"numeric string or null"}]}
Skip non-clothing. Make names descriptive. Extract brand from product name if present.`;
