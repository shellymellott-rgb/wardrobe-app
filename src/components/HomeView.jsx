import { useMemo, useState } from "react";
import { T, ML, tabStyle, chipB } from "../theme.js";
import WeatherOutfitCard from "./WeatherOutfitCard.jsx";

const CHIPS = ["Errands", "Dinner", "Travel", "Boat day", "Work from home"];
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function HomeView({
  items, underloved,
  outfits, loadingOutfit, generateOutfits, occasion, setOccasion,
  markWorn, evaluateItem, setView, onAddItem,
  weatherEnabled, weatherOutfit, weatherLoading, weatherError,
  weatherOccasion, setWeatherOccasion, weatherSaved,
  getWeatherOutfit, saveWeatherOutfit, resetWeatherOutfit,
}) {
  const [inputFocused, setInputFocused] = useState(false);

  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()].toUpperCase();
  const monthName = MONTH_NAMES[now.getMonth()].toUpperCase();
  const dayNum = now.getDate();

  const insights = useMemo(() => {
    const list = [];
    const ninetyDaysAgo = new Date(Date.now() - 90*24*60*60*1000).toISOString().split("T")[0];
    const unwornValue = underloved.filter(i => i.price > 0).reduce((s, i) => s + i.price, 0);
    if (underloved.length > 0)
      list.push(unwornValue > 0
        ? `${underloved.length} pieces never worn — $${Math.round(unwornValue)} sitting idle`
        : `${underloved.length} pieces you've never worn`);
    const stale = items.filter(i => i.wornDates?.length > 0 && i.wornDates[i.wornDates.length-1] < ninetyDaysAgo);
    if (stale.length > 0) list.push(`${stale.length} pieces not worn in 3+ months`);
    const catCounts = {};
    items.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    const [top] = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    if (top && top[1] >= 6) list.push(`You own ${top[1]} ${top[0].toLowerCase()} — your largest category`);
    return list.slice(0, 3);
  }, [items, underloved]);

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

  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>

      {/* ── Hero ───────────────────────────────────────────── */}
      <div style={{ padding: "56px 28px 28px", borderBottom: `1px solid ${T.rule}` }}>
        {/* Date + weather line */}
        <div style={{ ...ML, color: T.ink3, marginBottom: 14 }}>
          {dayName} · {monthName} {dayNum}
          {weatherOutfit?.weather && (
            <span style={{ color: T.cobalt }}> · {weatherOutfit.weather.condition} · {weatherOutfit.weather.tempHigh}°/{weatherOutfit.weather.tempLow}°</span>
          )}
        </div>
        {/* Headline */}
        <h1 style={{ fontFamily: T.serif, fontSize: 64, fontWeight: 400, letterSpacing: "-.03em", lineHeight: 0.95, color: T.ink, margin: 0 }}>
          What are we{" "}
          <em style={{ fontStyle: "italic", color: T.cobalt }}>wearing</em>{" "}
          today?
        </h1>
      </div>

      {/* ── 4-col image strip ──────────────────────────────── */}
      {stripItems.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(stripItems.length, 4)},1fr)`, borderBottom: `1px solid ${T.rule}` }}>
          {stripItems.map((item, i) => (
            <div key={item.id} onClick={() => evaluateItem(item)} style={{
              position: "relative", cursor: "pointer", overflow: "hidden",
              borderRight: i < stripItems.length - 1 ? `1px solid ${T.rule}` : "none",
            }}>
              <img src={item.imageThumb ?? item.imageData} alt={item.name} loading="lazy"
                style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Today's Pick / Generator ────────────────────────── */}
      <div style={{ padding: "0 28px", borderBottom: `1px solid ${T.rule}` }}>

        {/* Section label */}
        <div style={{ padding: "20px 0 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ ...ML, color: T.hot }}>● 01 — Today's Pick</div>
          {hasEnoughItems && (
            <button onClick={generateOutfits} style={{ ...ML, background: "none", border: "none", color: T.ink3, cursor: "pointer", padding: 0 }}>
              {loadingOutfit ? "Styling…" : "↻ Refresh"}
            </button>
          )}
        </div>

        {/* Loading */}
        {loadingOutfit && (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <div style={{ ...ML, color: T.ink3, animation: "pulse 1.2s ease-in-out infinite" }}>Styling…</div>
          </div>
        )}

        {/* Not enough items */}
        {!hasEnoughItems && !loadingOutfit && (
          <div style={{ paddingBottom: 28 }}>
            <p style={{ fontFamily: T.serif, fontSize: 20, color: T.ink, margin: "0 0 16px", lineHeight: 1.3 }}>
              Add a few pieces to unlock outfit suggestions.
            </p>
            <button onClick={onAddItem} style={{
              background: T.cobalt, color: T.bg, border: "none", borderRadius: 0,
              padding: "14px 28px", fontFamily: T.mono, fontSize: 10, letterSpacing: ".24em",
              textTransform: "uppercase", cursor: "pointer",
            }}>
              + Add Pieces
            </button>
          </div>
        )}

        {/* No outfits yet */}
        {hasEnoughItems && outfits.length === 0 && !loadingOutfit && (
          <div style={{ paddingBottom: 28 }}>
            <p style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 18, color: T.ink3, margin: "0 0 20px", lineHeight: 1.4 }}>
              Generate your first look for today.
            </p>
            <button onClick={generateOutfits} style={{
              width: "100%", background: T.cobalt, color: T.bg, border: "none", borderRadius: 0,
              padding: "16px", fontFamily: T.mono, fontSize: 11, letterSpacing: ".24em",
              textTransform: "uppercase", cursor: "pointer",
            }}>
              Generate Outfits
            </button>
          </div>
        )}

        {/* Outfit results */}
        {firstOutfit && !loadingOutfit && (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 0, paddingBottom: 28 }}>
            {/* Left col */}
            <div style={{ paddingRight: 20, borderRight: `1px solid ${T.rule}` }}>
              <h2 style={{ fontFamily: T.serif, fontSize: 28, fontWeight: 400, letterSpacing: "-.015em", color: T.ink, margin: "0 0 16px", lineHeight: 1.1 }}>
                {firstOutfit.name || "Today's Look"}
              </h2>
              {/* Piece list */}
              <div style={{ marginBottom: 16 }}>
                {firstOutfitPieces.map((item, i) => (
                  <div key={item.id} onClick={() => evaluateItem(item)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                    borderBottom: `1px solid ${T.rule}`, cursor: "pointer",
                  }}>
                    <span style={{ ...ML, color: T.ink3, fontSize: 9, width: 20 }}>{String(i + 1).padStart(2, "0")}</span>
                    {item.imageData && (
                      <img src={item.imageThumb ?? item.imageData} alt={item.name} style={{ width: 28, height: 37, objectFit: "cover", flexShrink: 0 }} />
                    )}
                    <span style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, flex: 1 }}>{item.name}</span>
                  </div>
                ))}
              </div>
              {firstOutfit.why && (
                <p style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 18, color: T.ink3, margin: 0, lineHeight: 1.4 }}>
                  "{firstOutfit.why}"
                </p>
              )}
              {outfits.length > 1 && (
                <button onClick={() => setView("outfits")} style={{ ...ML, background: "none", border: "none", color: T.cobalt, cursor: "pointer", padding: "16px 0 0", display: "block" }}>
                  All outfits →
                </button>
              )}
            </div>
            {/* Right col — stacked thumbnails */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {firstOutfitPieces.slice(0, 2).map((item, i) => (
                <div key={item.id} style={{ flex: 1, overflow: "hidden", borderTop: i > 0 ? `1px solid ${T.rule}` : "none" }}>
                  {item.imageData
                    ? <img src={item.imageThumb ?? item.imageData} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : <div style={{ height: 120, background: T.paper }} />
                  }
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Occasion chips ─────────────────────────────────── */}
      <div style={{ padding: "24px 28px", borderBottom: `1px solid ${T.rule}` }}>
        <div style={{ ...ML, color: T.ink3, marginBottom: 14 }}>02 — Dress for what?</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CHIPS.map(s => (
            <button key={s} onClick={() => setOccasion(occasion === s ? "" : s)} style={chipB(occasion === s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Weather ────────────────────────────────────────── */}
      {weatherEnabled && hasEnoughItems && (
        <div style={{ padding: "28px 28px 0", borderBottom: `1px solid ${T.rule}` }}>
          <div style={{ ...ML, color: T.ink3, marginBottom: 14 }}>Weather Outfit</div>
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

      {/* ── Never worn strip ──────────────────────────────── */}
      {underloved.length > 0 && (
        <div style={{ padding: "28px 0 0" }}>
          <div style={{ padding: "0 28px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ ...ML, color: T.hot }}>
              Unworn <span style={{ color: T.ink3, marginLeft: 8 }}>{underloved.length}</span>
            </div>
            <button onClick={() => setView("closet")} style={{ ...ML, background: "none", border: "none", color: T.ink3, cursor: "pointer" }}>
              View all →
            </button>
          </div>
          <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none", borderTop: `1px solid ${T.rule}` }}>
            {underloved.slice(0, 12).map((item, i) => (
              <div key={item.id} onClick={() => evaluateItem(item)} style={{
                flexShrink: 0, width: 96, cursor: "pointer",
                borderRight: `1px solid ${T.rule}`,
              }}>
                <div style={{ aspectRatio: "3/4", overflow: "hidden", background: T.paper }}>
                  {item.imageData
                    ? <img src={item.imageThumb ?? item.imageData} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
                        <div style={{ ...ML, color: T.rule, fontSize: 8, textAlign: "center" }}>{item.name}</div>
                      </div>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick links ───────────────────────────────────── */}
      <div style={{ padding: "0 28px", marginTop: 28 }}>
        {[
          { label: "Outfit Inspo", body: "Upload a photo, recreate the look", action: () => setView("outfits") },
          { label: "Ask Stylist",  body: "Chat about your wardrobe",          action: () => setView("chat") },
        ].map(({ label, body, action }, i) => (
          <button key={label} onClick={action} style={{
            display: "block", width: "100%", background: "transparent", border: "none",
            borderBottom: `1px solid ${T.rule}`, padding: "20px 0",
            textAlign: "left", cursor: "pointer",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, fontWeight: 500, marginBottom: 3 }}>{label}</div>
                <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3 }}>{body}</div>
              </div>
              <span style={{ color: T.ink3, fontSize: 18 }}>→</span>
            </div>
          </button>
        ))}
      </div>

      {/* ── Insights ──────────────────────────────────────── */}
      {insights.length > 0 && (
        <div style={{ padding: "28px 28px 0" }}>
          <div style={{ ...ML, color: T.ink3, marginBottom: 16 }}>Wardrobe Snapshot</div>
          {insights.map((insight, i) => (
            <div key={i} style={{
              padding: "14px 0", borderBottom: i < insights.length - 1 ? `1px solid ${T.rule}` : "none",
            }}>
              <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink2, lineHeight: 1.6 }}>{insight}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
