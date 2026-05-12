import { useState, useRef } from "react";
import { CATEGORIES, DEFAULT_STYLE_SYSTEM } from "../constants.js";
import { chipStyle, inputStyle, labelStyle, ghostBtn } from "../styles.js";
import { compressImage } from "../utils/imageUtils.js";
import { parseJsonObject } from "../utils/parseJson.js";

export default function SettingsModal({
  onClose,
  customCategories, addCustomCategory, removeCustomCategory,
  styleProfile, setStyleProfile, saveSettings,
  extraInstructions, setExtraInstructions,
  styleNotes, removeStyleNote, clearStyleNotes,
  weatherEnabled, setWeatherEnabled, homeCity, setHomeCity,
  exportWardrobe, onImport,
  user, signOut,
  wardrobeProfile, upsertProfile,
}) {
  const [newCatInput, setNewCatInput] = useState("");
  const [colorLoading, setColorLoading] = useState(false);
  const [bodyLoading, setBodyLoading] = useState(false);
  const colorPhotoRef = useRef();
  const bodyPhotoRef = useRef();

  async function analyzeColor(e) {
    const file = e.target.files[0]; e.target.value = "";
    if (!file || !user?.id) return;
    setColorLoading(true);
    try {
      const dataUrl = await new Promise(res => { const r = new FileReader(); r.onload = ev => res(ev.target.result); r.readAsDataURL(file); });
      const compressed = await compressImage(dataUrl, 400, 0.5);
      const base64 = compressed.split(",")[1];
      const resp = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-latest", max_tokens: 400,
          system: "You are a color analysis expert. Analyze the face photo and return ONLY a JSON object with these exact fields: color_season (one of: Spring, Summer, Autumn, Winter), color_undertone (warm/cool/neutral), best_colors (array of 6-8 color names that flatter this person), avoid_colors (array of 3-4 colors to avoid). No markdown, no explanation.",
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
            { type: "text", text: "Analyze this person's coloring." },
          ]}],
        }),
      });
      const data = await resp.json();
      const parsed = parseJsonObject(data.content?.[0]?.text || "");
      if (parsed?.color_season) await upsertProfile(user.id, parsed);
    } catch (err) { console.error("[analyzeColor]", err.message); }
    setColorLoading(false);
  }

  async function analyzeBody(e) {
    const file = e.target.files[0]; e.target.value = "";
    if (!file || !user?.id) return;
    setBodyLoading(true);
    try {
      const dataUrl = await new Promise(res => { const r = new FileReader(); r.onload = ev => res(ev.target.result); r.readAsDataURL(file); });
      const compressed = await compressImage(dataUrl, 400, 0.5);
      const base64 = compressed.split(",")[1];
      const resp = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-latest", max_tokens: 500,
          system: "You are a fashion and body type expert. Analyze the body photo and return ONLY a JSON object: body_type (one of: hourglass, pear, apple, rectangle, inverted triangle), flattering_silhouettes (array of 4-6 silhouette descriptions), flattering_necklines (array of 3-4 neckline types), flattering_lengths (array of 3-4 hem/length descriptions), avoid_silhouettes (array of 2-3 things to avoid). No markdown, no explanation.",
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
            { type: "text", text: "Analyze this person's body type." },
          ]}],
        }),
      });
      const data = await resp.json();
      const parsed = parseJsonObject(data.content?.[0]?.text || "");
      if (parsed?.body_type) await upsertProfile(user.id, parsed);
    } catch (err) { console.error("[analyzeBody]", err.message); }
    setBodyLoading(false);
  }

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

        {/* E. Color & Body Analysis */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#888",marginBottom:14}}>Color & Body Analysis</div>

          {/* Color Analysis */}
          <div style={{background:"#161616",border:"1px solid #2a2a2a",borderRadius:4,padding:16,marginBottom:12}}>
            <div style={{fontSize:12,color:"#e8e2d8",marginBottom:4}}>Color Analysis</div>
            <div style={{fontSize:10,color:"#555",marginBottom:12,lineHeight:1.5}}>Upload a clear face photo to determine your color season, undertone, and best colors.</div>
            {wardrobeProfile?.color_season && (
              <div style={{marginBottom:12}}>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                  <span style={{display:"inline-block",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:20,padding:"4px 10px",fontSize:10,color:"#b8976a"}}>
                    {wardrobeProfile.color_season} · {wardrobeProfile.color_undertone}
                  </span>
                </div>
                {wardrobeProfile.best_colors?.length > 0 && (
                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:9,letterSpacing:1,textTransform:"uppercase",color:"#555",marginBottom:4}}>Best colors</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {wardrobeProfile.best_colors.map((c,i) => (
                        <span key={i} style={{display:"inline-block",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:20,padding:"3px 9px",fontSize:10,color:"#c8c0b0"}}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}
                {wardrobeProfile.avoid_colors?.length > 0 && (
                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:9,letterSpacing:1,textTransform:"uppercase",color:"#555",marginBottom:4}}>Avoid</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {wardrobeProfile.avoid_colors.map((c,i) => (
                        <span key={i} style={{display:"inline-block",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:20,padding:"3px 9px",fontSize:10,color:"#666"}}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <input ref={colorPhotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={analyzeColor} />
            <button onClick={()=>colorPhotoRef.current?.click()} disabled={colorLoading}
              style={{background:"transparent",border:"1px solid #2a2a2a",color:colorLoading?"#444":"#888",borderRadius:3,padding:"8px 14px",fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:colorLoading?"not-allowed":"pointer",display:"block",marginBottom:6}}>
              {colorLoading ? "Analyzing…" : wardrobeProfile?.color_season ? "Re-analyze face photo" : "Analyze face photo"}
            </button>
            <div style={{fontSize:9,color:"#444",lineHeight:1.4}}>Photo is analyzed and immediately discarded — never stored</div>
          </div>

          {/* Body Analysis */}
          <div style={{background:"#161616",border:"1px solid #2a2a2a",borderRadius:4,padding:16}}>
            <div style={{fontSize:12,color:"#e8e2d8",marginBottom:4}}>Body Analysis</div>
            <div style={{fontSize:10,color:"#555",marginBottom:12,lineHeight:1.5}}>Upload a full-length photo to get personalized silhouette, neckline, and hem recommendations.</div>
            {wardrobeProfile?.body_type && (
              <div style={{marginBottom:12}}>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                  <span style={{display:"inline-block",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:20,padding:"4px 10px",fontSize:10,color:"#b8976a",textTransform:"capitalize"}}>
                    {wardrobeProfile.body_type}
                  </span>
                </div>
                {wardrobeProfile.flattering_silhouettes?.length > 0 && (
                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:9,letterSpacing:1,textTransform:"uppercase",color:"#555",marginBottom:4}}>Silhouettes</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {wardrobeProfile.flattering_silhouettes.map((s,i) => (
                        <span key={i} style={{display:"inline-block",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:20,padding:"3px 9px",fontSize:10,color:"#c8c0b0"}}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {wardrobeProfile.flattering_necklines?.length > 0 && (
                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:9,letterSpacing:1,textTransform:"uppercase",color:"#555",marginBottom:4}}>Necklines</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {wardrobeProfile.flattering_necklines.map((n,i) => (
                        <span key={i} style={{display:"inline-block",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:20,padding:"3px 9px",fontSize:10,color:"#c8c0b0"}}>{n}</span>
                      ))}
                    </div>
                  </div>
                )}
                {wardrobeProfile.avoid_silhouettes?.length > 0 && (
                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:9,letterSpacing:1,textTransform:"uppercase",color:"#555",marginBottom:4}}>Avoid</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {wardrobeProfile.avoid_silhouettes.map((s,i) => (
                        <span key={i} style={{display:"inline-block",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:20,padding:"3px 9px",fontSize:10,color:"#666"}}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <input ref={bodyPhotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={analyzeBody} />
            <button onClick={()=>bodyPhotoRef.current?.click()} disabled={bodyLoading}
              style={{background:"transparent",border:"1px solid #2a2a2a",color:bodyLoading?"#444":"#888",borderRadius:3,padding:"8px 14px",fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:bodyLoading?"not-allowed":"pointer",display:"block",marginBottom:6}}>
              {bodyLoading ? "Analyzing…" : wardrobeProfile?.body_type ? "Re-analyze body photo" : "Analyze body photo"}
            </button>
            <div style={{fontSize:9,color:"#444",lineHeight:1.4}}>Photo is analyzed and immediately discarded — never stored</div>
          </div>
        </div>

        {/* F. Weather */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#888",marginBottom:10}}>Weather-Based Outfits</div>
          <div style={{background:"#161616",border:"1px solid #2a2a2a",borderRadius:4,padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:weatherEnabled?14:0}}>
              <div>
                <div style={{fontSize:12,color:"#e8e2d8",marginBottom:2}}>Daily outfit by weather</div>
                <div style={{fontSize:10,color:"#555"}}>Shows "What should I wear today?" on the home screen</div>
              </div>
              <button
                onClick={()=>{
                  const next = !weatherEnabled;
                  setWeatherEnabled(next);
                  try{localStorage.setItem("wardrobe-weather-enabled",String(next));}catch{}
                  saveSettings({weatherEnabled:next});
                }}
                style={{
                  background:weatherEnabled?"#e8e2d8":"transparent",
                  color:weatherEnabled?"#111":"#555",
                  border:`1px solid ${weatherEnabled?"#e8e2d8":"#333"}`,
                  borderRadius:20,padding:"5px 14px",fontSize:10,letterSpacing:1,
                  textTransform:"uppercase",cursor:"pointer",flexShrink:0,marginLeft:12,
                }}
              >{weatherEnabled?"On":"Off"}</button>
            </div>
            {weatherEnabled && (
              <>
                <div style={{fontSize:10,color:"#666",marginBottom:6}}>Home city — leave blank to use device location</div>
                <input
                  value={homeCity}
                  onChange={e=>{setHomeCity(e.target.value);try{localStorage.setItem("wardrobe-home-city",e.target.value);}catch{}}}
                  onBlur={e=>saveSettings({homeCity:e.target.value})}
                  placeholder="e.g. Miami, New York, Chicago"
                  style={{...inputStyle,marginBottom:0}}
                />
              </>
            )}
          </div>
        </div>

        {/* F. Account */}
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
