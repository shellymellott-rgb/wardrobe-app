import { useState, useEffect, useRef } from "react";
import { supabase, sbLoadOutfits, sbDeleteImage } from "./supabase.js";
import { CATEGORIES } from "./constants.js";
import { navBtn, ghostBtn } from "./styles.js";
import { normalizeItem, emptyForm } from "./utils/normalizeItem.js";
import { readFile, compressImage, generateImageVersions } from "./utils/imageUtils.js";
import { IMAGE_SCAN_PROMPT, WEATHER_OUTFIT_PROMPT } from "./constants.js";
import { callClaude } from "./utils/callClaude.js";
import { fetchWeatherByCity, fetchWeatherByGeolocation } from "./utils/weather.js";
import { stripForClaude } from "./utils/wardrobeContext.js";
import { parseJsonObject } from "./utils/parseJson.js";

import { useSettings } from "./hooks/useSettings.js";
import { useWardrobeData } from "./hooks/useWardrobeData.js";
import { useClaudeStyling } from "./hooks/useClaudeStyling.js";

import LoginScreen from "./components/LoginScreen.jsx";
import CropModal from "./components/CropModal.jsx";
import HomeView from "./components/HomeView.jsx";
import ClosetView from "./components/ClosetView.jsx";
import AddItemView from "./components/AddItemView.jsx";
import OutfitsView from "./components/OutfitsView.jsx";
import WishlistView from "./components/WishlistView.jsx";
import ChatView from "./components/ChatView.jsx";
import ItemDetailModal from "./components/ItemDetailModal.jsx";
import ItemChatModal from "./components/ItemChatModal.jsx";
import SettingsModal from "./components/SettingsModal.jsx";

// Read the cached Supabase user ID directly from localStorage so we can kick
// off the data fetch before getSession() resolves its network token check.
// Returns null if no valid cached session exists.
function getCachedUserId() {
  try {
    const ref = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Bail if the access token is already expired — sync would 401 anyway
    if ((parsed?.expires_at ?? 0) < Math.floor(Date.now() / 1000)) return null;
    return parsed?.user?.id ?? null;
  } catch { return null; }
}

// App-wide start time so every log shows ms-since-mount, not absolute ms
const APP_START = performance.now();
const ts = () => `+${(performance.now() - APP_START).toFixed(0)}ms`;

