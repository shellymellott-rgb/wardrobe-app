import { useState } from "react";
import { chipStyle, inputStyle, labelStyle, ghostBtn } from "../styles.js";
import { callClaude } from "../utils/callClaude.js";
import { parseJsonObject } from "../utils/parseJson.js";
import { URL_PROMPT } from "../constants.js";

const WISH_TAGS = ["Need", "Maybe", "Saved"];
const TAG_COLORS = { Need:"#c86010", Maybe:"#555", Saved:"#3a7a4a" };
const TAG_BG = { Need:"rgba(200,96,16,0.12)", Maybe:"rgba(80,80,80,0.12)", Saved:"rgba(58,122,74,0.12)" };

export default function WishlistView({ wishlist, persistWishlist }) {
  const [wishForm, setWishForm] = useState({ type:"general", tag:"Saved", note:"", url:"", targetPrice:"", name:"", brand:"" });
  const [addingWish, setAddingWish] = useState(false);
  const [fetchingWishUrl, setFetchingWishUrl] = useState(false);

  async function fetchWishUrl() {
    if (!wishForm.url.trim()) return;
    setFetchingWishUrl(true);
    try {
      const pageRes = await fetch("/api/claude", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ fetchUrl:wishForm.url.trim() }) });
      const pageData = await pageRes.json();
      const text = await callClaude(URL_PROMPT, [{ type:"text", text:`Extract product details from this page content:\n\n${pageData.pageText||"URL: "+wishForm.url}` }], 400);
      const parsed = parseJsonObject(text);
      setWishForm(f => ({ ...f, name:parsed.name||f.name, brand:parsed.brand||f.brand, note:pageData.price||parsed.price||f.note }));
    } catch {}
    setFetchingWishUrl(false);
  }

  function addWishItem() {
    if (!wishForm.note && !wishForm.url && !wishForm.name) return;
    const item = {
      id:Date.now()+Math.random(), type:wishForm.type, tag:wishForm.tag||"Saved",
      note:wishForm.note, url:wishForm.url,
      targetPrice:wishForm.targetPrice?parseFloat(wishForm.targetPrice):null,
      name:wishForm.name, brand:wishForm.brand, addedAt:new Date().toISOString(),
    };
    persistWishlist([...wishlist, item]);
    setWishForm({ type:"general", tag:"Saved", note:"", url:"", targetPrice:"", name:"", brand:"" });
    setAddingWish(false);
  }

  function updateTag(id, tag) {
    persistWishlist(wishlist.map(w => w.id===id ? {...w, tag} : w));
  }

  // Group by tag for display
  const grouped = { Need:[], Maybe:[], Saved:[], untagged:[] };
  wishlist.forEach(w => {
    const t = w.tag || "Saved";
    if (grouped[t]) grouped[t].push(w);
    else grouped.Saved.push(w);
  });
  const orderedItems = [...grouped.Need, ...grouped.Saved, ...grouped.Maybe];

  return (
    <div style={{padding:"24px 24px 100px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:20,fontStyle:"italic",color:"#e8e2d8"}}>Wishlist</div>
        <button onClick={()=>setAddingWish(true)} style={{background:"#e8e2d8",color:"#111",border:"none",borderRadius:20,padding:"7px 16px",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",fontWeight:600}}>
          + Add
        </button>
      </div>

      {/* Tag summary */}
      {wishlist.length > 0 && (
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {WISH_TAGS.map(tag => {
            const count = wishlist.filter(w=>(w.tag||"Saved")===tag).length;
            if (!count) return null;
            return (
              <div key={tag} style={{background:TAG_BG[tag],border:`1px solid ${TAG_COLORS[tag]}33`,borderRadius:20,padding:"4px 12px",display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:10,color:TAG_COLORS[tag]}}>{tag}</span>
                <span style={{fontSize:9,color:TAG_COLORS[tag],opacity:0.7}}>{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
      {addingWish && (
        <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:10,padding:18,marginBottom:20}}>
          {/* Type */}
          <div style={{display:"flex",gap:6,marginBottom:14}}>
            <button onClick={()=>setWishForm(f=>({...f,type:"general"}))}  style={{...chipStyle(wishForm.type==="general"),fontSize:10}}>General</button>
            <button onClick={()=>setWishForm(f=>({...f,type:"specific"}))} style={{...chipStyle(wishForm.type==="specific"),fontSize:10}}>Specific Item</button>
          </div>

          {wishForm.type==="general" ? (
            <>
              <label style={labelStyle}>What are you looking for?</label>
              <input value={wishForm.note} onChange={e=>setWishForm(f=>({...f,note:e.target.value}))} placeholder="e.g. Navy structured blazer, under $300" style={inputStyle}/>
            </>
          ) : (
            <>
              <label style={labelStyle}>Item Name</label>
              <input value={wishForm.name} onChange={e=>setWishForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Everlane The Way-High Jean" style={inputStyle}/>
              <label style={labelStyle}>Brand</label>
              <input value={wishForm.brand} onChange={e=>setWishForm(f=>({...f,brand:e.target.value}))} placeholder="Brand" style={inputStyle}/>
              <label style={labelStyle}>URL</label>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <input value={wishForm.url} onChange={e=>setWishForm(f=>({...f,url:e.target.value}))} placeholder="https://..." style={{...inputStyle,marginBottom:0,flex:1}}/>
                <button onClick={fetchWishUrl} disabled={fetchingWishUrl||!wishForm.url} style={{...chipStyle(false),padding:"4px 12px",flexShrink:0,opacity:fetchingWishUrl||!wishForm.url?0.5:1}}>
                  {fetchingWishUrl?"...":"Fetch"}
                </button>
              </div>
              <label style={labelStyle}>Current Price ($)</label>
              <input value={wishForm.note} onChange={e=>setWishForm(f=>({...f,note:e.target.value}))} placeholder="Current price" style={inputStyle}/>
              <label style={labelStyle}>Alert me when price drops to ($)</label>
              <input value={wishForm.targetPrice} onChange={e=>setWishForm(f=>({...f,targetPrice:e.target.value}))} placeholder="Target price" style={inputStyle}/>
            </>
          )}

          {/* Tag */}
          <label style={labelStyle}>Tag</label>
          <div style={{display:"flex",gap:6,marginBottom:14}}>
            {WISH_TAGS.map(tag => (
              <button key={tag} onClick={()=>setWishForm(f=>({...f,tag}))} style={{
                ...chipStyle(wishForm.tag===tag),
                padding:"4px 12px",fontSize:10,
                color:wishForm.tag===tag?TAG_COLORS[tag]:undefined,
                borderColor:wishForm.tag===tag?TAG_COLORS[tag]:undefined,
              }}>{tag}</button>
            ))}
          </div>

          <div style={{display:"flex",gap:8}}>
            <button onClick={addWishItem} style={{flex:1,background:"#e8e2d8",color:"#111",border:"none",borderRadius:6,padding:"12px",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontWeight:600}}>Save</button>
            <button onClick={()=>setAddingWish(false)} style={{...chipStyle(false),padding:"12px 16px"}}>Cancel</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {wishlist.length === 0 && !addingWish && (
        <div style={{textAlign:"center",padding:"60px 24px",color:"#444"}}>
          <div style={{fontSize:12,letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>Nothing yet</div>
          <div style={{fontSize:11,color:"#333"}}>Add pieces you want to buy</div>
        </div>
      )}

      {/* Items */}
      {orderedItems.map(item => (
        <div key={item.id} style={{background:"#111",border:"1px solid #1a1a1a",borderRadius:10,padding:16,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:500,color:"#e8e2d8",marginBottom:3,lineHeight:1.3}}>{item.name||item.note}</div>
              {item.brand && <div style={{fontSize:11,color:"#666",marginBottom:3}}>{item.brand}</div>}
              {item.note && item.type==="specific" && <div style={{fontSize:11,color:"#555",marginBottom:3}}>Current: ${item.note}</div>}
              {item.targetPrice && <div style={{fontSize:11,color:"#b8976a"}}>Alert at: ${item.targetPrice}</div>}
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer"
                  style={{fontSize:10,color:"#666",letterSpacing:1,textTransform:"uppercase",textDecoration:"none",display:"inline-block",marginTop:6}}>
                  View item →
                </a>
              )}
            </div>
            <button onClick={()=>persistWishlist(wishlist.filter(w=>w.id!==item.id))} style={{...ghostBtn,color:"#444",fontSize:18,padding:"0 0 0 12px",flexShrink:0}}>×</button>
          </div>
          {/* Tag pills */}
          <div style={{display:"flex",gap:6}}>
            {WISH_TAGS.map(tag => {
              const active = (item.tag||"Saved")===tag;
              return (
                <button key={tag} onClick={()=>updateTag(item.id, tag)} style={{
                  background:active?TAG_BG[tag]:"transparent",
                  border:`1px solid ${active?TAG_COLORS[tag]+"55":"#222"}`,
                  color:active?TAG_COLORS[tag]:"#444",
                  borderRadius:20,padding:"3px 10px",fontSize:9,letterSpacing:1,
                  textTransform:"uppercase",cursor:"pointer",
                }}>{tag}</button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
