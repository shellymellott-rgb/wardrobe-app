import { useMemo } from "react";
import { chipStyle, inputStyle } from "../styles.js";

export default function HomeView({
  items, underloved,
  outfits, loadingOutfit, generateOutfits, occasion, setOccasion,
  markWorn, evaluateItem, setView,
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const insights = useMemo(() => {
    const list = [];
    const ninetyDaysAgo = new Date(Date.now() - 90*24*60*60*1000).toISOString().split("T")[0];

    const unwornWithPrice = underloved.filter(i => i.price > 0);
    const unwornValue = unwornWithPrice.reduce((s, i) => s + i.price, 0);
    if (underloved.length > 0) {
      list.push(unwornValue > 0
        ? `${underloved.length} pieces never worn — $${Math.round(unwornValue)} sitting idle`
        : `${underloved.length} pieces you've never worn`
      );
    }

    const stale = items.filter(i =>
      i.wornDates?.length > 0 &&
      i.wornDates[i.wornDates.length - 1] < ninetyDaysAgo
    );
    if (stale.length > 0) list.push(`${stale.length} pieces not worn in 3+ months`);

    const catCounts = {};
    items.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    const heavy = Object.entries(catCounts).sort((a,b) => b[1]-a[1]);
    if (heavy.length > 0 && heavy[0][1] >= 6) {
      list.push(`You own ${heavy[0][1]} ${heavy[0][0].toLowerCase()} — your largest category`);
    }

    return list.slice(0, 3);
  }, [items, underloved]);

  const CHIPS = ["Errands", "Dinner", "Travel", "Boat day", "Work from home"];

  return (
    <div style={{paddingBottom:100,fontFamily:"'DM Sans', system-ui, sans-serif"}}>

      {/* Greeting */}
      <div style={{padding:"28px 24px 24px"}}>
        <div style={{fontSize:10,color:"#555",letterSpacing:3,textTransform:"uppercase",marginBottom:6}}>{greeting}</div>
        <div style={{fontFamily:"Georgia, serif",fontSize:24,fontStyle:"italic",letterSpacing:-0.5,lineHeight:1.25,color:"#e8e2d8"}}>
          What are we wearing today?
        </div>
      </div>

      {/* Outfit of the Day */}
      <div style={{padding:"0 24px",marginBottom:36}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#555"}}>Today's Look</div>
          {outfits.length > 0 && (
            <button onClick={()=>setView("outfits")} style={{background:"none",border:"none",color:"#666",fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer"}}>
              More →
            </button>
          )}
        </div>

        {outfits.length === 0 && !loadingOutfit && (
          <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:10,padding:20}}>
            <div style={{fontSize:12,color:"#555",marginBottom:14,lineHeight:1.6}}>
              Get outfit suggestions tailored to your wardrobe.
            </div>
            <input
              value={occasion}
              onChange={e=>setOccasion(e.target.value)}
              placeholder="What are you dressing for? (optional)"
              style={{...inputStyle,marginBottom:10,fontSize:11,background:"#0d0d0d",border:"1px solid #222",borderRadius:6}}
            />
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
              {CHIPS.map(s => (
                <button key={s} onClick={()=>setOccasion(occasion===s?"":s)}
                  style={{...chipStyle(occasion===s),padding:"4px 10px",fontSize:9}}>
                  {s}
                </button>
              ))}
            </div>
            <button
              onClick={generateOutfits}
              disabled={items.length < 2}
              style={{
                width:"100%",
                background:items.length < 2 ? "#1a1a1a" : "#e8e2d8",
                color:items.length < 2 ? "#444" : "#111",
                border:"none",borderRadius:6,padding:"14px",
                fontSize:11,letterSpacing:3,textTransform:"uppercase",
                cursor:items.length < 2 ? "not-allowed" : "pointer",fontWeight:700,
              }}
            >
              {items.length < 2 ? "Add more pieces first" : "Generate Outfits"}
            </button>
          </div>
        )}

        {loadingOutfit && (
          <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:10,padding:40,textAlign:"center"}}>
            <div style={{fontSize:11,color:"#b8976a",letterSpacing:3,textTransform:"uppercase"}}>Styling...</div>
          </div>
        )}

        {outfits.length > 0 && (
          <>
            {outfits.slice(0, 2).map((outfit, oi) => {
              const pieces = (outfit.pieces||[])
                .map(name => items.find(i => i.name===name || i.name.toLowerCase()===name.toLowerCase()))
                .filter(Boolean);
              return (
                <div key={oi} style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:10,marginBottom:12,overflow:"hidden"}}>
                  {pieces.length > 0 && (
                    <div style={{display:"flex",gap:2,padding:2}}>
                      {pieces.map((item, ii) => (
                        <div key={ii} style={{flex:1,aspectRatio:"3/4",background:"#1a1a1a",overflow:"hidden",borderRadius:6}}>
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
                  <div style={{padding:"14px 16px"}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#e8e2d8",marginBottom:4}}>{outfit.name}</div>
                    <div style={{fontSize:11,color:"#777",lineHeight:1.5,marginBottom:outfit.tip?8:0}}>{outfit.why}</div>
                    {outfit.tip && <div style={{fontSize:10,color:"#b8976a"}}>✦ {outfit.tip}</div>}
                  </div>
                </div>
              );
            })}
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button onClick={generateOutfits} style={{flex:1,background:"transparent",border:"1px solid #222",color:"#666",borderRadius:6,padding:"10px",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>
                Regenerate
              </button>
              <button onClick={()=>setView("outfits")} style={{flex:1,background:"transparent",border:"1px solid #222",color:"#666",borderRadius:6,padding:"10px",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>
                All Outfits →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Never Worn */}
      {underloved.length > 0 && (
        <div style={{marginBottom:36}}>
          <div style={{padding:"0 24px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#555"}}>
              Never Worn
              <span style={{color:"#b8976a",marginLeft:8}}>{underloved.length}</span>
            </div>
            <button onClick={()=>setView("closet")} style={{background:"none",border:"none",color:"#666",fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer"}}>
              View all →
            </button>
          </div>
          <div style={{display:"flex",gap:10,overflowX:"auto",padding:"0 24px 4px",scrollbarWidth:"none"}}>
            {underloved.slice(0, 10).map(item => (
              <div key={item.id} style={{flexShrink:0,width:96,cursor:"pointer"}} onClick={()=>evaluateItem(item)}>
                <div style={{width:96,height:124,background:"#111",borderRadius:8,overflow:"hidden",marginBottom:6,position:"relative"}}>
                  {item.imageData
                    ? <img src={item.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:8}}>
                        <div style={{fontSize:9,color:"#333",textAlign:"center",lineHeight:1.3}}>{item.name}</div>
                      </div>
                  }
                  <button
                    onClick={e=>{e.stopPropagation();markWorn(item.id);}}
                    style={{
                      position:"absolute",bottom:4,left:4,right:4,
                      background:"rgba(0,0,0,0.8)",border:"1px solid #ffffff15",
                      color:"#e8e2d888",borderRadius:4,
                      padding:"3px 0",fontSize:8,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",
                    }}
                  >worn</button>
                </div>
                <div style={{fontSize:9,color:"#777",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                {item.brand && <div style={{fontSize:8,color:"#444",marginTop:1}}>{item.brand}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{padding:"0 24px",marginBottom:36}}>
        <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#555",marginBottom:14}}>Quick Actions</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <button
            onClick={()=>setView("outfits")}
            style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:10,padding:"18px 14px",textAlign:"left",cursor:"pointer"}}
          >
            <div style={{fontSize:20,marginBottom:8}}>📸</div>
            <div style={{fontSize:12,color:"#e8e2d8",fontWeight:500,marginBottom:3}}>Outfit Inspo</div>
            <div style={{fontSize:10,color:"#444",lineHeight:1.4}}>Upload a photo, recreate the look</div>
          </button>
          <button
            onClick={()=>setView("chat")}
            style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:10,padding:"18px 14px",textAlign:"left",cursor:"pointer"}}
          >
            <div style={{fontSize:20,marginBottom:8}}>💬</div>
            <div style={{fontSize:12,color:"#e8e2d8",fontWeight:500,marginBottom:3}}>Ask Stylist</div>
            <div style={{fontSize:10,color:"#444",lineHeight:1.4}}>Chat about your wardrobe</div>
          </button>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div style={{padding:"0 24px"}}>
          <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#555",marginBottom:14}}>Insights</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {insights.map((insight, i) => (
              <div key={i} style={{
                background:"#111",border:"1px solid #1e1e1e",borderRadius:10,
                padding:"14px 16px",display:"flex",alignItems:"center",gap:12,
              }}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#b8976a",flexShrink:0}}/>
                <div style={{fontSize:12,color:"#c8c0b0",lineHeight:1.5}}>{insight}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
