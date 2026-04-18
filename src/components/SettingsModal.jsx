import { useState } from "react";
import { CATEGORIES, DEFAULT_STYLE_SYSTEM } from "../constants.js";
import { chipStyle, inputStyle, labelStyle, ghostBtn } from "../styles.js";

export default function SettingsModal({
  onClose,
  customCategories, addCustomCategory, removeCustomCategory,
  styleProfile, setStyleProfile, saveSettings,
  extraInstructions, setExtraInstructions,
  styleNotes, removeStyleNote, clearStyleNotes,
  exportWardrobe, onImport,
  user, signOut,
}) {
  const [newCatInput, setNewCatInput] = useState("");

  function handleAddCat() {
    if (addCustomCategory(newCatInput)) setNewCatInput("");
  }

  return (
    <div style={{position:"fixed",inset:0,background:"#0d0d0d",zIndex:180,overflowY:"auto",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      <div style={{padding:24,maxWidth:680,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
          <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#666"}}>Settings</div>
          <button onClick={onClose} style={ghostBtn}>✕ Close</button>
        </div>

        {/* A. Custom Categories */}
        <div style={{marginBottom:28,background:"#161616",border:"1px solid #2a2a2a",borderRadius:4,padding:16}}>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#aaa",marginBottom:12}}>Categories</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
            {CATEGORIES.map(c=>(
              <span key={c} style={{display:"inline-flex",alignItems:"center",background:"#111",border:"1px solid #2a2a2a",borderRadius:20,padding:"5px 12px"}}>
                <span style={{fontSize:11,color:"#555"}}>{c}</span>
              </span>
            ))}
            {customCategories.map((c,i)=>(
              <span key={c} style={{display:"inline-flex",alignItems:"center",gap:5,background:"#e8e2d820",border:"1px solid #e8e2d840",borderRadius:20,padding:"5px 10px 5px 12px"}}>
                <span style={{fontSize:11,color:"#e8e2d8"}}>{c}</span>
                <button onClick={()=>removeCustomCategory(i)} style={{background:"none",border:"none",color:"#888",cursor:"pointer",padding:0,fontSize:14,lineHeight:1,display:"flex",alignItems:"center"}}>×</button>
              </span>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={newCatInput} onChange={e=>setNewCatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleAddCat();}} placeholder="Add category: Loungewear, Jumpsuits..." style={{...inputStyle,marginBottom:0,flex:1}}/>
            <button onClick={handleAddCat} disabled={!newCatInput.trim()} style={{background:newCatInput.trim()?"#e8e2d8":"#1a1a1a",color:newCatInput.trim()?"#111":"#444",border:"none",borderRadius:3,padding:"0 16px",fontSize:11,letterSpacing:1,cursor:newCatInput.trim()?"pointer":"not-allowed",fontWeight:600,flexShrink:0}}>Add</button>
          </div>
        </div>

        {/* B. Style Profile */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#888",marginBottom:6}}>Style Profile</div>
          <div style={{fontSize:11,color:"#555",marginBottom:10,lineHeight:1.5}}>Describe your style in your own words. This replaces the default on every Claude call.</div>
          <textarea
            value={styleProfile}
            onChange={e=>{setStyleProfile(e.target.value);try{localStorage.setItem("wardrobe-style-profile",e.target.value);}catch{};}}
            onBlur={e=>saveSettings({styleProfile:e.target.value})}
            style={{...inputStyle,height:130,resize:"vertical",lineHeight:1.6}}
            placeholder={DEFAULT_STYLE_SYSTEM}
          />
          {styleProfile!==DEFAULT_STYLE_SYSTEM && <button onClick={()=>{setStyleProfile(DEFAULT_STYLE_SYSTEM);try{localStorage.setItem("wardrobe-style-profile",DEFAULT_STYLE_SYSTEM);}catch{}saveSettings({styleProfile:DEFAULT_STYLE_SYSTEM});}} style={{...ghostBtn,fontSize:10,color:"#555",letterSpacing:1}}>Reset to default</button>}
        </div>

        {/* C. Extra Instructions */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#888",marginBottom:6}}>Current Instructions</div>
          <div style={{fontSize:11,color:"#555",marginBottom:10,lineHeight:1.5}}>Temporary context appended to every prompt — packing for a trip, trying to shop less, etc.</div>
          <textarea
            value={extraInstructions}
            onChange={e=>{setExtraInstructions(e.target.value);try{localStorage.setItem("wardrobe-extra-instructions",e.target.value);}catch{};}}
            onBlur={e=>saveSettings({extraInstructions:e.target.value})}
            style={{...inputStyle,height:72,resize:"none",lineHeight:1.6}}
            placeholder="e.g. Packing for 10 days in Italy in June. Carry-on only."
          />
        </div>

        {/* D. Style Notes */}
        <div style={{marginBottom:28}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#888"}}>Learned Style Notes</div>
            {styleNotes.length>0 && <button onClick={clearStyleNotes} style={{...ghostBtn,fontSize:10,color:"#555"}}>Clear all</button>}
          </div>
          {styleNotes.length===0
            ? <div style={{fontSize:11,color:"#444",fontStyle:"italic"}}>None yet — auto-saved from your chat conversations.</div>
            : <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {styleNotes.map((n,i)=>(
                  <span key={i} style={{display:"inline-flex",alignItems:"center",gap:5,background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:20,padding:"5px 10px 5px 12px"}}>
                    <span style={{fontSize:11,color:"#c8c0b0"}}>{n}</span>
                    <button onClick={()=>removeStyleNote(i)} style={{background:"none",border:"none",color:"#555",cursor:"pointer",padding:0,fontSize:14,lineHeight:1,display:"flex",alignItems:"center"}}>×</button>
                  </span>
                ))}
              </div>
          }
        </div>

        {/* E. Account */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#888",marginBottom:14}}>Account</div>
          <div style={{background:"#161616",border:"1px solid #2a2a2a",borderRadius:4,padding:16}}>
            <div style={{fontSize:11,color:"#666",marginBottom:12}}>Signed in as <span style={{color:"#c8c0b0"}}>{user.email}</span></div>
            <div style={{fontSize:11,color:"#444",marginBottom:14}}>Your wardrobe syncs automatically across all devices when signed in with the same Google account.</div>
            <button onClick={signOut} style={{background:"transparent",border:"1px solid #3a2020",color:"#8a4a4a",borderRadius:3,padding:"10px 20px",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>Sign Out</button>
          </div>
        </div>

        {/* F. Data */}
        <div>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#888",marginBottom:12}}>Data</div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={exportWardrobe} style={{...chipStyle(false),fontSize:10}}>↓ Export JSON</button>
            <button onClick={onImport} style={{...chipStyle(false),fontSize:10}}>↑ Import JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
}
