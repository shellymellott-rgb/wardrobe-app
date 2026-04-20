import { useState, useRef } from "react";
import { COLORS, PRESET_TAGS, URL_PROMPT, RECEIPT_PROMPT } from "../constants.js";
import { inputStyle, labelStyle, chipStyle, ghostBtn, navBtn } from "../styles.js";
import { buildItem, emptyForm } from "../utils/normalizeItem.js";
import { parseJsonObject } from "../utils/parseJson.js";
import { readFile } from "../utils/imageUtils.js";
import { callClaude } from "../utils/callClaude.js";
import FormFields from "./FormFields.jsx";

export default function AddItemView({
  items, persist, addBrand, brands, allCategories,
  // addForm is lifted to App so the crop callback can update it
  addForm, setAddForm,
  scanningImage,
  openFilePicker, onImageDrop, setCropSrc, setCropTarget,
  // receiptImages is lifted to App so the crop callback can update it
  receiptImages, setReceiptImages,
  setView,
}) {
  const [addMode, setAddMode] = useState("photo");
  const [urlInput, setUrlInput] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState("");

  const [receiptData, setReceiptData] = useState(null);
  const [receiptDate, setReceiptDate] = useState("");
  const [scanning, setScanning] = useState(false);
  const receiptFileRef = useRef();

  async function fetchUrl() {
    if (!urlInput.trim()) return;
    setFetchingUrl(true); setUrlError("");
    try {
      const text = await callClaude(URL_PROMPT, [{ type:"text", text:`Product URL: ${urlInput.trim()}\n\nExtract product details using your knowledge of this retailer/brand from the URL. Make your best guess even if uncertain.` }], 500);
      if (!text) { setUrlError("No response from Claude — check VITE_ANTHROPIC_API_KEY in Vercel env vars"); setFetchingUrl(false); return; }
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
      }));
      if (parsed.brand) addBrand(parsed.brand);
      // Background fetch for image + price. Guards on each field prevent overwriting user edits.
      fetch("/api/claude", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ fetchUrl:urlInput.trim() }) })
        .then(r => r.json())
        .then(pageData => {
          if (pageData.imageData || pageData.price) {
            setAddForm(f => ({
              ...f,
              price: pageData.price || f.price,
              imageData: f.imageData || pageData.imageData || null,
              originalImageData: f.originalImageData || pageData.imageData || null,
            }));
          }
        })
        .catch(() => {});
    } catch (err) {
      setUrlError(`Error: ${err.message}`);
    }
    setFetchingUrl(false);
  }

  async function scanReceipt(e) {
    const file = e.target.files[0]; e.target.value = ""; if (!file) return;
    setScanning(true); setReceiptData(null); setReceiptImages({});
    const dataUrl = await readFile(file);
    const base64 = dataUrl.split(",")[1];
    try {
      const text = await callClaude(RECEIPT_PROMPT, [{ type:"image", source:{ type:"base64", media_type:"image/jpeg", data:base64 } }, { type:"text", text:"Extract all clothing items from this receipt or order confirmation." }], 1000);
      const parsed = parseJsonObject(text);
      setReceiptDate(parsed.purchaseDate || "");
      setReceiptData((parsed.items||[]).map((item,i)=>({ ...item, tempId:i, season:"All Year", sleeveLength:"N/A", length:"N/A", materials:[], customMaterial:"", tags:[], comments:"", price:item.price||"" })));
    } catch { setReceiptData([]); }
    setScanning(false);
  }

  function updateRI(tempId, field, value) { setReceiptData(prev=>prev.map(i=>i.tempId===tempId?{...i,[field]:value}:i)); }
  function toggleRITag(tempId, tag) { setReceiptData(prev=>prev.map(i=>i.tempId!==tempId?i:{...i,tags:i.tags.includes(tag)?i.tags.filter(t=>t!==tag):[...i.tags,tag]})); }

  function addReceiptItems() {
    const newItems = receiptData.map(item => ({
      id: Date.now()+item.tempId+Math.random(),
      name: item.name, brand: item.brand||"", category: item.category,
      color: item.color||"", materials: Array.isArray(item.materials)?item.materials:[],
      season: item.season||"All Year", sleeveLength: item.sleeveLength||"N/A", length: item.length||"N/A",
      tags: item.tags||[], comments: item.comments||"",
      datePurchased: receiptDate||"", price: item.price?parseFloat(item.price):null,
      imageData: receiptImages[item.tempId]||null, wornDates:[], addedAt:new Date().toISOString(),
    }));
    receiptData.forEach(item => { if (item.brand) addBrand(item.brand); });
    persist([...items, ...newItems]);
    setReceiptData(null); setReceiptDate(""); setReceiptImages({}); setView("closet");
  }

  function addItem() {
    if (!addForm.name) return;
    if (addForm.brand) addBrand(addForm.brand);
    persist([...items, buildItem(addForm)]);
    setAddForm(emptyForm()); setUrlInput(""); setView("closet");
  }

  return (
    <div style={{padding:24,fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {navBtn("📷 Photo", addMode==="photo", ()=>setAddMode("photo"))}
        {navBtn("🔗 URL", addMode==="url", ()=>setAddMode("url"))}
        {navBtn("🧾 Receipt", addMode==="receipt", ()=>{setAddMode("receipt");setReceiptData(null);})}
      </div>

      {addMode==="photo" && (<>
        {scanningImage && <div style={{textAlign:"center",padding:"16px 0",color:"#b8976a"}}><div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase"}}>✦ Reading image...</div><div style={{fontSize:10,color:"#555",marginTop:4}}>Extracting brand, color, details</div></div>}
        <FormFields form={addForm} setForm={setAddForm} onImageClick={()=>openFilePicker("add")} onImageDrop={onImageDrop} onRecrop={()=>{setCropTarget("add");setCropSrc(addForm.originalImageData);}} brands={brands} onAddBrand={addBrand} categories={allCategories}/>
        <button onClick={addItem} disabled={!addForm.name||scanningImage} style={{width:"100%",background:addForm.name&&!scanningImage?"#e8e2d8":"#1a1a1a",color:addForm.name&&!scanningImage?"#111":"#444",border:"none",borderRadius:3,padding:"14px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:addForm.name&&!scanningImage?"pointer":"not-allowed",fontWeight:600,marginTop:8}}>Add to Closet</button>
      </>)}

      {addMode==="url" && (<>
        <label style={labelStyle}>Product URL</label>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <input value={urlInput} onChange={e=>setUrlInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();fetchUrl();}}} placeholder="https://..." style={{...inputStyle,marginBottom:0,flex:1}}/>
          <button onClick={fetchUrl} disabled={fetchingUrl||!urlInput} style={{...chipStyle(false),padding:"4px 14px",flexShrink:0,opacity:fetchingUrl||!urlInput?0.5:1}}>{fetchingUrl?"...":"Go"}</button>
        </div>
        {fetchingUrl && <div style={{textAlign:"center",padding:"12px 0",color:"#b8976a",fontSize:11,letterSpacing:2,textTransform:"uppercase"}}>✦ Reading page...</div>}
        {urlError && <div style={{background:"#2a1a1a",border:"1px solid #6a3a3a",borderRadius:3,padding:"10px 12px",marginBottom:12,fontSize:11,color:"#e07070",lineHeight:1.5}}>{urlError}</div>}
        <FormFields form={addForm} setForm={setAddForm} onImageClick={()=>openFilePicker("add")} onImageDrop={onImageDrop} onRecrop={()=>{setCropTarget("add");setCropSrc(addForm.originalImageData);}} brands={brands} onAddBrand={addBrand} categories={allCategories}/>
        <button onClick={addItem} disabled={!addForm.name} style={{width:"100%",background:addForm.name?"#e8e2d8":"#1a1a1a",color:addForm.name?"#111":"#444",border:"none",borderRadius:3,padding:"14px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:addForm.name?"pointer":"not-allowed",fontWeight:600,marginTop:8}}>Add to Closet</button>
      </>)}

      {addMode==="receipt" && !receiptData && !scanning && (
        <div onClick={()=>receiptFileRef.current.click()} style={{background:"#1a1a1a",border:"1px dashed #333",borderRadius:3,padding:"48px 24px",display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer"}}>
          <div style={{fontSize:36,marginBottom:12}}>🧾</div>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#666"}}>Upload Receipt</div>
          <div style={{fontSize:11,color:"#444",marginTop:6,textAlign:"center"}}>Photo or screenshot of any receipt or order confirmation</div>
        </div>
      )}
      {scanning && <div style={{textAlign:"center",padding:"60px 24px",color:"#666"}}><div style={{fontSize:36,marginBottom:16}}>🧾</div><div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase"}}>Reading receipt...</div></div>}
      {receiptData && receiptData.length===0 && (<div style={{textAlign:"center",padding:"40px 0",color:"#666"}}><div style={{marginBottom:12}}>No items found. Try again.</div><button onClick={()=>setReceiptData(null)} style={chipStyle(false)}>Try Again</button></div>)}
      {receiptData && receiptData.length>0 && (<>
        <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#b8976a",marginBottom:6}}>{receiptData.length} item{receiptData.length!==1?"s":""} found</div>
        {receiptDate && <div style={{fontSize:11,color:"#888",marginBottom:14}}>Purchase date: {receiptDate}</div>}
        {receiptData.map(item=>(
          <div key={item.tempId} style={{background:"#1a1a1a",border:"1px solid #222",borderRadius:3,padding:14,marginBottom:12}}>
            <div style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start"}}>
              <div onClick={()=>openFilePicker(item.tempId)} style={{width:52,height:68,background:"#111",border:"1px dashed #333",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,overflow:"hidden"}}>
                {receiptImages[item.tempId]?<img src={receiptImages[item.tempId]} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{fontSize:20,color:"#333"}}>+</div>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <input value={item.name} onChange={e=>updateRI(item.tempId,"name",e.target.value)} style={{...inputStyle,padding:"8px 10px",fontSize:11,marginBottom:6}}/>
                <input value={item.brand||""} onChange={e=>updateRI(item.tempId,"brand",e.target.value)} placeholder="Brand" style={{...inputStyle,padding:"8px 10px",fontSize:11,marginBottom:6}}/>
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>{allCategories.map(c=><button key={c} type="button" onClick={()=>updateRI(item.tempId,"category",c)} style={{...chipStyle(item.category===c),padding:"3px 8px",fontSize:9}}>{c}</button>)}</div>
                <input value={item.price||""} onChange={e=>updateRI(item.tempId,"price",e.target.value)} placeholder="$ Price" style={{...inputStyle,padding:"8px 10px",fontSize:11,marginBottom:0}}/>
              </div>
              <button onClick={()=>setReceiptData(prev=>prev.filter(i=>i.tempId!==item.tempId))} style={{...ghostBtn,fontSize:18,color:"#444",flexShrink:0}}>×</button>
            </div>
            <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:"#555",marginBottom:6}}>Color</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10}}>{COLORS.map(c=><button key={c} onClick={()=>updateRI(item.tempId,"color",item.color===c?"":c)} style={{...chipStyle(item.color===c),padding:"3px 8px",fontSize:9}}>{c}</button>)}</div>
            <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:"#555",marginBottom:6}}>Tags</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{Object.values(PRESET_TAGS).flat().map(t=><button key={t} onClick={()=>toggleRITag(item.tempId,t)} style={{...chipStyle((item.tags||[]).includes(t)),padding:"3px 8px",fontSize:9}}>{t}</button>)}</div>
          </div>
        ))}
        <button onClick={addReceiptItems} style={{width:"100%",background:"#e8e2d8",color:"#111",border:"none",borderRadius:3,padding:"14px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontWeight:600}}>Add {receiptData.length} Item{receiptData.length!==1?"s":""} to Closet</button>
        <button onClick={()=>{setReceiptData(null);setReceiptDate("");setReceiptImages({});}} style={{width:"100%",background:"transparent",border:"1px solid #222",color:"#555",borderRadius:3,padding:"11px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",marginTop:8}}>Scan Different Receipt</button>
      </>)}

      <input ref={receiptFileRef} type="file" accept="image/*" onChange={scanReceipt} style={{display:"none"}}/>
    </div>
  );
}
