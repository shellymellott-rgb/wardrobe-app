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
    if (dragging) { setCrop(clamp({ ...cropStart, x: cropStart.x + dx, y: cropStart.y + dy })); return; }
    if (resizing) {
      let { x, y, w, h } = cropStart;
      if (resizing.includes("e")) w = Math.max(20, w + dx);
      if (resizing.includes("s")) h = Math.max(20, h + dy);
      if (resizing.includes("w")) { w = Math.max(20, w - dx); x = x + dx; }
      if (resizing.includes("n")) { h = Math.max(20, h - dy); y = y + dy; }
      if (mode === "portrait") h = w * (4/3);
      if (mode === "square") h = w;
      setCrop(clamp({ x, y, w, h })); return;
    }
    let w = pos.x - cropStart.x; let h = pos.y - cropStart.y;
    if (mode === "portrait") h = Math.abs(w) * (4/3) * (h < 0 ? -1 : 1);
    if (mode === "square") { const s = Math.max(Math.abs(w), Math.abs(h)); w = w < 0 ? -s : s; h = h < 0 ? -s : s; }
    setCrop(clamp({ x: w < 0 ? cropStart.x + w : cropStart.x, y: h < 0 ? cropStart.y + h : cropStart.y, w: Math.abs(w), h: Math.abs(h) }));
  }

  function onPointerUp() { setDragging(false); setResizing(null); setDragStart(null); setCropStart(null); }

  function applyCrop() {
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
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, cw); canvas.height = Math.max(1, ch);
    canvas.getContext("2d").drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
    onDone(canvas.toDataURL("image/jpeg", 0.92));
  }

  const HANDLES = ["nw","n","ne","e","se","s","sw","w"];
  const hSize = 14;
  function hStyle(h) {
    const p = {
      nw:{left:crop.x-hSize/2,top:crop.y-hSize/2}, n:{left:crop.x+crop.w/2-hSize/2,top:crop.y-hSize/2},
      ne:{left:crop.x+crop.w-hSize/2,top:crop.y-hSize/2}, e:{left:crop.x+crop.w-hSize/2,top:crop.y+crop.h/2-hSize/2},
      se:{left:crop.x+crop.w-hSize/2,top:crop.y+crop.h-hSize/2}, s:{left:crop.x+crop.w/2-hSize/2,top:crop.y+crop.h-hSize/2},
      sw:{left:crop.x-hSize/2,top:crop.y+crop.h-hSize/2}, w:{left:crop.x-hSize/2,top:crop.y+crop.h/2-hSize/2},
    };
    const c = { nw:"nwse-resize",n:"ns-resize",ne:"nesw-resize",e:"ew-resize",se:"nwse-resize",s:"ns-resize",sw:"nesw-resize",w:"ew-resize" };
    return { position:"absolute", width:hSize, height:hSize, background:"#e8e2d8", borderRadius:2, zIndex:10, cursor:c[h], touchAction:"none", ...p[h] };
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"#000", zIndex:200, display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid #1a1a1a", flexShrink:0 }}>
        <button onClick={onCancel} style={{ background:"transparent", border:"none", color:"#888", fontSize:11, letterSpacing:1.5, textTransform:"uppercase", cursor:"pointer" }}>Cancel</button>
        <div style={{ display:"flex", gap:6 }}>
          {[["portrait","3:4"],["square","1:1"],["free","Free"]].map(([m,label]) => (
            <button key={m} onClick={() => setMode(m)} style={{ background:mode===m?"#e8e2d8":"#1a1a1a", color:mode===m?"#111":"#666", border:`1px solid ${mode===m?"#e8e2d8":"#2a2a2a"}`, borderRadius:20, padding:"4px 12px", fontSize:10, cursor:"pointer" }}>{label}</button>
          ))}
        </div>
        <button onClick={applyCrop} style={{ background:"#e8e2d8", color:"#111", border:"none", borderRadius:3, padding:"6px 16px", fontSize:11, fontWeight:600, cursor:"pointer" }}>Apply</button>
      </div>
      <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>
        <div ref={containerRef}
          style={{ flex:1, position:"relative", overflow:"hidden", userSelect:"none", touchAction:"none", cursor:"crosshair" }}
          onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}>
          <img ref={imgRef} src={imageSrc} onLoad={() => setImgLoaded(true)}
            style={{ width:"100%", height:"100%", objectFit:"contain", display:"block", pointerEvents:"none" }} />
          {imgLoaded && crop.w > 10 && <>
            <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}>
              <defs><mask id="cm"><rect width="100%" height="100%" fill="white"/><rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="black"/></mask></defs>
              <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#cm)"/>
              <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="none" stroke="#e8e2d8" strokeWidth="1.5"/>
              <line x1={crop.x+crop.w/3} y1={crop.y} x2={crop.x+crop.w/3} y2={crop.y+crop.h} stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
              <line x1={crop.x+crop.w*2/3} y1={crop.y} x2={crop.x+crop.w*2/3} y2={crop.y+crop.h} stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
              <line x1={crop.x} y1={crop.y+crop.h/3} x2={crop.x+crop.w} y2={crop.y+crop.h/3} stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
              <line x1={crop.x} y1={crop.y+crop.h*2/3} x2={crop.x+crop.w} y2={crop.y+crop.h*2/3} stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
            </svg>
            {HANDLES.map(h => <div key={h} data-handle={h} style={hStyle(h)} />)}
          </>}
          {!imgLoaded && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#555", fontSize:11 }}>Loading...</div>}
        </div>
        <div style={{ width:100, background:"#080808", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, padding:10, borderLeft:"1px solid #1a1a1a", flexShrink:0 }}>
          <div style={{ fontSize:8, letterSpacing:2, textTransform:"uppercase", color:"#444" }}>Preview</div>
          {previewUrl
            ? <img src={previewUrl} style={{ width:80, height:mode==="portrait"?80*(4/3):80, objectFit:"cover", borderRadius:2, border:"1px solid #222", maxHeight:120 }} />
            : <div style={{ width:80, height:80, background:"#111", borderRadius:2 }} />}
          {crop.w > 10 && <div style={{ fontSize:8, color:"#444", textAlign:"center" }}>{Math.round(crop.w)}×{Math.round(crop.h)}</div>}
        </div>
      </div>
      <div style={{ padding:"8px 0", textAlign:"center", color:"#333", fontSize:9, letterSpacing:1.5, textTransform:"uppercase", flexShrink:0 }}>
        Drag image · Handles to resize
      </div>
    </div>
  );
}

