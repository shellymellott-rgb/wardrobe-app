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
  "Where From": ["Amazon", "Armoire"],
};

const STYLE_SYSTEM_PROMPT = `You are Shelly's personal stylist. You know her style inside out:
- Polished but not corporate. Minimal but not boring. Comfortable but intentional. Slightly edgy, never feminine or frilly.
- She wants to look like she got dressed on purpose, even for errands.
- AVOID: trendy, cheap-looking, boho, flowy/tiered, ruffles, fussy details, safe or forgettable outfits.
- LOVES: clean lines, structure, good fabric weight, neutral cohesive palette, pieces that hold shape.
- FIT: wide-leg or straight-leg pants, cropped or full-length, defined waist, structured dresses.
- SHOES: supportive, practical. Clean sneakers, structured sandals, refined flats. No heels.
- LIFESTYLE: outfits that work for real life (errands, casual days, travel, boat) but still look elevated.
Be direct and opinionated. No fluff. Prioritize versatility and repeatable outfit formulas.`;

const OUTFIT_PROMPT = (items, occasion) => `Here are items from Shelly's wardrobe:
${items.map(i => `- [${i.category}] ${i.name || "Unnamed"}${i.color ? ` (${i.color})` : ""}${i.material ? ` / ${i.material}` : ""}${i.season ? ` / ${i.season}` : ""} — worn ${i.wornDates?.length || 0} times`).join("\n")}

${occasion ? `Occasion: ${occasion}` : "Build her best everyday outfit combinations."}

Give 3 specific outfit combinations using ONLY items listed above. For each outfit:
1. List exactly which pieces to wear
2. One sentence on why it works for her aesthetic
3. One concrete styling tip

Flag any pieces never worn that she should prioritize.
Be direct. No fluff. Think editorial, not safe.`;

const EVALUATE_PROMPT = (item) => `Evaluate this wardrobe piece for Shelly:
Category: ${item.category}
Name: ${item.name || "Unnamed"}
${item.brand ? `Brand: ${item.brand}` : ""}
${item.color ? `Color: ${item.color}` : ""}
${item.material ? `Material: ${item.material}` : ""}
${item.tags?.length ? `Tags: ${item.tags.join(", ")}` : ""}
${item.comments ? `Notes: ${item.comments}` : ""}

Based on her style (elevated everyday, minimal but not boring, polished but not corporate, slightly edgy):
1. Verdict: KEEP / PASS / USE DIFFERENTLY
2. What works (be specific)
3. What doesn't (if anything)
4. Best outfit formula using this piece

Be direct and opinionated. Two sentences max per point.`;

const RECEIPT_PROMPT = `You are reading a shopping receipt or order confirmation for a wardrobe app.
Extract ALL clothing/shoe/accessory items. Return ONLY valid JSON, nothing else:

{
  "purchaseDate": "YYYY-MM-DD or null",
  "items": [
    {
      "name": "descriptive name e.g. Black Wide-Leg Trousers",
      "brand": "brand name or null",
      "color": "one of: Black, White, Cream, Tan, Camel, Navy, Grey, Brown, Olive, Blush, Red, Blue, Green, Other — or null",
      "category": "one of: Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories"
    }
  ]
}

Rules:
- Make names descriptive: include color, style, cut
- Extract purchase date if visible
- Skip non-clothing items unless they are bags/belts (Accessories)
- Return ONLY valid JSON`;

const emptyForm = () => ({
  name: "", brand: "", category: "Tops", color: "", customColor: "",
  season: "All Year", sleeveLength: "N/A", length: "N/A",
  material: "", customMaterial: "", tags: [], customTag: "",
  comments: "", datePurchased: "", imageData: null,
});

