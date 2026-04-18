import { useState } from "react";
import { chipStyle, inputStyle, labelStyle, ghostBtn } from "../styles.js";
import { callClaude } from "../utils/callClaude.js";
import { parseJsonObject } from "../utils/parseJson.js";
import { URL_PROMPT } from "../constants.js";

export default function WishlistView({ wishlist, persistWishlist }) {
  const [wishForm, setWishForm] = useState({ type:"general", note:"", url:"", targetPrice:"", name:"", brand:"" });
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
      setWishForm(f=>({...f, name:parsed.name||f.name, brand:parsed.brand||f.brand, note:pageData.price||parsed.price||f.note}));
    } catch {}
    setFetchingWishUrl(false);
  }

  function addWishItem() {
    if (!wishForm.note && !wishForm.url) return;
    const item = { id:Date.now()+Math.random(), type:wishForm.type, note:wishForm.note, url:wishForm.url, targetPrice:wishForm.targetPrice?parseFloat(wishForm.targetPrice):null, name:wishForm.name, brand:wishForm.brand, addedAt:new Date().toISOString() };
    persistWishlist([...wishlist, item]);
    setWishForm({ type:"general", note:"", url:"", targetPrice:"", name:"", brand:"" });
    setAddingWish(false);
  }

  return (
    <div style={{padding:24,fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#666"}}>Wishlist</div>
        <button onClick={()=>setAddingWish(true)} style={{...chipStyle(false),fontSize:10}}>+ Add</button>
      </div>

      {addingWish && (
        <div style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:3,padding:16,marginBottom:16}}>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <button onClick={()=>setWishForm(f=>({...f,type:"general"}))} style={chipStyle(wishForm.type==="general")}>General</button>
            <button onClick={()=>setWishForm(f=>({...f,type:"specific"}))} style={chipStyle(wishForm.type==="specific")}>Specific Item</button>
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
                <button onClick={fetchWishUrl} disabled={fetchingWishUrl||!wishForm.url} style={{...chipStyle(false),padding:"4px 12px",flexShrink:0,opacity:fetchingWishUrl||!wishForm.url?0.5:1}}>{fetchingWishUrl?"...":"Fetch"}</button>
              </div>
              <label style={labelStyle}>Current Price ($)</label>
              <input value={wishForm.note} onChange={e=>setWishForm(f=>({...f,note:e.target.value}))} placeholder="Current price" style={inputStyle}/>
              <label style={labelStyle}>Alert me when price drops to ($)</label>
              <input value={wishForm.targetPrice} onChange={e=>setWishForm(f=>({...f,targetPrice:e.target.value}))} placeholder="Target price" style={inputStyle}/>
            </>
          )}
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <button onClick={addWishItem} style={{flex:1,background:"#e8e2d8",color:"#111",border:"none",borderRadius:3,padding:"11px",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontWeight:600}}>Save</button>
            <button onClick={()=>setAddingWish(false)} style={{...chipStyle(false),padding:"11px 16px"}}>Cancel</button>
          </div>
        </div>
      )}

      {wishlist.length===0 && !addingWish && (
        <div style={{textAlign:"center",padding:"60px 24px",color:"#444"}}>
          <div style={{fontSize:12,letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>Nothing yet</div>
          <div style={{fontSize:11,color:"#333"}}>Add items you want to buy</div>
        </div>
      )}

      {wishlist.map(item=>(
        <div key={item.id} style={{background:"#1a1a1a",border:"1px solid #222",borderRadius:3,padding:14,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:item.type==="general"?"#666":"#b8976a",marginBottom:4}}>{item.type==="general"?"General":"Specific"}</div>
              <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>{item.name||item.note}</div>
              {item.brand && <div style={{fontSize:11,color:"#777",marginBottom:4}}>{item.brand}</div>}
              {item.note && item.type==="specific" && <div style={{fontSize:11,color:"#666",marginBottom:4}}>Current: ${item.note}</div>}
              {item.targetPrice && <div style={{fontSize:11,color:"#b8976a"}}>Alert at: ${item.targetPrice}</div>}
              {item.url && <a href={item.url} target="_blank" rel="noreferrer" style={{fontSize:10,color:"#888",letterSpacing:1,textTransform:"uppercase",textDecoration:"none",display:"block",marginTop:6}}>View item →</a>}
            </div>
            <button onClick={()=>persistWishlist(wishlist.filter(w=>w.id!==item.id))} style={{...ghostBtn,color:"#555",fontSize:16,padding:"0 0 0 12px"}}>×</button>
          </div>
        </div>
      ))}
    </div>
  );
}
