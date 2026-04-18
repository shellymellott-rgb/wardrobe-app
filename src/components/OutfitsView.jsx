import { useRef } from "react";
import { chipStyle, inputStyle, labelStyle, ghostBtn } from "../styles.js";

export default function OutfitsView({
  items, occasion, setOccasion, outfits, outfitText, loadingOutfit, generateOutfits,
  inspoImage, inspoResult, setInspoResult, setInspoImage, loadingInspo, analyzeInspo,
  underloved, markWorn,
}) {
  const inspoRef = useRef();

  return (
    <div style={{padding:24,fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      <label style={labelStyle}>Occasion (optional)</label>
      <input value={occasion} onChange={e=>setOccasion(e.target.value)} placeholder="e.g. boat day, errands, travel..." style={inputStyle}/>
      <button onClick={generateOutfits} disabled={loadingOutfit||items.length<2} style={{width:"100%",background:items.length<2?"#1a1a1a":"#e8e2d8",color:items.length<2?"#444":"#111",border:"none",borderRadius:3,padding:"14px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:items.length<2?"not-allowed":"pointer",fontWeight:600,marginBottom:20}}>
        {loadingOutfit?"Styling...":"Generate Outfits"}
      </button>
      {items.length<2 && <div style={{textAlign:"center",color:"#444",fontSize:12,marginBottom:16}}>Add at least 2 pieces first</div>}

      {outfits.length>0 && outfits.map((outfit,oi)=>{
        const outfitItems = outfit.pieces.map(name=>items.find(i=>i.name===name||i.name.toLowerCase()===name.toLowerCase())).filter(Boolean);
        return (
          <div key={oi} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:4,marginBottom:16,overflow:"hidden"}}>
            <div style={{padding:"12px 14px 8px"}}>
              <div style={{fontSize:12,fontWeight:600,color:"#e8e2d8",marginBottom:2}}>{outfit.name}</div>
              <div style={{fontSize:11,color:"#888",lineHeight:1.5,marginBottom:6}}>{outfit.why}</div>
            </div>
            {outfitItems.length>0 && (
              <div style={{display:"flex",gap:1,padding:"0 1px 1px"}}>
                {outfitItems.map((item,ii)=>(
                  <div key={ii} style={{flex:1,aspectRatio:"3/4",background:"#111",overflow:"hidden",position:"relative"}}>
                    {item.imageData?<img src={item.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:4}}><div style={{fontSize:8,color:"#555",textAlign:"center",lineHeight:1.3}}>{item.name}</div></div>}
                    <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.7)",padding:"4px 4px 3px"}}><div style={{fontSize:7,color:"#e8e2d8aa",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div></div>
                  </div>
                ))}
              </div>
            )}
            <div style={{padding:"8px 14px 12px"}}><div style={{fontSize:10,color:"#b8976a",lineHeight:1.5}}>✦ {outfit.tip}</div></div>
          </div>
        );
      })}

      {outfitText && <div style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:3,padding:18,fontSize:13,lineHeight:1.8,color:"#c8c0b0",whiteSpace:"pre-wrap"}}>{outfitText}</div>}

      {/* Outfit Inspiration */}
      <div style={{marginTop:28,borderTop:"1px solid #222",paddingTop:20}}>
        <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#666",marginBottom:12}}>Outfit Inspiration</div>
        <input ref={inspoRef} type="file" accept="image/*" onChange={analyzeInspo} style={{display:"none"}}/>
        {!inspoResult && (
          <div onClick={()=>inspoRef.current.click()} style={{background:"#1a1a1a",border:"1px dashed #333",borderRadius:3,padding:"24px",display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",marginBottom:12}}>
            {inspoImage
              ? <img src={inspoImage} style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:2,marginBottom:8}}/>
              : <><div style={{fontSize:24,marginBottom:8}}>📸</div><div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"#666"}}>Upload Inspo Photo</div><div style={{fontSize:10,color:"#444",marginTop:4,textAlign:"center"}}>I'll build this look from your wardrobe</div></>
            }
          </div>
        )}
        {loadingInspo && <div style={{textAlign:"center",color:"#666",fontSize:11,letterSpacing:1,padding:"12px 0"}}>Analyzing look...</div>}
        {inspoResult && (()=>{
          const allPieces = (inspoResult.pieces||[]).map(name=>{
            const item = items.find(i=>i.name===name||i.name.toLowerCase()===name.toLowerCase());
            return { name, item };
          });
          return (
            <div style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:4,overflow:"hidden",marginBottom:12}}>
              <div style={{position:"relative"}}>
                <img src={inspoImage} style={{width:"100%",maxHeight:220,objectFit:"cover",display:"block"}}/>
                <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(0,0,0,0.85))",padding:"24px 14px 12px",display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#e8e2d8"}}>{inspoResult.outfitName}</div>
                  <button onClick={()=>{setInspoResult(null);setInspoImage(null)}} style={{background:"none",border:"1px solid #ffffff33",color:"#ffffff88",borderRadius:3,padding:"3px 8px",fontSize:9,letterSpacing:1,cursor:"pointer"}}>New photo</button>
                </div>
              </div>
              {allPieces.length>0 && (
                <div>
                  <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555",padding:"10px 14px 6px"}}>Recreate with your wardrobe</div>
                  <div style={{display:"flex",gap:1,padding:"0 1px 1px"}}>
                    {allPieces.map(({name,item},i)=>(
                      <div key={i} style={{flex:1,overflow:"hidden"}}>
                        <div style={{aspectRatio:"3/4",background:item?"#111":"#1a1510",position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {item?.imageData?<img src={item.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:6,gap:4}}>{!item&&<div style={{fontSize:14,color:"#b8976a44"}}>+</div>}<div style={{fontSize:7,color:item?"#555":"#b8976a88",textAlign:"center",lineHeight:1.3,padding:"0 2px"}}>{name}</div></div>}
                        </div>
                        <div style={{background:item?"rgba(0,0,0,0.7)":"#1a1510",padding:"4px 4px"}}><div style={{fontSize:7,color:item?"#e8e2d8aa":"#b8976a",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item?item.name:name}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{padding:"12px 14px 14px"}}>
                {inspoResult.why && <div style={{fontSize:11,color:"#888",lineHeight:1.6,marginBottom:8}}>{inspoResult.why}</div>}
                {inspoResult.tip && <div style={{fontSize:10,color:"#b8976a",marginBottom:8}}>✦ {inspoResult.tip}</div>}
                {inspoResult.gaps?.length>0 && (<div><div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555",marginBottom:6}}>Still need:</div>{inspoResult.gaps.map((g,i)=><div key={i} style={{fontSize:11,color:"#666",marginBottom:3}}>· {g}</div>)}</div>)}
              </div>
            </div>
          );
        })()}
        {inspoResult && <button onClick={()=>inspoRef.current.click()} style={{...ghostBtn,fontSize:10,letterSpacing:1,marginBottom:4}}>📸 Try different photo</button>}
      </div>

      {underloved.length>0 && (
        <div style={{marginTop:24}}>
          <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#b8976a",marginBottom:12}}>Never worn</div>
          {underloved.map(item=>(
            <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,background:"#1a1a1a",border:"1px solid #b8976a22",borderRadius:3,padding:"9px 12px",marginBottom:7}}>
              {item.imageData && <img src={item.imageData} style={{width:32,height:42,objectFit:"cover",borderRadius:2,flexShrink:0}}/>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name||"Unnamed"}</div>
                <div style={{fontSize:9,color:"#666",letterSpacing:1,textTransform:"uppercase"}}>{item.brand||item.category}</div>
              </div>
              <button onClick={()=>markWorn(item.id)} style={{...chipStyle(false),flexShrink:0}}>worn</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
