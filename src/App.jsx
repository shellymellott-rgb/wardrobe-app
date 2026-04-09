importimport { useState, useEffect, useRef } from "react";

const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Accessories"];

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
${items.map(i => `- [${i.category}] ${i.name || "Unnamed " + i.category} (worn ${i.wornCount || 0} times)`).join("\n")}

${occasion ? `Occasion: ${occasion}` : "Build her best everyday outfit combinations."}

Give 3 specific outfit combinations using ONLY items listed above. For each outfit:
1. List exactly which pieces to wear
2. One sentence on why it works for her aesthetic
3. One concrete styling tip (tuck, layer, accessory choice, etc.)

Also flag any pieces worn 0 times that she should prioritize wearing.
Be direct. No fluff. Think editorial, not safe.`;

const EVALUATE_PROMPT = (item) => `Evaluate this wardrobe piece for Shelly:
Category: ${item.category}
Name: ${item.name || "Unnamed piece"}

Based on her style (elevated everyday, minimal but not boring, polished but not corporate, slightly edgy):
1. Verdict: KEEP / PASS / USE DIFFERENTLY
2. What works (be specific)
3. What doesn't (if anything)
4. Best outfit formula using this piece

Be direct and opinionated. Two sentences max per point.`;

const RECEIPT_PROMPT = `You are reading a shopping receipt or order confirmation for Shelly's wardrobe app.
Extract ALL clothing/shoe/accessory items purchased. For each item return JSON only, no prose.

Return this exact format:
{
  "items": [
    {
      "name": "descriptive name e.g. Black Wide-Leg Trousers",
      "category": "one of: Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories"
    }
  ]
}

