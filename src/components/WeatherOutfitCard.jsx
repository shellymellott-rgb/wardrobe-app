import { chipStyle } from "../styles.js";

const OCCASION_CHIPS = ["Errands","Work from home","Dinner","Travel","Casual day","Boat day"];

const card = { background:"#161616", border:"1px solid #262626", borderRadius:12 };
const divider = { borderTop:"1px solid #1e1e1e", margin:"0 16px" };

function OutfitSection({ label, pieces, why }) {
  if (!pieces?.length) return null;
  return (
    <div>
      <div style={{fontSize:9, letterSpacing:2.5, textTransform:"uppercase", color:"#555", marginBottom:8}}>{label}</div>
      {pieces.map((name, i) => (
        <div key={i} style={{fontSize:13, color:"#e8e2d8", marginBottom:5, lineHeight:1.4}}>· {name}</div>
      ))}
      {why && <div style={{fontSize:11, color:"#777", marginTop:8, lineHeight:1.6}}>{why}</div>}
    </div>
  );
}

export default function WeatherOutfitCard({
  weatherOutfit, weatherLoading, weatherError,
  weatherOccasion, setWeatherOccasion, weatherSaved,
  getWeatherOutfit, saveWeatherOutfit, resetWeatherOutfit,
}) {
  const font = { fontFamily:"'DM Sans', system-ui, sans-serif" };

  // ── Idle ───────────────────────────────────────────────────────────────────
  if (!weatherOutfit && !weatherLoading && !weatherError) {
    return (
      <div style={{...card, padding:"18px 20px", ...font}}>
        <div style={{fontSize:13, fontWeight:600, color:"#e8e2d8", marginBottom:14}}>
          What should I wear today?
        </div>
        <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:16}}>
          {OCCASION_CHIPS.map(c => (
            <button key={c}
              onClick={() => setWeatherOccasion(weatherOccasion === c ? "" : c)}
              style={{...chipStyle(weatherOccasion === c), padding:"4px 10px", fontSize:9}}
            >{c}</button>
          ))}
        </div>
        <button
          onClick={getWeatherOutfit}
          style={{
            width:"100%", background:"#e8e2d8", color:"#111", border:"none",
            borderRadius:8, padding:"13px", fontSize:11, letterSpacing:2.5,
            textTransform:"uppercase", cursor:"pointer", fontWeight:700,
          }}
        >
          {weatherOccasion ? `Get outfit — ${weatherOccasion}` : "Get outfit suggestion"}
        </button>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (weatherLoading) {
    return (
      <div style={{...card, padding:"24px 20px", textAlign:"center", ...font}}>
        <div style={{fontSize:11, color:"#b8976a", letterSpacing:3, textTransform:"uppercase"}}>
          Checking weather…
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (weatherError) {
    return (
      <div style={{...card, padding:"18px 20px", ...font}}>
        <div style={{fontSize:12, color:"#8a5a5a", marginBottom:12, lineHeight:1.5}}>{weatherError}</div>
        <div style={{display:"flex", gap:16}}>
          <button onClick={getWeatherOutfit}
            style={{fontSize:10, color:"#666", letterSpacing:1.5, textTransform:"uppercase", background:"none", border:"none", cursor:"pointer", padding:0}}>
            Try again
          </button>
          <button onClick={resetWeatherOutfit}
            style={{fontSize:10, color:"#444", letterSpacing:1.5, textTransform:"uppercase", background:"none", border:"none", cursor:"pointer", padding:0}}>
            Change location
          </button>
        </div>
      </div>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  const hasBackup = weatherOutfit.backup?.length > 0;
  const hasGaps   = weatherOutfit.gaps?.length > 0;

  return (
    <div style={{...card, overflow:"hidden", ...font}}>
      {/* Weather + occasion bar */}
      <div style={{padding:"11px 16px", borderBottom:"1px solid #1e1e1e", display:"flex", justifyContent:"space-between", alignItems:"center", gap:8}}>
        <div>
          <div style={{fontSize:11, color:"#888"}}>{weatherOutfit.weather?.summary}</div>
          {weatherOccasion && (
            <div style={{fontSize:9, color:"#b8976a", letterSpacing:1.5, textTransform:"uppercase", marginTop:3}}>{weatherOccasion}</div>
          )}
        </div>
        <button onClick={resetWeatherOutfit}
          style={{fontSize:9, color:"#444", letterSpacing:1, textTransform:"uppercase", background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0}}>
          ↺ Change
        </button>
      </div>

      {/* Main outfit */}
      <div style={{padding:"14px 16px"}}>
        <OutfitSection label="Today's pick" pieces={weatherOutfit.main} why={weatherOutfit.mainWhy} />
        {weatherOutfit.layer && (
          <div style={{fontSize:11, color:"#b8976a", marginTop:10}}>✦ {weatherOutfit.layer}</div>
        )}
        {weatherOutfit.avoid && (
          <div style={{fontSize:10, color:"#555", marginTop:6}}>Avoid: {weatherOutfit.avoid}</div>
        )}
      </div>

      {/* Backup outfit */}
      {hasBackup && (
        <>
          <div style={divider}/>
          <div style={{padding:"14px 16px"}}>
            <OutfitSection label="Also works" pieces={weatherOutfit.backup} why={weatherOutfit.backupWhy} />
          </div>
        </>
      )}

      {/* Gaps */}
      {hasGaps && (
        <>
          <div style={divider}/>
          <div style={{padding:"12px 16px"}}>
            <div style={{fontSize:9, letterSpacing:2.5, textTransform:"uppercase", color:"#555", marginBottom:6}}>
              Your closet is missing
            </div>
            {weatherOutfit.gaps.map((g, i) => (
              <div key={i} style={{fontSize:11, color:"#666", marginBottom:3}}>· {g}</div>
            ))}
          </div>
        </>
      )}

      {/* Actions */}
      <div style={{...divider}}/>
      <div style={{padding:"12px 16px", display:"flex", gap:16, alignItems:"center"}}>
        <button
          onClick={saveWeatherOutfit}
          disabled={weatherSaved}
          style={{
            fontSize:10, letterSpacing:1.5, textTransform:"uppercase", cursor:weatherSaved?"default":"pointer",
            background:"none", border:"none", padding:0,
            color: weatherSaved ? "#3a7a4a" : "#888",
          }}
        >
          {weatherSaved ? "✓ Saved to Outfits" : "Save for later"}
        </button>
        <button onClick={getWeatherOutfit}
          style={{fontSize:10, color:"#444", letterSpacing:1.5, textTransform:"uppercase", background:"none", border:"none", cursor:"pointer", padding:0, marginLeft:"auto"}}>
          ↺ Refresh
        </button>
      </div>
    </div>
  );
}
