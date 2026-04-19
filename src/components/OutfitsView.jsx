import { useRef, useState } from "react";
import { chipStyle, inputStyle, ghostBtn } from "../styles.js";
import { sbCreateOutfit } from "../supabase.js";

const OCCASION_CHIPS = ["Errands", "Dinner", "Travel", "Boat day", "Work from home", "Date night", "Beach", "Gym"];

export default function OutfitsView({
  items, occasion, setOccasion, outfits, outfitText, loadingOutfit, generateOutfits,
  inspoImage, inspoResult, setInspoResult, setInspoImage, loadingInspo, analyzeInspo,
  underloved, markWorn, user,
}) {
  const inspoRef = useRef();
  const [inspoSaved, setInspoSaved] = useState(false);

  async function saveInspoOutfit() {
    if (!inspoResult || !user?.id) return;
    // Re-run same three-level matching used in the render to find matched items
    const matchedIds = (inspoResult.pieces || []).map(name => {
      const q = name.toLowerCase().trim();
      return (
        items.find(i => i.name.toLowerCase() === q) ||
        items.find(i => i.name.toLowerCase().includes(q) || q.includes(i.name.toLowerCase())) ||
        items.find(i => q.split(/\s+/).filter(w => w.length > 3).some(w => i.name.toLowerCase().includes(w))) ||
        null
      );
    }).filter(Boolean).map(i => String(i.id));

    const id = crypto.randomUUID();
    const name = inspoResult.outfitName || "Inspo Look";
    await sbCreateOutfit({ id, user_id: user.id, name }, matchedIds);
    setInspoSaved(true);
  }

  return (
    <div style={{padding:"24px 24px 100px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>

      {/* Occasion input */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#555",marginBottom:10}}>What are you dressing for?</div>
        <input
          value={occasion}
          onChange={e=>setOccasion(e.target.value)}
          placeholder="Occasion (optional)"
          style={{...inputStyle,marginBottom:10,borderRadius:6}}
        />
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {OCCASION_CHIPS.map(s => (
            <button key={s} onClick={()=>setOccasion(occasion===s?"":s)}
              style={{...chipStyle(occasion===s),padding:"4px 10px",fontSize:9}}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Generate CTA */}
      <button
        onClick={generateOutfits}
        disabled={loadingOutfit || items.length < 2}
        style={{
          width:"100%",
          background:items.length < 2 ? "#141414" : "#e8e2d8",
          color:items.length < 2 ? "#444" : "#111",
          border:"none",borderRadius:6,padding:"16px",
          fontSize:11,letterSpacing:3,textTransform:"uppercase",
          cursor:items.length < 2 ? "not-allowed" : "pointer",
          fontWeight:700,marginBottom:24,
        }}
      >
        {loadingOutfit ? "Styling..." : items.length < 2 ? "Add at least 2 pieces first" : "Generate Outfits"}
      </button>

      {/* Inspo photo — always visible above results */}
      <div style={{marginBottom:28,borderBottom:"1px solid #1a1a1a",paddingBottom:28}}>
        <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#555",marginBottom:12}}>Outfit Inspiration</div>
        <input ref={inspoRef} type="file" accept="image/*" onChange={analyzeInspo} style={{display:"none"}}/>

        {!inspoResult && (
          <div
            onClick={()=>inspoRef.current.click()}
            style={{background:"#111",border:"1px dashed #2a2a2a",borderRadius:8,padding:"20px",display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer"}}
          >
            {inspoImage
              ? <img src={inspoImage} style={{width:"100%",maxHeight:180,objectFit:"cover",borderRadius:6,marginBottom:8}}/>
              : <>
                  <div style={{fontSize:26,marginBottom:8}}>📸</div>
                  <div style={{fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:"#555",marginBottom:4}}>Upload Inspo Photo</div>
                  <div style={{fontSize:10,color:"#333",textAlign:"center"}}>I'll recreate the look from your wardrobe</div>
                </>
            }
          </div>
        )}

        {loadingInspo && (
          <div style={{textAlign:"center",color:"#666",fontSize:11,letterSpacing:2,textTransform:"uppercase",padding:"16px 0"}}>
            Analyzing look...
          </div>
        )}

        {inspoResult && (() => {
          // Three-level match: exact → one contains the other → any significant word overlaps
          function findItem(name) {
            const q = name.toLowerCase().trim();
            return (
              items.find(i => i.name.toLowerCase() === q) ||
              items.find(i => i.name.toLowerCase().includes(q) || q.includes(i.name.toLowerCase())) ||
              items.find(i => q.split(/\s+/).filter(w => w.length > 3).some(w => i.name.toLowerCase().includes(w))) ||
              null
            );
          }
          const allPieces = (inspoResult.pieces||[]).map(name => ({ name, item: findItem(name) }));

          return (
            <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:8,overflow:"hidden"}}>
              <div style={{position:"relative"}}>
                <img src={inspoImage} style={{width:"100%",maxHeight:220,objectFit:"cover",display:"block"}}/>
                <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(0,0,0,0.85))",padding:"24px 16px 14px",display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#e8e2d8"}}>{inspoResult.outfitName}</div>
                  <button
                    onClick={()=>{setInspoResult(null);setInspoImage(null);setInspoSaved(false);}}
                    style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.5)",borderRadius:3,padding:"3px 8px",fontSize:9,letterSpacing:1,cursor:"pointer"}}
                  >New photo</button>
                </div>
              </div>
              {allPieces.length > 0 && (
                <div>
                  <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555",padding:"12px 16px 8px"}}>
                    Recreate with your wardrobe
                  </div>
                  {/* Horizontal scroll row — closet-card style, fixed width per item */}
                  <div style={{display:"flex",gap:8,overflowX:"auto",padding:"0 16px 14px",scrollbarWidth:"none"}}>
                    {allPieces.map(({ name, item }, i) => (
                      <div key={i} style={{flexShrink:0,width:96}}>
                        <div style={{
                          position:"relative",width:96,height:128,
                          background:item?"#141414":"#1a1510",
                          borderRadius:8,overflow:"hidden",
                          border:item?"1px solid #1e1e1e":"1px solid rgba(184,151,106,0.15)",
                        }}>
                          {item?.imageData
                            ? <img src={item.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                            : <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:8,gap:6}}>
                                <div style={{fontSize:18,color:item?"#2a2a2a":"rgba(184,151,106,0.2)"}}>+</div>
                                <div style={{fontSize:8,color:item?"#333":"rgba(184,151,106,0.45)",textAlign:"center",lineHeight:1.4}}>{name}</div>
                              </div>
                          }
                          {/* Gradient name overlay — same as closet grid */}
                          <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(0,0,0,0.82))",padding:"18px 6px 6px"}}>
                            <div style={{fontSize:9,fontWeight:500,color:"#e8e2d8",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {item ? item.name : name}
                            </div>
                            <div style={{fontSize:8,color:item?"#666":"#b8976a",marginTop:1}}>
                              {item ? (item.brand||item.category||"") : "not in closet"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{padding:"14px 16px"}}>
                {inspoResult.why && <div style={{fontSize:11,color:"#777",lineHeight:1.6,marginBottom:8}}>{inspoResult.why}</div>}
                {inspoResult.tip && <div style={{fontSize:10,color:"#b8976a",marginBottom:8}}>✦ {inspoResult.tip}</div>}
                {inspoResult.gaps?.length > 0 && (
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555",marginBottom:6}}>Still need:</div>
                    {inspoResult.gaps.map((g,i) => <div key={i} style={{fontSize:11,color:"#555",marginBottom:3}}>· {g}</div>)}
                  </div>
                )}
                <button
                  onClick={saveInspoOutfit}
                  disabled={inspoSaved}
                  style={{
                    width:"100%", border:"none", borderRadius:6, padding:"11px",
                    fontSize:10, letterSpacing:2, textTransform:"uppercase", cursor:inspoSaved?"default":"pointer",
                    background:inspoSaved?"transparent":"#e8e2d8",
                    color:inspoSaved?"#3a7a4a":"#111",
                    fontWeight:inspoSaved?400:700,
                  }}
                >
                  {inspoSaved ? "✓ Outfit saved" : "Save outfit"}
                </button>
              </div>
            </div>
          );
        })()}

        {inspoResult && (
          <button onClick={()=>inspoRef.current.click()} style={{...ghostBtn,fontSize:10,letterSpacing:1.5,marginTop:8}}>
            📸 Try different photo
          </button>
        )}
      </div>

      {/* Outfit results */}
      {outfits.length > 0 && outfits.map((outfit, oi) => {
        const outfitItems = (outfit.pieces||[])
          .map(name => items.find(i => i.name===name || i.name.toLowerCase()===name.toLowerCase()))
          .filter(Boolean);
        return (
          <div key={oi} style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
            {outfitItems.length > 0 && (
              <div style={{display:"flex",gap:2,padding:2}}>
                {outfitItems.map((item, ii) => (
                  <div key={ii} style={{flex:1,aspectRatio:"3/4",background:"#1a1a1a",overflow:"hidden",borderRadius:5}}>
                    {item.imageData
                      ? <img src={item.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:4}}>
                          <div style={{fontSize:8,color:"#444",textAlign:"center",lineHeight:1.3}}>{item.name}</div>
                        </div>
                    }
                  </div>
                ))}
              </div>
            )}
            <div style={{padding:"12px 16px 14px"}}>
              <div style={{fontSize:13,fontWeight:600,color:"#e8e2d8",marginBottom:4}}>{outfit.name}</div>
              <div style={{fontSize:11,color:"#777",lineHeight:1.5,marginBottom:outfit.tip?8:0}}>{outfit.why}</div>
              {outfit.tip && <div style={{fontSize:10,color:"#b8976a"}}>✦ {outfit.tip}</div>}
            </div>
          </div>
        );
      })}

      {outfitText && (
        <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:8,padding:18,fontSize:13,lineHeight:1.8,color:"#c8c0b0",whiteSpace:"pre-wrap"}}>
          {outfitText}
        </div>
      )}

      {/* Never worn */}
      {underloved.length > 0 && (
        <div style={{marginTop:28}}>
          <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#b8976a",marginBottom:14}}>
            Never worn — {underloved.length} pieces
          </div>
          {underloved.map(item => (
            <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,background:"#111",border:"1px solid rgba(184,151,106,0.15)",borderRadius:6,padding:"10px 12px",marginBottom:8}}>
              {item.imageData && <img src={item.imageData} style={{width:32,height:42,objectFit:"cover",borderRadius:4,flexShrink:0}}/>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name||"Unnamed"}</div>
                <div style={{fontSize:9,color:"#555",letterSpacing:1,textTransform:"uppercase",marginTop:1}}>{item.brand||item.category}</div>
              </div>
              <button onClick={()=>markWorn(item.id)} style={{...chipStyle(false),flexShrink:0,fontSize:9}}>worn</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
