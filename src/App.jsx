import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Accessories"];
const COLORS = ["Black", "White", "Cream", "Tan", "Camel", "Navy", "Grey", "Brown", "Olive", "Blush", "Red", "Blue", "Green", "Other"];
const SEASONS = ["All Year", "Spring/Summer", "Fall/Winter"];
const SLEEVE_LENGTHS = ["N/A", "Sleeveless", "Short Sleeve", "Long Sleeve"];
const LENGTHS = ["N/A", "Cropped", "Mini", "Midi", "Full"];
const MATERIALS = ["Cotton", "Linen", "Silk", "Wool", "Cashmere", "Denim", "Knit", "Leather", "Polyester", "Other"];
const PRESET_TAGS = {
  "Style": ["Casual", "Dressy", "Work", "Beach/Boat", "Travel"],
  "Practical": ["Needs Under Layer", "Needs Tailoring", "Travel-Friendly", "Runs Small", "Runs Large"],
  "Where From": ["Amazon", "Armoire"],
};
const STORAGE_KEY = "wardrobe-v3";

// ─── AI Prompts ───────────────────────────────────────────────────────────────
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
  "price": "numeric string if price tag or label visible, or null",
  "datePurchased": "YYYY-MM-DD if any date visible, or null",
  "season": "one of: All Year, Spring/Summer, Fall/Winter — infer from fabric and style",
  "sleeveLength": "one of: N/A, Sleeveless, Short Sleeve, Long Sleeve — N/A if not a top or dress",
  "length": "one of: N/A, Cropped, Mini, Midi, Full — N/A if not bottoms or dress"
}
Be specific and accurate. Infer what you can from visual cues. Always return valid JSON.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const emptyForm = () => ({
  name: "", brand: "", category: "Tops", color: "", customColor: "",
  season: "All Year", sleeveLength: "N/A", length: "N/A",
  material: "", customMaterial: "", tags: [], customTag: "",
  comments: "", datePurchased: "", price: "", imageData: null,
});

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToStorage(items) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
}

async function callClaude(system, userContent, maxTokens = 1000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

// ─── Crop Modal ───────────────────────────────────────────────────────────────
function CropModal({ imageSrc, onDone, onCancel }) {
  const canvasRef = useRef();
  const [mode, setMode] = useState("square"); // "square" | "free"
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState(null);
  const imgRef = useRef();
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (!imgLoaded) return;
    const img = imgRef.current;
    const size = Math.min(img.offsetWidth, img.offsetHeight) * 0.8;
    const x = (img.offsetWidth - size) / 2;
    const y = (img.offsetHeight - size) / 2;
    setCrop({ x, y, w: size, h: size });
  }, [imgLoaded, mode]);

  function getPos(e, el) {
    const rect = el.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function onMouseDown(e) {
    const pos = getPos(e, imgRef.current);
    setDragging(true);
    setStart(pos);
    setCrop({ x: pos.x, y: pos.y, w: 0, h: 0 });
  }

  function onMouseMove(e) {
    if (!dragging || !start) return;
    const pos = getPos(e, imgRef.current);
    let w = pos.x - start.x;
    let h = pos.y - start.y;
    if (mode === "square") { const s = Math.max(Math.abs(w), Math.abs(h)); w = w < 0 ? -s : s; h = h < 0 ? -s : s; }
    setCrop({ x: w < 0 ? start.x + w : start.x, y: h < 0 ? start.y + h : start.y, w: Math.abs(w), h: Math.abs(h) });
  }

  function onMouseUp() { setDragging(false); }

  function applyCrop() {
    const img = imgRef.current;
    const scaleX = img.naturalWidth / img.offsetWidth;
    const scaleY = img.naturalHeight / img.offsetHeight;
    const canvas = document.createElement("canvas");
    canvas.width = crop.w * scaleX;
    canvas.height = crop.h * scaleY;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, crop.x * scaleX, crop.y * scaleY, crop.w * scaleX, crop.h * scaleY, 0, 0, canvas.width, canvas.height);
    onDone(canvas.toDataURL("image/jpeg", 0.85));
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 200, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #222" }}>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setMode("square")} style={{ ...chipStyle(mode === "square"), fontSize: 11 }}>Square</button>
          <button onClick={() => setMode("free")} style={{ ...chipStyle(mode === "free"), fontSize: 11 }}>Free</button>
        </div>
        <button onClick={applyCrop} style={{ ...ghostBtn, color: "#e8e2d8", fontWeight: 600 }}>Apply</button>
      </div>
      <div style={{ flex: 1, overflow: "hidden", position: "relative", userSelect: "none" }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onTouchStart={onMouseDown} onTouchMove={onMouseMove} onTouchEnd={onMouseUp}>
        <img ref={imgRef} src={imageSrc} onLoad={() => setImgLoaded(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }} />
        {crop.w > 0 && crop.h > 0 && (
          <div style={{
            position: "absolute", left: crop.x, top: crop.y, width: crop.w, height: crop.h,
            border: "2px solid #e8e2d8", background: "rgba(232,226,216,0.08)", pointerEvents: "none",
          }} />
        )}
        {!imgLoaded && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: 12 }}>Loading...</div>}
      </div>
      <div style={{ padding: 16, textAlign: "center", color: "#555", fontSize: 11, letterSpacing: 1 }}>Drag to select crop area</div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const ghostBtn = {
  background: "transparent", border: "none", color: "#888",
  fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", padding: "4px 0",
};

