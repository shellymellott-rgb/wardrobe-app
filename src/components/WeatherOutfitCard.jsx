const card = { background:"#161616", border:"1px solid #262626", borderRadius:12 };

export default function WeatherOutfitCard({ weatherOutfit, weatherLoading, weatherError, getWeatherOutfit }) {
  // Not yet requested
  if (!weatherOutfit && !weatherLoading && !weatherError) {
    return (
      <button
        onClick={getWeatherOutfit}
        style={{
          ...card, width:"100%", padding:"18px 20px", cursor:"pointer",
          display:"flex", alignItems:"center", gap:14, textAlign:"left",
          fontFamily:"'DM Sans', system-ui, sans-serif",
        }}
      >
        <div style={{fontSize:22, lineHeight:1, flexShrink:0}}>🌤</div>
        <div>
          <div style={{fontSize:13, fontWeight:600, color:"#e8e2d8", marginBottom:3}}>
            What should I wear today?
          </div>
          <div style={{fontSize:11, color:"#666"}}>Outfit based on today's weather</div>
        </div>
      </button>
    );
  }

  // Loading
  if (weatherLoading) {
    return (
      <div style={{...card, padding:"24px 20px", textAlign:"center", fontFamily:"'DM Sans', system-ui, sans-serif"}}>
        <div style={{fontSize:11, color:"#b8976a", letterSpacing:3, textTransform:"uppercase"}}>Checking weather…</div>
      </div>
    );
  }

  // Error
  if (weatherError) {
    return (
      <div style={{...card, padding:"18px 20px", fontFamily:"'DM Sans', system-ui, sans-serif"}}>
        <div style={{fontSize:12, color:"#8a5a5a", marginBottom:12, lineHeight:1.5}}>{weatherError}</div>
        <button
          onClick={getWeatherOutfit}
          style={{fontSize:10, color:"#666", letterSpacing:1.5, textTransform:"uppercase", background:"none", border:"none", cursor:"pointer", padding:0}}
        >
          Try again
        </button>
      </div>
    );
  }

  // Result
  return (
    <div style={{...card, overflow:"hidden", fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      {/* Weather bar */}
      <div style={{padding:"12px 16px", borderBottom:"1px solid #1e1e1e", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div style={{fontSize:11, color:"#888"}}>{weatherOutfit.weather?.summary}</div>
        <button
          onClick={getWeatherOutfit}
          style={{fontSize:9, color:"#444", letterSpacing:1.5, textTransform:"uppercase", background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0}}
        >
          ↺
        </button>
      </div>

      {/* Outfit */}
      <div style={{padding:"14px 16px 16px"}}>
        <div style={{fontSize:9, letterSpacing:2.5, textTransform:"uppercase", color:"#555", marginBottom:10}}>Wear Today</div>
        {(weatherOutfit.outfit || []).map((name, i) => (
          <div key={i} style={{fontSize:13, color:"#e8e2d8", marginBottom:5, lineHeight:1.4}}>· {name}</div>
        ))}
        {weatherOutfit.why && (
          <div style={{fontSize:11, color:"#777", marginTop:10, lineHeight:1.6}}>{weatherOutfit.why}</div>
        )}
        {weatherOutfit.layer && (
          <div style={{fontSize:11, color:"#b8976a", marginTop:8}}>✦ {weatherOutfit.layer}</div>
        )}
        {weatherOutfit.avoid && (
          <div style={{fontSize:10, color:"#555", marginTop:6}}>Avoid: {weatherOutfit.avoid}</div>
        )}
      </div>
    </div>
  );
}
