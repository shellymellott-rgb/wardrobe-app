import { useState, useMemo } from "react";
import { COLORS, SEASONS, MATERIALS } from "../constants.js";
import { chipStyle } from "../styles.js";

export default function ClosetView({
  items, filtered, activeCategory, setActiveCategory, allCategories,
  activeFilters, setActiveFilters, showFilters, setShowFilters,
  brands, allTags, evaluateItem,
}) {
  const [search, setSearch] = useState("");

  const displayItems = useMemo(() => {
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter(i =>
      (i.name||"").toLowerCase().includes(q) ||
      (i.brand||"").toLowerCase().includes(q) ||
      (i.color||"").toLowerCase().includes(q) ||
      (i.category||"").toLowerCase().includes(q)
    );
  }, [filtered, search]);

  // Count active filters, supporting both legacy string values and new arrays
  const activeFilterCount = useMemo(() =>
    Object.values(activeFilters).reduce((n, v) =>
      n + (Array.isArray(v) ? v.length : (v ? 1 : 0)), 0
    ), [activeFilters]
  );

  function toggleFilter(key, value) {
    setActiveFilters(f => {
      const raw = f[key];
      const current = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      const idx = current.indexOf(value);
      const next = idx >= 0 ? current.filter(v => v !== value) : [...current, value];
      if (!next.length) { const { [key]: _, ...rest } = f; return rest; }
      return { ...f, [key]: next };
    });
  }

  function isActive(key, value) {
    const v = activeFilters[key];
    if (Array.isArray(v)) return v.includes(value);
    return v === value;
  }

  return (
    <div style={{fontFamily:"'DM Sans', system-ui, sans-serif"}}>

      {/* Search bar */}
      <div style={{padding:"12px 16px 6px"}}>
        <div style={{position:"relative"}}>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Search pieces..."
            style={{
              width:"100%",background:"#141414",border:"1px solid #1e1e1e",
              borderRadius:24,padding:"10px 16px 10px 36px",
              fontSize:12,color:"#e8e2d8",outline:"none",
              boxSizing:"border-box",fontFamily:"'DM Sans', system-ui, sans-serif",
            }}
          />
          <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:"#444",fontSize:15,pointerEvents:"none",lineHeight:1}}>⌕</span>
          {search && (
            <button onClick={()=>setSearch("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:18,lineHeight:1,padding:0}}>×</button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div style={{display:"flex",gap:6,padding:"6px 16px 6px",overflowX:"auto",scrollbarWidth:"none"}}>
        {["All", ...allCategories, "To Go"].map(cat => (
          <button key={cat} onClick={()=>setActiveCategory(cat)} style={{
            background:activeCategory===cat?"#e8e2d8":"transparent",
            color:activeCategory===cat?"#111":"#555",
            border:`1px solid ${activeCategory===cat?"#e8e2d8":"#222"}`,
            borderRadius:20,padding:"5px 14px",fontSize:10,letterSpacing:1.5,
            textTransform:"uppercase",cursor:"pointer",
            fontWeight:activeCategory===cat?600:400,whiteSpace:"nowrap",
          }}>{cat}</button>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{padding:"6px 16px 12px",display:"flex",alignItems:"center",gap:8}}>
        <button
          onClick={()=>setShowFilters(true)}
          style={{
            display:"flex",alignItems:"center",gap:6,
            background:"#111",border:"1px solid #222",borderRadius:20,
            padding:"6px 14px",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",
            color:activeFilterCount>0?"#e8e2d8":"#555",cursor:"pointer",
          }}
        >
          ⊞ Filter
          {activeFilterCount > 0 && (
            <span style={{background:"#b8976a",color:"#111",borderRadius:10,padding:"1px 6px",fontSize:8,fontWeight:700,letterSpacing:0}}>
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button onClick={()=>setActiveFilters({})} style={{background:"none",border:"none",color:"#555",fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer"}}>
            Clear
          </button>
        )}
        <div style={{marginLeft:"auto",fontSize:10,color:"#333"}}>{displayItems.length} pieces</div>
      </div>

      {/* Grid */}
      {displayItems.length === 0 ? (
        <div style={{textAlign:"center",padding:"60px 24px",color:"#444"}}>
          <div style={{fontSize:12,letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>
            {items.length > 0 ? "No matches" : "Nothing here yet"}
          </div>
          <div style={{fontSize:11,color:"#333"}}>
            {items.length > 0 ? "Try different filters or search" : "Add your first piece"}
          </div>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:2,padding:"0 2px 2px"}}>
          {displayItems.map(item => (
            <div key={item.id} onClick={()=>evaluateItem(item)}
              style={{position:"relative",aspectRatio:"3/4",background:"#141414",cursor:"pointer",overflow:"hidden",borderRadius:3}}>
              {item.imageData
                ? <img src={item.imageData} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                : <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,padding:8,boxSizing:"border-box"}}>
                    {item.color && <div style={{fontSize:8,color:"#3a3a3a"}}>{item.color}</div>}
                    <div style={{fontSize:9,color:"#2a2a2a",textAlign:"center",lineHeight:1.3}}>{item.name}</div>
                  </div>
              }
              {/* Name overlay */}
              <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(0,0,0,0.75))",padding:"18px 8px 8px"}}>
                {item.name && <div style={{fontSize:10,fontWeight:500,color:"#e8e2d8",marginBottom:1,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>}
                <div style={{fontSize:9,color:"#666",letterSpacing:0.3}}>{item.brand || item.category}</div>
              </div>
              {/* Status badges */}
              {item.status==="donate" && <div style={{position:"absolute",top:5,right:5,background:"rgba(200,96,16,0.9)",color:"#fff",borderRadius:3,padding:"2px 6px",fontSize:7,letterSpacing:1,fontWeight:700,textTransform:"uppercase"}}>Donate</div>}
              {item.status==="sell"   && <div style={{position:"absolute",top:5,right:5,background:"rgba(58,122,74,0.9)",color:"#fff",borderRadius:3,padding:"2px 6px",fontSize:7,letterSpacing:1,fontWeight:700,textTransform:"uppercase"}}>Sell</div>}
              {!item.status && !item.wornDates?.length && <div style={{position:"absolute",top:5,right:5,background:"rgba(184,151,106,0.9)",color:"#111",borderRadius:3,padding:"2px 5px",fontSize:7,letterSpacing:1,fontWeight:700,textTransform:"uppercase"}}>New</div>}
              {item.wornDates?.length > 0 && <div style={{position:"absolute",top:5,left:5,background:"rgba(0,0,0,0.5)",color:"rgba(255,255,255,0.35)",borderRadius:2,padding:"2px 5px",fontSize:8}}>×{item.wornDates.length}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Filter bottom sheet */}
      {showFilters && (
        <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.7)"}} onClick={()=>setShowFilters(false)}>
          <div
            style={{position:"absolute",bottom:0,left:0,right:0,background:"#0d0d0d",borderRadius:"20px 20px 0 0",padding:"0 24px 40px",maxHeight:"78vh",overflowY:"auto"}}
            onClick={e=>e.stopPropagation()}
          >
            {/* Handle */}
            <div style={{width:36,height:4,background:"#2a2a2a",borderRadius:2,margin:"14px auto 20px"}}/>
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
              <div style={{fontSize:14,fontWeight:600,color:"#e8e2d8",fontFamily:"Georgia,serif",fontStyle:"italic"}}>Filter</div>
              <div style={{display:"flex",gap:16,alignItems:"center"}}>
                {activeFilterCount > 0 && (
                  <button onClick={()=>setActiveFilters({})} style={{background:"none",border:"none",color:"#b8976a",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>
                    Clear all
                  </button>
                )}
                <button onClick={()=>setShowFilters(false)} style={{background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
              </div>
            </div>
            {/* Filter groups */}
            {[
              { key:"color",    label:"Color",    opts:COLORS },
              { key:"season",   label:"Season",   opts:SEASONS },
              { key:"material", label:"Material", opts:MATERIALS },
              ...(brands.length ? [{ key:"brand", label:"Brand", opts:brands }] : []),
              ...(allTags.length ? [{ key:"tag",  label:"Tags",  opts:allTags }] : []),
            ].map(({ key, label, opts }) => (
              <div key={key} style={{marginBottom:22}}>
                <div style={{fontSize:9,letterSpacing:2.5,textTransform:"uppercase",color:"#555",marginBottom:10}}>{label}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {opts.map(o => (
                    <button key={o} onClick={()=>toggleFilter(key, o)} style={{...chipStyle(isActive(key,o)),padding:"5px 12px"}}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {/* Apply */}
            <button
              onClick={()=>setShowFilters(false)}
              style={{width:"100%",background:"#e8e2d8",color:"#111",border:"none",borderRadius:6,padding:"14px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontWeight:700,marginTop:8}}
            >
              Show {displayItems.length} pieces
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
