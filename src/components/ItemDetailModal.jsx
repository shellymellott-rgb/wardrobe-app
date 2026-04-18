import { useEffect } from "react";
import { fmtMaterials } from "../utils/normalizeItem.js";
import { chipStyle, inputStyle, ghostBtn } from "../styles.js";
import FormFields from "./FormFields.jsx";

export default function ItemDetailModal({
  selectedItem, setSelectedItem,
  items, persist,
  itemEval, loadingEval,
  editing, setEditing, editForm, setEditForm, saveEdit,
  markWorn, removeWornDate, removeItem,
  wornDateInput, setWornDateInput,
  setItemStatus,
  openItemChat,
  openFilePicker, setCropSrc, setCropTarget,
  outfitPhotoRef, addOutfitPhoto,
  brands, addBrand, allCategories,
  stylingNotesInput, setStylingNotesInput,
}) {
  useEffect(() => { if (selectedItem) setStylingNotesInput(selectedItem.stylingNotes || ""); }, [selectedItem?.id]);

  if (!selectedItem) return null;

  if (editing && editForm) {
    return (
      <div style={{position:"fixed",inset:0,background:"#0d0d0d",zIndex:100,overflowY:"auto"}}>
        <div style={{padding:24,maxWidth:680,margin:"0 auto",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
            <button onClick={()=>setEditing(false)} style={ghostBtn}>← Cancel</button>
            <button onClick={saveEdit} style={{background:"#e8e2d8",color:"#111",border:"none",borderRadius:3,padding:"7px 20px",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontWeight:600}}>Save</button>
          </div>
          <FormFields
            form={editForm} setForm={setEditForm}
            onImageClick={()=>openFilePicker("edit")}
            onRecrop={()=>{setCropTarget("edit");setCropSrc(editForm?.originalImageData);}}
            brands={brands} onAddBrand={addBrand} categories={allCategories}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{position:"fixed",inset:0,background:"#0d0d0d",zIndex:100,overflowY:"auto"}}>
      <div style={{padding:24,maxWidth:680,margin:"0 auto",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
          <button onClick={()=>{setSelectedItem(null);setWornDateInput(null);}} style={ghostBtn}>← Back</button>
          <button onClick={()=>{setEditing(true);setEditForm({...selectedItem,customColor:"",customMaterial:"",materials:selectedItem.materials||(selectedItem.material?[selectedItem.material]:[])});}} style={{...chipStyle(false),fontSize:10}}>Edit</button>
        </div>

        {selectedItem.imageData
          ? <img src={selectedItem.imageData} style={{width:"100%",aspectRatio:"3/4",objectFit:"cover",borderRadius:3,marginBottom:14}}/>
          : <div style={{width:"100%",aspectRatio:"3/4",background:"#1a1a1a",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14,color:"#333",fontSize:12}}>No Photo</div>
        }

        {(selectedItem.outfitPhotos||[]).length>0 && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555",marginBottom:8}}>Worn Photos</div>
            <div style={{display:"flex",gap:8,overflowX:"auto",scrollbarWidth:"none",paddingBottom:4}}>
              {(selectedItem.outfitPhotos||[]).map((p,i)=>(
                <div key={i} style={{position:"relative",flexShrink:0}}>
                  <img src={p} style={{width:90,height:120,objectFit:"cover",borderRadius:3,display:"block"}}/>
                  <button onClick={()=>{const upd=items.map(it=>it.id===selectedItem.id?{...it,outfitPhotos:(it.outfitPhotos||[]).filter((_,j)=>j!==i)}:it);persist(upd);setSelectedItem(upd.find(it=>it.id===selectedItem.id));}} style={{position:"absolute",top:3,right:3,background:"rgba(0,0,0,0.75)",border:"none",color:"#aaa",fontSize:12,borderRadius:2,cursor:"pointer",padding:"1px 5px",lineHeight:1}}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <button onClick={()=>outfitPhotoRef.current.click()} style={{width:"100%",background:"transparent",border:"1px dashed #2a2a2a",color:"#666",borderRadius:3,padding:"10px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",marginBottom:14}}>+ Add Outfit Photo</button>

        <div style={{fontFamily:"Georgia, serif",fontSize:20,fontStyle:"italic",marginBottom:3}}>{selectedItem.name||"Unnamed"}</div>
        {selectedItem.brand && <div style={{fontSize:11,color:"#777",marginBottom:8}}>{selectedItem.brand}</div>}
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
          {selectedItem.color && <span style={chipStyle(false)}>{selectedItem.color}</span>}
          {fmtMaterials(selectedItem) && <span style={chipStyle(false)}>{fmtMaterials(selectedItem)}</span>}
          {selectedItem.season && selectedItem.season!=="All Year" && <span style={chipStyle(false)}>{selectedItem.season}</span>}
          {selectedItem.sleeveLength && selectedItem.sleeveLength!=="N/A" && <span style={chipStyle(false)}>{selectedItem.sleeveLength}</span>}
          {selectedItem.length && selectedItem.length!=="N/A" && <span style={chipStyle(false)}>{selectedItem.length}</span>}
          {(selectedItem.tags||[]).map(t=><span key={t} style={chipStyle(true)}>{t}</span>)}
        </div>
        {selectedItem.comments && <div style={{fontSize:12,color:"#777",fontStyle:"italic",lineHeight:1.6,marginBottom:12}}>{selectedItem.comments}</div>}
        <div style={{fontSize:10,color:"#999",lineHeight:1.8,marginBottom:14}}>
          {selectedItem.price && <span>Paid ${selectedItem.price.toFixed(2)}{selectedItem.wornDates?.length>0?` · $${(selectedItem.price/selectedItem.wornDates.length).toFixed(2)}/wear`:""} · </span>}
          {selectedItem.datePurchased && <span>Purchased {selectedItem.datePurchased} · </span>}
          Worn {selectedItem.wornDates?.length||0}×{selectedItem.wornDates?.length>0&&` · Last worn ${selectedItem.wornDates[selectedItem.wornDates.length-1]}`}
        </div>

        <div style={{marginBottom:8}}>
          {wornDateInput===null ? (
            <div style={{display:"flex",gap:8}}>
              <button type="button" onClick={()=>setWornDateInput(new Date().toISOString().split("T")[0])} style={{flex:1,background:"transparent",border:"1px solid #333",color:"#e8e2d8",borderRadius:3,padding:"10px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>Mark Worn</button>
              <button type="button" onClick={()=>removeItem(selectedItem.id)} style={{background:"transparent",border:"1px solid #3a2020",color:"#8a4a4a",borderRadius:3,padding:"10px 16px",fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer"}}>Remove</button>
            </div>
          ) : wornDateInput==="done" ? (
            <div style={{padding:"10px 14px",background:"#1a1a2a",border:"1px solid #333",borderRadius:3,fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"#6a9a6a",textAlign:"center"}}>✓ Logged</div>
          ) : (
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input type="date" value={wornDateInput} onChange={e=>setWornDateInput(e.target.value)} style={{...inputStyle,marginBottom:0,flex:1}}/>
              <button type="button" onClick={()=>{markWorn(selectedItem.id,wornDateInput);setWornDateInput("done");setTimeout(()=>setWornDateInput(null),1200);}} style={{background:"#e8e2d8",color:"#111",border:"none",borderRadius:3,padding:"10px 14px",fontSize:11,letterSpacing:1,cursor:"pointer",fontWeight:600,flexShrink:0,whiteSpace:"nowrap"}}>Log Date</button>
              <button type="button" onClick={()=>setWornDateInput(null)} style={{...ghostBtn,fontSize:18,padding:"0 4px",flexShrink:0}}>✕</button>
            </div>
          )}
        </div>

        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <button onClick={()=>setItemStatus(selectedItem.id,selectedItem.status==="donate"?null:"donate")} style={{flex:1,background:selectedItem.status==="donate"?"#c8601022":"transparent",border:`1px solid ${selectedItem.status==="donate"?"#c86010":"#333"}`,color:selectedItem.status==="donate"?"#d4752a":"#888",borderRadius:3,padding:"10px",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>{selectedItem.status==="donate"?"✓ To Donate":"Mark to Donate"}</button>
          <button onClick={()=>setItemStatus(selectedItem.id,selectedItem.status==="sell"?null:"sell")} style={{flex:1,background:selectedItem.status==="sell"?"#3a8a4a22":"transparent",border:`1px solid ${selectedItem.status==="sell"?"#4a9a5a":"#333"}`,color:selectedItem.status==="sell"?"#4a9a5a":"#888",borderRadius:3,padding:"10px",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>{selectedItem.status==="sell"?"✓ To Sell":"Mark to Sell"}</button>
        </div>

        <button onClick={()=>openItemChat(selectedItem)} style={{width:"100%",background:"transparent",border:"1px solid #2a2a2a",color:"#888",borderRadius:3,padding:"10px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",marginBottom:16}}>Chat about this →</button>

        {selectedItem.wornDates?.length>0 && (
          <div style={{marginBottom:18}}>
            <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555",marginBottom:8}}>Wear History</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {[...selectedItem.wornDates].map((d,origIdx)=>({d,origIdx})).reverse().slice(0,24).map(({d,origIdx})=>(
                <span key={origIdx} style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,color:"#666",background:"#1a1a1a",padding:"3px 4px 3px 8px",borderRadius:2}}>
                  {d}<button onClick={()=>removeWornDate(selectedItem.id,origIdx)} style={{background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:13,padding:"0 3px",lineHeight:1,display:"flex",alignItems:"center"}}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555",marginBottom:6}}>Styling Notes</div>
        <textarea
          value={stylingNotesInput}
          onChange={e=>setStylingNotesInput(e.target.value)}
          onBlur={()=>{
            if (stylingNotesInput !== (selectedItem.stylingNotes||"")) {
              const upd = items.map(i=>i.id===selectedItem.id?{...i,stylingNotes:stylingNotesInput}:i);
              persist(upd); setSelectedItem(upd.find(i=>i.id===selectedItem.id));
            }
          }}
          placeholder="e.g. only wear tucked in, boat days only, needs a belt..."
          style={{width:"100%",background:"#1a1a1a",border:"1px solid #222",borderRadius:3,padding:12,color:"#e8e2d8",fontSize:12,resize:"vertical",minHeight:56,boxSizing:"border-box",marginBottom:18,fontFamily:"inherit",lineHeight:1.5}}
        />

        <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#555",marginBottom:10}}>Style Verdict</div>
        {loadingEval
          ? <div style={{color:"#444",fontSize:12,padding:"16px 0",fontStyle:"italic"}}>Evaluating...</div>
          : <div>
              <div style={{background:"#1a1a1a",border:"1px solid #222",borderRadius:3,padding:16,fontSize:13,lineHeight:1.8,color:"#c8c0b0",whiteSpace:"pre-wrap",marginBottom:10}}>{itemEval}</div>
              {selectedItem.keepNote
                ? <div style={{fontSize:11,color:"#6a9a6a",paddingBottom:8}}>✓ Marked as keep</div>
                : <button type="button" onClick={()=>{const upd=items.map(i=>i.id===selectedItem.id?{...i,keepNote:"Shelly wants to keep this"}:i);persist(upd);setSelectedItem(upd.find(i=>i.id===selectedItem.id));}} style={{background:"transparent",border:"1px solid #333",color:"#666",borderRadius:3,padding:"8px 16px",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",marginBottom:8}}>I disagree — keeping this</button>
              }
            </div>
        }
      </div>
    </div>
  );
}