Rules:
- Make names descriptive: include color, style, cut (e.g. "Cream Linen Straight-Leg Pants" not just "Pants")
- Skip non-clothing items (bags, belts count as Accessories)
- If item name is ambiguous, make your best guess at category
- Return ONLY valid JSON, nothing else`;

export default function WardrobeApp() {
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [view, setView] = useState("closet");
  const [outfitResult, setOutfitResult] = useState("");
  const [loadingOutfit, setLoadingOutfit] = useState(false);
  const [occasion, setOccasion] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemEval, setItemEval] = useState("");
  const [loadingEval, setLoadingEval] = useState(false);
  const [addMode, setAddMode] = useState("photo"); // "photo" | "receipt"
  const [addForm, setAddForm] = useState({ name: "", category: "Tops", imageData: null });
  const [receiptData, setReceiptData] = useState(null); // parsed receipt items
  const [receiptImage, setReceiptImage] = useState(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [receiptItemImages, setReceiptItemImages] = useState({}); // id -> imageData
  const fileRef = useRef();
  const receiptRef = useRef();
  const itemImageRefs = useRef({});

  useEffect(() => {
    async function load() {
      try {
        const res = await window.storage.get("wardrobe-v1");
        if (res?.value) setItems(JSON.parse(res.value));
      } catch {}
    }
    load();
  }, []);

  async function saveItems(newItems) {
    setItems(newItems);
    try {
      await window.storage.set("wardrobe-v1", JSON.stringify(newItems));
    } catch {}
  }

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAddForm(f => ({ ...f, imageData: ev.target.result }));
    reader.readAsDataURL(file);
  }

  async function addItem() {
    if (!addForm.imageData) return;
    const newItem = {
      id: Date.now(),
      name: addForm.name,
      category: addForm.category,
      imageData: addForm.imageData,
      wornCount: 0,
      addedAt: new Date().toISOString(),
    };
    await saveItems([...items, newItem]);
    setAddForm({ name: "", category: "Tops", imageData: null });
    setView("closet");
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
      setReceiptImage(imageData);
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
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
                { type: "text", text: "Extract all clothing items from this receipt." }
              ]
            }]
          })
        });
        const data = await res.json();
        const text = data.content?.[0]?.text || "{}";
        const clean = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        const withIds = (parsed.items || []).map((item, i) => ({ ...item, tempId: i }));
        setReceiptData(withIds);
      } catch {
        setReceiptData([]);
      }
      setScanningReceipt(false);
    };
    reader.readAsDataURL(file);
  }

  function handleReceiptItemImage(tempId, e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setReceiptItemImages(prev => ({ ...prev, [tempId]: ev.target.result }));
    };
    reader.readAsDataURL(file);
  }

  function updateReceiptItem(tempId, field, value) {
    setReceiptData(prev => prev.map(item => item.tempId === tempId ? { ...item, [field]: value } : item));
  }

  function removeReceiptItem(tempId) {
    setReceiptData(prev => prev.filter(item => item.tempId !== tempId));
  }

  async function addReceiptItems() {
    const newItems = receiptData.map(item => ({
      id: Date.now() + item.tempId,
      name: item.name,
      category: item.category,
      imageData: receiptItemImages[item.tempId] || null,
      wornCount: 0,
      addedAt: new Date().toISOString(),
    }));
    await saveItems([...items, ...newItems]);
    setReceiptData(null);
    setReceiptImage(null);
    setReceiptItemImages({});
    setView("closet");
  }

  async function markWorn(id) {
    const updated = items.map(i => i.id === id ? { ...i, wornCount: (i.wornCount || 0) + 1, lastWorn: new Date().toISOString() } : i);
    await saveItems(updated);
    if (selectedItem?.id === id) setSelectedItem(updated.find(i => i.id === id));
  }

  async function removeItem(id) {
    await saveItems(items.filter(i => i.id !== id));
    setSelectedItem(null);
    setItemEval("");
  }

  async function generateOutfits() {
    if (items.length < 2) return;
    setLoadingOutfit(true);
    setOutfitResult("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: STYLE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: OUTFIT_PROMPT(items, occasion) }]
        })
      });
      const data = await res.json();
      setOutfitResult(data.content?.[0]?.text || "No response.");
    } catch {
      setOutfitResult("Error generating outfits. Try again.");
    }
    setLoadingOutfit(false);
  }

  async function evaluateItem(item) {
    setSelectedItem(item);
    setItemEval("");
    setLoadingEval(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          system: STYLE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: EVALUATE_PROMPT(item) }]
        })
      });
      const data = await res.json();
      setItemEval(data.content?.[0]?.text || "No response.");
    } catch {
      setItemEval("Error evaluating. Try again.");
    }
    setLoadingEval(false);
  }

  const filtered = activeCategory === "All" ? items : items.filter(i => i.category === activeCategory);
  const underloved = items.filter(i => !i.wornCount || i.wornCount === 0);

  const btn = (label, active, onClick) => (
    <button onClick={onClick} style={{
      background: active ? "#e8e2d8" : "transparent",
      color: active ? "#111" : "#888",
      border: `1px solid ${active ? "#e8e2d8" : "#333"}`,
      borderRadius: 20, padding: "6px 16px",
      fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
      cursor: "pointer", fontWeight: active ? 600 : 400, whiteSpace: "nowrap",
    }}>{label}</button>
  );

  const inputStyle = {
    width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
    color: "#e8e2d8", borderRadius: 3, padding: "12px 14px",
    fontSize: 13, outline: "none", boxSizing: "border-box",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  };

  const selectStyle = { ...inputStyle };

  return (
    <div style={{
      minHeight: "100vh", background: "#111", color: "#e8e2d8",
      fontFamily: "Georgia, 'Times New Roman', serif",
      maxWidth: 480, margin: "0 auto",
    }}>
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
            {underloved.length > 0 && (
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#b8976a", marginTop: 4 }}>{underloved.length} unworn</div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          {btn("Closet", view === "closet", () => setView("closet"))}
          {btn("Outfits", view === "outfits", () => setView("outfits"))}
          {btn("+ Add", view === "add", () => { setView("add"); setAddMode("photo"); setReceiptData(null); })}
        </div>
      </div>

      {/* CLOSET */}
      {view === "closet" && (
        <div>
          <div style={{ display: "flex", gap: 8, padding: "16px 24px", overflowX: "auto", scrollbarWidth: "none", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            {["All", ...CATEGORIES].map(cat => btn(cat, activeCategory === cat, () => setActiveCategory(cat)))}
          </div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "#444", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
              <div style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Nothing here yet</div>
              <div style={{ fontSize: 12, color: "#333" }}>Add your first piece</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              {filtered.map(item => (
                <div key={item.id} onClick={() => evaluateItem(item)} style={{
                  position: "relative", aspectRatio: "3/4",
                  background: "#1a1a1a", cursor: "pointer", overflow: "hidden",
                }}>
                  {item.imageData
                    ? <img src={item.imageData} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>No photo</div>
                  }
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    background: "linear-gradient(transparent, rgba(10,10,10,0.92))",
                    padding: "24px 10px 10px", fontFamily: "'DM Sans', system-ui, sans-serif",
                  }}>
                    {item.name && <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 2 }}>{item.name}</div>}
                    <div style={{ fontSize: 9, color: "#666", letterSpacing: 1.5, textTransform: "uppercase" }}>{item.category}</div>
                  </div>
                  {!item.wornCount && <div style={{ position: "absolute", top: 8, right: 8, background: "#b8976a", color: "#111", borderRadius: 2, padding: "2px 6px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 8, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" }}>New</div>}
                  {item.wornCount > 0 && <div style={{ position: "absolute", top: 8, left: 8, background: "#ffffff10", color: "#ffffff66", borderRadius: 2, padding: "2px 6px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9 }}>×{item.wornCount}</div>}
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
                    <div style={{ fontSize: 9, color: "#666", letterSpacing: 1.5, textTransform: "uppercase" }}>{item.category}</div>
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
          {/* Mode toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {btn("📷 Photo", addMode === "photo", () => setAddMode("photo"))}
            {btn("🧾 Receipt", addMode === "receipt", () => setAddMode("receipt"))}
          </div>

          {/* PHOTO MODE */}
          {addMode === "photo" && (
            <>
              <div onClick={() => fileRef.current.click()} style={{
                aspectRatio: "3/4", background: "#1a1a1a", border: "1px dashed #333",
                borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", marginBottom: 16, overflow: "hidden",
              }}>
                {addForm.imageData
                  ? <img src={addForm.imageData} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ textAlign: "center", color: "#444" }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>+</div>
                      <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>Upload Photo</div>
                    </div>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
              <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="Name (e.g. Black wide-leg trousers)" style={{ ...inputStyle, marginBottom: 10 }} />
              <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} style={{ ...selectStyle, marginBottom: 20 }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={addItem} disabled={!addForm.imageData} style={{
                width: "100%", background: addForm.imageData ? "#e8e2d8" : "#1a1a1a",
                color: addForm.imageData ? "#111" : "#444", border: "none", borderRadius: 3, padding: "15px",
                fontSize: 11, letterSpacing: 3, textTransform: "uppercase",
                cursor: addForm.imageData ? "pointer" : "not-allowed", fontWeight: 600,
              }}>Add to Closet</button>
            </>
          )}

          {/* RECEIPT MODE */}
          {addMode === "receipt" && (
            <>
              {!receiptData && !scanningReceipt && (
                <>
                  <div onClick={() => receiptRef.current.click()} style={{
                    background: "#1a1a1a", border: "1px dashed #333", borderRadius: 3,
                    padding: "40px 24px", display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🧾</div>
                    <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#666" }}>Upload Receipt</div>
                    <div style={{ fontSize: 11, color: "#444", marginTop: 6, textAlign: "center" }}>Photo, screenshot, or order confirmation</div>
                  </div>
                  <input ref={receiptRef} type="file" accept="image/*" onChange={scanReceipt} style={{ display: "none" }} />
                </>
              )}

              {scanningReceipt && (
                <div style={{ textAlign: "center", padding: "60px 24px", color: "#666" }}>
                  <div style={{ fontSize: 32, marginBottom: 16 }}>🧾</div>
                  <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Reading receipt...</div>
                </div>
              )}

              {receiptData && receiptData.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 24px", color: "#666" }}>
                  <div style={{ fontSize: 13 }}>No clothing items found. Try a clearer photo.</div>
                  <button onClick={() => { setReceiptData(null); setReceiptImage(null); }} style={{ marginTop: 16, background: "transparent", border: "1px solid #333", color: "#888", borderRadius: 3, padding: "8px 20px", fontSize: 11, cursor: "pointer" }}>Try Again</button>
                </div>
              )}

              {receiptData && receiptData.length > 0 && (
                <>
                  <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#b8976a", marginBottom: 16 }}>
                    {receiptData.length} item{receiptData.length !== 1 ? "s" : ""} found — review & add photos
                  </div>

                  {receiptData.map(item => (
                    <div key={item.tempId} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 3, padding: 14, marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                        {/* Photo upload per item */}
                        <div
                          onClick={() => {
                            if (!itemImageRefs.current[item.tempId]) itemImageRefs.current[item.tempId] = document.createElement("input");
                            const inp = itemImageRefs.current[item.tempId];
                            inp.type = "file"; inp.accept = "image/*";
                            inp.onchange = (e) => handleReceiptItemImage(item.tempId, e);
                            inp.click();
                          }}
                          style={{
                            width: 60, height: 76, background: "#111", border: "1px dashed #333",
                            borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", flexShrink: 0, overflow: "hidden",
                          }}>
                          {receiptItemImages[item.tempId]
                            ? <img src={receiptItemImages[item.tempId]} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ fontSize: 18, color: "#444" }}>+</div>
                          }
                        </div>
                        <div style={{ flex: 1 }}>
                          <input
                            value={item.name}
                            onChange={e => updateReceiptItem(item.tempId, "name", e.target.value)}
                            style={{ ...inputStyle, marginBottom: 8, padding: "8px 10px", fontSize: 12 }}
                          />
                          <select
                            value={item.category}
                            onChange={e => updateReceiptItem(item.tempId, "category", e.target.value)}
                            style={{ ...selectStyle, padding: "8px 10px", fontSize: 12 }}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <button onClick={() => removeReceiptItem(item.tempId)} style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 16, padding: "0 4px", alignSelf: "flex-start" }}>×</button>
                      </div>
                    </div>
                  ))}

                  <button onClick={addReceiptItems} style={{
                    width: "100%", background: "#e8e2d8", color: "#111",
                    border: "none", borderRadius: 3, padding: "15px",
                    fontSize: 11, letterSpacing: 3, textTransform: "uppercase",
                    cursor: "pointer", fontWeight: 600, marginTop: 8,
                  }}>Add {receiptData.length} Item{receiptData.length !== 1 ? "s" : ""} to Closet</button>

                  <button onClick={() => { setReceiptData(null); setReceiptImage(null); setReceiptItemImages({}); }} style={{
                    width: "100%", background: "transparent", border: "1px solid #2a2a2a",
                    color: "#666", borderRadius: 3, padding: "12px",
                    fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
                    cursor: "pointer", marginTop: 8,
                  }}>Scan Different Receipt</button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ITEM MODAL */}
      {selectedItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.97)", zIndex: 100, overflowY: "auto" }}>
          <div style={{ padding: 24, maxWidth: 480, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            <button onClick={() => { setSelectedItem(null); setItemEval(""); }} style={{ background: "transparent", border: "none", color: "#666", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", marginBottom: 20, padding: 0 }}>← Back</button>
            {selectedItem.imageData && <img src={selectedItem.imageData} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 3, marginBottom: 16 }} />}
            <div style={{ marginBottom: 4, fontFamily: "Georgia, serif", fontSize: 20, fontStyle: "italic" }}>{selectedItem.name || "Unnamed piece"}</div>
            <div style={{ fontSize: 10, color: "#666", letterSpacing: 2, textTransform: "uppercase", marginBottom: 20 }}>{selectedItem.category} · worn {selectedItem.wornCount || 0}×</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <button onClick={() => markWorn(selectedItem.id)} style={{ flex: 1, background: "transparent", border: "1px solid #333", color: "#e8e2d8", borderRadius: 3, padding: "11px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>Mark Worn</button>
              <button onClick={() => removeItem(selectedItem.id)} style={{ background: "transparent", border: "1px solid #3a2020", color: "#8a4a4a", borderRadius: 3, padding: "11px 18px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>Remove</button>
            </div>
            <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#666", marginBottom: 12 }}>Style Verdict</div>
            {loadingEval
              ? <div style={{ color: "#444", fontSize: 13, padding: "20px 0", fontStyle: "italic" }}>Evaluating...</div>
              : <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 3, padding: 18, fontSize: 13, lineHeight: 1.8, color: "#c8c0b0", whiteSpace: "pre-wrap" }}>{itemEval}</div>
            }
          </div>
        </div>
      )}
    </div>
  );
}

