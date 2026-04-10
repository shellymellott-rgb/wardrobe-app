import { useState, useEffect, useRef, useCallback } from "react";

const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Accessories"];
const COLORS = ["Black", "White", "Cream", "Tan", "Camel", "Navy", "Grey", "Brown", "Olive", "Blush", "Red", "Blue", "Green", "Other"];
const SEASONS = ["All Year", "Spring/Summer", "Fall/Winter"];
const SLEEVE_LENGTHS = ["N/A", "Sleeveless", "Short Sleeve", "Long Sleeve"];
const LENGTHS = ["N/A", "Cropped", "Mini", "Midi", "Full"];
const MATERIALS = ["Cotton", "Linen", "Silk", "Wool", "Cashmere", "Denim", "Knit", "Leather", "Polyester", "Other"];
const PRESET_TAGS = {
  "Style": ["Casual", "Dressy", "Work", "Beach/Boat", "Travel"],
  "Practical": ["Needs Under Layer", "Needs Tailoring", "Travel-Friendly", "Runs Small", "Runs Large"],
};
const STORAGE_KEY = "wardrobe-v3";

const STYLE_SYSTEM = `You are Shelly's personal stylist. Her style: polished but not corporate, minimal but not boring, slightly edgy, never feminine or frilly. Loves clean lines, structure, good fabric, neutral palette. Wide-leg or straight-leg pants, defined waist, structured dresses. Supportive flat shoes only. Real-life elevated — errands, boat, travel. Be direct, opinionated, no fluff.`;

const OUTFIT_PROMPT = (items, occasion) => `Shelly's wardrobe:
${items.map(i => `- [${i.category}] ${i.name}${i.color ? ` / ${i.color}` : ""}${i.material ? ` / ${i.material}` : ""} (worn ${i.wornDates?.length || 0}x)`).join("\n")}
${occasion ? `Occasion: ${occasion}` : "Everyday outfits."}
Give 3 outfit combos using ONLY these items. For each: pieces, why it works, one styling tip. Flag anything never worn. Direct, editorial, not safe.`;

const EVALUATE_PROMPT = (item) => `Evaluate for Shelly:
${item.name} / ${item.category}${item.brand ? ` / ${item.brand}` : ""}${item.color ? ` / ${item.color}` : ""}${item.material ? ` / ${item.material}` : ""}${item.tags?.length ? ` / Tags: ${item.tags.join(", ")}` : ""}${item.comments ? ` / Notes: ${item.comments}` : ""}
1. Verdict: KEEP/PASS/USE DIFFERENTLY
2. What works
3. What doesn't
4. Best outfit formula
Two sentences max per point. Direct.`;

const RECEIPT_PROMPT = `Extract clothing items from this receipt. Return ONLY valid JSON:
{"purchaseDate":"YYYY-MM-DD or null","items":[{"name":"descriptive name with color+style","brand":"or null","color":"Black/White/Cream/Tan/Camel/Navy/Grey/Brown/Olive/Blush/Red/Blue/Green/Other or null","category":"Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories","price":"numeric string or null"}]}
Skip non-clothing. Make names descriptive.`;

const IMAGE_SCAN_PROMPT = `You are analyzing a clothing product image for a wardrobe app. Extract all visible or clearly inferable details. Return ONLY valid JSON, nothing else:
{
  "name": "descriptive name including color + style + cut e.g. 'Black Wide-Leg Trousers' or 'Cream Linen Button-Down Shirt'",
  "brand": "brand name if visible anywhere in image, or null",
  "color": "one of: Black, White, Cream, Tan, Camel, Navy, Grey, Brown, Olive, Blush, Red, Blue, Green, Other",
  "category": "one of: Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories",
  "material": "one of: Cotton, Linen, Silk, Wool, Cashmere, Denim, Knit, Leather, Polyester, Other — infer from visual texture if not labeled, or null",
  "price": "numeric string if price​​​​​​​​​​​​​​​​
