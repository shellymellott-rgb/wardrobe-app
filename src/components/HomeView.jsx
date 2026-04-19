import { useMemo, useState } from "react";
import { chipStyle } from "../styles.js";
import WeatherOutfitCard from "./WeatherOutfitCard.jsx";

// Shared card style — slightly lighter than page (#0d0d0d → #111 → #161616 layering)
const card = {
  background:"#161616",
  border:"1px solid #262626",
  borderRadius:12,
};

// Input with visible contrast and focus support
function OccasionInput({ value, onChange, focused, onFocus, onBlur }) {
  return (
    <input
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder="What are you dressing for?"
      style={{
        width:"100%", boxSizing:"border-box",
        background:"#1a1a1a",
        border:`1px solid ${focused?"#b8976a":"#333"}`,
        borderRadius:8, padding:"11px 14px",
        fontSize:13, color:"#e8e2d8",
        outline:"none", fontFamily:"'DM Sans', system-ui, sans-serif",
        marginBottom:12, transition:"border-color 0.15s",
      }}
    />
  );
}

const CHIPS = ["Errands","Dinner","Travel","Boat day","Work from home"];

export default function HomeView({
  items, underloved,
  outfits, loadingOutfit, generateOutfits, occasion, setOccasion,
  markWorn, evaluateItem, setView, onAddItem,
  weatherEnabled, weatherOutfit, weatherLoading, weatherError,
  weatherOccasion, setWeatherOccasion, weatherSaved,
  getWeatherOutfit, saveWeatherOutfit, resetWeatherOutfit,
}) {
  const [inputFocused, setInputFocused] = useState(false);
  const hour = new Date().getHours();
  const timeLabel = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const insights = useMemo(() => {
    const list = [];
    const ninetyDaysAgo = new Date(Date.now() - 90*24*60*60*1000).toISOString().split("T")[0];
    const unwornValue = underloved.filter(i=>i.price>0).reduce((s,i)=>s+i.price, 0);
    if (underloved.length > 0)
      list.push(unwornValue > 0
        ? `${underloved.length} pieces never worn — $${Math.round(unwornValue)} sitting idle`
        : `${underloved.length} pieces you've never worn`);
    const stale = items.filter(i=>i.wornDates?.length>0 && i.wornDates[i.wornDates.length-1]<ninetyDaysAgo);
    if (stale.length > 0) list.push(`${stale.length} pieces not worn in 3+ months`);
    const catCounts = {};
    items.forEach(i=>{ if(i.category) catCounts[i.category]=(catCounts[i.category]||0)+1; });
    const [top] = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]);
    if (top && top[1] >= 6) list.push(`You own ${top[1]} ${top[0].toLowerCase()} — your largest category`);
    return list.slice(0, 3);
  }, [items, underloved]);

  const hasEnoughItems = items.length >= 2;

  // Preview strip — first 4 items with photos, used as visual anchor
  const previewItems = items.filter(i=>i.imageData).slice(0, 4);

  return (
    <div style={{paddingBottom:100, fontFamily:"'DM Sans', system-ui, sans-serif"}}>

      {/* ── Greeting ─────────────────────────────────────────── */}
      <div style={{padding:"32px 24px 28px"}}>
        <div style={{fontSize:10,color:"#444",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>
          {timeLabel}
        </div>
        <div style={{fontFamily:"Georgia, serif",fontSize:30,fontStyle:"italic",
          letterSpacing:"-0.5px",lineHeight:1.2,color:"#e8e2d8"}}>
          What are we wearing today?
        </div>
      </div>

      {/* ── Weather Outfit ───────────────────────────────────── */}
      {weatherEnabled && hasEnoughItems && (
        <div style={{padding:"0 24px",marginBottom:32}}>
          <div style={{fontSize:9,letterSpacing:2.5,textTransform:"uppercase",color:"#555",marginBottom:14}}>Today's Weather</div>
          <WeatherOutfitCard
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
        </div>
      )}

      {/* ── Outfit of the Day ────────────────────────────────── */}
      <div style={{padding:"0 24px",marginBottom:40}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:9,letterSpacing:2.5,textTransform:"uppercase",color:"#555"}}>Today's Look</div>
          {outfits.length > 0 && (
            <button onClick={()=>setView("outfits")}
              style={{background:"none",border:"none",color:"#888",fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
              See all →
            </button>
          )}
        </div>

        {/* Empty — not enough items */}
        {!hasEnoughItems && !loadingOutfit && (
          <div style={{...card, overflow:"hidden"}}>
            {/* Visual anchor: wardrobe preview or placeholder */}
            {previewItems.length > 0 ? (
              <div style={{display:"flex",height:100,gap:1,padding:2}}>
                {previewItems.map((item,i) => (
                  <div key={i} style={{flex:1,overflow:"hidden",borderRadius:6,background:"#111"}}>
                    <img src={item.imageData} style={{width:"100%",height:"100%",objectFit:"cover",opacity:0.55}}/>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{height:80,background:"linear-gradient(135deg,#1a1510 0%,#161616 100%)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{fontSize:28,opacity:0.3}}>👗</div>
              </div>
            )}
            <div style={{padding:"20px 20px 20px"}}>
              <div style={{fontSize:15,fontWeight:600,color:"#e8e2d8",marginBottom:6,lineHeight:1.3}}>
                Start building your style profile
              </div>
              <div style={{fontSize:12,color:"#777",marginBottom:20,lineHeight:1.6}}>
                Add 3–5 pieces to unlock outfit suggestions, style insights, and your personal AI stylist.
              </div>
              <button
                onClick={onAddItem}
                style={{
                  width:"100%",background:"#e8e2d8",color:"#111",border:"none",
                  borderRadius:8,padding:"14px",fontSize:11,letterSpacing:2.5,
                  textTransform:"uppercase",cursor:"pointer",fontWeight:700,
                }}
              >
                Add Your First Pieces
              </button>
            </div>
          </div>
        )}

        {/* Empty — has items, no outfits generated yet */}
        {hasEnoughItems && outfits.length === 0 && !loadingOutfit && (
          <div style={{...card}}>
            {previewItems.length > 0 && (
              <div style={{display:"flex",height:110,gap:1,padding:2}}>
                {previewItems.map((item,i) => (
                  <div key={i} style={{flex:1,overflow:"hidden",borderRadius:6,background:"#111"}}>
                    <img src={item.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  </div>
                ))}
              </div>
            )}
            <div style={{padding:"18px 20px 20px"}}>
              <OccasionInput
                value={occasion} onChange={e=>setOccasion(e.target.value)}
                focused={inputFocused}
                onFocus={()=>setInputFocused(true)}
                onBlur={()=>setInputFocused(false)}
              />
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:18}}>
                {CHIPS.map(s => (
                  <button key={s} onClick={()=>setOccasion(occasion===s?"":s)}
                    style={{...chipStyle(occasion===s),padding:"4px 10px",fontSize:9}}>
                    {s}
                  </button>
                ))}
              </div>
              <button
                onClick={generateOutfits}
                style={{
                  width:"100%",background:"#e8e2d8",color:"#111",border:"none",
                  borderRadius:8,padding:"14px",fontSize:11,letterSpacing:2.5,
                  textTransform:"uppercase",cursor:"pointer",fontWeight:700,
                }}
              >
                Generate Outfits
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loadingOutfit && (
          <div style={{...card,padding:40,textAlign:"center"}}>
            <div style={{fontSize:11,color:"#b8976a",letterSpacing:3,textTransform:"uppercase"}}>Styling...</div>
          </div>
        )}

        {/* Outfit cards */}
        {outfits.length > 0 && (
          <>
            {outfits.slice(0,2).map((outfit,oi) => {
              const pieces = (outfit.pieces||[])
                .map(name=>items.find(i=>i.name===name||i.name.toLowerCase()===name.toLowerCase()))
                .filter(Boolean);
              return (
                <div key={oi} style={{...card,marginBottom:12,overflow:"hidden"}}>
                  {pieces.length > 0 && (
                    <div style={{display:"flex",gap:2,padding:2}}>
                      {pieces.map((item,ii) => (
                        <div key={ii} style={{flex:1,aspectRatio:"3/4",background:"#1a1a1a",overflow:"hidden",borderRadius:8}}>
                          {item.imageData
                            ? <img src={item.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                            : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:6}}>
                                <div style={{fontSize:8,color:"#444",textAlign:"center",lineHeight:1.3}}>{item.name}</div>
                              </div>
                          }
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{padding:"14px 16px 16px"}}>
                    <div style={{fontSize:14,fontWeight:600,color:"#e8e2d8",marginBottom:5}}>{outfit.name}</div>
                    <div style={{fontSize:12,color:"#888",lineHeight:1.6,marginBottom:outfit.tip?8:0}}>{outfit.why}</div>
                    {outfit.tip && <div style={{fontSize:11,color:"#b8976a"}}>✦ {outfit.tip}</div>}
                  </div>
                </div>
              );
            })}
            <div style={{display:"flex",gap:8}}>
              <button onClick={generateOutfits}
                style={{flex:1,background:"transparent",border:"1px solid #2a2a2a",color:"#888",borderRadius:8,padding:"11px",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>
                Regenerate
              </button>
              <button onClick={()=>setView("outfits")}
                style={{flex:1,background:"transparent",border:"1px solid #2a2a2a",color:"#888",borderRadius:8,padding:"11px",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>
                All Outfits →
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Never Worn ───────────────────────────────────────── */}
      {underloved.length > 0 && (
        <div style={{marginBottom:40}}>
          <div style={{padding:"0 24px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:9,letterSpacing:2.5,textTransform:"uppercase",color:"#555"}}>
              Never Worn
              <span style={{color:"#b8976a",marginLeft:8,fontSize:11,fontWeight:600,letterSpacing:0}}>{underloved.length}</span>
            </div>
            <button onClick={()=>setView("closet")}
              style={{background:"none",border:"none",color:"#888",fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
              View all →
            </button>
          </div>
          <div style={{display:"flex",gap:10,overflowX:"auto",padding:"0 24px 4px",scrollbarWidth:"none"}}>
            {underloved.slice(0,10).map(item => (
              <div key={item.id} style={{flexShrink:0,width:96,cursor:"pointer"}} onClick={()=>evaluateItem(item)}>
                <div style={{width:96,height:124,background:"#161616",border:"1px solid #222",borderRadius:10,overflow:"hidden",marginBottom:7,position:"relative"}}>
                  {item.imageData
                    ? <img src={item.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:8}}>
                        <div style={{fontSize:9,color:"#444",textAlign:"center",lineHeight:1.3}}>{item.name}</div>
                      </div>
                  }
                  <button
                    onClick={e=>{e.stopPropagation();markWorn(item.id);}}
                    style={{
                      position:"absolute",bottom:5,left:5,right:5,
                      background:"rgba(0,0,0,0.85)",border:"1px solid rgba(255,255,255,0.1)",
                      color:"rgba(232,226,216,0.7)",borderRadius:5,
                      padding:"4px 0",fontSize:8,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",
                    }}
                  >worn</button>
                </div>
                <div style={{fontSize:10,color:"#c8c0b0",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                {item.brand && <div style={{fontSize:9,color:"#555",marginTop:2}}>{item.brand}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Actions ────────────────────────────────────── */}
      <div style={{padding:"0 24px",marginBottom:40}}>
        <div style={{fontSize:9,letterSpacing:2.5,textTransform:"uppercase",color:"#555",marginBottom:14}}>Quick Actions</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[
            { emoji:"📸", title:"Outfit Inspo", body:"Upload a photo, recreate the look", action:()=>setView("outfits") },
            { emoji:"💬", title:"Ask Stylist",  body:"Chat about your wardrobe",          action:()=>setView("chat") },
          ].map(({emoji,title,body,action}) => (
            <button key={title} onClick={action} style={{
              ...card,
              padding:"18px 16px",textAlign:"left",cursor:"pointer",
              border:"1px solid #2a2a2a",
            }}>
              <div style={{fontSize:22,marginBottom:10,lineHeight:1}}>{emoji}</div>
              <div style={{fontSize:13,color:"#e8e2d8",fontWeight:600,marginBottom:4}}>{title}</div>
              <div style={{fontSize:11,color:"#666",lineHeight:1.4}}>{body}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Insights ─────────────────────────────────────────── */}
      {insights.length > 0 && (
        <div style={{padding:"0 24px"}}>
          <div style={{fontSize:9,letterSpacing:2.5,textTransform:"uppercase",color:"#555",marginBottom:14}}>Insights</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {insights.map((insight,i) => (
              <div key={i} style={{...card,padding:"14px 16px",display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#b8976a",flexShrink:0}}/>
                <div style={{fontSize:13,color:"#c8c0b0",lineHeight:1.5}}>{insight}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
