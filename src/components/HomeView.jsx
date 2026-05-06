import { useMemo, useState } from "react";
import { chipStyle } from "../styles.js";
import WeatherOutfitCard from "./WeatherOutfitCard.jsx";
import CompositeOutfitCard from "./CompositeOutfitCard.jsx";

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
        background:"transparent",
        border:"none",
        borderBottom:`1px solid ${focused?"#b8976a":"#333"}`,
        borderRadius:0, padding:"10px 0",
        fontSize:15, color:"#e8e2d8",
        outline:"none", fontFamily:"Georgia, serif",
        fontStyle:"italic",
        marginBottom:16, transition:"border-color 0.2s",
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
  const previewItems = items.filter(i=>i.imageData).slice(0, 6);

  return (
    <div style={{paddingBottom:120, fontFamily:"'DM Sans', system-ui, sans-serif", background:"#0d0d0d", minHeight:"100vh"}}>

      {/* ── Hero ─────────────────────────────────────────────── */}
      {previewItems.length > 0 && (
        <div style={{position:"relative", height:260, overflow:"hidden", marginBottom:0}}>
          <div style={{display:"flex", height:"100%", gap:2}}>
            {previewItems.map((item,i) => (
              <div key={i} style={{flex: i===0 ? 2 : 1, overflow:"hidden", position:"relative"}}>
                <img
                  src={item.imageThumb ?? item.imageData}
                  loading="lazy"
                  style={{width:"100%", height:"100%", objectFit:"cover", display:"block"}}
                />
              </div>
            ))}
          </div>
          {/* Gradient overlay */}
          <div style={{
            position:"absolute", inset:0,
            background:"linear-gradient(to bottom, rgba(13,13,13,0.1) 0%, rgba(13,13,13,0.0) 40%, rgba(13,13,13,0.85) 100%)",
          }}/>
          {/* Greeting overlaid on hero */}
          <div style={{position:"absolute", bottom:24, left:24, right:24}}>
            <div style={{fontSize:11, color:"rgba(232,226,216,0.5)", letterSpacing:1, marginBottom:4}}>
              {timeLabel}
            </div>
            <div style={{fontFamily:"Georgia, serif", fontSize:28, fontStyle:"italic",
              letterSpacing:"-0.5px", lineHeight:1.15, color:"#e8e2d8"}}>
              What are we wearing today?
            </div>
          </div>
        </div>
      )}

      {/* Greeting without hero */}
      {previewItems.length === 0 && (
        <div style={{padding:"40px 24px 24px"}}>
          <div style={{fontSize:11, color:"#555", letterSpacing:1, marginBottom:6}}>{timeLabel}</div>
          <div style={{fontFamily:"Georgia, serif", fontSize:32, fontStyle:"italic",
            letterSpacing:"-0.5px", lineHeight:1.15, color:"#e8e2d8"}}>
            What are we wearing today?
          </div>
        </div>
      )}

      {/* ── Weather ──────────────────────────────────────────── */}
      {weatherEnabled && hasEnoughItems && (
        <div style={{padding:"28px 24px 0"}}>
          <div style={{
            display:"flex", justifyContent:"space-between", alignItems:"center",
            marginBottom:12,
          }}>
            <div style={{fontSize:10, color:"#555", letterSpacing:2, textTransform:"uppercase"}}>Today's Weather</div>
          </div>
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

      {/* ── Outfit Generator ─────────────────────────────────── */}
      <div style={{padding:"32px 24px 0"}}>

        {/* Section header */}
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center",
          marginBottom:20,
        }}>
          <div style={{fontSize:10, color:"#555", letterSpacing:2, textTransform:"uppercase"}}>Today's Look</div>
          {outfits.length > 0 && (
            <button onClick={()=>setView("outfits")}
              style={{background:"none",border:"none",color:"#666",fontSize:11,cursor:"pointer",
                fontFamily:"'DM Sans',system-ui,sans-serif",letterSpacing:0.5}}>
              See all →
            </button>
          )}
        </div>

        {/* Not enough items */}
        {!hasEnoughItems && !loadingOutfit && (
          <div style={{borderTop:"1px solid #1e1e1e", paddingTop:24}}>
            <div style={{fontSize:15, fontWeight:500, color:"#e8e2d8", marginBottom:8, lineHeight:1.4}}>
              Start building your style profile
            </div>
            <div style={{fontSize:13, color:"#555", marginBottom:24, lineHeight:1.7}}>
              Add a few pieces to unlock outfit suggestions and your personal AI stylist.
            </div>
            <button onClick={onAddItem} style={{
              background:"#e8e2d8", color:"#111", border:"none",
              borderRadius:2, padding:"14px 28px", fontSize:12, letterSpacing:1,
              cursor:"pointer", fontWeight:600,
              fontFamily:"'DM Sans', system-ui, sans-serif",
            }}>
              Add pieces
            </button>
          </div>
        )}

        {/* Has items, no outfits yet */}
        {hasEnoughItems && outfits.length === 0 && !loadingOutfit && (
          <div style={{borderTop:"1px solid #1e1e1e", paddingTop:24}}>
            <OccasionInput
              value={occasion} onChange={e=>setOccasion(e.target.value)}
              focused={inputFocused}
              onFocus={()=>setInputFocused(true)}
              onBlur={()=>setInputFocused(false)}
            />
            <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:24}}>
              {CHIPS.map(s => (
                <button key={s} onClick={()=>setOccasion(occasion===s?"":s)} style={{
                  background:"transparent",
                  color: occasion===s ? "#e8e2d8" : "#444",
                  border:`1px solid ${occasion===s ? "#e8e2d840" : "#222"}`,
                  borderRadius:20, padding:"5px 14px", fontSize:11,
                  cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif",
                  letterSpacing:0.3,
                }}>
                  {s}
                </button>
              ))}
            </div>
            <button onClick={generateOutfits} style={{
              width:"100%", background:"#e8e2d8", color:"#111", border:"none",
              borderRadius:2, padding:"16px", fontSize:13, letterSpacing:0.5,
              cursor:"pointer", fontWeight:600,
              fontFamily:"'DM Sans', system-ui, sans-serif",
            }}>
              Generate Outfits
            </button>
          </div>
        )}

        {/* Loading */}
        {loadingOutfit && (
          <div style={{padding:"48px 0", textAlign:"center"}}>
            <div style={{fontSize:11, color:"#b8976a", letterSpacing:3, textTransform:"uppercase"}}>Styling...</div>
          </div>
        )}

        {/* Outfit results */}
        {outfits.length > 0 && (
          <>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:2, marginBottom:16}}>
              {outfits.slice(0,2).map((outfit,oi) => {
                const pieces = (outfit.pieces||[])
                  .map(name=>items.find(i=>i.name===name||i.name.toLowerCase()===name.toLowerCase()))
                  .filter(Boolean);
                return (
                  <div key={oi} style={{overflow:"hidden", borderRadius:0}}>
                    <CompositeOutfitCard items={pieces} />
                    <div style={{padding:"12px 4px 4px"}}>
                      <div style={{fontSize:12, fontWeight:600, color:"#e8e2d8", marginBottom:3,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{outfit.name}</div>
                      <div style={{fontSize:11, color:"#555", lineHeight:1.5,
                        display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden"}}>{outfit.why}</div>
                      {outfit.tip && <div style={{fontSize:10, color:"#b8976a", marginTop:4}}>✦ {outfit.tip}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex", gap:12, borderTop:"1px solid #1a1a1a", paddingTop:16}}>
              <button onClick={generateOutfits} style={{
                flex:1, background:"transparent", border:"none", color:"#555",
                fontSize:11, letterSpacing:0.5, cursor:"pointer",
                fontFamily:"'DM Sans', system-ui, sans-serif", textAlign:"left", padding:0,
              }}>
                ↺ Regenerate
              </button>
              <button onClick={()=>setView("outfits")} style={{
                flex:1, background:"transparent", border:"none", color:"#555",
                fontSize:11, letterSpacing:0.5, cursor:"pointer",
                fontFamily:"'DM Sans', system-ui, sans-serif", textAlign:"right", padding:0,
              }}>
                All outfits →
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Never Worn ───────────────────────────────────────── */}
      {underloved.length > 0 && (
        <div style={{marginTop:48}}>
          <div style={{padding:"0 24px", display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:16}}>
            <div style={{fontSize:10, color:"#555", letterSpacing:2, textTransform:"uppercase"}}>
              Unworn
              <span style={{color:"#b8976a", marginLeft:8, fontSize:13, fontWeight:500, letterSpacing:0}}>{underloved.length}</span>
            </div>
            <button onClick={()=>setView("closet")} style={{
              background:"none", border:"none", color:"#555", fontSize:11,
              cursor:"pointer", fontFamily:"'DM Sans',system-ui,sans-serif", letterSpacing:0.5,
            }}>
              View all →
            </button>
          </div>
          <div style={{display:"flex", gap:2, overflowX:"auto", padding:"0 24px 4px", scrollbarWidth:"none"}}>
            {underloved.slice(0,12).map(item => (
              <div key={item.id} style={{flexShrink:0, width:100, cursor:"pointer"}}
                onClick={()=>evaluateItem(item)}>
                <div style={{
                  width:100, height:133, background:"#111",
                  overflow:"hidden", marginBottom:8,
                }}>
                  {item.imageData
                    ? <img src={item.imageThumb ?? item.imageData} loading="lazy"
                        style={{width:"100%", height:"100%", objectFit:"cover"}}/>
                    : <div style={{width:"100%", height:"100%", display:"flex", alignItems:"center",
                        justifyContent:"center", padding:8}}>
                        <div style={{fontSize:9, color:"#333", textAlign:"center", lineHeight:1.3}}>{item.name}</div>
                      </div>
                  }
                </div>
                <div style={{fontSize:10, color:"#888", lineHeight:1.3, overflow:"hidden",
                  textOverflow:"ellipsis", whiteSpace:"nowrap", paddingRight:4}}>{item.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Links ────────────────────────────────────────────── */}
      <div style={{padding:"48px 24px 0"}}>
        <div style={{borderTop:"1px solid #1a1a1a", paddingTop:24, display:"flex", flexDirection:"column", gap:0}}>
          {[
            { label:"Outfit Inspo", body:"Upload a photo, recreate the look", action:()=>setView("outfits") },
            { label:"Ask Stylist",  body:"Chat about your wardrobe",          action:()=>setView("chat") },
          ].map(({label,body,action},i) => (
            <button key={label} onClick={action} style={{
              background:"transparent", border:"none", borderBottom:"1px solid #1a1a1a",
              padding:"18px 0", textAlign:"left", cursor:"pointer", display:"block", width:"100%",
            }}>
              <div style={{
                display:"flex", justifyContent:"space-between", alignItems:"center",
              }}>
                <div>
                  <div style={{fontSize:14, color:"#e8e2d8", fontWeight:400, marginBottom:3,
                    fontFamily:"'DM Sans', system-ui, sans-serif"}}>{label}</div>
                  <div style={{fontSize:11, color:"#444", lineHeight:1.5}}>{body}</div>
                </div>
                <div style={{fontSize:18, color:"#333"}}>→</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Insights ─────────────────────────────────────────── */}
      {insights.length > 0 && (
        <div style={{padding:"40px 24px 0"}}>
          <div style={{fontSize:10, color:"#555", letterSpacing:2, textTransform:"uppercase", marginBottom:16}}>
            Wardrobe snapshot
          </div>
          <div style={{display:"flex", flexDirection:"column", gap:0}}>
            {insights.map((insight,i) => (
              <div key={i} style={{
                padding:"14px 0",
                borderBottom: i < insights.length-1 ? "1px solid #1a1a1a" : "none",
              }}>
                <div style={{fontSize:13, color:"#666", lineHeight:1.6}}>{insight}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
