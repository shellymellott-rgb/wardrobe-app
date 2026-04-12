  async function scanReceipt(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setScanning(true);
    setReceiptData(null);
    setReceiptImages({});
    const dataUrl = await readFile(file);
    const base64 = dataUrl.split(",")[1];
    try {
      const text = await callClaude(RECEIPT_PROMPT, [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
        { type: "text", text: "Extract all clothing items from this receipt or order confirmation." }
      ], 1000);
      const clean = text.replace(/```json|```/g, "").trim();
      const start = clean.indexOf("{");
      const end = clean.lastIndexOf("}");
      const parsed = JSON.parse(clean.substring(start, end + 1));
      setReceiptDate(parsed.purchaseDate || "");
      setReceiptData((parsed.items || []).map((item, i) => ({
        ...item, tempId: i,
        season: "All Year", sleeveLength: "N/A", length: "N/A",
        material: "", tags: [], comments: "", price: item.price || "",
      })));
    } catch (err) {
      setReceiptData([]);
    }
    setScanning(false);
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
          { type:"text", text:"Analyze this clothing item and extract all details." }
        ], 500);
        const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
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
        if (parsed.brand) addBrand(parsed.brand);
      } catch {}
      setScanningImage(false);
    }
    setCropSrc(dataUrl);
  }

  function onCropDone(cropped) {
    if (cropTarget === "add") setAddForm(f => ({ ...f, imageData:cropped }));
    else if (cropTarget === "edit") setEditForm(f => ({ ...f, imageData:cropped }));
    else setReceiptImages(prev => ({ ...prev, [cropTarget]:cropped }));
    setCropSrc(null); setCropTarget(null); setPendingImageData(null);
  }

  function onCropCancel() {
    if (pendingImageData) {
      if (cropTarget === "add") setAddForm(f => ({ ...f, imageData:pendingImageData }));
      else if (cropTarget === "edit") setEditForm(f => ({ ...f, imageData:pendingImageData }));
      else setReceiptImages(prev => ({ ...prev, [cropTarget]:pendingImageData }));
    }
    setCropSrc(null); setCropTarget(null); setPendingImageData(null);
  }

  function buildItem(form) {
    return {
      id: Date.now() + Math.random(),
      name: form.name, brand: form.brand, category: form.category,
      color: form.color==="Other" ? form.customColor : form.color,
      material: form.material==="Other" ? form.customMaterial : form.material,
      season: form.season, sleeveLength: form.sleeveLength, length: form.length,
      tags: form.tags, comments: form.comments, datePurchased: form.datePurchased,
      price: form.price ? parseFloat(form.price) : null,
      imageData: form.imageData, wornDates: [], addedAt: new Date().toISOString(),
    };
  }

  function addItem() {
    if (!addForm.name) return;
    if (addForm.brand) addBrand(addForm.brand);
    persist([...items, buildItem(addForm)]);
    setAddForm(emptyForm()); setView("closet");
  }

  async function scanReceipt(e) {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    setScanning(true); setReceiptData(null); setReceiptImages({});
    const dataUrl = await readFile(file);
    const base64 = dataUrl.split(",")[1];
    try {
      const text = await callClaude(RECEIPT_PROMPT, [
        { type:"image", source:{ type:"base64", media_type:"image/jpeg", data:base64 } },
        { type:"text", text:"Extract all clothing items from this receipt or order confirmation." }
      ], 1000);
      const clean = text.replace(/```json|```/g,"").trim();
      const start = clean.indexOf("{");
      const end = clean.lastIndexOf("}");
      const parsed = JSON.parse(clean.substring(start, end + 1));
      setReceiptDate(parsed.purchaseDate || "");
      setReceiptData((parsed.items||[]).map((item,i) => ({
        ...item, tempId:i, season:"All Year", sleeveLength:"N/A", length:"N/A",
        material:"", tags:[], comments:"", price:item.price||"",
      })));
    } catch { setReceiptData([]); }
    setScanning(false);
  }

  function updateRI(tempId, field, value) { setReceiptData(prev => prev.map(i => i.tempId===tempId ? { ...i, [field]:value } : i)); }
  function toggleRITag(tempId, tag) { setReceiptData(prev => prev.map(i => i.tempId!==tempId ? i : { ...i, tags:i.tags.includes(tag) ? i.tags.filter(t => t!==tag) : [...i.tags, tag] })); }

  async function addReceiptItems() {
    const newItems = receiptData.map(item => ({
      id: Date.now() + item.tempId + Math.random(),
      name: item.name, brand: item.brand||"", category: item.category,
      color: item.color||"", material: item.material||"",
      season: item.season||"All Year", sleeveLength: item.sleeveLength||"N/A", length: item.length||"N/A",
      tags: item.tags||[], comments: item.comments||"", datePurchased: receiptDate||"",
      price: item.price ? parseFloat(item.price) : null,
      imageData: receiptImages[item.tempId]||null, wornDates:[], addedAt:new Date().toISOString(),
    }));
    receiptData.forEach(item => { if (item.brand) addBrand(item.brand); });
    persist([...items, ...newItems]);
    setReceiptData(null); setReceiptDate(""); setReceiptImages({}); setView("closet");
  }

  function markWorn(id) {
    const today = new Date().toISOString().split("T")[0];
    const updated = items.map(i => i.id===id ? { ...i, wornDates:[...(i.wornDates||[]), today] } : i);
    persist(updated);
    if (selectedItem?.id===id) setSelectedItem(updated.find(i => i.id===id));
  }

  function removeItem(id) { persist(items.filter(i => i.id!==id)); setSelectedItem(null); setItemEval(""); setEditing(false); }

  function saveEdit() {
    const updated = items.map(i => i.id===editForm.id ? {
      ...editForm,
      color: editForm.color==="Other" ? editForm.customColor : editForm.color,
      material: editForm.material==="Other" ? editForm.customMaterial : editForm.material,
    } : i);
    if (editForm.brand) addBrand(editForm.brand);
    persist(updated);
    setSelectedItem(updated.find(i => i.id===editForm.id));
    setEditing(false);
  }

  async function evaluateItem(item) {
    setSelectedItem(item); setItemEval(""); setLoadingEval(true); setEditing(false);
    try { setItemEval(await callClaude(STYLE_SYSTEM, EVALUATE_PROMPT(item), 500)); } catch { setItemEval("Error. Try again."); }
    setLoadingEval(false);
  }

  async function generateOutfits() {
    if (items.length < 2) return;
    setLoadingOutfit(true); setOutfitResult("");
    try { setOutfitResult(await callClaude(STYLE_SYSTEM, OUTFIT_PROMPT(items, occasion), 1000)); } catch { setOutfitResult("Error. Try again."); }
    setLoadingOutfit(false);
  }

  function exportWardrobe() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type:"application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `wardrobe-${new Date().toISOString().split("T")[0]}.json`; a.click();
  }

  function importWardrobe(e) {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { try { const imp = JSON.parse(ev.target.result); if (Array.isArray(imp)) { persist([...items, ...imp]); alert(`Imported ${imp.length} items.`); } } catch { alert("Invalid file."); } };
    reader.readAsText(file);
  }

  const filtered = items.filter(i => {
    if (activeCategory !== "All" && i.category !== activeCategory) return false;
    if (activeFilters.color && i.color !== activeFilters.color) return false;
    if (activeFilters.season && i.season !== activeFilters.season) return false;
    if (activeFilters.material && i.material !== activeFilters.material) return false;
    if (activeFilters.brand && i.brand !== activeFilters.brand) return false;
    if (activeFilters.tag && !(i.tags||[]).includes(activeFilters.tag)) return false;
    return true;
  });

  const underloved = items.filter(i => !i.wornDates?.length);
  const allTags = [...new Set(items.flatMap(i => i.tags||[]))];

  return (
    <div style={{ minHeight:"100vh", background:"#111", color:"#e8e2d8", fontFamily:"Georgia, 'Times New Roman', serif", maxWidth:480, margin:"0 auto" }}>
      {cropSrc && <CropModal imageSrc={cropSrc} onDone={onCropDone} onCancel={onCropCancel} />}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileSelected} style={{ display:"none" }} />
      <input ref={receiptFileRef} type="file" accept="image/*" onChange={scanReceipt} style={{ display:"none" }} />
      <input ref={importRef} type="file" accept=".json" onChange={importWardrobe} style={{ display:"none" }} />

      <div style={{ padding:"28px 24px 18px", borderBottom:"1px solid #222" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontFamily:"'DM Sans', system-ui, sans-serif", fontSize:10, letterSpacing:5, color:"#555", textTransform:"uppercase", marginBottom:5 }}>Personal Closet</div>
            <div style={{ fontSize:28, fontStyle:"italic", letterSpacing:-0.5 }}>Wardrobe</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"'DM Sans', system-ui, sans-serif", fontSize:20, fontWeight:300 }}>{items.length}</div>
            <div style={{ fontFamily:"'DM Sans', system-ui, sans-serif", fontSize:9, letterSpacing:2, color:"#555", textTransform:"uppercase" }}>pieces</div>
            {underloved.length > 0 && <div style={{ fontFamily:"'DM Sans', system-ui, sans-serif", fontSize:10, color:"#b8976a", marginTop:3 }}>{underloved.length} unworn</div>}
          </div>
        </div>
        <div style={{ display:"flex", gap:6, marginTop:18, fontFamily:"'DM Sans', system-ui, sans-serif", flexWrap:"wrap" }}>
          {navBtn("Closet", view==="closet", () => setView("closet"))}
          {navBtn("Outfits", view==="outfits", () => setView("outfits"))}
          {navBtn("+ Add", view==="add", () => { setView("add"); setAddMode("photo"); setReceiptData(null); setAddForm(emptyForm()); })}
        </div>
      </div>

      {view === "closet" && (
        <div>
          <div style={{ display:"flex", gap:6, padding:"14px 24px 6px", overflowX:"auto", scrollbarWidth:"none", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
            {["All",...CATEGORIES].map(cat => navBtn(cat, activeCategory===cat, () => setActiveCategory(cat)))}
          </div>
          <div style={{ padding:"8px 24px 12px", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
            <button onClick={() => setShowFilters(f => !f)} style={{ ...ghostBtn, fontSize:10, letterSpacing:1.5 }}>
              {showFilters ? "▲ Hide" : "▼ Filter"}
              {Object.keys(activeFilters).length > 0 && <span style={{ color:"#b8976a", marginLeft:6 }}>({Object.keys(activeFilters).length})</span>}
            </button>
            {showFilters && (
              <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:10 }}>
                {[
                  { key:"color", opts:COLORS },
                  { key:"season", opts:SEASONS },
                  { key:"material", opts:MATERIALS },
                  ...(brands.length ? [{ key:"brand", opts:brands }] : []),
                  ...(allTags.length ? [{ key:"tag", opts:allTags }] : []),
                ].map(({ key, opts }) => (
                  <div key={key}>
                    <div style={{ fontSize:9, letterSpacing:2, textTransform:"uppercase", color:"#555", marginBottom:6 }}>{key}</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                      {opts.map(o => <button key={o} onClick={() => setActiveFilters(f => f[key]===o ? Object.fromEntries(Object.entries(f).filter(([k]) => k!==key)) : { ...f, [key]:o })} style={chipStyle(activeFilters[key]===o)}>{o}</button>)}
                    </div>
                  </div>
                ))}
                {Object.keys(activeFilters).length > 0 && <button onClick={() => setActiveFilters({})} style={{ ...ghostBtn, color:"#8a4a4a", fontSize:10 }}>Clear filters</button>}
              </div>
            )}
          </div>
          <div style={{ padding:"0 24px 12px", display:"flex", gap:10, fontFamily:"'DM Sans', system-ui, sans-serif" }}>
            <button onClick={exportWardrobe} style={{ ...ghostBtn, fontSize:9, letterSpacing:1.5, color:"#555" }}>↓ Export</button>
            <button onClick={() => importRef.current.click()} style={{ ...ghostBtn, fontSize:9, letterSpacing:1.5, color:"#555" }}>↑ Import</button>
          </div>
          {filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 24px", color:"#444", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
              <div style={{ fontSize:12, letterSpacing:3, textTransform:"uppercase", marginBottom:8 }}>{items.length > 0 ? "No matches" : "Nothing here yet"}</div>
              <div style={{ fontSize:11, color:"#333" }}>{items.length > 0 ? "Try different filters" : "Add your first piece"}</div>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:2 }}>
              {filtered.map(item => (
                <div key={item.id} onClick={() => evaluateItem(item)} style={{ position:"relative", aspectRatio:"3/4", background:"#1a1a1a", cursor:"pointer", overflow:"hidden" }}>
                  {item.imageData ? <img src={item.imageData} alt={item.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> :
                    <div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, padding:12, boxSizing:"border-box" }}>
                      {item.color && <div style={{ fontSize:10, color:"#555" }}>{item.color}</div>}
                      <div style={{ fontSize:11, color:"#444", textAlign:"center" }}>{item.name}</div>
                    </div>
                  }
                  <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(transparent, rgba(8,8,8,0.94))", padding:"20px 10px 9px", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
                    {item.name && <div style={{ fontSize:11, fontWeight:500, marginBottom:1, lineHeight:1.3 }}>{item.name}</div>}
                    <div style={{ fontSize:9, color:"#666", letterSpacing:1, textTransform:"uppercase" }}>{item.brand || item.category}</div>
                  </div>
                  {!item.wornDates?.length && <div style={{ position:"absolute", top:7, right:7, background:"#b8976a", color:"#111", borderRadius:2, padding:"2px 5px", fontFamily:"'DM Sans', system-ui, sans-serif", fontSize:8, letterSpacing:1.5, fontWeight:700, textTransform:"uppercase" }}>New</div>}
                  {item.wornDates?.length > 0 && <div style={{ position:"absolute", top:7, left:7, background:"#ffffff12", color:"#ffffff55", borderRadius:2, padding:"2px 6px", fontFamily:"'DM Sans', system-ui, sans-serif", fontSize:9 }}>×{item.wornDates.length}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "outfits" && (
        <div style={{ padding:24, fontFamily:"'DM Sans', system-ui, sans-serif" }}>
          <label style={labelStyle}>Occasion (optional)</label>
          <input value={occasion} onChange={e => setOccasion(e.target.value)} placeholder="e.g. boat day, errands, travel..." style={inputStyle} />
          <button onClick={generateOutfits} disabled={loadingOutfit||items.length<2} style={{ width:"100%", background:items.length<2?"#1a1a1a":"#e8e2d8", color:items.length<2?"#444":"#111", border:"none", borderRadius:3, padding:"14px", fontSize:11, letterSpacing:3, textTransform:"uppercase", cursor:items.length<2?"not-allowed":"pointer", fontWeight:600, marginBottom:20 }}>
            {loadingOutfit ? "Styling..." : "Generate Outfits"}
          </button>
          {items.length < 2 && <div style={{ textAlign:"center", color:"#444", fontSize:12, marginBottom:16 }}>Add at least 2 pieces first</div>}
          {outfitResult && <div style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:3, padding:18, fontSize:13, lineHeight:1.8, color:"#c8c0b0", whiteSpace:"pre-wrap" }}>{outfitResult}</div>}
          {underloved.length > 0 && (
            <div style={{ marginTop:24 }}>
              <div style={{ fontSize:9, letterSpacing:3, textTransform:"uppercase", color:"#b8976a", marginBottom:12 }}>Never worn</div>
              {underloved.map(item => (
                <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, background:"#1a1a1a", border:"1px solid #b8976a22", borderRadius:3, padding:"9px 12px", marginBottom:7 }}>
                  {item.imageData && <img src={item.imageData} style={{ width:32, height:42, objectFit:"cover", borderRadius:2, flexShrink:0 }} />}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name||"Unnamed"}</div>
                    <div style={{ fontSize:9, color:"#666", letterSpacing:1, textTransform:"uppercase" }}>{item.brand||item.category}</div>
                  </div>
                  <button onClick={() => markWorn(item.id)} style={{ ...chipStyle(false), flexShrink:0 }}>worn</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "add" && (
        <div style={{ padding:24, fontFamily:"'DM Sans', system-ui, sans-serif" }}>
          <div style={{ display:"flex", gap:8, marginBottom:24 }}>
            {navBtn("📷 Photo", addMode==="photo", () => setAddMode("photo"))}
            {navBtn("🧾 Receipt", addMode==="receipt", () => { setAddMode("receipt"); setReceiptData(null); })}
          </div>
          {addMode === "photo" && (
            <>
              {scanningImage && <div style={{ textAlign:"center", padding:"16px 0", color:"#b8976a", fontFamily:"'DM Sans', system-ui, sans-serif" }}><div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase" }}>✦ Reading image...</div><div style={{ fontSize:10, color:"#555", marginTop:4 }}>Extracting brand, color, details</div></div>}
              <FormFields form={addForm} setForm={setAddForm} onImageClick={() => openFilePicker("add")} brands={brands} onAddBrand={addBrand} />
              <button onClick={addItem} disabled={!addForm.name||scanningImage} style={{ width:"100%", background:addForm.name&&!scanningImage?"#e8e2d8":"#1a1a1a", color:addForm.name&&!scanningImage?"#111":"#444", border:"none", borderRadius:3, padding:"14px", fontSize:11, letterSpacing:3, textTransform:"uppercase", cursor:addForm.name&&!scanningImage?"pointer":"not-allowed", fontWeight:600, marginTop:8 }}>Add to Closet</button>
            </>
          )}
          {addMode === "receipt" && !receiptData && !scanning && (
            <div onClick={() => receiptFileRef.current.click()} style={{ background:"#1a1a1a", border:"1px dashed #333", borderRadius:3, padding:"48px 24px", display:"flex", flexDirection:"column", alignItems:"center", cursor:"pointer" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🧾</div>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"#666" }}>Upload Receipt</div>
              <div style={{ fontSize:11, color:"#444", marginTop:6, textAlign:"center" }}>Photo or screenshot of any receipt or order confirmation</div>
            </div>
          )}
          {scanning && <div style={{ textAlign:"center", padding:"60px 24px", color:"#666" }}><div style={{ fontSize:36, marginBottom:16 }}>🧾</div><div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase" }}>Reading receipt...</div></div>}
          {receiptData && receiptData.length === 0 && (
            <div style={{ textAlign:"center", padding:"40px 0", color:"#666" }}>
              <div style={{ marginBottom:12 }}>No items found. Try again.</div>
              <button onClick={() => setReceiptData(null)} style={chipStyle(false)}>Try Again</button>
            </div>
          )}
          {receiptData && receiptData.length > 0 && (
            <>
              <div style={{ fontSize:9, letterSpacing:3, textTransform:"uppercase", color:"#b8976a", marginBottom:6 }}>{receiptData.length} item{receiptData.length!==1?"s":""} found</div>
              {receiptDate && <div style={{ fontSize:11, color:"#888", marginBottom:14 }}>Purchase date: {receiptDate}</div>}
              {receiptData.map(item => (
                <div key={item.tempId} style={{ background:"#1a1a1a", border:"1px solid #222", borderRadius:3, padding:14, marginBottom:12 }}>
                  <div style={{ display:"flex", gap:10, marginBottom:10, alignItems:"flex-start" }}>
                    <div onClick={() => openFilePicker(item.tempId)} style={{ width:52, height:68, background:"#111", border:"1px dashed #333", borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, overflow:"hidden" }}>
                      {receiptImages[item.tempId] ? <img src={receiptImages[item.tempId]} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <div style={{ fontSize:20, color:"#333" }}>+</div>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <input value={item.name} onChange={e => updateRI(item.tempId,"name",e.target.value)} style={{ ...inputStyle, padding:"8px 10px", fontSize:11, marginBottom:6 }} />
                      <input value={item.brand||""} onChange={e => updateRI(item.tempId,"brand",e.target.value)} placeholder="Brand" style={{ ...inputStyle, padding:"8px 10px", fontSize:11, marginBottom:6 }} />
                      <div style={{ display:"flex", gap:6 }}>
                        <select value={item.category} onChange={e => updateRI(item.tempId,"category",e.target.value)} style={{ ...inputStyle, padding:"8px 10px", fontSize:11, marginBottom:0, flex:1 }}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input value={item.price||""} onChange={e => updateRI(item.tempId,"price",e.target.value)} placeholder="$" style={{ ...inputStyle, padding:"8px 10px", fontSize:11, marginBottom:0, width:60 }} />
                      </div>
                    </div>
                    <button onClick={() => setReceiptData(prev => prev.filter(i => i.tempId!==item.tempId))} style={{ ...ghostBtn, fontSize:18, color:"#444", flexShrink:0 }}>×</button>
                  </div>
                  <div style={{ fontSize:9, letterSpacing:1.5, textTransform:"uppercase", color:"#555", marginBottom:6 }}>Color</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
                    {COLORS.map(c => <button key={c} onClick={() => updateRI(item.tempId,"color",item.color===c?"":c)} style={{ ...chipStyle(item.color===c), padding:"3px 8px", fontSize:9 }}>{c}</button>)}
                  </div>
                  <div style={{ fontSize:9, letterSpacing:1.5, textTransform:"uppercase", color:"#555", marginBottom:6 }}>Tags</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {Object.values(PRESET_TAGS).flat().map(t => <button key={t} onClick={() => toggleRITag(item.tempId,t)} style={{ ...chipStyle((item.tags||[]).includes(t)), padding:"3px 8px", fontSize:9 }}>{t}</button>)}
                  </div>
                </div>
              ))}
              <button onClick={addReceiptItems} style={{ width:"100%", background:"#e8e2d8", color:"#111", border:"none", borderRadius:3, padding:"14px", fontSize:11, letterSpacing:3, textTransform:"uppercase", cursor:"pointer", fontWeight:600 }}>
                Add {receiptData.length} Item{receiptData.length!==1?"s":""} to Closet
              </button>
              <button onClick={() => { setReceiptData(null); setReceiptDate(""); setReceiptImages({}); }} style={{ width:"100%", background:"transparent", border:"1px solid #222", color:"#555", borderRadius:3, padding:"11px", fontSize:10, letterSpacing:2, textTransform:"uppercase", cursor:"pointer", marginTop:8 }}>
                Scan Different Receipt
              </button>
            </>
          )}
        </div>
      )}

      {selectedItem && !editing && (
        <div style={{ position:"fixed", inset:0, background:"#0d0d0d", zIndex:100, overflowY:"auto" }}>
          <div style={{ padding:24, maxWidth:480, margin:"0 auto", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:18 }}>
              <button onClick={() => { setSelectedItem(null); setItemEval(""); }} style={ghostBtn}>← Back</button>
              <button onClick={() => { setEditing(true); setEditForm({ ...selectedItem, customColor:"", customMaterial:"" }); }} style={{ ...chipStyle(false), fontSize:10 }}>Edit</button>
            </div>
            {selectedItem.imageData ? <img src={selectedItem.imageData} style={{ width:"100%", aspectRatio:"3/4", objectFit:"cover", borderRadius:3, marginBottom:14 }} /> : <div style={{ width:"100%", aspectRatio:"3/4", background:"#1a1a1a", borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14, color:"#333", fontSize:12 }}>No Photo</div>}
            <div style={{ fontFamily:"Georgia, serif", fontSize:20, fontStyle:"italic", marginBottom:3 }}>{selectedItem.name||"Unnamed"}</div>
            {selectedItem.brand && <div style={{ fontSize:11, color:"#777", marginBottom:8 }}>{selectedItem.brand}</div>}
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:12 }}>
              {selectedItem.color && <span style={chipStyle(false)}>{selectedItem.color}</span>}
              {selectedItem.material && <span style={chipStyle(false)}>{selectedItem.material}</span>}
              {selectedItem.season && selectedItem.season!=="All Year" && <span style={chipStyle(false)}>{selectedItem.season}</span>}
              {selectedItem.sleeveLength && selectedItem.sleeveLength!=="N/A" && <span style={chipStyle(false)}>{selectedItem.sleeveLength}</span>}
              {selectedItem.length && selectedItem.length!=="N/A" && <span style={chipStyle(false)}>{selectedItem.length}</span>}
              {(selectedItem.tags||[]).map(t => <span key={t} style={chipStyle(true)}>{t}</span>)}
            </div>
            {selectedItem.comments && <div style={{ fontSize:12, color:"#777", fontStyle:"italic", lineHeight:1.6, marginBottom:12 }}>{selectedItem.comments}</div>}
            <div style={{ fontSize:10, color:"#555", lineHeight:1.8, marginBottom:14 }}>
              {selectedItem.price && <span>Paid ${selectedItem.price.toFixed(2)}{selectedItem.wornDates?.length>0?` · $${(selectedItem.price/selectedItem.wornDates.length).toFixed(2)}/wear`:""} · </span>}
              {selectedItem.datePurchased && <span>Purchased {selectedItem.datePurchased} · </span>}
              Worn {selectedItem.wornDates?.length||0}×{selectedItem.wornDates?.length>0&&` · Last worn ${selectedItem.wornDates[selectedItem.wornDates.length-1]}`}
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              <button onClick={() => markWorn(selectedItem.id)} style={{ flex:1, background:"transparent", border:"1px solid #333", color:"#e8e2d8", borderRadius:3, padding:"10px", fontSize:10, letterSpacing:2, textTransform:"uppercase", cursor:"pointer" }}>Mark Worn Today</button>
              <button onClick={() => removeItem(selectedItem.id)} style={{ background:"transparent", border:"1px solid #3a2020", color:"#8a4a4a", borderRadius:3, padding:"10px 16px", fontSize:10, letterSpacing:1, textTransform:"uppercase", cursor:"pointer" }}>Remove</button>
            </div>
            {selectedItem.wornDates?.length > 0 && (
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:9, letterSpacing:2, textTransform:"uppercase", color:"#555", marginBottom:8 }}>Wear History</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {[...selectedItem.wornDates].reverse().slice(0,12).map((d,i) => <span key={i} style={{ fontSize:10, color:"#666", background:"#1a1a1a", padding:"3px 8px", borderRadius:2 }}>{d}</span>)}
                </div>
              </div>
            )}
            <div style={{ fontSize:9, letterSpacing:3, textTransform:"uppercase", color:"#555", marginBottom:10 }}>Style Verdict</div>
            {loadingEval ? <div style={{ color:"#444", fontSize:12, padding:"16px 0", fontStyle:"italic" }}>Evaluating...</div> : <div style={{ background:"#1a1a1a", border:"1px solid #222", borderRadius:3, padding:16, fontSize:13, lineHeight:1.8, color:"#c8c0b0", whiteSpace:"pre-wrap" }}>{itemEval}</div>}
          </div>
        </div>
      )}

      {selectedItem && editing && editForm && (
        <div style={{ position:"fixed", inset:0, background:"#0d0d0d", zIndex:100, overflowY:"auto" }}>
          <div style={{ padding:24, maxWidth:480, margin:"0 auto", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
              <button onClick={() => setEditing(false)} style={ghostBtn}>← Cancel</button>
              <button onClick={saveEdit} style={{ background:"#e8e2d8", color:"#111", border:"none", borderRadius:3, padding:"7px 20px", fontSize:11, letterSpacing:2, textTransform:"uppercase", cursor:"pointer", fontWeight:600 }}>Save</button>
            </div>
            <FormFields form={editForm} setForm={setEditForm} onImageClick={() => openFilePicker("edit")} brands={brands} onAddBrand={addBrand} />
          </div>
        </div>
      )}
    </div>
  );
}
