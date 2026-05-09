import { T, ML } from "../theme.js";

const OCCASION_CHIPS = ["Errands","Work from home","Dinner","Travel","Casual day","Boat day"];
const CREAM = "#f5f1e8";

function OutfitSection({ label, pieces, why }) {
  if (!pieces?.length) return null;
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ ...ML, fontSize:9, color:"rgba(245,241,232,.45)", marginBottom:8 }}>{label}</div>
      {pieces.map((name, i) => (
        <div key={i} style={{ fontFamily:T.sans, fontSize:13, color:"rgba(245,241,232,.9)", marginBottom:5, lineHeight:1.4 }}>· {name}</div>
      ))}
      {why && <div style={{ fontFamily:T.sans, fontSize:11, color:"rgba(245,241,232,.55)", marginTop:8, lineHeight:1.6, fontStyle:"italic" }}>{why}</div>}
    </div>
  );
}

export default function WeatherOutfitCard({
  weatherOutfit, weatherLoading, weatherError,
  weatherOccasion, setWeatherOccasion, weatherSaved,
  getWeatherOutfit, saveWeatherOutfit, resetWeatherOutfit,
}) {
  const cardBase = {
    background: T.inkSurface,
    borderTop: `3px solid ${T.citron}`,
    padding: "24px 22px 20px",
    margin: "0 20px",
  };

  // ── Idle ───────────────────────────────────────────────────────────────────
  if (!weatherOutfit && !weatherLoading && !weatherError) {
    return (
      <div style={cardBase}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14 }}>
          <div style={{ ...ML, fontSize:9.5, color:"rgba(245,241,232,.6)" }}>Weather Outfit</div>
        </div>
        <h3 style={{ fontFamily:T.serif, fontSize:28, fontWeight:400, color:CREAM, letterSpacing:"-.015em", margin:"0 0 18px", lineHeight:1.05 }}>
          What should I <em style={{ fontStyle:"italic", color:T.citron }}>wear</em> today?
        </h3>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:18 }}>
          {OCCASION_CHIPS.map(c => {
            const active = weatherOccasion === c;
            return (
              <button key={c}
                onClick={() => setWeatherOccasion(active ? "" : c)}
                style={{
                  border:0,
                  background: active ? T.citron : CREAM,
                  color: T.ink,
                  padding:"8px 12px",
                  fontFamily:T.mono, fontSize:10, letterSpacing:".18em", textTransform:"uppercase",
                  cursor:"pointer", fontWeight: active ? 500 : 400,
                }}
              >{c}</button>
            );
          })}
        </div>
        <button
          onClick={getWeatherOutfit}
          style={{
            width:"100%", padding:"14px", border:0,
            background:T.citron, color:T.ink,
            fontFamily:T.mono, fontSize:10.5, letterSpacing:".24em", textTransform:"uppercase",
            cursor:"pointer", fontWeight:500,
          }}
        >→ {weatherOccasion ? `Get outfit — ${weatherOccasion}` : "Get outfit suggestion"}</button>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (weatherLoading) {
    return (
      <div style={{ ...cardBase, textAlign:"center" }}>
        <div style={{ ...ML, fontSize:11, color:T.citron, letterSpacing:".22em" }}>
          Checking weather…
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (weatherError) {
    return (
      <div style={cardBase}>
        <div style={{ fontFamily:T.sans, fontSize:12, color:"rgba(245,241,232,.55)", marginBottom:14, lineHeight:1.5 }}>{weatherError}</div>
        <div style={{ display:"flex", gap:16 }}>
          <button onClick={getWeatherOutfit}
            style={{ ...ML, fontSize:10, color:"rgba(245,241,232,.6)", background:"none", border:"none", cursor:"pointer", padding:0 }}>
            Try again
          </button>
          <button onClick={resetWeatherOutfit}
            style={{ ...ML, fontSize:10, color:"rgba(245,241,232,.35)", background:"none", border:"none", cursor:"pointer", padding:0 }}>
            Change location
          </button>
        </div>
      </div>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  const hasBackup = weatherOutfit.backup?.length > 0;
  const weatherInfo = weatherOutfit.weather
    ? `${weatherOutfit.weather.tempHigh}°/${weatherOutfit.weather.tempLow}° · ${weatherOutfit.weather.condition}`
    : null;

  return (
    <div style={cardBase}>
      {/* Header row */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14 }}>
        <div style={{ ...ML, fontSize:9.5, color:"rgba(245,241,232,.6)" }}>
          Weather Outfit{weatherInfo ? ` · ${weatherInfo}` : ""}{weatherOccasion ? ` · ${weatherOccasion}` : ""}
        </div>
        <button onClick={resetWeatherOutfit} style={{ ...ML, fontSize:9.5, color:T.citron, background:"none", border:"none", cursor:"pointer", padding:0 }}>↻ Refresh</button>
      </div>

      {weatherOutfit.weather?.summary && (
        <div style={{ fontFamily:T.sans, fontSize:12, color:"rgba(245,241,232,.55)", marginBottom:14, lineHeight:1.5 }}>
          {weatherOutfit.weather.summary}
        </div>
      )}

      <OutfitSection label="Today's pick" pieces={weatherOutfit.main} why={weatherOutfit.mainWhy} />

      {weatherOutfit.layer && (
        <div style={{ fontFamily:T.sans, fontSize:11, color:T.citron, marginBottom:10 }}>✦ {weatherOutfit.layer}</div>
      )}

      {hasBackup && (
        <>
          <div style={{ borderTop:"1px solid rgba(245,241,232,.12)", margin:"12px 0" }} />
          <OutfitSection label="Also works" pieces={weatherOutfit.backup} why={weatherOutfit.backupWhy} />
        </>
      )}

      {/* Actions */}
      <div style={{ borderTop:"1px solid rgba(245,241,232,.12)", marginTop:12, paddingTop:12, display:"flex", gap:16, alignItems:"center" }}>
        <button
          onClick={saveWeatherOutfit}
          disabled={weatherSaved}
          style={{
            ...ML, fontSize:9.5, cursor: weatherSaved ? "default" : "pointer",
            background:"none", border:"none", padding:0,
            color: weatherSaved ? T.citron : "rgba(245,241,232,.6)",
          }}
        >
          {weatherSaved ? "✓ Saved" : "Save for later"}
        </button>
        <button onClick={getWeatherOutfit}
          style={{ ...ML, fontSize:9.5, color:"rgba(245,241,232,.35)", background:"none", border:"none", cursor:"pointer", padding:0, marginLeft:"auto" }}>
          ↺ New suggestion
        </button>
      </div>
    </div>
  );
}