export default function WardrobeApp() {
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeFilters, setActiveFilters] = useState({});
  const [view, setView] = useState("closet");
  const [outfitResult, setOutfitResult] = useState("");
  const [loadingOutfit, setLoadingOutfit] = useState(false);
  const [occasion, setOccasion] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemEval, setItemEval] = useState("");
  const [loadingEval, setLoadingEval] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [addMode, setAddMode] = useState("photo");
  const [addForm, setAddForm] = useState(emptyForm());
  const [receiptData, setReceiptData] = useState(null);
  const [receiptPurchaseDate, setReceiptPurchaseDate] = useState(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [receiptItemImages, setReceiptItemImages] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const fileRef = useRef();
  const receiptRef = useRef();

  useEffect(() => {
    async function load() {
      try {
        const res = await window.storage.get("wardrobe-v2");
        if (res?.value) setItems(JSON.parse(res.value));
      } catch {}
    }
    load();
  }, []);

  async function saveItems(newItems) {
    setItems(newItems);
    try {
      await window.storage.set("wardrobe-v2", JSON.stringify(newItems));
    } catch {}
  }

  function handleImageUpload(e, setter) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setter(ev.target.result);
    reader.readAsDataURL(file);
  }

  function toggleTag(tag, form, setForm) {
    const tags = form.tags || [];
    setForm(f => ({ ...f, tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag] }));
  }

  function addCustomTag(form, setForm) {
    if (!form.customTag.trim()) return;
    const tag = form.customTag.trim();
    if (!form.tags.includes(tag)) setForm(f => ({ ...f, tags: [...f.tags, tag], customTag: "" }));
    else setForm(f => ({ ...f, customTag: "" }));
  }

  async function addItem() {
    if (!addForm.imageData) return;
    const color = addForm.color === "Other" ? addForm.customColor : addForm.color;
    const material = addForm.material === "Other" ? addForm.customMaterial : addForm.material;
    const newItem = {
      id: Date.now(),
      name: addForm.name, brand: addForm.brand, category: addForm.category,
      color, material, season: addForm.season,
      sleeveLength: addForm.sleeveLength, length: addForm.length,
      tags: addForm.tags, comments: addForm.comments,
      datePurchased: addForm.datePurchased,
      imageData: addForm.imageData,
      wornDates: [],
      addedAt: new Date().toISOString(),
    };
    await saveItems([...items, newItem]);
    setAddForm(emptyForm());
    setView("closet");
  }

  async function markWorn(id) {
    const today = new Date().toISOString().split("T")[0];
    const updated = items.map(i => i.id === id ? { ...i, wornDates: [...(i.wornDates || []), today] } : i);
    await saveItems(updated);
    if (selectedItem?.id === id) setSelectedItem(updated.find(i => i.id === id));
  }

  async function removeItem(id) {
    await saveItems(items.filter(i => i.id !== id));
    setSelectedItem(null); setItemEval(""); setEditing(false);
  }

  async function saveEdit() {
    const color = editForm.color === "Other" ? editForm.customColor : editForm.color;
    const material = editForm.material === "Other" ? editForm.customMaterial : editForm.material;
    const updated = items.map(i => i.id === editForm.id ? { ...editForm, color, material } : i);
    await saveItems(updated);
    setSelectedItem(updated.find(i => i.id === editForm.id));
    setEditing(false);
  }

  async function scanReceipt(e) {
    const file = e.target.files[0];
    if (!file) return;
    setScanningReceipt(true);
    setReceiptData(null);
    setReceiptItemImages({});
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const imageData = ev.target.result;
      const base64 = imageData.split(",")[1];
      const mediaType = file.type || "image/jpeg";
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            system: RECEIPT_PROMPT,
            messages: [{ role: "user", content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: "Extract all clothing items from this receipt." }
            ]}]
          })
        });
        const data = await res.json();
        const text = data.content?.[0]?.text || "{}";
        const clean = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        setReceiptPurchaseDate(parsed.purchaseDate || "");
        const withIds = (parsed.items || []).map((item, i) => ({
          ...item, tempId: i,
          season: "All Year", sleeveLength: "N/A", length: "N/A",
          material: "", tags: [], comments: "",
        }));
        setReceiptData(withIds);
      } catch { setReceiptData([]); }
      setScanningReceipt(false);
    };
    reader.readAsDataURL(file);
  }

  function updateReceiptItem(tempId, field, value) {
    setReceiptData(prev => prev.map(i => i.tempId === tempId ? { ...i, [field]: value } : i));
  }

  function toggleReceiptTag(tempId, tag) {
    setReceiptData(prev => prev.map(i => {
      if (i.tempId !== tempId) return i;
      const tags = i.tags || [];
      return { ...i, tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag] };
    }));
  }

  function handleReceiptItemImage(tempId, e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setReceiptItemImages(prev => ({ ...prev, [tempId]: ev.target.result }));
    reader.readAsDataURL(file);
  }

  async function addReceiptItems() {
    const newItems = receiptData.map(item => ({
      id: Date.now() + item.tempId + Math.random(),
      name: item.name, brand: item.brand || "", category: item.category,
      color: item.color || "", material: item.material || "",
      season: item.season || "All Year", sleeveLength: item.sleeveLength || "N/A",
      length: item.length || "N/A", tags: item.tags || [], comments: item.comments || "",
      datePurchased: receiptPurchaseDate || "",
      imageData: receiptItemImages[item.tempId] || null,
      wornDates: [], addedAt: new Date().toISOString(),
    }));
    await saveItems([...items, ...newItems]);
    setReceiptData(null); setReceiptPurchaseDate(null); setReceiptItemImages({});
    setView("closet");
  }

  async function generateOutfits() {
    if (items.length < 2) return;
    setLoadingOutfit(true); setOutfitResult("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: STYLE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: OUTFIT_PROMPT(items, occasion) }]
        })
      });
      const data = await res.json();
      setOutfitResult(data.content?.[0]?.text || "No response.");
    } catch { setOutfitResult("Error. Try again."); }
    setLoadingOutfit(false);
  }

  async function evaluateItem(item) {
    setSelectedItem(item); setItemEval(""); setLoadingEval(true); setEditing(false);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 500,
          system: STYLE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: EVALUATE_PROMPT(item) }]
        })
      });
      const data = await res.json();
      setItemEval(data.content?.[0]?.text || "No response.");
    } catch { setItemEval("Error. Try again."); }
    setLoadingEval(false);
  }

  // Filtering
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

  // Styles
  const inputStyle = {
    width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
    color: "#e8e2d8", borderRadius: 3, padding: "11px 12px",
    fontSize: 12, outline: "none", boxSizing: "border-box",
    fontFamily: "'DM Sans', system-ui, sans-serif", marginBottom: 8,
  };

  const labelStyle = {
    fontSize: 9, letterSpacing: 2, textTransform: "uppercase",
    color: "#666", display: "block", marginBottom: 4,
  };

  const chipStyle = (active) => ({
    background: active ? "#e8e2d8" : "#1a1a1a",
    color: active ? "#111" : "#666",
    border: `1px solid ${active ? "#e8e2d8" : "#2a2a2a"}`,
    borderRadius: 20, padding: "4px 12px",
    fontSize: 10, letterSpacing: 1, cursor: "pointer",
    whiteSpace: "nowrap", fontFamily: "'DM Sans', system-ui, sans-serif",
  });

  const navBtn = (label, active, onClick) => (
    <button onClick={onClick} style={{
      background: active ? "#e8e2d8" : "transparent",
      color: active ? "#111" : "#888",
      border: `1px solid ${active ? "#e8e2d8" : "#333"}`,
      borderRadius: 20, padding: "6px 16px",
      fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
      cursor: "pointer", fontWeight: active ? 600 : 400, whiteSpace: "nowrap",
    }}>{label}</button>
  );

  function FormFields({ form, setForm, showImage = true }) {
    const showSleeve = ["Tops", "Dresses"].includes(form.category);
    const showLength = ["Bottoms", "Dresses"].includes(form.category);
    return (
      <div>
        {showImage && (
          <div onClick={() => fileRef.current.click()} style={{
            aspectRatio: "3/4", background: "#1a1a1a", border: "1px dashed #333",
            borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", marginBottom: 16, overflow: "hidden",
          }}>
            {form.imageData
              ? <img src={form.imageData} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ textAlign: "center", color: "#444" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>+</div>
                  <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>Upload Photo</div>
                </div>
            }
          </div>
        )}

        <label style={labelStyle}>Name</label>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Black Wide-Leg Trousers" style={inputStyle} />

        <label style={labelStyle}>Brand</label>
        <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. Everlane" style={inputStyle} />

        <label style={labelStyle}>Category</label>
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inputStyle }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <label style={labelStyle}>Color</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={chipStyle(form.color === c)}>{c}</button>
          ))}
        </div>
        {form.color === "Other" && (
          <input value={form.customColor} onChange={e => setForm(f => ({ ...f, customColor: e.target.value }))} placeholder="Enter color" style={inputStyle} />
        )}

        <label style={{ ...labelStyle, marginTop: 8 }}>Material</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {MATERIALS.map(m => (
            <button key={m} onClick={() => setForm(f => ({ ...f, material: m }))} style={chipStyle(form.material === m)}>{m}</button>
          ))}
        </div>
        {form.material === "Other" && (
          <input value={form.customMaterial} onChange={e => setForm(f => ({ ...f, customMaterial: e.target.value }))} placeholder="Enter material" style={inputStyle} />
        )}

        <label style={{ ...labelStyle, marginTop: 8 }}>Season</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {SEASONS.map(s => <button key={s} onClick={() => setForm(f => ({ ...f, season: s }))} style={chipStyle(form.season === s)}>{s}</button>)}
        </div>

        {showSleeve && <>
          <label style={{ ...labelStyle, marginTop: 8 }}>Sleeve Length</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {SLEEVE_LENGTHS.map(s => <button key={s} onClick={() => setForm(f => ({ ...f, sleeveLength: s }))} style={chipStyle(form.sleeveLength === s)}>{s}</button>)}
          </div>
        </>}

        {showLength && <>
          <label style={{ ...labelStyle, marginTop: 8 }}>Length</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {LENGTHS.map(l => <button key={l} onClick={() => setForm(f => ({ ...f, length: l }))} style={chipStyle(form.length === l)}>{l}</button>)}
          </div>
        </>}

        <label style={{ ...labelStyle, marginTop: 8 }}>Tags</label>
        {Object.entries(PRESET_TAGS).map(([group, tags]) => (
          <div key={group} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: "#444", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{group}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {tags.map(t => <button key={t} onClick={() => toggleTag(t, form, setForm)} style={chipStyle((form.tags || []).includes(t))}>{t}</button>)}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 6, marginBottom: 8 }}>
          <input value={form.customTag || ""} onChange={e => setForm(f => ({ ...f, customTag: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && addCustomTag(form, setForm)}
            placeholder="Add custom tag..." style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
          <button onClick={() => addCustomTag(form, setForm)} style={{ ...chipStyle(false), padding: "4px 14px" }}>+</button>
        </div>
        {(form.tags || []).filter(t => !Object.values(PRESET_TAGS).flat().includes(t)).map(t => (
          <span key={t} style={{ ...chipStyle(true), display: "inline-block", marginRight: 6, marginBottom: 6 }}>{t} <span onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))} style={{ cursor: "pointer", marginLeft: 4 }}>×</span></span>
        ))}

        <label style={{ ...labelStyle, marginTop: 8 }}>Date Purchased</label>
        <input type="date" value={form.datePurchased} onChange={e => setForm(f => ({ ...f, datePurchased: e.target.value }))} style={inputStyle} />

        <label style={{ ...labelStyle }}>Comments</label>
        <textarea value={form.comments} onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
          placeholder="Notes, fit tips, styling ideas..."
          style={{ ...inputStyle, height: 80, resize: "none", marginBottom: 0 }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#111", color: "#e8e2d8", fontFamily: "Georgia, 'Times New Roman', serif", maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ padding: "32px 24px 20px", borderBottom: "1px solid #222" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: 5, color: "#666", textTransform: "uppercase", marginBottom: 6 }}>Personal Closet</div>
            <div style={{ fontSize: 30, fontStyle: "italic", letterSpacing: -1 }}>Wardrobe</div>
          </div>
          <div style={{ textAlign: "right", paddingTop: 8 }}>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 22, fontWeight: 300 }}>{items.length}</div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: 2, color: "#555", textTransform: "uppercase" }}>pieces</div>
            {underloved.length > 0 && <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#b8976a", marginTop: 4 }}>{underloved.length} unworn</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          {navBtn("Closet", view === "closet", () => setView("closet"))}
          {navBtn("Outfits", view === "outfits", () => setView("outfits"))}
          {navBtn("+ Add", view === "add", () => { setView("add"); setAddMode("photo"); setReceiptData(null); setAddForm(emptyForm()); })}
        </div>
      </div>

      {/* CLOSET */}
      {view === "closet" && (
        <div>
          {/* Category filter */}
          <div style={{ display: "flex", gap: 8, padding: "16px 24px 8px", overflowX: "auto", scrollbarWidth: "none", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            {["All", ...CATEGORIES].map(cat => navBtn(cat, activeCategory === cat, () => setActiveCategory(cat)))}
          </div>

          {/* Advanced filters */}
          <div style={{ padding: "0 24px 12px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            <button onClick={() => setShowFilters(f => !f)} style={{ background: "transparent", border: "none", color: "#555", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", padding: 0 }}>
              {showFilters ? "▲ Hide Filters" : "▼ Filter"}
              {Object.keys(activeFilters).length > 0 && <span style={{ color: "#b8976a", marginLeft: 8 }}>({Object.keys(activeFilters).length} active)</span>}
            </button>
            {showFilters && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { key: "color", options: COLORS },
                  { key: "season", options: SEASONS },
                  { key: "material", options: MATERIALS },
                  ...(allTags.length ? [{ key: "tag", options: allTags }] : []),
                ].map(({ key, options }) => (
                  <div key={key}>
                    <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "#555", marginBottom: 6 }}>{key}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {options.map(o => (
                        <button key={o} onClick={() => setActiveFilters(f => f[key] === o ? Object.fromEntries(Object.entries(f).filter(([k]) => k !== key)) : { ...f, [key]: o })}
                          style={chipStyle(activeFilters[key] === o)}>{o}</button>
                      ))}
                    </div>
                  </div>
                ))}
                {Object.keys(activeFilters).length > 0 && (
                  <button onClick={() => setActiveFilters({})} style={{ background: "transparent", border: "none", color: "#8a4a4a", fontSize: 10, letterSpacing: 1, cursor: "pointer", textAlign: "left", padding: 0 }}>Clear all filters</button>
                )}
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "#444", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
              <div style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Nothing here</div>
              <div style={{ fontSize: 12, color: "#333" }}>{items.length > 0 ? "Try different filters" : "Add your first piece"}</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              {filtered.map(item => (
                <div key={item.id} onClick={() => evaluateItem(item)} style={{ position: "relative", aspectRatio: "3/4", background: "#1a1a1a", cursor: "pointer", overflow: "hidden" }}>
                  {item.imageData
                    ? <img src={item.imageData} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#333" }}>
                        {item.color && <div style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{item.color}</div>}
                        <div style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>{item.category}</div>
                      </div>
                  }
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(10,10,10,0.92))", padding: "24px 10px 10px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                    {item.name && <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 2 }}>{item.name}</div>}
                    <div style={{ fontSize: 9, color: "#666", letterSpacing: 1.5, textTransform: "uppercase" }}>{item.brand || item.category}</div>
                  </div>
                  {!item.wornDates?.length && <div style={{ position: "absolute", top: 8, right: 8, background: "#b8976a", color: "#111", borderRadius: 2, padding: "2px 6px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 8, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" }}>New</div>}
                  {item.wornDates?.length > 0 && <div style={{ position: "absolute", top: 8, left: 8, background: "#ffffff10", color: "#ffffff66", borderRadius: 2, padding: "2px 6px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9 }}>×{item.wornDates.length}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* OUTFITS */}
      {view === "outfits" && (
        <div style={{ padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#666", marginBottom: 8 }}>Occasion (optional)</div>
          <input value={occasion} onChange={e => setOccasion(e.target.value)} placeholder="e.g. boat day, errands, travel..." style={{ ...inputStyle, marginBottom: 16 }} />
          <button onClick={generateOutfits} disabled={loadingOutfit || items.length < 2} style={{
            width: "100%", background: items.length < 2 ? "#1a1a1a" : "#e8e2d8",
            color: items.length < 2 ? "#444" : "#111", border: "none", borderRadius: 3, padding: "15px",
            fontSize: 11, letterSpacing: 3, textTransform: "uppercase",
            cursor: items.length < 2 ? "not-allowed" : "pointer", fontWeight: 600, marginBottom: 24,
          }}>{loadingOutfit ? "Styling..." : "Generate Outfits"}</button>
          {items.length < 2 && <div style={{ textAlign: "center", color: "#444", fontSize: 12, marginBottom: 20 }}>Add at least 2 pieces first</div>}
          {outfitResult && <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 3, padding: 20, fontSize: 13, lineHeight: 1.8, color: "#c8c0b0", whiteSpace: "pre-wrap" }}>{outfitResult}</div>}
          {underloved.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#b8976a", marginBottom: 14 }}>Never worn</div>
              {underloved.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#1a1a1a", border: "1px solid #b8976a22", borderRadius: 3, padding: "10px 14px", marginBottom: 8 }}>
                  {item.imageData && <img src={item.imageData} style={{ width: 36, height: 46, objectFit: "cover", borderRadius: 2 }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{item.name || "Unnamed"}</div>
                    <div style={{ fontSize: 9, color: "#666", letterSpacing: 1.5, textTransform: "uppercase" }}>{item.brand || item.category}</div>
                  </div>
                  <button onClick={() => markWorn(item.id)} style={{ background: "transparent", border: "1px solid #333", color: "#888", borderRadius: 20, padding: "4px 12px", fontSize: 10, cursor: "pointer" }}>worn</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADD */}
      {view === "add" && (
        <div style={{ padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {navBtn("📷 Photo", addMode === "photo", () => setAddMode("photo"))}
            {navBtn("🧾 Receipt", addMode === "receipt", () => setAddMode("receipt"))}
          </div>

          {addMode === "photo" && (
            <>
              <input ref={fileRef} type="file" accept="image/*" onChange={e => handleImageUpload(e, (d) => setAddForm(f => ({ ...f, imageData: d })))} style={{ display: "none" }} />
              <FormFields form={addForm} setForm={setAddForm} showImage={true} />
              <button onClick={addItem} disabled={!addForm.imageData} style={{
                width: "100%", background: addForm.imageData ? "#e8e2d8" : "#1a1a1a",
                color: addForm.imageData ? "#111" : "#444", border: "none", borderRadius: 3, padding: "15px",
                fontSize: 11, letterSpacing: 3, textTransform: "uppercase",
                cursor: addForm.imageData ? "pointer" : "not-allowed", fontWeight: 600, marginTop: 16,
              }}>Add to Closet</button>
            </>
          )}

          {addMode === "receipt" && (
            <>
              {!receiptData && !scanningReceipt && (
                <div onClick={() => receiptRef.current.click()} style={{
                  background: "#1a1a1a", border: "1px dashed #333", borderRadius: 3,
                  padding: "40px 24px", display: "flex", flexDirection: "column",
                  alignItems: "center", cursor: "pointer",
                }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🧾</div>
                  <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#666" }}>Upload Receipt</div>
                  <div style={{ fontSize: 11, color: "#444", marginTop: 6, textAlign: "center" }}>Photo, screenshot, or order confirmation</div>
                </div>
              )}
              <input ref={receiptRef} type="file" accept="image/*" onChange={scanReceipt} style={{ display: "none" }} />

              {scanningReceipt && (
                <div style={{ textAlign: "center", padding: "60px 24px", color: "#666" }}>
                  <div style={{ fontSize: 32, marginBottom: 16 }}>🧾</div>
                  <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Reading receipt...</div>
                </div>
              )}

              {receiptData && receiptData.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 24px", color: "#666" }}>
                  <div style={{ fontSize: 13 }}>No items found. Try a clearer photo.</div>
                  <button onClick={() => setReceiptData(null)} style={{ marginTop: 16, background: "transparent", border: "1px solid #333", color: "#888", borderRadius: 3, padding: "8px 20px", fontSize: 11, cursor: "pointer" }}>Try Again</button>
                </div>
              )}

              {receiptData && receiptData.length > 0 && (
                <>
                  {receiptPurchaseDate && (
                    <div style={{ fontSize: 11, color: "#b8976a", marginBottom: 16, letterSpacing: 1 }}>
                      Purchase date: {receiptPurchaseDate}
                    </div>
                  )}
                  <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#b8976a", marginBottom: 16 }}>
                    {receiptData.length} item{receiptData.length !== 1 ? "s" : ""} found
                  </div>

                  {receiptData.map(item => (
                    <div key={item.tempId} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 3, padding: 14, marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                        <div onClick={() => {
                          const inp = document.createElement("input");
                          inp.type = "file"; inp.accept = "image/*";
                          inp.onchange = (e) => handleReceiptItemImage(item.tempId, e);
                          inp.click();
                        }} style={{ width: 56, height: 72, background: "#111", border: "1px dashed #333", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, overflow: "hidden" }}>
                          {receiptItemImages[item.tempId]
                            ? <img src={receiptItemImages[item.tempId]} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ fontSize: 18, color: "#444" }}>+</div>
                          }
                        </div>
                        <div style={{ flex: 1 }}>
                          <input value={item.name} onChange={e => updateReceiptItem(item.tempId, "name", e.target.value)} style={{ ...inputStyle, padding: "8px 10px", fontSize: 11 }} />
                          <input value={item.brand || ""} onChange={e => updateReceiptItem(item.tempId, "brand", e.target.value)} placeholder="Brand" style={{ ...inputStyle, padding: "8px 10px", fontSize: 11 }} />
                          <select value={item.category} onChange={e => updateReceiptItem(item.tempId, "category", e.target.value)} style={{ ...inputStyle, padding: "8px 10px", fontSize: 11 }}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <button onClick={() => setReceiptData(prev => prev.filter(i => i.tempId !== item.tempId))} style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 18, alignSelf: "flex-start", padding: "0 2px" }}>×</button>
                      </div>

                      {/* Color chips */}
                      <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", marginBottom: 6 }}>Color</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                        {COLORS.map(c => <button key={c} onClick={() => updateReceiptItem(item.tempId, "color", c)} style={{ ...chipStyle(item.color === c), padding: "3px 8px", fontSize: 9 }}>{c}</button>)}
                      </div>

                      {/* Tags */}
                      <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", marginBottom: 6 }}>Tags</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {Object.values(PRESET_TAGS).flat().map(t => (
                          <button key={t} onClick={() => toggleReceiptTag(item.tempId, t)} style={{ ...chipStyle((item.tags || []).includes(t)), padding: "3px 8px", fontSize: 9 }}>{t}</button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <button onClick={addReceiptItems} style={{ width: "100%", background: "#e8e2d8", color: "#111", border: "none", borderRadius: 3, padding: "15px", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", fontWeight: 600, marginTop: 8 }}>
                    Add {receiptData.length} Item{receiptData.length !== 1 ? "s" : ""} to Closet
                  </button>
                  <button onClick={() => { setReceiptData(null); setReceiptPurchaseDate(null); setReceiptItemImages({}); }} style={{ width: "100%", background: "transparent", border: "1px solid #2a2a2a", color: "#666", borderRadius: 3, padding: "12px", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", marginTop: 8 }}>
                    Scan Different Receipt
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ITEM MODAL */}
      {selectedItem && !editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.97)", zIndex: 100, overflowY: "auto" }}>
          <div style={{ padding: 24, maxWidth: 480, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <button onClick={() => { setSelectedItem(null); setItemEval(""); }} style={{ background: "transparent", border: "none", color: "#666", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", padding: 0 }}>← Back</button>
              <button onClick={() => { setEditing(true); setEditForm({ ...selectedItem, customColor: "", customMaterial: "" }); }} style={{ background: "transparent", border: "1px solid #333", color: "#888", borderRadius: 3, padding: "4px 14px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>Edit</button>
            </div>

            {selectedItem.imageData && <img src={selectedItem.imageData} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 3, marginBottom: 16 }} />}

            <div style={{ marginBottom: 4, fontFamily: "Georgia, serif", fontSize: 20, fontStyle: "italic" }}>{selectedItem.name || "Unnamed piece"}</div>
            {selectedItem.brand && <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{selectedItem.brand}</div>}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {selectedItem.color && <span style={chipStyle(false)}>{selectedItem.color}</span>}
              {selectedItem.material && <span style={chipStyle(false)}>{selectedItem.material}</span>}
              {selectedItem.season && selectedItem.season !== "All Year" && <span style={chipStyle(false)}>{selectedItem.season}</span>}
              {selectedItem.sleeveLength && selectedItem.sleeveLength !== "N/A" && <span style={chipStyle(false)}>{selectedItem.sleeveLength}</span>}
              {selectedItem.length && selectedItem.length !== "N/A" && <span style={chipStyle(false)}>{selectedItem.length}</span>}
              {(selectedItem.tags || []).map(t => <span key={t} style={{ ...chipStyle(true), fontSize: 10 }}>{t}</span>)}
            </div>

            {selectedItem.comments && <div style={{ fontSize: 12, color: "#888", fontStyle: "italic", marginBottom: 12, lineHeight: 1.6 }}>{selectedItem.comments}</div>}

            <div style={{ fontSize: 10, color: "#555", letterSpacing: 1, marginBottom: 4 }}>
              {selectedItem.datePurchased && `Purchased ${selectedItem.datePurchased} · `}
              Worn {selectedItem.wornDates?.length || 0}×
              {selectedItem.wornDates?.length > 0 && ` · Last worn ${selectedItem.wornDates[selectedItem.wornDates.length - 1]}`}
            </div>

            <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
              <button onClick={() => markWorn(selectedItem.id)} style={{ flex: 1, background: "transparent", border: "1px solid #333", color: "#e8e2d8", borderRadius: 3, padding: "11px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>Mark Worn Today</button>
              <button onClick={() => removeItem(selectedItem.id)} style={{ background: "transparent", border: "1px solid #3a2020", color: "#8a4a4a", borderRadius: 3, padding: "11px 18px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>Remove</button>
            </div>

            {selectedItem.wornDates?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "#555", marginBottom: 8 }}>Wear History</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[...selectedItem.wornDates].reverse().slice(0, 10).map((d, i) => (
                    <span key={i} style={{ fontSize: 10, color: "#666", background: "#1a1a1a", padding: "3px 8px", borderRadius: 2 }}>{d}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#666", marginBottom: 12 }}>Style Verdict</div>
            {loadingEval
              ? <div style={{ color: "#444", fontSize: 13, padding: "20px 0", fontStyle: "italic" }}>Evaluating...</div>
              : <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 3, padding: 18, fontSize: 13, lineHeight: 1.8, color: "#c8c0b0", whiteSpace: "pre-wrap" }}>{itemEval}</div>
            }
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {selectedItem && editing && editForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.97)", zIndex: 100, overflowY: "auto" }}>
          <div style={{ padding: 24, maxWidth: 480, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <button onClick={() => setEditing(false)} style={{ background: "transparent", border: "none", color: "#666", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", padding: 0 }}>← Cancel</button>
              <button onClick={saveEdit} style={{ background: "#e8e2d8", color: "#111", border: "none", borderRadius: 3, padding: "6px 18px", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", fontWeight: 600 }}>Save</button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={e => handleImageUpload(e, (d) => setEditForm(f => ({ ...f, imageData: d })))} style={{ display: "none" }} />
            <FormFields form={editForm} setForm={setEditForm} showImage={true} />
          </div>
        </div>
      )}
    </div>
  );
}