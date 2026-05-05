import { useState, useRef } from "react";
import { chipStyle, inputStyle, ghostBtn } from "../styles.js";
import CompositeOutfitCard from "./CompositeOutfitCard.jsx";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function toLocalDate(dateStr) {
  const [y,m,d] = dateStr.split("-").map(Number);
  return new Date(y, m-1, d);
}

function formatDate(dateStr) {
  const d = toLocalDate(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export default function JournalView({ items, user, journalEntries, journalLoading, onEntrySaved, onEntryDeleted, markWorn, setChatInput, setView, sbSaveJournalEntry, sbDeleteJournalEntry }) {
  const [calView, setCalView] = useState("month"); // "month" | "week" | "day"
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryPhoto, setEntryPhoto] = useState(null);
  const [entryItemIds, setEntryItemIds] = useState([]);
  const [entryNotes, setEntryNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const photoRef = useRef();

  const today = todayStr();
  const isFuture = selectedDate > today;

  // Build entry map for quick lookup
  const entryMap = {};
  journalEntries.forEach(e => { entryMap[e.date] = e; });

  const selectedEntry = entryMap[selectedDate];

  // Calendar helpers
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
  }

  async function saveEntry() {
    if (!user?.id) return;
    setSaving(true);
    const entry = {
      id: selectedEntry?.id || crypto.randomUUID(),
      user_id: user.id,
      date: selectedDate,
      photo: entryPhoto || selectedEntry?.photo || null,
      item_ids: entryItemIds,
      notes: entryNotes,
    };
    const ok = await sbSaveJournalEntry(entry);
    if (ok) {
      // Mark items as worn on this date
      entryItemIds.forEach(id => markWorn(id, selectedDate));
      await onEntrySaved();
      setShowEntryForm(false);
      setEntryPhoto(null);
      setEntryItemIds([]);
      setEntryNotes("");
    }
    setSaving(false);
  }

  function openEntryForm() {
    if (selectedEntry) {
      setEntryPhoto(selectedEntry.photo || null);
      setEntryItemIds(selectedEntry.item_ids || []);
      setEntryNotes(selectedEntry.notes || "");
    } else {
      setEntryPhoto(null);
      setEntryItemIds([]);
      setEntryNotes("");
    }
    setShowEntryForm(true);
  }

  async function deleteEntry() {
    if (!selectedEntry || !user?.id) return;
    await sbDeleteJournalEntry(selectedEntry.id, user.id);
    await onEntryDeleted();
  }

  function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setEntryPhoto(ev.target.result);
    reader.readAsDataURL(file);
  }

  const taggedItems = entryItemIds.map(id => items.find(i => String(i.id) === String(id))).filter(Boolean);
  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(itemSearch.toLowerCase()) &&
    !entryItemIds.includes(String(i.id))
  );

  // Month calendar render
  function renderMonthCal() {
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDayOfMonth(calYear, calMonth);
    const cells = [];
    // Build a map of date -> first worn item for dates with no journal entry
    const wornMap = {};
    items.forEach(item => {
      (item.wornDates || []).forEach(date => {
        if (!entryMap[date] && !wornMap[date]) {
          wornMap[date] = item;
        }
      });
    });
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <button onClick={()=>{ if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); }} style={{...ghostBtn,padding:"4px 10px"}}>‹</button>
          <div style={{fontSize:13,fontWeight:600,color:"#e8e2d8"}}>{MONTHS[calMonth]} {calYear}</div>
          <button onClick={()=>{ if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); }} style={{...ghostBtn,padding:"4px 10px"}}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,marginBottom:1}}>
          {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:8,color:"#444",letterSpacing:1,padding:"4px 0"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
          {cells.map((day, i) => {
            if (!day) return <div key={i}/>;
            const dateStr = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const entry = entryMap[dateStr];
            const wornItem = !entry ? wornMap[dateStr] : null;
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            return (
              <div key={i} onClick={()=>setSelectedDate(dateStr)} style={{
                cursor:"pointer",
                background: isSelected ? "#e8e2d8" : isToday ? "#1a1a1a" : "transparent",
                border: isToday && !isSelected ? "1px solid #333" : "1px solid transparent",
                borderRadius:4,
                aspectRatio:"3/4",
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                position:"relative",overflow:"hidden",
              }}>
                {entry?.photo
                  ? <img src={entry.photo} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.7}}/>
                  : entry?.item_ids?.length > 0
                    ? (() => {
                        const firstItem = items.find(i => String(i.id) === String(entry.item_ids[0]));
                        return firstItem?.imageThumb || firstItem?.imageData
                          ? <img src={firstItem.imageThumb ?? firstItem.imageData} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.5}}/>
                          : <div style={{position:"absolute",inset:0,background:"#b8976a33"}}/>;
                      })()
                  : wornItem?.imageThumb || wornItem?.imageData
                    ? <img src={wornItem.imageThumb ?? wornItem.imageData} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.35}}/>
                  : null
                }
                <div style={{position:"relative",fontSize:10,fontWeight:isToday||isSelected?600:400,color:isSelected?"#111":isToday?"#e8e2d8":"#888"}}>{day}</div>
                {(entry || wornItem) && <div style={{position:"relative",width:4,height:4,borderRadius:"50%",background:"#b8976a",marginTop:1}}/>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Week calendar render
  function renderWeekCal() {
    const d = toLocalDate(selectedDate);
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - d.getDay());
    const days = Array.from({length:7}, (_, i) => {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      return `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,"0")}-${String(day.getDate()).padStart(2,"0")}`;
    });

    return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <button onClick={()=>{ const d=toLocalDate(selectedDate); d.setDate(d.getDate()-7); setSelectedDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`); }} style={{...ghostBtn,padding:"4px 10px"}}>‹</button>
          <div style={{fontSize:12,color:"#888"}}>{formatDate(days[0])} — {formatDate(days[6])}</div>
          <button onClick={()=>{ const d=toLocalDate(selectedDate); d.setDate(d.getDate()+7); setSelectedDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`); }} style={{...ghostBtn,padding:"4px 10px"}}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
          {days.map(dateStr => {
            const entry = entryMap[dateStr];
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const d = toLocalDate(dateStr);
            return (
              <div key={dateStr} onClick={()=>setSelectedDate(dateStr)} style={{cursor:"pointer",borderRadius:6,overflow:"hidden",border:isSelected?"1px solid #e8e2d8":isToday?"1px solid #333":"1px solid #1a1a1a"}}>
                <div style={{background:isSelected?"#e8e2d8":"#111",padding:"4px",textAlign:"center"}}>
                  <div style={{fontSize:8,color:isSelected?"#111":"#555",letterSpacing:1}}>{DAYS[d.getDay()]}</div>
                  <div style={{fontSize:11,fontWeight:600,color:isSelected?"#111":isToday?"#e8e2d8":"#888"}}>{d.getDate()}</div>
                </div>
                <div style={{aspectRatio:"3/4",background:"#141414",position:"relative"}}>
                  {entry?.photo
                    ? <img src={entry.photo} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    : entry?.item_ids?.length > 0
                      ? (() => { const its = entry.item_ids.map(id=>items.find(i=>String(i.id)===String(id))).filter(Boolean); return its[0]?.imageThumb ? <img src={its[0].imageThumb} style={{width:"100%",height:"100%",objectFit:"cover",opacity:0.6}}/> : <div style={{width:"100%",height:"100%",background:"#b8976a11"}}/>; })()
                      : null
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{padding:"24px 24px 100px",fontFamily:"'DM Sans', system-ui, sans-serif"}}>

      {/* Header + view toggle */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#555"}}>Fashion Journal</div>
        <div style={{display:"flex",gap:4}}>
          {["month","week"].map(v=>(
            <button key={v} onClick={()=>setCalView(v)} style={{...chipStyle(calView===v),padding:"4px 10px",fontSize:9,textTransform:"capitalize"}}>{v}</button>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div style={{marginBottom:24}}>
        {calView==="month" ? renderMonthCal() : renderWeekCal()}
      </div>

      {/* Selected day panel */}
      <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:8,overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid #1a1a1a",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:12,fontWeight:600,color:"#e8e2d8"}}>{formatDate(selectedDate)}{selectedDate===today?" · Today":isFuture?" · Planned":""}</div>
          <div style={{display:"flex",gap:6}}>
            {selectedEntry && (
              <button onClick={deleteEntry} style={{...ghostBtn,fontSize:9,color:"#666"}}>Delete</button>
            )}
            <button onClick={openEntryForm} style={{background:"#e8e2d8",color:"#111",border:"none",borderRadius:4,padding:"5px 12px",fontSize:9,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontWeight:600}}>
              {selectedEntry ? "Edit" : isFuture ? "+ Plan" : "+ Log"}
            </button>
          </div>
        </div>

        {selectedEntry ? (
          <div>
            {selectedEntry.photo && (
              <img src={selectedEntry.photo} style={{width:"100%",maxHeight:300,objectFit:"cover",display:"block"}}/>
            )}
            {selectedEntry.item_ids?.length > 0 && (
              <div style={{padding:"12px 16px"}}>
                <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555",marginBottom:10}}>Items worn</div>
                <div style={{display:"flex",gap:8,overflowX:"auto",scrollbarWidth:"none"}}>
                  {selectedEntry.item_ids.map(id => {
                    const item = items.find(i => String(i.id) === String(id));
                    if (!item) return null;
                    return (
                      <div key={id} style={{flexShrink:0,width:72}}>
                        <div style={{width:72,height:96,background:"#141414",borderRadius:6,overflow:"hidden",border:"1px solid #1e1e1e"}}>
                          {(item.imageThumb||item.imageData) && <img src={item.imageThumb??item.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
                        </div>
                        <div style={{fontSize:8,color:"#555",marginTop:3,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {selectedEntry.notes && (
              <div style={{padding:"0 16px 12px",fontSize:11,color:"#777",lineHeight:1.6}}>{selectedEntry.notes}</div>
            )}
            <div style={{padding:"0 16px 14px",display:"flex",gap:8}}>
              <button onClick={()=>{ setChatInput?.(`Let's talk about my outfit on ${formatDate(selectedDate)}: ${selectedEntry.item_ids.map(id=>items.find(i=>String(i.id)===String(id))?.name).filter(Boolean).join(", ")}`); setView?.("chat"); }} style={{...ghostBtn,fontSize:9,flex:1,textAlign:"center"}}>Chat about this →</button>
            </div>
          </div>
        ) : (
          <div style={{padding:"24px 16px",textAlign:"center",color:"#333",fontSize:11}}>
            {isFuture ? "No outfit planned yet" : "Nothing logged for this day"}
          </div>
        )}
      </div>

      {/* Entry form modal */}
      {showEntryForm && (
        <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.92)",overflowY:"auto"}}>
          <div style={{maxWidth:480,margin:"0 auto",padding:"24px 24px 100px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:600,color:"#e8e2d8"}}>{isFuture?"Plan Outfit":"Log Outfit"} · {formatDate(selectedDate)}</div>
              <button onClick={()=>setShowEntryForm(false)} style={{...ghostBtn,fontSize:18}}>×</button>
            </div>

            {/* Photo */}
            <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}}/>
            <div onClick={()=>photoRef.current.click()} style={{width:"100%",aspectRatio:"3/4",background:"#141414",borderRadius:8,overflow:"hidden",cursor:"pointer",marginBottom:16,border:"1px dashed #2a2a2a",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {entryPhoto
                ? <img src={entryPhoto} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                : <div style={{textAlign:"center",color:"#444"}}>
                    <div style={{fontSize:28,marginBottom:8}}>📷</div>
                    <div style={{fontSize:10,letterSpacing:1,textTransform:"uppercase"}}>Add photo (optional)</div>
                  </div>
              }
            </div>
            {entryPhoto && <button onClick={()=>setEntryPhoto(null)} style={{...ghostBtn,fontSize:9,marginBottom:16,width:"100%"}}>Remove photo</button>}

            {/* Tagged items */}
            <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#555",marginBottom:8}}>Items worn</div>
            {taggedItems.length > 0 && (
              <div style={{display:"flex",gap:8,overflowX:"auto",scrollbarWidth:"none",marginBottom:12}}>
                {taggedItems.map(item => (
                  <div key={item.id} style={{flexShrink:0,width:64,position:"relative"}}>
                    <div style={{width:64,height:85,background:"#141414",borderRadius:6,overflow:"hidden"}}>
                      {(item.imageThumb||item.imageData) && <img src={item.imageThumb??item.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
                    </div>
                    <button onClick={()=>setEntryItemIds(ids=>ids.filter(id=>id!==String(item.id)))} style={{position:"absolute",top:-4,right:-4,background:"#333",border:"none",borderRadius:"50%",width:16,height:16,color:"#fff",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>×</button>
                    <div style={{fontSize:7,color:"#555",marginTop:2,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Item search */}
            <input value={itemSearch} onChange={e=>setItemSearch(e.target.value)} placeholder="Search items to add..." style={{...inputStyle,marginBottom:8}}/>
            <div style={{maxHeight:180,overflowY:"auto",marginBottom:16}}>
              {filteredItems.slice(0,20).map(item=>(
                <div key={item.id} onClick={()=>{setEntryItemIds(ids=>[...ids,String(item.id)]);setItemSearch("");}} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #1a1a1a",cursor:"pointer"}}>
                  <div style={{width:32,height:42,background:"#141414",borderRadius:4,overflow:"hidden",flexShrink:0}}>
                    {(item.imageThumb||item.imageData) && <img src={item.imageThumb??item.imageData} style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
                  </div>
                  <div>
                    <div style={{fontSize:11,color:"#c8c0b0"}}>{item.name}</div>
                    <div style={{fontSize:9,color:"#555"}}>{item.brand||item.category}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            <textarea value={entryNotes} onChange={e=>setEntryNotes(e.target.value)} placeholder="How did you feel? Where did you go? Any styling notes..." style={{...inputStyle,minHeight:80,resize:"vertical",marginBottom:16}}/>

            <button onClick={saveEntry} disabled={saving||(!entryPhoto&&entryItemIds.length===0)} style={{width:"100%",background:saving||(!entryPhoto&&entryItemIds.length===0)?"#1a1a1a":"#e8e2d8",color:saving||(!entryPhoto&&entryItemIds.length===0)?"#444":"#111",border:"none",borderRadius:6,padding:"14px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontWeight:700}}>
              {saving ? "Saving..." : isFuture ? "Save Plan" : "Log Outfit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
