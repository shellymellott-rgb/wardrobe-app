import { useState } from "react";
import { COLORS, SEASONS, SLEEVE_LENGTHS, LENGTHS, MATERIALS, PRESET_TAGS } from "../constants.js";
import { chipStyle, inputStyle, labelStyle, ghostBtn } from "../styles.js";

export default function FormFields({ form, setForm, onImageClick, onImageDrop, onRecrop, brands = [], onAddBrand, categories }) {
  const showSleeve = ["Tops","Dresses"].includes(form.category);
  const showLength = ["Bottoms","Dresses"].includes(form.category);
  const [dragOver, setDragOver] = useState(false);

  function handleDragOver(e) { e.preventDefault(); e.stopPropagation(); setDragOver(true); }
  function handleDragLeave(e) { e.stopPropagation(); setDragOver(false); }
  function handleDrop(e) {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith("image/") && onImageDrop) onImageDrop(file);
  }

  function toggleTag(tag) {
    setForm(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }));
  }
  function addCustomTag() {
    if (!form.customTag?.trim()) return;
    const tag = form.customTag.trim();
    if (!form.tags.includes(tag)) setForm(f => ({ ...f, tags: [...f.tags, tag], customTag: "" }));
    else setForm(f => ({ ...f, customTag: "" }));
  }

  const mats = Array.isArray(form.materials) ? form.materials : (form.material ? [form.material] : []);

  return (
    <div>
      <div
        onClick={onImageClick}
        onDragOver={handleDragOver} onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave} onDrop={handleDrop}
        style={{
          aspectRatio:"3/4",background:"#1a1a1a",
          border: dragOver ? "2px solid #b8976a" : "1px dashed #333",
          borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",
          cursor:"pointer",marginBottom:16,overflow:"hidden",
          transition:"border-color 0.15s",
          boxSizing:"border-box",
        }}
      >
        {form.imageData
          ? <img src={form.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          : <div style={{textAlign:"center",color: dragOver ? "#b8976a" : "#444",pointerEvents:"none"}}>
              <div style={{fontSize:28,marginBottom:8}}>{dragOver ? "↓" : "+"}</div>
              <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase"}}>
                {dragOver ? "Drop to upload" : "Upload & Crop Photo"}
              </div>
              <div style={{fontSize:9,color:"#555",marginTop:4}}>or drag & drop</div>
            </div>
        }
      </div>
      {form.imageData && <button onClick={form.originalImageData && onRecrop ? onRecrop : onImageClick} style={{...ghostBtn,color:"#666",fontSize:10,letterSpacing:1,marginBottom:12,display:"block"}}>↺ Change / Recrop</button>}

      <label style={labelStyle}>Name *</label>
      <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Black Wide-Leg Trousers" style={inputStyle}/>

      <label style={labelStyle}>Brand</label>
      {brands.length > 0 && <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>{brands.map(b=><button key={b} onClick={()=>setForm(f=>({...f,brand:f.brand===b?"":b}))} style={{...chipStyle(form.brand===b),fontSize:10}}>{b}</button>)}</div>}
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <input value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} placeholder={brands.length>0?"Or type new brand...":"e.g. Everlane, Madewell"} style={{...inputStyle,marginBottom:0,flex:1}} onKeyDown={e=>{if(e.key==="Enter"&&form.brand.trim()&&onAddBrand)onAddBrand(form.brand.trim())}}/>
        {form.brand && !brands.includes(form.brand) && onAddBrand && <button onClick={()=>onAddBrand(form.brand.trim())} style={{...chipStyle(false),padding:"4px 12px",flexShrink:0}}>Save</button>}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,marginBottom:5}}><label style={{...labelStyle,marginTop:0,marginBottom:0}}>Category</label></div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>{categories.map(c=><button key={c} type="button" onClick={()=>setForm(f=>({...f,category:c}))} style={chipStyle(form.category===c)}>{c}</button>)}</div>

      <label style={labelStyle}>Color</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>{COLORS.map(c=><button key={c} onClick={()=>setForm(f=>({...f,color:f.color===c?"":c}))} style={chipStyle(form.color===c)}>{c}</button>)}</div>
      {form.color==="Other" && <input value={form.customColor} onChange={e=>setForm(f=>({...f,customColor:e.target.value}))} placeholder="Enter color" style={inputStyle}/>}

      <label style={labelStyle}>Material (select all that apply)</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
        {MATERIALS.filter(m=>m!=="Other").map(m=>(
          <button key={m} onClick={()=>setForm(f=>{const cur=Array.isArray(f.materials)?f.materials:[];return{...f,materials:cur.includes(m)?cur.filter(x=>x!==m):[...cur,m]};})} style={chipStyle(mats.includes(m))}>{m}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <input value={form.customMaterial||""} onChange={e=>setForm(f=>({...f,customMaterial:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"&&form.customMaterial?.trim()){const v=form.customMaterial.trim();setForm(f=>{const cur=Array.isArray(f.materials)?f.materials:[];return{...f,materials:cur.includes(v)?cur:[...cur,v],customMaterial:""};});}}} placeholder="Custom (e.g. Spandex, Modal)..." style={{...inputStyle,marginBottom:0,flex:1}}/>
        <button onClick={()=>{const v=form.customMaterial?.trim();if(!v)return;setForm(f=>{const cur=Array.isArray(f.materials)?f.materials:[];return{...f,materials:cur.includes(v)?cur:[...cur,v],customMaterial:""};});}} style={{...chipStyle(false),padding:"4px 14px"}}>+</button>
      </div>
      {mats.filter(m=>!MATERIALS.filter(x=>x!=="Other").includes(m)).length>0 && (
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
          {mats.filter(m=>!MATERIALS.filter(x=>x!=="Other").includes(m)).map(m=>(
            <span key={m} style={{...chipStyle(true),display:"inline-flex",alignItems:"center",gap:4}}>{m}<span onClick={()=>setForm(f=>({...f,materials:(f.materials||[]).filter(x=>x!==m)}))} style={{cursor:"pointer",opacity:0.7}}>×</span></span>
          ))}
        </div>
      )}

      <label style={labelStyle}>Season</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>{SEASONS.map(s=><button key={s} onClick={()=>setForm(f=>({...f,season:s}))} style={chipStyle(form.season===s)}>{s}</button>)}</div>

      {showSleeve && <><label style={labelStyle}>Sleeve Length</label><div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>{SLEEVE_LENGTHS.map(s=><button key={s} onClick={()=>setForm(f=>({...f,sleeveLength:s}))} style={chipStyle(form.sleeveLength===s)}>{s}</button>)}</div></>}
      {showLength && <><label style={labelStyle}>Length</label><div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>{LENGTHS.map(l=><button key={l} onClick={()=>setForm(f=>({...f,length:l}))} style={chipStyle(form.length===l)}>{l}</button>)}</div></>}

      <label style={labelStyle}>Tags</label>
      {Object.entries(PRESET_TAGS).map(([group,tags])=>(
        <div key={group} style={{marginBottom:8}}>
          <div style={{fontSize:9,color:"#444",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{group}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{tags.map(t=><button key={t} onClick={()=>toggleTag(t)} style={chipStyle(form.tags.includes(t))}>{t}</button>)}</div>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:4}}>
        <input value={form.customTag||""} onChange={e=>setForm(f=>({...f,customTag:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addCustomTag()} placeholder="Custom tag..." style={{...inputStyle,marginBottom:0,flex:1}}/>
        <button onClick={addCustomTag} style={{...chipStyle(false),padding:"4px 14px"}}>+</button>
      </div>
      {form.tags.filter(t=>!Object.values(PRESET_TAGS).flat().includes(t)).length>0 && (
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
          {form.tags.filter(t=>!Object.values(PRESET_TAGS).flat().includes(t)).map(t=>(
            <span key={t} style={{...chipStyle(true),display:"inline-flex",alignItems:"center",gap:4}}>{t}<span onClick={()=>setForm(f=>({...f,tags:f.tags.filter(x=>x!==t)}))} style={{cursor:"pointer",opacity:0.7}}>×</span></span>
          ))}
        </div>
      )}

      <div style={{marginTop:10}}>
        <label style={labelStyle}>Date Purchased</label>
        <input type="date" value={form.datePurchased} onChange={e=>setForm(f=>({...f,datePurchased:e.target.value}))} style={inputStyle}/>
        <label style={labelStyle}>Price ($)</label>
        <input type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} placeholder="0.00" style={inputStyle}/>
      </div>

      <label style={labelStyle}>Comments</label>
      <textarea value={form.comments} onChange={e=>setForm(f=>({...f,comments:e.target.value}))} placeholder="Fit notes, styling ideas, where to wear..." style={{...inputStyle,height:80,resize:"none"}}/>
    </div>
  );
}
