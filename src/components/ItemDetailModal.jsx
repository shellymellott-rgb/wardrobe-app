import { useEffect, useState } from "react";
import { fmtMaterials } from "../utils/normalizeItem.js";
import { COLORS } from "../constants.js";
import { chipStyle, inputStyle, ghostBtn } from "../styles.js";
import { T } from "../theme.js";
import FormFields from "./FormFields.jsx";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function ItemDetailModal({
  selectedItem, setSelectedItem,
  items, persist,
  itemEval, loadingEval,
  editing, setEditing, editForm, setEditForm, saveEdit, saving = false, saveError = "",
  itemNavList = [], onNavigate,
  markWorn, removeWornDate, removeItem,
  wornDateInput, setWornDateInput,
  setItemStatus,
  openItemChat,
  openFilePicker, onImageDrop, setCropSrc, setCropTarget,
  outfitPhotoRef, addOutfitPhoto,
  brands, addBrand, allCategories, allCustomColors = [], customCategories = [], addCustomCategory,
  stylingNotesInput, setStylingNotesInput,
}) {
  useEffect(() => { if (selectedItem) setStylingNotesInput(selectedItem.stylingNotes || ""); }, [selectedItem?.id]);
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => { setConfirmRemove(false); }, [selectedItem?.id]);

  if (!selectedItem) return null;

  if (editing && editForm) {
    return (
      <div style={{position:"fixed",inset:0,background:T.bg,zIndex:100,overflowY:"auto"}}>
        <div style={{padding:24,maxWidth:680,margin:"0 auto",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
            <button onClick={()=>setEditing(false)} style={ghostBtn}>← Cancel</button>
            <button onClick={saveEdit} disabled={saving} style={{background:saving?T.rule:T.ink,color:saving?"#888":T.surface,border:"none",borderRadius:3,padding:"7px 20px",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:saving?"not-allowed":"pointer",fontWeight:600}}>{saving?"Uploading image...":"Save"}</button>
          </div>
          {saveError && <div style={{background:"#fdf0f0",border:"1px solid #e8b0b0",borderRadius:3,padding:"10px 12px",marginBottom:12,fontSize:11,color:T.hot,lineHeight:1.5}}>{saveError}</div>}
          <FormFields
            form={editForm} setForm={setEditForm}
            onImageClick={()=>openFilePicker("edit")}
            onImageDrop={onImageDrop}
            onRecrop={()=>{setCropTarget("edit");setCropSrc(editForm?.originalImageData);}}
            brands={brands} onAddBrand={addBrand} categories={allCategories} allCustomColors={allCustomColors} customCategories={customCategories} onAddCustomCategory={addCustomCategory}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{position:"fixed",inset:0,background:T.bg,zIndex:100,overflowY:"auto"}}>
      <div style={{padding:24,maxWidth:680,margin:"0 auto",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
          <button onClick={()=>{setSelectedItem(null);setWornDateInput(null);}} style={ghostBtn}>← Back</button>
          <button onClick={()=>{setEditing(true);setEditForm({...selectedItem,customColor:"",customMaterial:"",customColors:COLORS.includes(selectedItem.color)||!selectedItem.color?[]:[selectedItem.color],materials:selectedItem.materials||(selectedItem.material?[selectedItem.material]:[])});}} style={{...chipStyle(false),fontSize:10}}>Edit</button>
        </div>

        {selectedItem.imageData
          ? <img src={selectedItem.imageData} style={{width:"100%",aspectRatio:"3/4",objectFit:"cover",borderRadius:3,marginBottom:14}}/>
          : <div style={{width:"100%",aspectRatio:"3/4",background:T.surface,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14,color:T.rule,fontSize:12}}>No Photo</div>
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
        <button onClick={()=>outfitPhotoRef.current.click()} style={{width:"100%",background:"transparent",border:`1px dashed ${T.rule}`,color:T.ink3,borderRadius:3,padding:"10px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",marginBottom:14}}>+ Add Outfit Photo</button>

        {itemNavList.length > 1 && (() => {
          const idx = itemNavList.findIndex(i => String(i.id) === String(selectedItem.id));
          const prev = idx > 0 ? itemNavList[idx - 1] : null;
          const next = idx < itemNavList.length - 1 ? itemNavList[idx + 1] : null;
          return (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <button
                onClick={() => prev && onNavigate(prev)}
                disabled={!prev}
                style={{background:"none",border:"none",color:prev?T.ink:T.rule,fontSize:20,cursor:prev?"pointer":"default",padding:"4px 8px",lineHeight:1}}
              >←</button>
              <div style={{fontSize:9,color:"#555",letterSpacing:2,textTransform:"uppercase"}}>
                {idx + 1} / {itemNavList.length}
              </div>
              <button
                onClick={() => next && onNavigate(next)}
                disabled={!next}
                style={{background:"none",border:"none",color:next?T.ink:T.rule,fontSize:20,cursor:next?"pointer":"default",padding:"4px 8px",lineHeight:1}}
              >→</button>
            </div>
          );
        })()}

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
              <button type="button" onClick={()=>setWornDateInput(new Date().toISOString().split("T")[0])} style={{flex:1,background:"transparent",border:`1px solid ${T.rule}`,color:T.ink,borderRadius:3,padding:"10px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>Mark Worn</button>
              {confirmRemove
                ? <div style={{display:"flex",gap:8,flex:1}}>
                    <span style={{flex:1,display:"flex",alignItems:"center",fontSize:10,color:"#8a4a4a",letterSpacing:0.5}}>Remove this item?</span>
                    <button type="button" onClick={()=>removeItem(selectedItem.id)} style={{background:"#fdf0f0",border:"1px solid #e8b0b0",color:T.hot,borderRadius:3,padding:"10px 14px",fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontWeight:600}}>Yes, remove</button>
                    <button type="button" onClick={()=>setConfirmRemove(false)} style={{background:"transparent",border:`1px solid ${T.rule}`,color:T.ink3,borderRadius:3,padding:"10px 14px",fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer"}}>Cancel</button>
                  </div>
                : <button type="button" onClick={()=>setConfirmRemove(true)} style={{background:"transparent",border:`1px solid ${T.hot}`,color:T.hot,borderRadius:3,padding:"10px 16px",fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer"}}>Remove</button>
              }
            </div>
          ) : wornDateInput==="done" ? (
            <div style={{padding:"10px 14px",background:"#f0f7f0",border:`1px solid ${T.sage}`,borderRadius:3,fontSize:10,letterSpacing:2,textTransform:"uppercase",color:T.sage,textAlign:"center"}}>✓ Logged</div>
          ) : (
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <DatePicker
                selected={wornDateInput && wornDateInput !== "done" ? new Date(wornDateInput) : null}
                onChange={date => setWornDateInput(date ? date.toISOString().split("T")[0] : "")}
                dateFormat="MM/dd/yyyy"
                placeholderText="mm/dd/yyyy"
                className="wardrobe-datepicker"
              />
              <button type="button" onClick={()=>{markWorn(selectedItem.id,wornDateInput);setWornDateInput("done");setTimeout(()=>setWornDateInput(null),1200);}} style={{background:T.ink,color:T.surface,border:"none",borderRadius:3,padding:"10px 14px",fontSize:11,letterSpacing:1,cursor:"pointer",fontWeight:600,flexShrink:0,whiteSpace:"nowrap"}}>Log Date</button>
              <button type="button" onClick={()=>setWornDateInput(null)} style={{...ghostBtn,fontSize:18,padding:"0 4px",flexShrink:0}}>✕</button>
            </div>
          )}
        </div>

        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <button onClick={()=>setItemStatus(selectedItem.id,selectedItem.status==="donate"?null:"donate")} style={{flex:1,background:selectedItem.status==="donate"?"#c8601022":"transparent",border:`1px solid ${selectedItem.status==="donate"?T.hot:T.rule}`,color:selectedItem.status==="donate"?T.hot:T.ink3,borderRadius:3,padding:"10px",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>{selectedItem.status==="donate"?"✓ To Donate":"Mark to Donate"}</button>
          <button onClick={()=>setItemStatus(selectedItem.id,selectedItem.status==="sell"?null:"sell")} style={{flex:1,background:selectedItem.status==="sell"?"#3a8a4a22":"transparent",border:`1px solid ${selectedItem.status==="sell"?T.sage:T.rule}`,color:selectedItem.status==="sell"?T.sage:T.ink3,borderRadius:3,padding:"10px",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>{selectedItem.status==="sell"?"✓ To Sell":"Mark to Sell"}</button>
        </div>

        <button onClick={()=>openItemChat(selectedItem)} style={{width:"100%",background:"transparent",border:`1px solid ${T.rule}`,color:T.ink3,borderRadius:3,padding:"10px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",marginBottom:16}}>Chat about this →</button>

        {selectedItem.wornDates?.length>0 && (
          <div style={{marginBottom:18}}>
            <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555",marginBottom:8}}>Wear History</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {[...selectedItem.wornDates].map((d,origIdx)=>({d,origIdx})).reverse().slice(0,24).map(({d,origIdx})=>(
                <span key={origIdx} style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,color:T.ink3,background:T.surface,padding:"3px 4px 3px 8px",borderRadius:2}}>
                  {d}<button onClick={()=>removeWornDate(selectedItem.id,origIdx)} style={{background:"none",border:"none",color:T.ink3,cursor:"pointer",fontSize:13,padding:"0 3px",lineHeight:1,display:"flex",alignItems:"center"}}>×</button>
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
          style={{width:"100%",background:T.surface,border:`1px solid ${T.rule}`,borderRadius:3,padding:12,color:T.ink,fontSize:12,resize:"vertical",minHeight:56,boxSizing:"border-box",marginBottom:18,fontFamily:"inherit",lineHeight:1.5}}
        />

        <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#555",marginBottom:10}}>Style Verdict</div>
        {loadingEval
          ? <div style={{color:"#444",fontSize:12,padding:"16px 0",fontStyle:"italic"}}>Evaluating...</div>
          : <div>
              <div style={{background:T.surface,border:`1px solid ${T.rule}`,borderRadius:3,padding:16,fontSize:13,lineHeight:1.8,color:T.ink2,whiteSpace:"pre-wrap",marginBottom:10}}>{itemEval}</div>
              {selectedItem.keepNote
                ? <div style={{fontSize:11,color:"#6a9a6a",paddingBottom:8}}>✓ Marked as keep</div>
                : <button type="button" onClick={()=>{const upd=items.map(i=>i.id===selectedItem.id?{...i,keepNote:"Shelly wants to keep this"}:i);persist(upd);setSelectedItem(upd.find(i=>i.id===selectedItem.id));}} style={{background:"transparent",border:`1px solid ${T.rule}`,color:T.ink3,borderRadius:3,padding:"8px 16px",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",marginBottom:8}}>I disagree — keeping this</button>
              }
            </div>
        }
      </div>
    </div>
  );
}
