import { useMemo, useState } from "react";
import { T, ML, chipB } from "../theme.js";
import WeatherOutfitCard from "./WeatherOutfitCard.jsx";

const CHIPS = ["Errands", "Dinner", "Travel", "Boat day", "Work from home", "Date night", "Beach", "Gym"];
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Bold chapter band separating each Home section
function SectionRule({ n, label, color }) {
  return (
    <div style={{ display:"flex", alignItems:"stretch", borderTop:`1px solid ${T.ruleStrong}`, borderBottom:`1px solid ${T.ruleStrong}`, background:T.surface }}>
      <div style={{ width:48, background:color, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:T.mono, fontSize:11, color:"#fff", letterSpacing:".1em", flexShrink:0 }}>
        {String(n).padStart(2,"0")}
      </div>
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px" }}>
        <div style={{ fontFamily:T.mono, fontSize:11, letterSpacing:".24em", color:color, textTransform:"uppercase", padding:"12px 0" }}>{label}</div>
        <div style={{ fontFamily:T.mono, fontSize:9.5, letterSpacing:".22em", color:T.ink3, textTransform:"uppercase" }}>SS '26</div>
      </div>
    </div>
  );
}

export default function HomeView({
  items, underloved,
  outfits, loadingOutfit, generateOutfits, occasion, setOccasion,
  markWorn, evaluateItem, setView, onAddItem,
  weatherEnabled, weatherOutfit, weatherLoading, weatherError,
  weatherOccasion, setWeatherOccasion, weatherSaved,
  getWeatherOutfit, saveWeatherOutfit, resetWeatherOutfit,
}) {
  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()].toUpperCase();
  const monthName = MONTH_NAMES[now.getMonth()].toUpperCase();
  const dayNum = now.getDate();

  const hasEnoughItems = items.length >= 2;
  const stripItems = items.filter(i => i.imageData).slice(0, 4);
  const firstOutfit = outfits[0];
  const firstOutfitPieces = firstOutfit
    ? (firstOutfit.pieces || []).map(name => {
        const q = name.toLowerCase().trim();
        return items.find(i => i.name.toLowerCase() === q) ||
               items.find(i => i.name.toLowerCase().includes(q) || q.includes(i.name.toLowerCase())) ||
               null;
      }).filter(Boolean)
    : [];

  // Hero subtitle: outfit piece count + colors if we have an outfit
  const heroSubtitle = firstOutfit
    ? `${firstOutfitPieces.length} pieces`
    : `${items.length} pieces in your wardrobe`;

  return (
    <div style={{ minHeight:"100vh", paddingBottom:100 }}>

      {/* ── Hero — deep sage ──────────────────────────────── */}
      <div style={{ padding:"56px 28px 48px", background:T.heroSage, position:"relative", color:T.cream }}>
        {/* Date + weather */}
        <div style={{ fontFamily:T.mono, fontSize:10, letterSpacing:".22em", color:"rgba(244,239,226,.7)", textTransform:"uppercase" }}>
          {dayName} · {monthName} {dayNum}
          {weatherOutfit?.weather && (
            <span style={{ background:T.citron, color:T.ink, padding:"2px 8px", marginLeft:8 }}>
              {weatherOutfit.weather.condition?.toUpperCase()} · {weatherOutfit.weather.tempHigh}°/{weatherOutfit.weather.tempLow}°
            </span>
          )}
        </div>
        {/* Headline */}
        <h1 style={{ fontFamily:T.serif, fontSize:64, fontWeight:400, color:T.cream, letterSpacing:"-.03em", lineHeight:0.95, margin:"10px 0 0" }}>
          What are we{" "}
          <em style={{ fontStyle:"italic", color:T.citron }}>wearing</em>{" "}
          today?
        </h1>
        {/* CTA pill */}
        <div style={{ marginTop:28, display:"flex", gap:14, alignItems:"center", fontFamily:T.mono, fontSize:10, letterSpacing:".22em", textTransform:"uppercase" }}>
          <span style={{ background:T.cream, color:T.ink, padding:"8px 14px" }}>↓ Today's pick</span>
          <span style={{ color:"rgba(244,239,226,.7)" }}>{heroSubtitle}</span>
        </div>
      </div>

      {/* ── 4-col image strip — white ─────────────────────── */}
      {stripItems.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(stripItems.length,4)},1fr)`, background:T.surface }}>
          {stripItems.map((item, i) => (
            <div key={item.id} onClick={() => evaluateItem(item)} style={{
              aspectRatio:"3/4", overflow:"hidden", cursor:"pointer",
              borderRight: i < stripItems.length-1 ? `1px solid ${T.rule}` : "none",
            }}>
              <img src={item.imageThumb ?? item.imageData} alt={item.name} loading="lazy"
                style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Section 01: Today's Pick — cream bg ───────────── */}
      <SectionRule n={1} label="Today's Pick" color={T.hot} />
      <div style={{ background:T.paper, borderBottom:`1px solid ${T.rule}` }}>

        {/* Loading */}
        {loadingOutfit && (
          <div style={{ padding:"40px 28px", textAlign:"center" }}>
            <div style={{ ...ML, color:T.ink3, animation:"pulse 1.2s ease-in-out infinite" }}>Styling…</div>
          </div>
        )}

        {/* Not enough items */}
        {!hasEnoughItems && !loadingOutfit && (
          <div style={{ padding:"28px" }}>
            <p style={{ fontFamily:T.serif, fontSize:20, color:T.ink, margin:"0 0 16px", lineHeight:1.3 }}>
              Add a few pieces to unlock outfit suggestions.
            </p>
            <button onClick={onAddItem} style={{
              background:T.cobalt, color:"#fff", border:"none",
              padding:"14px 28px", fontFamily:T.mono, fontSize:10, letterSpacing:".24em",
              textTransform:"uppercase", cursor:"pointer",
            }}>
              + Add Pieces
            </button>
          </div>
        )}

        {/* No outfits yet */}
        {hasEnoughItems && outfits.length === 0 && !loadingOutfit && (
          <div style={{ padding:"28px" }}>
            <p style={{ fontFamily:T.serif, fontStyle:"italic", fontSize:18, color:T.ink3, margin:"0 0 20px", lineHeight:1.4 }}>
              Generate your first look for today.
            </p>
            <button onClick={generateOutfits} style={{
              width:"100%", background:T.cobalt, color:"#fff", border:"none",
              padding:"16px", fontFamily:T.mono, fontSize:11, letterSpacing:".24em",
              textTransform:"uppercase", cursor:"pointer",
            }}>
              Generate Outfits
            </button>
          </div>
        )}

        {/* Outfit result — 2fr/1fr */}
        {firstOutfit && !loadingOutfit && (
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr" }}>
            {/* Left col */}
            <div style={{ padding:28, borderRight:`1px solid ${T.rule}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                <div style={{ ...ML, color:T.ink3 }}>01 — Today's Pick</div>
                <button onClick={generateOutfits} style={{ ...ML, background:"none", border:"none", color:T.ink3, cursor:"pointer", padding:0 }}>
                  {loadingOutfit ? "Styling…" : "↻ Refresh"}
                </button>
              </div>
              <h2 style={{ fontFamily:T.serif, fontSize:30, fontWeight:400, letterSpacing:"-.015em", color:T.ink, margin:"0 0 18px", lineHeight:1.1 }}>
                {firstOutfit.name || "Today's Look"}
              </h2>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"2px 36px", marginBottom:16 }}>
                {firstOutfitPieces.map((item, i) => (
                  <div key={item.id} onClick={() => evaluateItem(item)} style={{
                    display:"flex", gap:12, padding:"8px 0",
                    borderBottom:`1px solid ${T.rule}`, alignItems:"baseline", cursor:"pointer",
                  }}>
                    <div style={{ fontFamily:T.mono, fontSize:10, color:T.ink3, width:18 }}>{String(i+1).padStart(2,"0")}</div>
                    <div style={{ fontFamily:T.sans, fontSize:13, color:T.ink, flex:1 }}>{item.name}</div>
                  </div>
                ))}
              </div>
              {firstOutfit.why && (
                <p style={{ fontFamily:T.serif, fontStyle:"italic", fontSize:18, color:T.ink2, margin:0, lineHeight:1.4 }}>
                  "{firstOutfit.why}"
                </p>
              )}
              {outfits.length > 1 && (
                <button onClick={() => setView("outfits")} style={{ ...ML, background:"none", border:"none", color:T.cobalt, cursor:"pointer", padding:"16px 0 0", display:"block" }}>
                  All outfits →
                </button>
              )}
            </div>
            {/* Right col: stacked thumbnails */}
            <div style={{ display:"flex", flexDirection:"column" }}>
              {firstOutfitPieces.slice(0, 2).map((item, i) => (
                <div key={item.id} style={{ flex:1, overflow:"hidden", borderTop: i > 0 ? `1px solid ${T.rule}` : "none" }}>
                  {item.imageData
                    ? <img src={item.imageThumb ?? item.imageData} alt={item.name} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                    : <div style={{ height:120, background:T.surface }} />
                  }
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Section 02: Dress for what? — white ────────────── */}
      <SectionRule n={2} label="Dress for what?" color={T.cobalt} />
      <div style={{ padding:"20px 28px 24px", background:T.surface, borderBottom:`1px solid ${T.rule}` }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {CHIPS.map(s => (
            <button key={s} onClick={() => setOccasion(occasion === s ? "" : s)} style={chipB(occasion === s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 03: Weather Outfit — cream bg ──────────── */}
      {weatherEnabled && hasEnoughItems && (
        <>
          <SectionRule n={3} label="Weather Outfit" color={T.sage} />
          <div style={{ padding:"20px 0", background:T.paper }}>
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
        </>
      )}

      {/* ── Section 04: Unworn — white ────────────────────── */}
      {underloved.length > 0 && (
        <>
          <SectionRule n={4} label={<span>Unworn <span style={{ color:T.hot, marginLeft:6 }}>{underloved.length}</span></span>} color={T.hot} />
          <div style={{ background:T.surface }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)" }}>
              {underloved.slice(0, 4).map((item, i) => (
                <div key={item.id} onClick={() => evaluateItem(item)} style={{
                  aspectRatio:"3/4", overflow:"hidden", background:T.paper, cursor:"pointer",
                  borderRight: i < 3 ? `1px solid ${T.rule}` : "none",
                }}>
                  {item.imageData
                    ? <img src={item.imageThumb ?? item.imageData} loading="lazy" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                    : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", padding:8 }}>
                        <div style={{ ...ML, color:T.rule, fontSize:8, textAlign:"center" }}>{item.name}</div>
                      </div>
                  }
                </div>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", padding:"12px 28px" }}>
              <button onClick={() => setView("closet")} style={{ ...ML, background:"none", border:"none", color:T.ink3, cursor:"pointer" }}>
                View all →
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Quick links ───────────────────────────────────── */}
      <div style={{ padding:"0 28px", marginTop:28 }}>
        {[
          { label:"Outfit Inspo", body:"Upload a photo, recreate the look", action:() => setView("outfits") },
          { label:"Ask Stylist",  body:"Chat about your wardrobe",          action:() => setView("chat") },
        ].map(({ label, body, action }) => (
          <button key={label} onClick={action} style={{
            display:"block", width:"100%", background:"transparent", border:"none",
            borderBottom:`1px solid ${T.rule}`, padding:"20px 0",
            textAlign:"left", cursor:"pointer",
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontFamily:T.sans, fontSize:13, color:T.ink, fontWeight:500, marginBottom:3 }}>{label}</div>
                <div style={{ fontFamily:T.sans, fontSize:12, color:T.ink3 }}>{body}</div>
              </div>
              <span style={{ color:T.ink3, fontSize:18 }}>→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
