import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { T, ML, tabStyle } from "../theme.js";
import { inputStyle } from "../styles.js";
import { sbCreateOutfit } from "../supabase.js";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

function toLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(dateStr) {
  const d = toLocalDate(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function SectionRule({ n, label, color }) {
  return (
    <div style={{ display:"flex", alignItems:"stretch", borderTop:`1px solid ${T.ruleStrong}`, borderBottom:`1px solid ${T.ruleStrong}`, background:T.surface }}>
      <div style={{ width:48, background:color, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:T.mono, fontSize:11, color:"#fff", letterSpacing:".1em", flexShrink:0 }}>
        {String(n).padStart(2,"0")}
      </div>
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px" }}>
        <div style={{ fontFamily:T.mono, fontSize:11, letterSpacing:".24em", color:color, textTransform:"uppercase", padding:"12px 0" }}>{label}</div>
        <div style={{ fontFamily:T.mono, fontSize:9.5, letterSpacing:".22em", color:T.ink3, textTransform:"uppercase" }}>SS '26</div>
      </div>
    </div>
  );
}

const JournalView = forwardRef(function JournalView({ items, user, journalEntries, journalLoading, onEntrySaved, onEntryDeleted, markWorn, setChatInput, setView, sbSaveJournalEntry, sbDeleteJournalEntry }, ref) {
  const [calView, setCalView] = useState("month");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryPhoto, setEntryPhoto] = useState(null);
  const [entryItemIds, setEntryItemIds] = useState([]);
  const [entryNotes, setEntryNotes] = useState("");

  useImperativeHandle(ref, () => ({
    prefillEntry(date, itemIds, notes) {
      setSelectedDate(date);
      setEntryItemIds(itemIds);
      setEntryNotes(notes || "");
      setShowEntryForm(true);
    },
  }));
  const [saving, setSaving] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const photoRef = useRef();

  const today = todayStr();
  const isFuture = selectedDate > today;

  // Build entry map
  const entryMap = {};
  journalEntries.forEach(e => { entryMap[e.date] = e; });

  // Build worn map for dates with no journal entry
  const wornMap = {};
  items.forEach(item => {
    (item.wornDates || []).forEach(date => {
      if (!entryMap[date]) {
        if (!wornMap[date]) wornMap[date] = [];
        wornMap[date].push(item);
      }
    });
  });

  const selectedEntry = entryMap[selectedDate];

  // Derived: pieces to show in the detail strip for the selected date
  const detailEntryItems = selectedEntry?.item_ids?.length > 0
    ? selectedEntry.item_ids.map(id => items.find(i => String(i.id) === String(id))).filter(Boolean)
    : [];
  const detailPieces = detailEntryItems.length > 0 ? detailEntryItems : (wornMap[selectedDate] || []);
  const detailNotes = selectedEntry?.notes || "";

  async function saveAsOutfit() {
    if (!user?.id || detailPieces.length === 0) return;
    const id = crypto.randomUUID();
    const d = toLocalDate(selectedDate);
    const name = `${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()} Look`;
    const itemIds = detailPieces.map(p => String(p.id));
    try { await sbCreateOutfit({ id, user_id: user.id, name }, itemIds); }
    catch (e) { console.error("[saveAsOutfit]", e.message); }
  }

  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
  function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay(); }

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

  // Month calendar
  function renderMonthCal() {
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDayOfMonth(calYear, calMonth);
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
      <div>
        {/* Nav row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px", borderBottom: `1px solid ${T.rule}` }}>
          <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
            style={{ background: "none", border: `1px solid ${T.rule}`, color: T.ink3, fontFamily: T.mono, fontSize: 14, cursor: "pointer", padding: "4px 10px" }}>‹</button>
          <div style={{ fontFamily: T.serif, fontSize: 22, color: T.ink }}>
            {MONTHS[calMonth]}{" "}
            <em style={{ fontStyle: "italic", color: T.sage }}>{calYear}</em>
          </div>
          <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
            style={{ background: "none", border: `1px solid ${T.rule}`, color: T.ink3, fontFamily: T.mono, fontSize: 14, cursor: "pointer", padding: "4px 10px" }}>›</button>
        </div>
        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: `1px solid ${T.rule}` }}>
          {DAYS.map((d, i) => (
            <div key={d} style={{ textAlign: "center", ...ML, fontSize: 9, color: T.ink3, padding: "8px 0", borderRight: i < 6 ? `1px solid ${T.rule}` : "none" }}>{d}</div>
          ))}
        </div>
        {/* Calendar grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} style={{ aspectRatio: "1/1", borderRight: `1px solid ${T.rule}`, borderBottom: `1px solid ${T.rule}` }} />;
            const dateStr = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const entry = entryMap[dateStr];
            const wornItems = !entry ? (wornMap[dateStr] || []) : [];
            const entryItems = entry?.item_ids?.length > 0
              ? entry.item_ids.map(id => items.find(i => String(i.id) === String(id))).filter(Boolean)
              : [];
            const allPieces = entryItems.length > 0 ? entryItems : wornItems;
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const col = i % 7;
            const hasPieces = allPieces.length > 0;
            return (
              <div key={i} onClick={() => setSelectedDate(dateStr)} style={{
                position: "relative", cursor: "pointer", overflow: "hidden",
                aspectRatio: "1/1",
                borderRight: col < 6 ? `1px solid ${T.rule}` : "none",
                borderBottom: `1px solid ${T.rule}`,
                background: isSelected ? T.paper : T.surface,
                outline: isSelected ? `2px solid ${T.ink}` : "none",
                outlineOffset: -2,
                zIndex: isSelected ? 2 : 1,
              }}>
                {/* Single entry photo when no item pieces */}
                {entry?.photo && !hasPieces && (
                  <img src={entry.photo} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {/* 2×2 piece thumbnail collage */}
                {hasPieces && (
                  <div style={{
                    position: "absolute", inset: 0, display: "grid",
                    gridTemplateColumns: allPieces.length === 1 ? "1fr" : "1fr 1fr",
                    gridTemplateRows: allPieces.length <= 2 ? "1fr" : "1fr 1fr",
                    gap: 1, background: T.rule,
                  }}>
                    {allPieces.slice(0, 4).map((p, pi) => (
                      <div key={pi} style={{ background: T.surface, overflow: "hidden" }}>
                        {(p.imageThumb || p.imageData)
                          ? <img src={p.imageThumb ?? p.imageData} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          : <div style={{ width: "100%", height: "100%", background: T.paper }} />
                        }
                      </div>
                    ))}
                  </div>
                )}
                {/* Date number — white pill when pieces present */}
                <div style={{
                  position: "absolute", top: 6, left: 8, zIndex: 3,
                  fontFamily: T.mono, fontSize: 10, letterSpacing: ".08em",
                  color: hasPieces ? T.ink : isToday ? T.hot : T.ink3,
                  background: hasPieces ? "rgba(255,255,255,.85)" : "transparent",
                  padding: hasPieces ? "1px 5px" : 0,
                }}>
                  {String(day).padStart(2, "0")}
                </div>
                {/* +N overflow chip */}
                {allPieces.length > 4 && (
                  <div style={{ position: "absolute", bottom: 6, right: 8, fontFamily: T.mono, fontSize: 9, letterSpacing: ".1em", color: T.ink, background: "rgba(255,255,255,.85)", padding: "1px 5px", zIndex: 3 }}>
                    +{allPieces.length - 4}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Week calendar
  function renderWeekCal() {
    const d = toLocalDate(selectedDate);
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - d.getDay());
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      return `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,"0")}-${String(day.getDate()).padStart(2,"0")}`;
    });

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px", borderBottom: `1px solid ${T.rule}` }}>
          <button onClick={() => { const d = toLocalDate(selectedDate); d.setDate(d.getDate()-7); setSelectedDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`); }}
            style={{ background: "none", border: `1px solid ${T.rule}`, color: T.ink3, fontFamily: T.mono, fontSize: 14, cursor: "pointer", padding: "4px 10px" }}>‹</button>
          <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3 }}>{formatDate(days[0])} — {formatDate(days[6])}</div>
          <button onClick={() => { const d = toLocalDate(selectedDate); d.setDate(d.getDate()+7); setSelectedDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`); }}
            style={{ background: "none", border: `1px solid ${T.rule}`, color: T.ink3, fontFamily: T.mono, fontSize: 14, cursor: "pointer", padding: "4px 10px" }}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: `1px solid ${T.rule}` }}>
          {DAYS.map((d, i) => (
            <div key={d} style={{ textAlign: "center", ...ML, fontSize: 9, color: T.ink3, padding: "8px 0", borderRight: i < 6 ? `1px solid ${T.rule}` : "none" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {days.map((dateStr, i) => {
            const entry = entryMap[dateStr];
            const wornItems = !entry ? (wornMap[dateStr] || []) : [];
            const entryItems = entry?.item_ids?.length > 0
              ? entry.item_ids.map(id => items.find(it => String(it.id) === String(id))).filter(Boolean)
              : [];
            const allPieces = entryItems.length > 0 ? entryItems : wornItems;
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const dObj = toLocalDate(dateStr);
            const hasPieces = allPieces.length > 0;
            return (
              <div key={dateStr} onClick={() => setSelectedDate(dateStr)} style={{
                position: "relative", cursor: "pointer", overflow: "hidden",
                aspectRatio: "1/1",
                borderRight: i < 6 ? `1px solid ${T.rule}` : "none",
                borderBottom: `1px solid ${T.rule}`,
                background: isSelected ? T.paper : T.surface,
                outline: isSelected ? `2px solid ${T.ink}` : "none",
                outlineOffset: -2,
                zIndex: isSelected ? 2 : 1,
              }}>
                {entry?.photo && !hasPieces && (
                  <img src={entry.photo} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {hasPieces && (
                  <div style={{
                    position: "absolute", inset: 0, display: "grid",
                    gridTemplateColumns: allPieces.length === 1 ? "1fr" : "1fr 1fr",
                    gridTemplateRows: allPieces.length <= 2 ? "1fr" : "1fr 1fr",
                    gap: 1, background: T.rule,
                  }}>
                    {allPieces.slice(0, 4).map((p, pi) => (
                      <div key={pi} style={{ background: T.surface, overflow: "hidden" }}>
                        {(p.imageThumb || p.imageData)
                          ? <img src={p.imageThumb ?? p.imageData} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          : <div style={{ width: "100%", height: "100%", background: T.paper }} />
                        }
                      </div>
                    ))}
                  </div>
                )}
                <div style={{
                  position: "absolute", top: 6, left: 8, zIndex: 3,
                  fontFamily: T.mono, fontSize: 10, letterSpacing: ".08em",
                  color: hasPieces ? T.ink : isToday ? T.hot : T.ink3,
                  background: hasPieces ? "rgba(255,255,255,.85)" : "transparent",
                  padding: hasPieces ? "1px 5px" : 0,
                }}>
                  {String(dObj.getDate()).padStart(2, "0")}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 100 }}>

      {/* ── Hero ─────────────────────────────────────────── */}
      <div style={{ padding: "40px 28px 20px", borderBottom: `1px solid ${T.rule}`, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ ...ML, color: T.ink3, marginBottom: 10 }}>The Journal</div>
          <h2 style={{ fontFamily: T.serif, fontSize: 40, fontWeight: 400, letterSpacing: "-.02em", lineHeight: 1.0, color: T.ink, margin: 0 }}>
            {MONTHS[calMonth]}{" "}
            <em style={{ fontStyle: "italic", color: T.sage }}>{calYear}</em>
          </h2>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {["month", "week"].map(v => (
            <button key={v} onClick={() => setCalView(v)} style={tabStyle(calView === v)}>{v.charAt(0).toUpperCase() + v.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* ── Calendar ─────────────────────────────────────── */}
      {calView === "month" ? renderMonthCal() : renderWeekCal()}

      {/* ── Detail strip — full-width, below calendar ────── */}
      {(() => {
        const d = toLocalDate(selectedDate);
        const dateLabel = `${MONTHS[d.getMonth()].slice(0,3)} ${String(d.getDate()).padStart(2,"0")}`;
        const ruleLabel = detailPieces.length > 0
          ? `${dateLabel} · ${detailPieces.length} ${detailPieces.length === 1 ? "piece" : "pieces"} worn`
          : `${dateLabel} · Nothing logged`;
        const colCount = Math.max(detailPieces.length, 4);
        return (
          <>
            <SectionRule n={5} label={ruleLabel} color={T.sage} />
            <div style={{ background: T.surface, paddingBottom: 0 }}>
              {detailPieces.length > 0 ? (
                <>
                  {/* Piece cards — 3:4 ratio, full width */}
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${colCount}, 1fr)`, borderBottom: `1px solid ${T.rule}` }}>
                    {detailPieces.map((p, i) => (
                      <div key={i} style={{ aspectRatio: "3/4", borderRight: `1px solid ${T.rule}`, position: "relative", overflow: "hidden", background: T.paper }}>
                        {(p.imageThumb || p.imageData) && (
                          <img src={p.imageThumb ?? p.imageData} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        )}
                        <div style={{ position: "absolute", top: 10, left: 12, fontFamily: T.mono, fontSize: 9, letterSpacing: ".2em", color: T.ink, background: T.citron, padding: "2px 6px", zIndex: 2 }}>
                          {String(i+1).padStart(2,"0")}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Label row — brand / name / color per column */}
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${colCount}, 1fr)`, borderBottom: `1px solid ${T.rule}` }}>
                    {detailPieces.map((p, i) => (
                      <div key={i} style={{ padding: "12px 14px 16px", borderRight: `1px solid ${T.rule}` }}>
                        <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: ".18em", color: T.ink3, textTransform: "uppercase" }}>{p.brand || p.category}</div>
                        <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink, marginTop: 4, fontWeight: 500, lineHeight: 1.25 }}>{p.name}</div>
                        {p.color && <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink3, marginTop: 2 }}>{p.color}</div>}
                      </div>
                    ))}
                  </div>
                  {/* Footer — notes + action buttons */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 28px 32px", gap: 16 }}>
                    <div style={{ fontFamily: T.serif, fontSize: 18, fontStyle: "italic", color: T.ink2, flex: 1, lineHeight: 1.35 }}>
                      {detailNotes ? `"${detailNotes}"` : ""}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                      <button onClick={openEntryForm} style={{ border: `1px solid ${T.rule}`, background: "transparent", padding: "10px 16px", fontFamily: T.mono, fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", cursor: "pointer", color: T.ink }}>Edit log</button>
                      <button onClick={saveAsOutfit} style={{ border: 0, background: T.ink, color: T.surface, padding: "10px 16px", fontFamily: T.mono, fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", cursor: "pointer" }}>Save as outfit →</button>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: "40px 28px 56px", textAlign: "center" }}>
                  <div style={{ fontFamily: T.serif, fontSize: 22, color: T.ink2, fontStyle: "italic" }}>No log for this day.</div>
                  <button onClick={openEntryForm} style={{ marginTop: 16, border: 0, background: T.citron, color: T.ink, padding: "12px 22px", fontFamily: T.mono, fontSize: 10.5, letterSpacing: ".22em", textTransform: "uppercase", cursor: "pointer" }}>
                    + Log what I wore
                  </button>
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* ── Entry form ────────────────────────────────────── */}
      {showEntryForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(10,10,10,0.5)", overflowY: "auto" }}>
          <div style={{ maxWidth: 480, margin: "0 auto", background: T.surface, minHeight: "100vh", padding: "28px 28px 100px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: T.serif, fontSize: 22, color: T.ink }}>{isFuture ? "Plan Outfit" : "Log Outfit"} · {formatDate(selectedDate)}</div>
              <button onClick={() => setShowEntryForm(false)} style={{ background: "none", border: "none", color: T.ink3, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {/* Photo */}
            <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
            <div onClick={() => photoRef.current.click()} style={{ width: "100%", aspectRatio: "3/4", background: T.paper, border: `1px solid ${T.rule}`, overflow: "hidden", cursor: "pointer", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {entryPhoto
                ? <img src={entryPhoto} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ textAlign: "center", color: T.ink3 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
                    <div style={{ ...ML, color: T.ink3 }}>Add photo (optional)</div>
                  </div>
              }
            </div>
            {entryPhoto && (
              <button onClick={() => setEntryPhoto(null)} style={{ background: "none", border: "none", color: T.ink3, fontFamily: T.mono, fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer", marginBottom: 16, width: "100%", textAlign: "center" }}>Remove photo</button>
            )}

            {/* Tagged items */}
            <div style={{ ...ML, color: T.ink3, marginBottom: 8 }}>Items worn</div>
            {taggedItems.length > 0 && (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", marginBottom: 12 }}>
                {taggedItems.map(item => (
                  <div key={item.id} style={{ flexShrink: 0, width: 64, position: "relative" }}>
                    <div style={{ width: 64, height: 85, background: T.paper, border: `1px solid ${T.rule}`, overflow: "hidden" }}>
                      {(item.imageThumb || item.imageData) && <img src={item.imageThumb ?? item.imageData} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </div>
                    <button onClick={() => setEntryItemIds(ids => ids.filter(id => id !== String(item.id)))} style={{ position: "absolute", top: -4, right: -4, background: T.ink, border: "none", borderRadius: "50%", width: 16, height: 16, color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
                    <div style={{ fontFamily: T.sans, fontSize: 7, color: T.ink3, marginTop: 2, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                  </div>
                ))}
              </div>
            )}

            <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Search items to add…" style={inputStyle} />
            <div style={{ maxHeight: 180, overflowY: "auto", marginBottom: 16 }}>
              {filteredItems.slice(0, 20).map(item => (
                <div key={item.id} onClick={() => { setEntryItemIds(ids => [...ids, String(item.id)]); setItemSearch(""); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.rule}`, cursor: "pointer" }}>
                  <div style={{ width: 32, height: 42, background: T.paper, border: `1px solid ${T.rule}`, overflow: "hidden", flexShrink: 0 }}>
                    {(item.imageThumb || item.imageData) && <img src={item.imageThumb ?? item.imageData} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  </div>
                  <div>
                    <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink }}>{item.name}</div>
                    <div style={{ fontFamily: T.sans, fontSize: 10, color: T.ink3 }}>{item.brand || item.category}</div>
                  </div>
                </div>
              ))}
            </div>

            <textarea value={entryNotes} onChange={e => setEntryNotes(e.target.value)} placeholder="How did you feel? Where did you go? Any styling notes…"
              style={{ ...inputStyle, minHeight: 80, resize: "vertical", marginBottom: 16 }} />

            <button onClick={saveEntry} disabled={saving || (!entryPhoto && entryItemIds.length === 0)} style={{
              width: "100%", background: saving || (!entryPhoto && entryItemIds.length === 0) ? T.rule : T.cobalt,
              color: saving || (!entryPhoto && entryItemIds.length === 0) ? T.ink3 : "#fff",
              border: "none", borderRadius: 0, padding: "14px",
              fontFamily: T.mono, fontSize: 11, letterSpacing: ".24em", textTransform: "uppercase",
              cursor: "pointer",
            }}>
              {saving ? "Saving…" : isFuture ? "Save Plan" : "Log Outfit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default JournalView;