function chipStyle(active) {
  return {
    background: active ? "#e8e2d8" : "#1a1a1a",
    color: active ? "#111" : "#666",
    border: `1px solid ${active ? "#e8e2d8" : "#2a2a2a"}`,
    borderRadius: 20, padding: "4px 12px",
    fontSize: 10, letterSpacing: 1, cursor: "pointer",
    whiteSpace: "nowrap", fontFamily: "'DM Sans', system-ui, sans-serif",
  };
}

const inputStyle = {
  width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
  color: "#e8e2d8", borderRadius: 3, padding: "11px 12px",
  fontSize: 12, outline: "none", boxSizing: "border-box",
  fontFamily: "'DM Sans', system-ui, sans-serif", marginBottom: 10,
};

const labelStyle = {
  fontSize: 9, letterSpacing: 2, textTransform: "uppercase",
  color: "#666", display: "block", marginBottom: 5, marginTop: 10,
};

function navBtn(label, active, onClick) {
  return (
    <button onClick={onClick} style={{
      background: active ? "#e8e2d8" : "transparent",
      color: active ? "#111" : "#888",
      border: `1px solid ${active ? "#e8e2d8" : "#333"}`,
      borderRadius: 20, padding: "6px 16px",
      fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
      cursor: "pointer", fontWeight: active ? 600 : 400, whiteSpace: "nowrap",
    }}>{label}</button>
  );
}

