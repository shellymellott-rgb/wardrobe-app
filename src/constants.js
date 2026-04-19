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

export const DEFAULT_STYLE_SYSTEM =
  `You are Shelly's personal stylist. She works from home and her life is real-life elevated — errands, boat trips, casual dining out, travel. Not corporate, ever. Style: polished but not stiff, minimal but not boring, slightly edgy, never feminine or frilly. Loves clean lines, structure, quality fabric, neutral palette. Wide-leg or straight-leg pants, defined waist, structured dresses. Supportive flat shoes only. Be direct, opinionated, no fluff.`;

export const URL_PROMPT =
  `Extract clothing item details from this webpage content. Return ONLY valid JSON:
{"name":"descriptive product name with color+style","brand":"brand name","color":"Black/White/Cream/Tan/Camel/Navy/Grey/Brown/Olive/Blush/Red/Blue/Green/Other","category":"Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories","material":"Cotton/Linen/Silk/Wool/Cashmere/Denim/Knit/Leather/Polyester/Other or null","price":"numeric string","season":"All Year/Spring/Summer/Fall/Winter","sleeveLength":"N/A/Sleeveless/Short Sleeve/Long Sleeve","length":"N/A/Cropped/Mini/Midi/Full"}`;

export const IMAGE_SCAN_PROMPT =
  `Analyze this clothing product image or order screenshot. Extract all visible details. Return ONLY valid JSON:
{"name":"descriptive name with color+style","brand":"brand name if visible or null","color":"Black/White/Cream/Tan/Camel/Navy/Grey/Brown/Olive/Blush/Red/Blue/Green/Other","category":"Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories","material":"Cotton/Linen/Silk/Wool/Cashmere/Denim/Knit/Leather/Polyester/Other or null","price":"numeric string if visible or null","datePurchased":"YYYY-MM-DD if visible or null","season":"All Year/Spring/Summer/Fall/Winter","sleeveLength":"N/A/Sleeveless/Short Sleeve/Long Sleeve","length":"N/A/Cropped/Mini/Midi/Full"}
Read ALL text in the image including product titles, brand names, prices.`;

export const WEATHER_OUTFIT_PROMPT = (items, weather) =>
  `Today's weather: ${weather.summary}.

Wardrobe (pre-filtered for conditions, ${items.length} pieces):
${items.map(i => `- [${i.category}] ${i.name}${i.color ? ` / ${i.color}` : ""}${i.season ? ` / ${i.season}` : ""}`).join("\n")}

Suggest ONE complete outfit for today using ONLY items listed. Return ONLY valid JSON:
{"outfit":["exact item name"],"why":"one sentence","layer":"optional layering or accessory tip or null","avoid":"what fabric or item type to skip given the weather or null"}`;

export const RECEIPT_PROMPT =
  `Extract clothing items from this receipt or order confirmation. Return ONLY valid JSON:
{"purchaseDate":"YYYY-MM-DD or null","items":[{"name":"descriptive name with color+style","brand":"brand name or null","color":"Black/White/Cream/Tan/Camel/Navy/Grey/Brown/Olive/Blush/Red/Blue/Green/Other or null","category":"Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories","price":"numeric string or null"}]}
Skip non-clothing. Make names descriptive. Extract brand from product name if present.`;