export default function WardrobeApp() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Data hooks ──────────────────────────────────────────────────────────────
  const settings = useSettings(user);
  const wardrobe = useWardrobeData(user);
  const styling = useClaudeStyling({
    items: wardrobe.items,
    buildStyleSystem: settings.buildStyleSystem,
    saveSettings: settings.saveSettings,
    addStyleNote: settings.addStyleNote,
  });

  // ── Auth: wait for session before syncing ───────────────────────────────────
  useEffect(() => {
    // ── Early sync: start data fetch NOW using cached session ─────────────────
    // getCachedUserId() reads the Supabase token directly from localStorage
    // so we don't have to wait for getSession() to make its network call.
    const cachedUid = getCachedUserId();
    if (cachedUid) {
      wardrobe.syncFromSupabase(cachedUid, settings.syncSettingsFrom);
    }

    // ── getSession: may make a network call to refresh an expired token ───────
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setAuthLoading(false);
      // Re-sync only if the user is different from the one we already synced with
      if (u && u.id !== cachedUid) {
        wardrobe.syncFromSupabase(u.id, settings.syncSettingsFrom);
      } else if (!u && cachedUid) {
        wardrobe.setItems([]);
      }
    });

    // onAuthStateChange fires for OAuth redirect (SIGNED_IN) and token refresh.
    // INITIAL_SESSION fires synchronously on init — guard against double-sync
    // if cachedUid already kicked off the same sync above.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && u && u.id !== cachedUid) {
        wardrobe.syncFromSupabase(u.id, settings.syncSettingsFrom);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync on tab focus (separate from auth — user is already known here)
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        const lastPersist = parseInt(localStorage.getItem("lastPersistAt") || "0");
        if (Date.now() - lastPersist < 30000) return;
        wardrobe.syncFromSupabase(user.id, settings.syncSettingsFrom);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Weather outfit ──────────────────────────────────────────────────────────
  const [weatherOutfit, setWeatherOutfit] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(null);
  const [weatherOccasion, setWeatherOccasion] = useState("");
  const [weatherSaved, setWeatherSaved] = useState(false);

  function weatherFilter(items, { tempHigh, tempLow, isRainy }) {
    const avg    = (tempHigh + tempLow) / 2;
    const cold   = avg < 45;
    const cool   = avg >= 45 && avg < 58;
    const hot    = avg >= 80;
    return items.filter(item => {
      const cat    = item.category   || "";
      const sleeve = item.sleeveLength || "N/A";
      const mats   = item.materials  || [];
      const length = item.length     || "N/A";
      const season = item.season     || "All Year";
      const name   = (item.name     || "").toLowerCase();
      const isHeavy    = mats.some(m => ["Wool","Cashmere","Knit"].includes(m));
      const isDelicate = mats.some(m => ["Linen","Silk"].includes(m));
      const isOpenShoe = cat === "Shoes" && /sandal|slide|mule|flip/.test(name);
      // Accessories are always relevant
      if (cat === "Accessories") return true;
      // Season-level (catches items with no detailed fields filled in)
      if (cold && season === "Spring/Summer") return false;
      if (hot  && season === "Fall/Winter" && cat !== "Outerwear") return false;
      // Heavy fabrics in heat
      if (hot && isHeavy && cat !== "Outerwear") return false;
      // Delicate fabrics in cold
      if (cold && isDelicate && ["Tops","Dresses"].includes(cat)) return false;
      // Sleeve length
      if ((cold || cool) && sleeve === "Sleeveless") return false;
      if (cold && sleeve === "Short Sleeve") return false;
      // Dress/bottom length
      if (cold && ["Mini","Cropped"].includes(length)) return false;
      if (cool && length === "Mini") return false;
      // Rain
      if (isRainy && isOpenShoe) return false;
      if (isRainy && isDelicate && ["Tops","Dresses"].includes(cat)) return false;
      // Wool/heavy outerwear in heat
      if (hot && cat === "Outerwear" && isHeavy) return false;
      return true;
    }).slice(0, 40);
  }

  async function getWeatherOutfit() {
    if (wardrobe.items.length < 2) return;
    setWeatherLoading(true); setWeatherOutfit(null); setWeatherError(null); setWeatherSaved(false);
    try {
      const w = settings.homeCity.trim()
        ? await fetchWeatherByCity(settings.homeCity.trim())
        : await fetchWeatherByGeolocation();
      const candidates = weatherFilter(wardrobe.items, w);
      const text = await callClaude(
        settings.buildStyleSystem(),
        WEATHER_OUTFIT_PROMPT(candidates.map(stripForClaude), w, weatherOccasion),
        700
      );
      setWeatherOutfit({ ...parseJsonObject(text), weather: w });
    } catch (e) {
      setWeatherError(e.message || "Could not get weather");
    }
    setWeatherLoading(false);
  }

  function saveWeatherOutfit() {
    if (!weatherOutfit || weatherSaved) return;
    styling.addOutfit({
      name: `${weatherOutfit.weather?.condition || "Weather"} Look${weatherOccasion ? ` — ${weatherOccasion}` : ""}`,
      pieces: weatherOutfit.main || [],
      why: weatherOutfit.mainWhy || "",
      tip: weatherOutfit.layer || "",
    });
    setWeatherSaved(true);
  }

  function resetWeatherOutfit() {
    setWeatherOutfit(null); setWeatherError(null); setWeatherSaved(false);
  }

  // ── Saved outfits ───────────────────────────────────────────────────────────
  const [savedOutfits, setSavedOutfits] = useState(null);   // null = not yet loaded
  const [outfitsLoading, setOutfitsLoading] = useState(false);

  async function loadSavedOutfits() {
    if (!user?.id) return;
    setOutfitsLoading(true);
    const data = await sbLoadOutfits(user.id);
    setSavedOutfits(data ?? []);
    setOutfitsLoading(false);
  }

  useEffect(() => { loadSavedOutfits(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ──────────────────────────────────────────────────────────────
  const [view, setView] = useState("home");
  const [showSettings, setShowSettings] = useState(false);

  // ── Closet filters ──────────────────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeFilters, setActiveFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  // ── Item detail ──────────────────────────────────────────────────────────────
  const [selectedItem, setSelectedItem] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [wornDateInput, setWornDateInput] = useState(null);
  const [stylingNotesInput, setStylingNotesInput] = useState("");

  // ── Image / crop state (shared across add, edit, receipt) ──────────────────
  const [addForm, setAddForm] = useState(() => emptyForm());
  const [receiptImages, setReceiptImages] = useState({});
  const [cropSrc, setCropSrc] = useState(null);
  const [cropTarget, setCropTarget] = useState(null);
  const [savedOriginalImageData, setSavedOriginalImageData] = useState(null);
  const [scanningImage, setScanningImage] = useState(false);
  const fileInputRef = useRef();
  const importRef = useRef();
  const outfitPhotoRef = useRef();

  // ── Auth actions ────────────────────────────────────────────────────────────
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({ provider:"google", options:{ redirectTo:window.location.origin } });
  }
  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    wardrobe.setItems([]); wardrobe.setWishlist([]);
    try { localStorage.removeItem("wardrobe-v3"); localStorage.removeItem("wardrobe-wishlist"); } catch {}
  }

  // ── File / crop handlers ────────────────────────────────────────────────────
  function openFilePicker(target) { setCropTarget(target); fileInputRef.current.click(); }

  // Shared handler for both file-picker selection and drag-and-drop drops.
  // `target` is "add", "edit", or a receipt tempId number.
  async function handleImageFile(file, target) {
    setCropTarget(target);
    const dataUrl = await readFile(file);

    if (target === "add") {
      setSavedOriginalImageData(addForm.originalImageData);
      setAddForm(f => ({ ...f, originalImageData: dataUrl }));
      // Auto-scan image for item details
      setScanningImage(true);
      try {
        const base64 = dataUrl.split(",")[1];
        const text = await callClaude(IMAGE_SCAN_PROMPT, [{ type:"image", source:{ type:"base64", media_type:file.type||"image/jpeg", data:base64 } }, { type:"text", text:"Analyze this clothing item." }], 500);
        const parsed = parseJsonObject(text);
        setAddForm(f => ({
          ...f,
          name: parsed.name || f.name,
          brand: parsed.brand || f.brand,
          color: parsed.color || f.color,
          materials: parsed.material && !f.materials.length ? [parsed.material] : f.materials,
          category: parsed.category || f.category,
          season: parsed.season || f.season,
          sleeveLength: parsed.sleeveLength || f.sleeveLength,
          length: parsed.length || f.length,
          price: parsed.price || f.price,
          datePurchased: parsed.datePurchased || f.datePurchased,
        }));
        if (parsed.brand) wardrobe.addBrand(parsed.brand);
      } catch {}
      setScanningImage(false);
    } else if (target === "edit") {
      setSavedOriginalImageData(editForm?.originalImageData ?? null);
      setEditForm(f => ({ ...f, originalImageData: dataUrl }));
    } else {
      // receipt image (target is the tempId number)
      setSavedOriginalImageData(receiptImages[target] ?? null);
    }
    setCropSrc(dataUrl);
  }

  async function onFileSelected(e) {
    const file = e.target.files[0]; e.target.value = ""; if (!file) return;
    await handleImageFile(file, cropTarget);
  }

  async function onCropDone(cropped) {
    console.log(`[crop] onCropDone: target="${cropTarget}", cropped size=${Math.round(cropped.length/1024)}KB`);
    // Compress immediately: full for detail view, thumb for grid
    const { full, thumb } = await generateImageVersions(cropped);
    console.log(`[crop] generated: full=${Math.round(full.length/1024)}KB, thumb=${Math.round(thumb.length/1024)}KB`);
    if (cropTarget === "add") setAddForm(f => ({ ...f, imageData: full, imageThumb: thumb }));
    else if (cropTarget === "edit") setEditForm(f => ({ ...f, imageData: full, imageThumb: thumb }));
    else setReceiptImages(prev => ({ ...prev, [cropTarget]: full })); // receipts: just full
    console.log(`[crop] images set on form for target="${cropTarget}"`);
    setCropSrc(null); setCropTarget(null); setSavedOriginalImageData(null);
  }

  function onCropCancel() {
    if (cropTarget === "add") setAddForm(f => ({ ...f, originalImageData: savedOriginalImageData }));
    else if (cropTarget === "edit") setEditForm(f => ({ ...f, originalImageData: savedOriginalImageData }));
    else setReceiptImages(prev => ({ ...prev, [cropTarget]: savedOriginalImageData }));
    setSavedOriginalImageData(null); setCropSrc(null); setCropTarget(null);
  }

  // ── Item actions ────────────────────────────────────────────────────────────
  async function evaluateItem(item) {
    setSelectedItem(item); setEditing(false); setWornDateInput(null);
    await styling.evaluateItem(item);
  }

  function markWorn(id, date) {
    const d = date || new Date().toISOString().split("T")[0];
    const updated = wardrobe.items.map(i => i.id===id ? { ...i, wornDates:[...(i.wornDates||[]),d] } : i);
    wardrobe.persist(updated);
    if (selectedItem?.id === id) setSelectedItem(updated.find(i => i.id===id));
  }

  function removeWornDate(id, idx) {
    const updated = wardrobe.items.map(i => {
      if (i.id !== id) return i;
      const d = [...(i.wornDates||[])]; d.splice(idx,1); return { ...i, wornDates:d };
    });
    wardrobe.persist(updated); setSelectedItem(updated.find(i=>i.id===id));
  }

  function removeItem(id) {
    wardrobe.persist(wardrobe.items.filter(i=>i.id!==id));
    setSelectedItem(null); styling.setItemEval(""); setEditing(false); setWornDateInput(null);
  }

  function saveEdit() {
    const { originalImageData, ...ef } = editForm;
    const updated = wardrobe.items.map(i => i.id===ef.id
      ? normalizeItem(ef)
      : i
    );
    if (ef.brand) wardrobe.addBrand(ef.brand);
    if (ef.imageData?.startsWith("data:")) sbDeleteImage(user.id, ef.id);
    wardrobe.persist(updated);
    localStorage.setItem("lastPersistAt", Date.now().toString());
    setSelectedItem(updated.find(i=>i.id===ef.id));
    setEditing(false);
  }

  function setItemStatus(id, status) {
    const upd = wardrobe.items.map(i=>i.id===id?{...i,status:status||null}:i);
    wardrobe.persist(upd); setSelectedItem(upd.find(i=>i.id===id));
  }

  async function addOutfitPhoto(e) {
    const file = e.target.files[0]; e.target.value=""; if(!file) return;
    const dataUrl = await readFile(file);
    const compressed = await compressImage(dataUrl);
    const updated = wardrobe.items.map(i=>i.id===selectedItem.id?{...i,outfitPhotos:[...(i.outfitPhotos||[]),compressed]}:i);
    wardrobe.persist(updated); setSelectedItem(updated.find(i=>i.id===selectedItem.id));
  }

  // ── Data export/import ──────────────────────────────────────────────────────
  function exportWardrobe() {
    const blob = new Blob([JSON.stringify(wardrobe.items, null, 2)], { type:"application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `wardrobe-${new Date().toISOString().split("T")[0]}.json`; a.click();
  }
  function importWardrobe(e) {
    const file = e.target.files[0]; e.target.value=""; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imp = JSON.parse(ev.target.result);
        if (Array.isArray(imp)) {
          wardrobe.persist([...wardrobe.items, ...imp.map(normalizeItem)]);
          alert(`Imported ${imp.length} items.`);
        }
      } catch { alert("Invalid file."); }
    };
    reader.readAsText(file);
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const allCategories = [...CATEGORIES, ...(Array.isArray(settings.customCategories) ? settings.customCategories : [])];
  const filtered = wardrobe.items.filter(i => {
    if (activeCategory==="To Go") return i.status==="donate"||i.status==="sell";
    if (activeCategory!=="All" && i.category!==activeCategory) return false;
    const fv = (key) => { const v = activeFilters[key]; return Array.isArray(v) ? v : (v ? [v] : []); };
    if (fv("color").length && !fv("color").includes(i.color)) return false;
    if (fv("season").length && !fv("season").includes(i.season)) return false;
    if (fv("material").length && !fv("material").some(m=>(i.materials||[]).includes(m))) return false;
    if (fv("brand").length && !fv("brand").includes(i.brand)) return false;
    if (fv("tag").length && !fv("tag").some(t=>(i.tags||[]).includes(t))) return false;
    return true;
  });
  const underloved = wardrobe.items.filter(i => !i.wornDates?.length);
  const allTags = [...new Set(wardrobe.items.flatMap(i=>i.tags||[]))];

  // ── Early returns ───────────────────────────────────────────────────────────
  // Don't block on authLoading — localStorage items render immediately.
  // Only redirect to login once auth definitively resolves to no-user.
  if (!authLoading && !user) return <LoginScreen onSignIn={signInWithGoogle}/>;

  const isDataLoading = authLoading || wardrobe.syncing;

  return (
    <div style={{minHeight:"100vh",background:"#111",color:"#e8e2d8",fontFamily:"Georgia, 'Times New Roman', serif",maxWidth:900,margin:"0 auto",position:"relative"}}>
      {cropSrc && <CropModal imageSrc={cropSrc} onDone={onCropDone} onCancel={onCropCancel}/>}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileSelected} style={{display:"none"}}/>
      <input ref={importRef} type="file" accept=".json" onChange={importWardrobe} style={{display:"none"}}/>
      <input ref={outfitPhotoRef} type="file" accept="image/*" onChange={addOutfitPhoto} style={{display:"none"}}/>

      {/* Header */}
      <div style={{padding:"28px 24px 18px",borderBottom:"1px solid #222"}}>
        {/* Syncing indicator — thin pulsing bar at top */}
        {isDataLoading && (
          <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"#b8976a",opacity:0.5,animation:"pulse 1.2s ease-in-out infinite"}}/>
        )}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontFamily:"'DM Sans', system-ui, sans-serif",fontSize:10,letterSpacing:5,color:"#555",textTransform:"uppercase",marginBottom:5}}>Personal Closet</div>
            <div style={{fontSize:28,fontStyle:"italic",letterSpacing:-0.5}}>Wardrobe</div>
          </div>
          <div style={{textAlign:"right",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
            <div style={{fontFamily:"'DM Sans', system-ui, sans-serif",fontSize:20,fontWeight:300}}>{wardrobe.items.length}</div>
            <div style={{fontFamily:"'DM Sans', system-ui, sans-serif",fontSize:9,letterSpacing:2,color:isDataLoading?"#b8976a":"#555",textTransform:"uppercase"}}>{isDataLoading ? "syncing..." : "pieces"}</div>
            {!isDataLoading && underloved.length>0 && <div style={{fontFamily:"'DM Sans', system-ui, sans-serif",fontSize:10,color:"#b8976a"}}>{underloved.length} unworn</div>}
            <button onClick={()=>setShowSettings(true)} style={{background:showSettings?"#e8e2d820":"transparent",border:`1px solid ${showSettings?"#e8e2d840":"#2a2a2a"}`,color:showSettings?"#e8e2d8":"#888",fontSize:11,cursor:"pointer",padding:"5px 10px",marginTop:4,borderRadius:3,letterSpacing:1,fontFamily:"'DM Sans', system-ui, sans-serif"}}>⚙ Settings</button>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginTop:18,fontFamily:"'DM Sans', system-ui, sans-serif",flexWrap:"wrap"}}>
          {navBtn("Home",    view==="home",    ()=>setView("home"))}
          {navBtn("Closet",  view==="closet",  ()=>setView("closet"))}
          {navBtn("Outfits", view==="outfits", ()=>setView("outfits"))}
          {navBtn("Wishlist",view==="wishlist",()=>setView("wishlist"))}
        </div>
      </div>

      {/* Views */}
      {view==="home" && (
        <HomeView
          items={wardrobe.items}
          underloved={underloved}
          outfits={styling.outfits}
          loadingOutfit={styling.loadingOutfit}
          generateOutfits={styling.generateOutfits}
          occasion={styling.occasion} setOccasion={styling.setOccasion}
          markWorn={markWorn}
          evaluateItem={evaluateItem}
          setView={setView}
          onAddItem={()=>{setView("add");setAddForm(emptyForm());}}
          weatherEnabled={settings.weatherEnabled}
          weatherOutfit={weatherOutfit}
          weatherLoading={weatherLoading}
          weatherError={weatherError}
          weatherOccasion={weatherOccasion}
          setWeatherOccasion={setWeatherOccasion}
          weatherSaved={weatherSaved}
          getWeatherOutfit={getWeatherOutfit}
          saveWeatherOutfit={saveWeatherOutfit}
          resetWeatherOutfit={resetWeatherOutfit}
        />
      )}

      {view==="closet" && (
        <ClosetView
          items={wardrobe.items} filtered={filtered}
          activeCategory={activeCategory} setActiveCategory={setActiveCategory}
          allCategories={allCategories}
          activeFilters={activeFilters} setActiveFilters={setActiveFilters}
          showFilters={showFilters} setShowFilters={setShowFilters}
          brands={wardrobe.brands} allTags={allTags}
          evaluateItem={evaluateItem}
          syncing={wardrobe.syncing}
        />
      )}

      {view==="outfits" && (
        <OutfitsView
          items={wardrobe.items} occasion={styling.occasion} setOccasion={styling.setOccasion}
          outfits={styling.outfits} outfitText={styling.outfitText} loadingOutfit={styling.loadingOutfit}
          generateOutfits={styling.generateOutfits}
          inspoImage={styling.inspoImage} inspoResult={styling.inspoResult}
          setInspoResult={styling.setInspoResult} setInspoImage={styling.setInspoImage}
          loadingInspo={styling.loadingInspo} analyzeInspo={styling.analyzeInspo}
          underloved={underloved} markWorn={markWorn} user={user}
          savedOutfits={savedOutfits} outfitsLoading={outfitsLoading} onOutfitSaved={loadSavedOutfits}
          wishlist={wardrobe.wishlist} persistWishlist={wardrobe.persistWishlist}
          setChatInput={styling.setChatInput} setView={setView}
        />
      )}

      {view==="wishlist" && (
        <WishlistView wishlist={wardrobe.wishlist} persistWishlist={wardrobe.persistWishlist}/>
      )}

      {view==="chat" && (
        <ChatView
          chatHistory={settings.chatHistory} setChatHistory={settings.setChatHistory}
          chatInput={styling.chatInput} setChatInput={styling.setChatInput}
          chatLoading={styling.chatLoading} chatEndRef={styling.chatEndRef}
          styleNotes={settings.styleNotes}
          removeStyleNote={settings.removeStyleNote}
          clearStyleNotes={settings.clearStyleNotes}
          learnedIndicator={styling.learnedIndicator}
          correctingIdx={styling.correctingIdx} setCorrectingIdx={styling.setCorrectingIdx}
          correctionInput={styling.correctionInput} setCorrectionInput={styling.setCorrectionInput}
          sendChat={styling.sendChat} submitCorrection={styling.submitCorrection}
        />
      )}

      {view==="add" && (
        <AddItemView
          items={wardrobe.items} persist={wardrobe.persist}
          addBrand={wardrobe.addBrand} brands={wardrobe.brands}
          allCategories={allCategories}
          addForm={addForm} setAddForm={setAddForm}
          scanningImage={scanningImage}
          openFilePicker={openFilePicker}
          onImageDrop={file => handleImageFile(file, "add")}
          setCropSrc={setCropSrc} setCropTarget={setCropTarget}
          receiptImages={receiptImages} setReceiptImages={setReceiptImages}
          setView={setView}
        />
      )}

      {/* Modals */}
      {showSettings && (
        <SettingsModal
          onClose={()=>setShowSettings(false)}
          customCategories={settings.customCategories}
          addCustomCategory={settings.addCustomCategory}
          removeCustomCategory={settings.removeCustomCategory}
          styleProfile={settings.styleProfile} setStyleProfile={settings.setStyleProfile}
          saveSettings={settings.saveSettings}
          extraInstructions={settings.extraInstructions} setExtraInstructions={settings.setExtraInstructions}
          styleNotes={settings.styleNotes}
          removeStyleNote={settings.removeStyleNote}
          clearStyleNotes={settings.clearStyleNotes}
          weatherEnabled={settings.weatherEnabled} setWeatherEnabled={settings.setWeatherEnabled}
          homeCity={settings.homeCity} setHomeCity={settings.setHomeCity}
          exportWardrobe={exportWardrobe}
          onImport={()=>importRef.current.click()}
          user={user} signOut={signOut}
        />
      )}

      {selectedItem && (
        <ItemDetailModal
          selectedItem={selectedItem} setSelectedItem={setSelectedItem}
          items={wardrobe.items} persist={wardrobe.persist}
          itemEval={styling.itemEval} loadingEval={styling.loadingEval}
          editing={editing} setEditing={setEditing}
          editForm={editForm} setEditForm={setEditForm} saveEdit={saveEdit}
          markWorn={markWorn} removeWornDate={removeWornDate} removeItem={removeItem}
          wornDateInput={wornDateInput} setWornDateInput={setWornDateInput}
          setItemStatus={setItemStatus}
          openItemChat={styling.openItemChat}
          openFilePicker={openFilePicker} onImageDrop={file => handleImageFile(file, "edit")}
          setCropSrc={setCropSrc} setCropTarget={setCropTarget}
          outfitPhotoRef={outfitPhotoRef} addOutfitPhoto={addOutfitPhoto}
          brands={wardrobe.brands} addBrand={wardrobe.addBrand} allCategories={allCategories}
          stylingNotesInput={stylingNotesInput} setStylingNotesInput={setStylingNotesInput}
        />
      )}

      {/* FAB — Add Item */}
      {!cropSrc && view!=="add" && !selectedItem && !showSettings && !styling.itemChatModal && (
        <button
          onClick={()=>{setView("add");setAddForm(emptyForm());}}
          style={{
            position:"fixed",bottom:28,right:24,
            width:52,height:52,borderRadius:"50%",
            background:"#e8e2d8",color:"#111",
            border:"none",fontSize:28,fontWeight:300,lineHeight:1,
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 4px 24px rgba(0,0,0,0.5)",zIndex:50,
            fontFamily:"'DM Sans',system-ui,sans-serif",
          }}
          aria-label="Add item"
        >+</button>
      )}

      {styling.itemChatModal && (
        <ItemChatModal
          itemChatModal={styling.itemChatModal} setItemChatModal={styling.setItemChatModal}
          itemChatHistory={styling.itemChatHistory}
          itemChatInput={styling.itemChatInput} setItemChatInput={styling.setItemChatInput}
          itemChatLoading={styling.itemChatLoading}
          itemChatEndRef={styling.itemChatEndRef}
          learnedIndicator={styling.learnedIndicator}
          sendItemChat={styling.sendItemChat}
        />
      )}
    </div>
  );
}