// ─── Form Fields Component ────────────────────────────────────────────────────
function FormFields({ form, setForm, onImageClick }) {
  const showSleeve = ["Tops", "Dresses"].includes(form.category);
  const showLength = ["Bottoms", "Dresses"].includes(form.category);

  function toggleTag(tag) {
    setForm(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }));
  }

  function addCustomTag() {
    if (!form.customTag?.trim()) return;
    const tag = form.customTag.trim();
    if (!form.tags.includes(tag)) setForm(f => ({ ...f, tags: [...f.tags, tag], customTag: "" }));
    else setForm(f => ({ ...f, customTag: "" }));
  }

  return (
    <div>
      {/* Photo */}
      <div onClick={onImageClick} style={{
        aspectRatio: "3/4", background: "#1a1a1a", border: "1px dashed #333",
        borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", marginBottom: 16, overflow: "hidden",
      }}>
        {form.imageData
          ? <img src={form.imageData} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ textAlign: "center", color: "#444" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>+</div>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>Upload & Crop Photo</div>
            </div>
        }
      </div>
      {form.imageData && (
        <button onClick={onImageClick} style={{ ...ghostBtn, color: "#666", fontSize: 10, letterSpacing: 1, marginBottom: 12, display: "block" }}>
          ↺ Change / Recrop Photo
        </button>
      )}

      <label style={labelStyle}>Name *</label>
      <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Black Wide-Leg Trousers" style={inputStyle} />

      <label style={labelStyle}>Brand</label>
      <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. Everlane, Madewell" style={inputStyle} />

      <label style={labelStyle}>Category</label>
      <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inputStyle }}>
        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      <label style={labelStyle}>Color</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {COLORS.map(c => <button key={c} onClick={() => setForm(f => ({ ...f, color: f.color === c ? "" : c }))} style={chipStyle(form.color === c)}>{c}</button>)}
      </div>
      {form.color === "Other" && (
        <input value={form.customColor} onChange={e => setForm(f => ({ ...f, customColor: e.target.value }))} placeholder="Enter color" style={inputStyle} />
      )}

      <label style={labelStyle}>Material</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {MATERIALS.map(m => <button key={m} onClick={() => setForm(f => ({ ...f, material: f.material === m ? "" : m }))} style={chipStyle(form.material === m)}>{m}</button>)}
      </div>
      {form.material === "Other" && (
        <input value={form.customMaterial} onChange={e => setForm(f => ({ ...f, customMaterial: e.target.value }))} placeholder="Enter material" style={inputStyle} />
      )}

      <label style={labelStyle}>Season</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {SEASONS.map(s => <button key={s} onClick={() => setForm(f => ({ ...f, season: s }))} style={chipStyle(form.season === s)}>{s}</button>)}
      </div>

      {showSleeve && <>
        <label style={labelStyle}>Sleeve Length</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {SLEEVE_LENGTHS.map(s => <button key={s} onClick={() => setForm(f => ({ ...f, sleeveLength: s }))} style={chipStyle(form.sleeveLength === s)}>{s}</button>)}
        </div>
      </>}

      {showLength && <>
        <label style={labelStyle}>Length</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {LENGTHS.map(l => <button key={l} onClick={() => setForm(f => ({ ...f, length: l }))} style={chipStyle(form.length === l)}>{l}</button>)}
        </div>
      </>}

      <label style={labelStyle}>Tags</label>
      {Object.entries(PRESET_TAGS).map(([group, tags]) => (
        <div key={group} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: "#444", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{group}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {tags.map(t => <button key={t} onClick={() => toggleTag(t)} style={chipStyle(form.tags.includes(t))}>{t}</button>)}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <input value={form.customTag || ""} onChange={e => setForm(f => ({ ...f, customTag: e.target.value }))}
          onKeyDown={e => e.key === "Enter" && addCustomTag()}
          placeholder="Custom tag..." style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
        <button onClick={addCustomTag} style={{ ...chipStyle(false), padding: "4px 14px" }}>+</button>
      </div>
      {form.tags.filter(t => !Object.values(PRESET_TAGS).flat().includes(t)).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {form.tags.filter(t => !Object.values(PRESET_TAGS).flat().includes(t)).map(t => (
            <span key={t} style={{ ...chipStyle(true), display: "inline-flex", alignItems: "center", gap: 4 }}>
              {t}
              <span onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))} style={{ cursor: "pointer", opacity: 0.7 }}>×</span>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Date Purchased</label>
          <input type="date" value={form.datePurchased} onChange={e => setForm(f => ({ ...f, datePurchased: e.target.value }))} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Price ($)</label>
          <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" style={inputStyle} />
        </div>
      </div>

      <label style={labelStyle}>Comments</label>
      <textarea value={form.comments} onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
        placeholder="Fit notes, styling ideas, where to wear..."
        style={{ ...inputStyle, height: 80, resize: "none" }} />
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function WardrobeApp() {
  const [items, setItems] = useState(() => loadFromStorage());
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeFilters, setActiveFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState("closet");

  // Add
  const [addMode, setAddMode] = useState("photo");
  const [addForm, setAddForm] = useState(emptyForm());
  const [cropSrc, setCropSrc] = useState(null);
  const [cropTarget, setCropTarget] = useState(null); // "add" | "edit" | tempId
  const [pendingImageData, setPendingImageData] = useState(null);
  const [scanningImage, setScanningImage] = useState(false);
  const fileInputRef = useRef();

  // Receipt
  const [receiptData, setReceiptData] = useState(null);
  const [receiptDate, setReceiptDate] = useState("");
  const [scanning, setScanning] = useState(false);
  const [receiptImages, setReceiptImages] = useState({});
  const receiptFileRef = useRef();

  // Item detail
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemEval, setItemEval] = useState("");
  const [loadingEval, setLoadingEval] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);

  // Outfits
  const [occasion, setOccasion] = useState("");
  const [outfitResult, setOutfitResult] = useState("");
  const [loadingOutfit, setLoadingOutfit] = useState(false);

  function persist(newItems) {
    setItems(newItems);
    saveToStorage(newItems);
  }

  // ── Image / Crop ────────────────────────────────────────────────────────────
  function openFilePicker(target) {
    setCropTarget(target);
    fileInputRef.current.click();
  }

  async function onFileSelected(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await readFile(file);
    setPendingImageData(dataUrl);

    // For "add" mode on new photo uploads, scan image with AI first
    if (cropTarget === "add") {
      setScanningImage(true);
      try {
        const base64 = dataUrl.split(",")[1];
        const mediaType = file.type || "image/jpeg";
        const text = await callClaude(IMAGE_SCAN_PROMPT, [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "Analyze this clothing item." }
        ], 500);
        const clean = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        setAddForm(f => ({
          ...f,
          name: parsed.name || f.name,
          brand: parsed.brand || f.brand,
          color: parsed.color || f.color,
          material: parsed.material || f.material,
          category: parsed.category || f.category,
          season: parsed.season || f.season,
          sleeveLength: parsed.sleeveLength || f.sleeveLength,
          length: parsed.length || f.length,
          price: parsed.price || f.price,
          datePurchased: parsed.datePurchased || f.datePurchased,
        }));
      } catch {}
      setScanningImage(false);
    }

    setCropSrc(dataUrl);
  }

  function onCropDone(cropped) {
    if (cropTarget === "add") setAddForm(f => ({ ...f, imageData: cropped }));
    else if (cropTarget === "edit") setEditForm(f => ({ ...f, imageData: cropped }));
    else setReceiptImages(prev => ({ ...prev, [cropTarget]: cropped }));
    setCropSrc(null);
    setCropTarget(null);
    setPendingImageData(null);
  }

  function onCropCancel() {
    // Use original without crop
    if (pendingImageData) {
      if (cropTarget === "add") setAddForm(f => ({ ...f, imageData: pendingImageData }));
      else if (cropTarget === "edit") setEditForm(f => ({ ...f, imageData: pendingImageData }));
      else setReceiptImages(prev => ({ ...prev, [cropTarget]: pendingImageData }));
    }
    setCropSrc(null);
    setCropTarget(null);
    setPendingImageData(null);
  }

  // ── Add Item ────────────────────────────────────────────────────────────────
  function buildItem(form, imageOverride) {
    const color = form.color === "Other" ? form.customColor : form.color;
    const material = form.material === "Other" ? form.customMaterial : form.material;
    return {
      id: Date.now() + Math.random(),
      name: form.name, brand: form.brand, category: form.category,
      color, material, season: form.season,
      sleeveLength: form.sleeveLength, length: form.length,
      tags: form.tags, comments: form.comments,
      datePurchased: form.datePurchased,
      price: form.price ? parseFloat(form.price) : null,
      imageData: imageOverride || form.imageData,
      wornDates: [],
      addedAt: new Date().toISOString(),
    };
  }

  function addItem() {
    if (!addForm.name) return;
    persist([...items, buildItem(addForm)]);
    setAddForm(emptyForm());
    setView("closet");
  }

  // ── Receipt ─────────────────────────────────────────────────────────────────
  async function scanReceipt(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setScanning(true);
    setReceiptData(null);
    setReceiptImages({});
    const dataUrl = await readFile(file);
    const base64 = dataUrl.split(",")[1];
    const mediaType = file.type || "image/jpeg";
    try {
      const text = await callClaude(RECEIPT_PROMPT, [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
        { type: "text", text: "Extract all clothing items." }
      ], 1000);
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setReceiptDate(parsed.purchaseDate || "");
      setReceiptData((parsed.items || []).map((item, i) => ({
        ...item, tempId: i,
        season: "All Year", sleeveLength: "N/A", length: "N/A",
        material: "", tags: [], comments: "", price: item.price || "",
      })));
    } catch { setReceiptData([]); }
    setScanning(false);
  }

  function updateRI(tempId, field, value) {
    setReceiptData(prev => prev.map(i => i.tempId === tempId ? { ...i, [field]: value } : i));
  }

  function toggleRITag(tempId, tag) {
    setReceiptData(prev => prev.map(i => {
      if (i.tempId !== tempId) return i;
      return { ...i, tags: i.tags.includes(tag) ? i.tags.filter(t => t !== tag) : [...i.tags, tag] };
    }));
  }

  async function addReceiptItems() {
    const newItems = receiptData.map(item => ({
      id: Date.now() + item.tempId + Math.random(),
      name: item.name, brand: item.brand || "", category: item.category,
      color: item.color || "", material: item.material || "",
      season: item.season || "All Year", sleeveLength: item.sleeveLength || "N/A",
      length: item.length || "N/A", tags: item.tags || [], comments: item.comments || "",
      datePurchased: receiptDate || "",
      price: item.price ? parseFloat(item.price) : null,
      imageData: receiptImages[item.tempId] || null,
      wornDates: [], addedAt: new Date().toISOString(),
    }));
    persist([...items, ...newItems]);
    setReceiptData(null); setReceiptDate(""); setReceiptImages({});
    setView("closet");
  }

  // ── Wear / Edit / Remove ────────────────────────────────────────────────────
  function markWorn(id) {
    const today = new Date().toISOString().split("T")[0];
    const updated = items.map(i => i.id === id ? { ...i, wornDates: [...(i.wornDates || []), today] } : i);
    persist(updated);
    if (selectedItem?.id === id) setSelectedItem(updated.find(i => i.id === id));
  }

  function removeItem(id) {
    persist(items.filter(i => i.id !== id));
    setSelectedItem(null); setItemEval(""); setEditing(false);
  }

  function saveEdit() {
    const color = editForm.color === "Other" ? editForm.customColor : editForm.color;
    const material = editForm.material === "Other" ? editForm.customMaterial : editForm.material;
    const updated = items.map(i => i.id === editForm.id ? { ...editForm, color, material } : i);
    persist(updated);
    setSelectedItem(updated.find(i => i.id === editForm.id));
    setEditing(false);
  }

  // ── AI ──────────────────────────────────────────────────────────────────────
  async function evaluateItem(item) {
    setSelectedItem(item); setItemEval(""); setLoadingEval(true); setEditing(false);
    try {
      const text = await callClaude(STYLE_SYSTEM, EVALUATE_PROMPT(item), 500);
      setItemEval(text);
    } catch { setItemEval("Error. Try again."); }
    setLoadingEval(false);
  }

  async function generateOutfits() {
    if (items.length < 2) return;
    setLoadingOutfit(true); setOutfitResult("");
    try {
      const text = await callClaude(STYLE_SYSTEM, OUTFIT_PROMPT(items, occasion), 1000);
      setOutfitResult(text);
    } catch { setOutfitResult("Error. Try again."); }
    setLoadingOutfit(false);
  }

  // ── Export / Import ─────────────────────────────────────────────────────────
  function exportWardrobe() {
    const json = JSON.stringify(items, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `wardrobe-${new Date().toISOString().split("T")[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  function importWardrobe(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (Array.isArray(imported)) {
          persist([...items, ...imported]);
          alert(`Imported ${imported.length} items.`);
        }
      } catch { alert("Invalid file."); }
    };
    reader.readAsText(file);
  }

  // ── Filtering ───────────────────────────────────────────────────────────────
  const filtered = items.filter(i => {
    if (activeCategory !== "All" && i.category !== activeCategory) return false;
    if (activeFilters.color && i.color !== activeFilters.color) return false;
    if (activeFilters.season && i.season !== activeFilters.season) return false;
    if (activeFilters.material && i.material !== activeFilters.material) return false;
    if (activeFilters.tag && !(i.tags || []).includes(activeFilters.tag)) return false;
    return true;
  });

  const underloved = items.filter(i => !i.wornDates?.length);
  const allTags = [...new Set(items.flatMap(i => i.tags || []))];
  const importRef = useRef();

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#111", color: "#e8e2d8", fontFamily: "Georgia, 'Times New Roman', serif", maxWidth: 480, margin: "0 auto" }}>

      {/* Crop Modal */}
      {cropSrc && <CropModal imageSrc={cropSrc} onDone={onCropDone} onCancel={onCropCancel} />}

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileSelected} style={{ display: "none" }} />
      <input ref={receiptFileRef} type="file" accept="image/*" onChange={scanReceipt} style={{ display: "none" }} />
      <input ref={importRef} type="file" accept=".json" onChange={importWardrobe} style={{ display: "none" }} />

      {/* ── Header ── */}
      <div style={{ padding: "28px 24px 18px", borderBottom: "1px solid #222" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: 5, color: "#555", textTransform: "uppercase", marginBottom: 5 }}>Personal Closet</div>
            <div style={{ fontSize: 28, fontStyle: "italic", letterSpacing: -0.5 }}>Wardrobe</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 20, fontWeight: 300 }}>{items.length}</div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: 2, color: "#555", textTransform: "uppercase" }}>pieces</div>
            {underloved.length > 0 && <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#b8976a", marginTop: 3 }}>{underloved.length} unworn</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 18, fontFamily: "'DM Sans', system-ui, sans-serif", flexWrap: "wrap" }}>
          {navBtn("Closet", view === "closet", () => setView("closet"))}
          {navBtn("Outfits", view === "outfits", () => setView("outfits"))}
          {navBtn("+ Add", view === "add", () => { setView("add"); setAddMode("photo"); setReceiptData(null); setAddForm(emptyForm()); })}
        </div>
      </div>

      {/* ── CLOSET ── */}
      {view === "closet" && (
        <div>
          <div style={{ display: "flex", gap: 6, padding: "14px 24px 6px", overflowX: "auto", scrollbarWidth: "none", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            {["All", ...CATEGORIES].map(cat => navBtn(cat, activeCategory === cat, () => setActiveCategory(cat)))}
          </div>

          {/* Filters */}
          <div style={{ padding: "8px 24px 12px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            <button onClick={() => setShowFilters(f => !f)} style={{ ...ghostBtn, fontSize: 10, letterSpacing: 1.5 }}>
              {showFilters ? "▲ Hide" : "▼ Filter"}
              {Object.keys(activeFilters).length > 0 && <span style={{ color: "#b8976a", marginLeft: 6 }}>({Object.keys(activeFilters).length})</span>}
            </button>
            {showFilters && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { key: "color", opts: COLORS },
                  { key: "season", opts: SEASONS },
                  { key: "material", opts: MATERIALS },
                  ...(allTags.length ? [{ key: "tag", opts: allTags }] : []),
                ].map(({ key, opts }) => (
                  <div key={key}>
                    <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "#555", marginBottom: 6 }}>{key}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {opts.map(o => (
                        <button key={o} onClick={() => setActiveFilters(f => f[key] === o ? Object.fromEntries(Object.entries(f).filter(([k]) => k !== key)) : { ...f, [key]: o })} style={chipStyle(activeFilters[key] === o)}>{o}</button>
                      ))}
                    </div>
                  </div>
                ))}
                {Object.keys(activeFilters).length > 0 && <button onClick={() => setActiveFilters({})} style={{ ...ghostBtn, color: "#8a4a4a", fontSize: 10 }}>Clear filters</button>}
              </div>
            )}
          </div>

          {/* Export/Import */}
          <div style={{ padding: "0 24px 12px", display: "flex", gap: 10, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            <button onClick={exportWardrobe} style={{ ...ghostBtn, fontSize: 9, letterSpacing: 1.5, color: "#555" }}>↓ Export</button>
            <button onClick={() => importRef.current.click()} style={{ ...ghostBtn, fontSize: 9, letterSpacing: 1.5, color: "#555" }}>↑ Import</button>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "#444", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
              <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>{items.length > 0 ? "No matches" : "Nothing here yet"}</div>
              <div style={{ fontSize: 11, color: "#333" }}>{items.length > 0 ? "Try different filters" : "Add your first piece"}</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              {filtered.map(item => (
                <div key={item.id} onClick={() => evaluateItem(item)} style={{ position: "relative", aspectRatio: "3/4", background: "#1a1a1a", cursor: "pointer", overflow: "hidden" }}>
                  {item.imageData
                    ? <img src={item.imageData} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, boxSizing: "border-box" }}>
                        {item.color && <div style={{ fontSize: 10, color: "#555", letterSpacing: 1 }}>{item.color}</div>}
                        <div style={{ fontSize: 11, color: "#444", letterSpacing: 1, textAlign: "center" }}>{item.name}</div>
                      </div>
                  }
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(8,8,8,0.94))", padding: "20px 10px 9px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                    {item.name && <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 1, lineHeight: 1.3 }}>{item.name}</div>}
                    <div style={{ fontSize: 9, color: "#666", letterSpacing: 1, textTransform: "uppercase" }}>{item.brand || item.category}</div>
                  </div>
                  {!item.wornDates?.length && <div style={{ position: "absolute", top: 7, right: 7, background: "#b8976a", color: "#111", borderRadius: 2, padding: "2px 5px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 8, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" }}>New</div>}
                  {item.wornDates?.length > 0 && <div style={{ position: "absolute", top: 7, left: 7, background: "#ffffff12", color: "#ffffff55", borderRadius: 2, padding: "2px 6px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9 }}>×{item.wornDates.length}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── OUTFITS ── */}
      {view === "outfits" && (
        <div style={{ padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          <label style={labelStyle}>Occasion (optional)</label>
          <input value={occasion} onChange={e => setOccasion(e.target.value)} placeholder="e.g. boat day, errands, travel..." style={{ ...inputStyle }} />
          <button onClick={generateOutfits} disabled={loadingOutfit || items.length < 2} style={{
            width: "100%", background: items.length < 2 ? "#1a1a1a" : "#e8e2d8",
            color: items.length < 2 ? "#444" : "#111", border: "none", borderRadius: 3, padding: "14px",
            fontSize: 11, letterSpacing: 3, textTransform: "uppercase",
            cursor: items.length < 2 ? "not-allowed" : "pointer", fontWeight: 600, marginBottom: 20,
          }}>{loadingOutfit ? "Styling..." : "Generate Outfits"}</button>
          {items.length < 2 && <div style={{ textAlign: "center", color: "#444", fontSize: 12, marginBottom: 16 }}>Add at least 2 pieces first</div>}
          {outfitResult && <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 3, padding: 18, fontSize: 13, lineHeight: 1.8, color: "#c8c0b0", whiteSpace: "pre-wrap" }}>{outfitResult}</div>}
          {underloved.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: "#b8976a", marginBottom: 12 }}>Never worn</div>
              {underloved.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#1a1a1a", border: "1px solid #b8976a22", borderRadius: 3, padding: "9px 12px", marginBottom: 7 }}>
                  {item.imageData && <img src={item.imageData} style={{ width: 32, height: 42, objectFit: "cover", borderRadius: 2, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name || "Unnamed"}</div>
                    <div style={{ fontSize: 9, color: "#666", letterSpacing: 1, textTransform: "uppercase" }}>{item.brand || item.category}</div>
                  </div>
                  <button onClick={() => markWorn(item.id)} style={{ ...chipStyle(false), flexShrink: 0 }}>worn</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ADD ── */}
      {view === "add" && (
        <div style={{ padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {navBtn("📷 Photo", addMode === "photo", () => setAddMode("photo"))}
            {navBtn("🧾 Receipt", addMode === "receipt", () => { setAddMode("receipt"); setReceiptData(null); })}
          </div>

          {addMode === "photo" && (
            <>
              {scanningImage && (
                <div style={{ textAlign: "center", padding: "20px 0 12px", color: "#b8976a", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>✦ Reading image...</div>
                  <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>Extracting brand, color, and details</div>
                </div>
              )}
              <FormFields form={addForm} setForm={setAddForm} onImageClick={() => openFilePicker("add")} />
              <button onClick={addItem} disabled={!addForm.name || scanningImage} style={{
                width: "100%", background: addForm.name && !scanningImage ? "#e8e2d8" : "#1a1a1a",
                color: addForm.name && !scanningImage ? "#111" : "#444", border: "none", borderRadius: 3, padding: "14px",
                fontSize: 11, letterSpacing: 3, textTransform: "uppercase",
                cursor: addForm.name && !scanningImage ? "pointer" : "not-allowed", fontWeight: 600, marginTop: 8,
              }}>Add to Closet</button>
            </>
          )}

          {addMode === "receipt" && !receiptData && !scanning && (
            <div onClick={() => receiptFileRef.current.click()} style={{
              background: "#1a1a1a", border: "1px dashed #333", borderRadius: 3,
              padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer",
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🧾</div>
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#666" }}>Upload Receipt</div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 6, textAlign: "center" }}>Photo or screenshot of any receipt or order confirmation</div>
            </div>
          )}

          {scanning && (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "#666" }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>🧾</div>
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>Reading receipt...</div>
            </div>
          )}

          {receiptData && receiptData.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#666" }}>
              <div style={{ marginBottom: 12, fontSize: 13 }}>No clothing items found.</div>
              <button onClick={() => setReceiptData(null)} style={{ ...chipStyle(false) }}>Try Again</button>
            </div>
          )}

          {receiptData && receiptData.length > 0 && (
            <>
              <div style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: "#b8976a", marginBottom: 6 }}>{receiptData.length} item{receiptData.length !== 1 ? "s" : ""} found</div>
              {receiptDate && <div style={{ fontSize: 11, color: "#888", marginBottom: 14 }}>Purchase date: {receiptDate}</div>}

              {receiptData.map(item => (
                <div key={item.tempId} style={{ background: "#1a1a1a", border: "1px solid #222", borderRadius: 3, padding: 14, marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                    <div onClick={() => openFilePicker(item.tempId)} style={{ width: 52, height: 68, background: "#111", border: "1px dashed #333", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, overflow: "hidden" }}>
                      {receiptImages[item.tempId] ? <img src={receiptImages[item.tempId]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ fontSize: 20, color: "#333" }}>+</div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input value={item.name} onChange={e => updateRI(item.tempId, "name", e.target.value)} style={{ ...inputStyle, padding: "8px 10px", fontSize: 11, marginBottom: 6 }} />
                      <input value={item.brand || ""} onChange={e => updateRI(item.tempId, "brand", e.target.value)} placeholder="Brand" style={{ ...inputStyle, padding: "8px 10px", fontSize: 11, marginBottom: 6 }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <select value={item.category} onChange={e => updateRI(item.tempId, "category", e.target.value)} style={{ ...inputStyle, padding: "8px 10px", fontSize: 11, marginBottom: 0, flex: 1 }}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input value={item.price || ""} onChange={e => updateRI(item.tempId, "price", e.target.value)} placeholder="$" style={{ ...inputStyle, padding: "8px 10px", fontSize: 11, marginBottom: 0, width: 60 }} />
                      </div>
                    </div>
                    <button onClick={() => setReceiptData(prev => prev.filter(i => i.tempId !== item.tempId))} style={{ ...ghostBtn, fontSize: 18, color: "#444", flexShrink: 0 }}>×</button>
                  </div>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", marginBottom: 6 }}>Color</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                    {COLORS.map(c => <button key={c} onClick={() => updateRI(item.tempId, "color", item.color === c ? "" : c)} style={{ ...chipStyle(item.color === c), padding: "3px 8px", fontSize: 9 }}>{c}</button>)}
                  </div>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", marginBottom: 6 }}>Tags</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Object.values(PRESET_TAGS).flat().map(t => <button key={t} onClick={() => toggleRITag(item.tempId, t)} style={{ ...chipStyle((item.tags || []).includes(t)), padding: "3px 8px", fontSize: 9 }}>{t}</button>)}
                  </div>
                </div>
              ))}

              <button onClick={addReceiptItems} style={{ width: "100%", background: "#e8e2d8", color: "#111", border: "none", borderRadius: 3, padding: "14px", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", fontWeight: 600 }}>
                Add {receiptData.length} Item{receiptData.length !== 1 ? "s" : ""} to Closet
              </button>
              <button onClick={() => { setReceiptData(null); setReceiptDate(""); setReceiptImages({}); }} style={{ width: "100%", background: "transparent", border: "1px solid #222", color: "#555", borderRadius: 3, padding: "11px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", marginTop: 8 }}>
                Scan Different Receipt
              </button>
            </>
          )}
        </div>
      )}

      {/* ── ITEM DETAIL ── */}
      {selectedItem && !editing && (
        <div style={{ position: "fixed", inset: 0, background: "#0d0d0d", zIndex: 100, overflowY: "auto" }}>
          <div style={{ padding: 24, maxWidth: 480, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <button onClick={() => { setSelectedItem(null); setItemEval(""); }} style={ghostBtn}>← Back</button>
              <button onClick={() => { setEditing(true); setEditForm({ ...selectedItem, customColor: "", customMaterial: "" }); }} style={{ ...chipStyle(false), fontSize: 10 }}>Edit</button>
            </div>

            {selectedItem.imageData
              ? <img src={selectedItem.imageData} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 3, marginBottom: 14 }} />
              : <div style={{ width: "100%", aspectRatio: "3/4", background: "#1a1a1a", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, color: "#333", fontSize: 12, letterSpacing: 2 }}>No Photo</div>
            }

            <div style={{ fontFamily: "Georgia, serif", fontSize: 20, fontStyle: "italic", marginBottom: 3 }}>{selectedItem.name || "Unnamed"}</div>
            {selectedItem.brand && <div style={{ fontSize: 11, color: "#777", marginBottom: 8 }}>{selectedItem.brand}</div>}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
              {selectedItem.color && <span style={chipStyle(false)}>{selectedItem.color}</span>}
              {selectedItem.material && <span style={chipStyle(false)}>{selectedItem.material}</span>}
              {selectedItem.season && selectedItem.season !== "All Year" && <span style={chipStyle(false)}>{selectedItem.season}</span>}
              {selectedItem.sleeveLength && selectedItem.sleeveLength !== "N/A" && <span style={chipStyle(false)}>{selectedItem.sleeveLength}</span>}
              {selectedItem.length && selectedItem.length !== "N/A" && <span style={chipStyle(false)}>{selectedItem.length}</span>}
              {(selectedItem.tags || []).map(t => <span key={t} style={{ ...chipStyle(true) }}>{t}</span>)}
            </div>

            {selectedItem.comments && <div style={{ fontSize: 12, color: "#777", fontStyle: "italic", lineHeight: 1.6, marginBottom: 12 }}>{selectedItem.comments}</div>}

            <div style={{ fontSize: 10, color: "#555", letterSpacing: 0.5, lineHeight: 1.8, marginBottom: 14 }}>
              {selectedItem.price && <span>Paid ${selectedItem.price.toFixed(2)}{selectedItem.wornDates?.length > 0 ? ` · $${(selectedItem.price / selectedItem.wornDates.length).toFixed(2)}/wear` : ""} · </span>}
              {selectedItem.datePurchased && <span>Purchased {selectedItem.datePurchased} · </span>}
              Worn {selectedItem.wornDates?.length || 0}×
              {selectedItem.wornDates?.length > 0 && ` · Last worn ${selectedItem.wornDates[selectedItem.wornDates.length - 1]}`}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={() => markWorn(selectedItem.id)} style={{ flex: 1, background: "transparent", border: "1px solid #333", color: "#e8e2d8", borderRadius: 3, padding: "10px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>Mark Worn Today</button>
              <button onClick={() => removeItem(selectedItem.id)} style={{ background: "transparent", border: "1px solid #3a2020", color: "#8a4a4a", borderRadius: 3, padding: "10px 16px", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>Remove</button>
            </div>

            {selectedItem.wornDates?.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "#555", marginBottom: 8 }}>Wear History</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {[...selectedItem.wornDates].reverse().slice(0, 12).map((d, i) => <span key={i} style={{ fontSize: 10, color: "#666", background: "#1a1a1a", padding: "3px 8px", borderRadius: 2 }}>{d}</span>)}
                </div>
              </div>
            )}

            <div style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: "#555", marginBottom: 10 }}>Style Verdict</div>
            {loadingEval
              ? <div style={{ color: "#444", fontSize: 12, padding: "16px 0", fontStyle: "italic" }}>Evaluating...</div>
              : <div style={{ background: "#1a1a1a", border: "1px solid #222", borderRadius: 3, padding: 16, fontSize: 13, lineHeight: 1.8, color: "#c8c0b0", whiteSpace: "pre-wrap" }}>{itemEval}</div>
            }
          </div>
        </div>
      )}

      {/* ── EDIT ── */}
      {selectedItem && editing && editForm && (
        <div style={{ position: "fixed", inset: 0, background: "#0d0d0d", zIndex: 100, overflowY: "auto" }}>
          <div style={{ padding: 24, maxWidth: 480, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <button onClick={() => setEditing(false)} style={ghostBtn}>← Cancel</button>
              <button onClick={saveEdit} style={{ background: "#e8e2d8", color: "#111", border: "none", borderRadius: 3, padding: "7px 20px", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", fontWeight: 600 }}>Save</button>
            </div>
            <FormFields form={editForm} setForm={setEditForm} onImageClick={() => openFilePicker("edit")} />
          </div>
        </div>
      )}
    </div>
  );
}
