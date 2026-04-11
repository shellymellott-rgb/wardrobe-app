import { useState, useEffect, useRef } from "react";

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

const RECEIPT_PROMPT = `Extract clothing items from this receipt or order confirmation. Return ONLY valid JSON:
{"purchaseDate":"YYYY-MM-DD or null","items":[{"name":"descriptive name with color+style e.g. Black Nappa Flat Sandals","brand":"brand name or null","color":"Black/White/Cream/Tan/Camel/Navy/Grey/Brown/Olive/Blush/Red/Blue/Green/Other or null","category":"Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories","price":"numeric string or null"}]}
Skip non-clothing. Make names descriptive. Extract brand from product name if present.`;

const IMAGE_SCAN_PROMPT = `Analyze this clothing product image or order screenshot. Extract all visible details. Return ONLY valid JSON:
{"name":"descriptive name with color+style e.g. Black Nappa Flat Sandals","brand":"brand name if visible anywhere or null","color":"Black/White/Cream/Tan/Camel/Navy/Grey/Brown/Olive/Blush/Red/Blue/Green/Other","category":"Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories","material":"Cotton/Linen/Silk/Wool/Cashmere/Denim/Knit/Leather/Polyester/Other or null","price":"numeric string if visible or null","datePurchased":"YYYY-MM-DD if visible or null","season":"All Year/Spring-Summer/Fall-Winter","sleeveLength":"N/A/Sleeveless/Short Sleeve/Long Sleeve","length":"N/A/Cropped/Mini/Midi/Full"}
Read ALL text in the image including product titles, brand names, prices. Be thorough.`;

const emptyForm = () => ({
  name: "", brand: "", category: "Tops", color: "", customColor: "",
  season: "All Year", sleeveLength: "N/A", length: "N/A",
  material: "", customMaterial: "", tags: [], customTag: "",
  comments: "", datePurchased: "", price: "", imageData: null,
});

function loadFromStorage() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveToStorage(items) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
}

async function callClaude(system, userContent, maxTokens = 1000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

function readFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

function CropModal({ imageSrc, onDone, onCancel }) {
  const [mode, setMode] = useState("portrait");
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [cropStart, setCropStart] = useState(null);
  const containerRef = useRef();
  const imgRef = useRef();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!imgLoaded) return;
    const el = containerRef.current;
    const W = el.offsetWidth; const H = el.offsetHeight;
    let w, h;
    if (mode === "portrait") { w = Math.min(W * 0.7, H * 0.7 * 0.75); h = w * (4/3); if (h > H * 0.85) { h = H * 0.85; w = h * (3/4); } }
    else if (mode === "square") { w = h = Math.min(W, H) * 0.7; }
    else { w = W * 0.7; h = H * 0.7; }
    setCrop({ x: (W - w) / 2, y: (H - h) / 2, w, h });
  }, [imgLoaded, mode]);

  useEffect(() => {
    if (!imgLoaded || crop.w < 10 || crop.h < 10) return;
    const img = imgRef.current; const container = containerRef.current;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const cAspect = container.offsetWidth / container.offsetHeight;
    let imgW, imgH, imgX, imgY;
    if (imgAspect > cAspect) { imgW = container.offsetWidth; imgH = imgW / imgAspect; imgX = 0; imgY = (container.offsetHeight - imgH) / 2; }
    else { imgH = container.offsetHeight; imgW = imgH * imgAspect; imgX = (container.offsetWidth - imgW) / 2; imgY = 0; }
    const cx = (crop.x - imgX) * (img.naturalWidth / imgW);
    const cy = (crop.y - imgY) * (img.naturalHeight / imgH);
    const cw = crop.w * (img.naturalWidth / imgW);
    const ch = crop.h * (img.naturalHeight / imgH);
    if (cw < 1 || ch < 1) return;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, cw); canvas.height = Math.max(1, ch);
    canvas.getContext("2d").drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
    setPreviewUrl(canvas.toDataURL("image/jpeg", 0.7));
  }, [crop, imgLoaded]);

  function getPos(e) {
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function clamp(c) {
    const el = containerRef.current;
    const W = el.offsetWidth; const H = el.offsetHeight;
    return {
      x: Math.max(0, Math.min(c.x, W - Math.max(c.w, 20))),
      y: Math.max(0, Math.min(c.y, H - Math.max(c.h, 20))),
      w: Math.max(20, Math.min(c.w, W)),
      h: Math.max(20, Math.min(c.h, H)),
    };
  }

  function onPointerDown(e) {
    e.preventDefault();
    const pos = getPos(e);
    const handle = e.target.dataset?.handle;
    if (handle) { setResizing(handle); setDragStart(pos); setCropStart({...crop}); return; }
    if (pos.x >= crop.x && pos.x <= crop.x + crop.w && pos.y >= crop.y && pos.y <= crop.y + crop.h) {
      setDragging(true); setDragStart(pos); setCropStart({...crop}); return;
    }
    setDragStart(pos); setCropStart({ x: pos.x, y: pos.y, w: 0, h: 0 });
    setCrop({ x: pos.x, y: pos.y, w: 0, h: 0 });
  }

  function onPointerMove(e) {
    if (!dragStart) return;
    e.preventDefault();
    const pos = getPos(e);
    const dx = pos.x - dragStart.x; const dy = pos.y - dragStart.y;
    if (dragging) { setCrop(clamp({ ...cropStart, x: cropStart.x + dx, y​​​​​​​​​​​​​​​​