const ghostBtn = { background:"transparent", border:"none", color:"#888", fontSize:11, letterSpacing:1.5, textTransform:"uppercase", cursor:"pointer", padding:"4px 0" };
function chipStyle(active) {
  return { background:active?"#e8e2d8":"#1a1a1a", color:active?"#111":"#666", border:`1px solid ${active?"#e8e2d8":"#2a2a2a"}`, borderRadius:20, padding:"4px 12px", fontSize:10, letterSpacing:1, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'DM Sans', system-ui, sans-serif" };
}
const inputStyle = { width:"100%", background:"#1a1a1a", border:"1px solid #2a2a2a", color:"#e8e2d8", borderRadius:3, padding:"11px 12px", fontSize:12, outline:"none", boxSizing:"border-box", fontFamily:"'DM Sans', system-ui, sans-serif", marginBottom:10 };
const labelStyle = { fontSize:9, letterSpacing:2, textTransform:"uppercase", color:"#666", display:"block", marginBottom:5, marginTop:10 };
function navBtn(label, active, onClick) {
  return <button onClick={onClick} style={{ background:active?"#e8e2d8":"transparent", color:active?"#111":"#888", border:`1px solid ${active?"#e8e2d8":"#333"}`, borderRadius:20, padding:"6px 16px", fontSize:11, letterSpacing:1.5, textTransform:"uppercase", cursor:"pointer", fontWeight:active?600:400, whiteSpace:"nowrap" }}>{label}</button>;
}

function FormFields({ form, setForm, onImageClick, brands=[], onAddBrand }) {
  const showSleeve = ["Tops","Dresses"].includes(form.category);
  const showLength = ["Bottoms","Dresses"].includes(form.category);
  function toggleTag(tag) { setForm(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] })); }
  function addCustomTag() {
    if (!form.customTag?.trim()) return;
    const tag = form.customTag.trim();
    if (!form.tags.includes(tag)) setForm(f => ({ ...f, tags:[...f.tags, tag], customTag:"" }));
    else setForm(f => ({ ...f, customTag:"" }));
  }
  return (
    <div>
      <div onClick={onImageClick} style={{ aspectRatio:"3/4", background:"#1a1a1a", border:"1px dashed #333", borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", marginBottom:16, overflow:"hidden" }}>
        {form.imageData ? <img src={form.imageData} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <div style={{ textAlign:"center", color:"#444" }}><div style={{ fontSize:28, marginBottom:8 }}>+</div><div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase" }}>Upload & Crop Photo</div></div>}
      </div>
      {form.imageData && <button onClick={onImageClick} style={{ ...ghostBtn, color:"#666", fontSize:10, letterSpacing:1, marginBottom:12, display:"block" }}>↺ Change / Recrop</button>}

      <label style={labelStyle}>Name *</label>
      <input value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} placeholder="e.g. Black Wide-Leg Trousers" style={inputStyle} />

      <label style={labelStyle}>Brand</label>
      {brands.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
          {brands.map(b => <button key={b} onClick={() => setForm(f => ({ ...f, brand:f.brand===b?"":b }))} style={{ ...chipStyle(form.brand===b), fontSize:10 }}>{b}</button>)}
        </div>
      )}
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand:e.target.value }))}
          placeholder={brands.length > 0 ? "Or type new brand..." : "e.g. Everlane, Madewell"}
          style={{ ...inputStyle, marginBottom:0, flex:1 }}
          onKeyDown={e => { if (e.key==="Enter" && form.brand.trim() && onAddBrand) onAddBrand(form.brand.trim()); }} />
        {form.brand && !brands.includes(form.brand) && onAddBrand && (
          <button onClick={() => onAddBrand(form.brand.trim())} style={{ ...chipStyle(false), padding:"4px 12px", flexShrink:0 }}>Save</button>
        )}
      </div>

      <label style={labelStyle}>Category</label>
      <select value={form.category} onChange={e => setForm(f => ({ ...f, category:e.target.value }))} style={inputStyle}>
        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      <label style={labelStyle}>Color</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
        {COLORS.map(c => <button key={c} onClick={() => setForm(f => ({ ...f, color:f.color===c?"":c }))} style={chipStyle(form.color===c)}>{c}</button>)}
      </div>
      {form.color==="Other" && <input value={form.customColor} onChange={e => setForm(f => ({ ...f, customColor:e.target.value }))} placeholder="Enter color" style={inputStyle} />}

      <label style={labelStyle}>Material</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
        {MATERIALS.map(m => <button key={m} onClick={() => setForm(f => ({ ...f, material:f.material===m?"":m }))} style={chipStyle(form.material===m)}>{m}</button>)}
      </div>
      {form.material==="Other" && <input value={form.customMaterial} onChange={e => setForm(f => ({ ...f, customMaterial:e.target.value }))} placeholder="Enter material" style={inputStyle} />}

      <label style={labelStyle}>Season</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
        {SEASONS.map(s => <button key={s} onClick={() => setForm(f => ({ ...f, season:s }))} style={chipStyle(form.season===s)}>{s}</button>)}
      </div>

      {showSleeve && <>
        <label style={labelStyle}>Sleeve Length</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
          {SLEEVE_LENGTHS.map(s => <button key={s} onClick={() => setForm(f => ({ ...f, sleeveLength:s }))} style={chipStyle(form.sleeveLength===s)}>{s}</button>)}
        </div>
      </>}
      {showLength && <>
        <label style={labelStyle}>Length</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
          {LENGTHS.map(l => <button key={l} onClick={() => setForm(f => ({ ...f, length:l }))} style={chipStyle(form.length===l)}>{l}</button>)}
        </div>
      </>}

      <label style={labelStyle}>Tags</label>
      {Object.entries(PRESET_TAGS).map(([group, tags]) => (
        <div key={group} style={{ marginBottom:8 }}>
          <div style={{ fontSize:9, color:"#444", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>{group}</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
            {tags.map(t => <button key={t} onClick={() => toggleTag(t)} style={chipStyle(form.tags.includes(t))}>{t}</button>)}
          </div>
        </div>
      ))}
      <div style={{ display:"flex", gap:8, marginTop:4 }}>
        <input value={form.customTag||""} onChange={e => setForm(f => ({ ...f, customTag:e.target.value }))}
          onKeyDown={e => e.key==="Enter" && addCustomTag()}
          placeholder="Custom tag..." style={{ ...inputStyle, marginBottom:0, flex:1 }} />
        <button onClick={addCustomTag} style={{ ...chipStyle(false), padding:"4px 14px" }}>+</button>
      </div>
      {form.tags.filter(t => !Object.values(PRESET_TAGS).flat().includes(t)).length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:8 }}>
          {form.tags.filter(t => !Object.values(PRESET_TAGS).flat().includes(t)).map(t => (
            <span key={t} style={{ ...chipStyle(true), display:"inline-flex", alignItems:"center", gap:4 }}>
              {t}<span onClick={() => setForm(f => ({ ...f, tags:f.tags.filter(x => x!==t) }))} style={{ cursor:"pointer", opacity:0.7 }}>×</span>
            </span>
          ))}
        </div>
      )}

      <div style={{ display:"flex", gap:10, marginTop:10 }}>
        <div style={{ flex:1 }}>
          <label style={labelStyle}>Date Purchased</label>
          <input type="date" value={form.datePurchased} onChange={e => setForm(f => ({ ...f, datePurchased:e.target.value }))} style={inputStyle} />
        </div>
        <div style={{ flex:1 }}>
          <label style={labelStyle}>Price ($)</label>
          <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price:e.target.value }))} placeholder="0.00" style={inputStyle} />
        </div>
      </div>

      <label style={labelStyle}>Comments</label>
      <textarea value={form.comments} onChange={e => setForm(f => ({ ...f, comments:e.target.value }))}
        placeholder="Fit notes, styling ideas, where to wear..."
        style={{ ...inputStyle, height:80, resize:"none" }} />
    </div>
  );
}

