import { COLORS, SEASONS, MATERIALS } from "../constants.js";
import { chipStyle, ghostBtn, navBtn } from "../styles.js";
import { getMaterials } from "../utils/normalizeItem.js";

export default function ClosetView({
  items, filtered, activeCategory, setActiveCategory, allCategories,
  activeFilters, setActiveFilters, showFilters, setShowFilters,
  brands, allTags, evaluateItem,
}) {
  return (
    <div>
      <div style={{display:"flex",gap:6,padding:"14px 24px 6px",overflowX:"auto",scrollbarWidth:"none",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
        {["All",...allCategories,"To Go"].map(cat=>navBtn(cat, activeCategory===cat, ()=>setActiveCategory(cat)))}
      </div>
      <div style={{padding:"8px 24px 12px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
        <button onClick={()=>setShowFilters(f=>!f)} style={{...ghostBtn,fontSize:10,letterSpacing:1.5}}>
          {showFilters?"▲ Hide":"▼ Filter"}
          {Object.keys(activeFilters).length>0 && <span style={{color:"#b8976a",marginLeft:6}}>({Object.keys(activeFilters).length})</span>}
        </button>
        {showFilters && (
          <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:10}}>
            {[
              {key:"color",opts:COLORS},
              {key:"season",opts:SEASONS},
              {key:"material",opts:MATERIALS},
              ...(brands.length?[{key:"brand",opts:brands}]:[]),
              ...(allTags.length?[{key:"tag",opts:allTags}]:[]),
            ].map(({key,opts})=>(
              <div key={key}>
                <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555",marginBottom:6}}>{key}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {opts.map(o=>(
                    <button key={o} onClick={()=>setActiveFilters(f=>f[key]===o?Object.fromEntries(Object.entries(f).filter(([k])=>k!==key)):{...f,[key]:o})} style={chipStyle(activeFilters[key]===o)}>{o}</button>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(activeFilters).length>0 && <button onClick={()=>setActiveFilters({})} style={{...ghostBtn,color:"#8a4a4a",fontSize:10}}>Clear filters</button>}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{textAlign:"center",padding:"60px 24px",color:"#444",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
          <div style={{fontSize:12,letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>{items.length>0?"No matches":"Nothing here yet"}</div>
          <div style={{fontSize:11,color:"#333"}}>{items.length>0?"Try different filters":"Add your first piece"}</div>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:1}}>
          {filtered.map(item=>(
            <div key={item.id} onClick={()=>evaluateItem(item)} style={{position:"relative",aspectRatio:"3/4",background:"#1a1a1a",cursor:"pointer",overflow:"hidden"}}>
              {item.imageData
                ? <img src={item.imageData} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                : <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,padding:8,boxSizing:"border-box"}}>
                    {item.color && <div style={{fontSize:8,color:"#555"}}>{item.color}</div>}
                    <div style={{fontSize:9,color:"#444",textAlign:"center",lineHeight:1.3}}>{item.name}</div>
                  </div>
              }
              <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(8,8,8,0.95))",padding:"14px 6px 6px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
                {item.name && <div style={{fontSize:9,fontWeight:500,marginBottom:1,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>}
                <div style={{fontSize:8,color:"#666",letterSpacing:0.5,textTransform:"uppercase"}}>{item.brand||item.category}</div>
              </div>
              {item.status==="donate" && <div style={{position:"absolute",top:4,right:4,background:"#c86010",color:"#fff",borderRadius:2,padding:"1px 5px",fontFamily:"'DM Sans'",fontSize:7,letterSpacing:1,fontWeight:700,textTransform:"uppercase"}}>Donate</div>}
              {item.status==="sell" && <div style={{position:"absolute",top:4,right:4,background:"#3a7a4a",color:"#fff",borderRadius:2,padding:"1px 5px",fontFamily:"'DM Sans'",fontSize:7,letterSpacing:1,fontWeight:700,textTransform:"uppercase"}}>Sell</div>}
              {!item.status && !item.wornDates?.length && <div style={{position:"absolute",top:4,right:4,background:"#b8976a",color:"#111",borderRadius:2,padding:"1px 4px",fontFamily:"'DM Sans'",fontSize:7,letterSpacing:1,fontWeight:700,textTransform:"uppercase"}}>New</div>}
              {item.wornDates?.length>0 && <div style={{position:"absolute",top:4,left:4,background:"#ffffff12",color:"#ffffff55",borderRadius:2,padding:"1px 5px",fontFamily:"'DM Sans'",fontSize:8}}>×{item.wornDates.length}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