export default function WardrobeApp() {
  const [items, setItems] = useState(() => loadFromStorage());
  const [brands, setBrands] = useState(() => { try { const b = localStorage.getItem("wardrobe-brands"); return b ? JSON.parse(b) : []; } catch { return []; } });
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeFilters, setActiveFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState("closet");
  const [addMode, setAddMode] = useState("photo");
  const [addForm, setAddForm] = useState(emptyForm());
  const [cropSrc, setCropSrc] = useState(null);
  const [cropTarget, setCropTarget] = useState(null);
  const [pendingImageData, setPendingImageData] = useState(null);
  const [scanningImage, setScanningImage] = useState(false);
  const fileInputRef = useRef();
  const [receiptData, setReceiptData] = useState(null);
  const [receiptDate, setReceiptDate] = useState("");
  const [scanning, setScanning] = useState(false);
  const [receiptImages, setReceiptImages] = useState({});
  const receiptFileRef = useRef();
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemEval, setItemEval] = useState("");
  const [loadingEval, setLoadingEval] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [occasion, setOccasion] = useState("");
  const [outfitResult, setOutfitResult] = useState("");
  const [loadingOutfit, setLoadingOutfit] = useState(false);
  const importRef = useRef();

  function persist(newItems) { setItems(newItems); saveToStorage(newItems); }

  function addBrand(brand) {
    if (!brand || brands.includes(brand)) return;
    const updated = [...brands, brand].sort();
    setBrands(updated);
    try { localStorage.setItem("wardrobe-brands", JSON.stringify(updated)); } catch {}
  }

  function openFilePicker(target) { setCropTarget(target); fileInputRef.current.click(); }

  async function onFileSelected(e) {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    const dataUrl = await readFile(file);
    setPendingImageData(dataUrl);
    if (cropTarget === "add") {
      setScanningImage(true);
      try {
        const base64 = dataUrl.split(",")[1];
        const mediaType = file.type || "image/jpeg";
        const text = await callClaude(IMAGE_SCAN_PROMPT, [
          { type:"image", source:{ type:"base64", media_type:mediaType, data:base64 } },
          { type:"text", text:"Extract​​​​​​​​​​​​​​​​
