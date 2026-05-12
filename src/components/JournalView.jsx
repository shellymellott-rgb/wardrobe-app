import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { T, ML, tabStyle } from "../theme.js";
import { inputStyle } from "../styles.js";

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

const JournalView = forwardRef(function JournalView({ items, user, journalEntries, journalLoading, onEntrySaved, onEntryDeleted, markWorn, setChatInput, setView, sbSaveJournalEntry, sbDeleteJournalEntry, journalPrefill, onPrefillConsumed }, ref) {
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

  useEffect(() => {
    console.log("[journal prefill] fired, journalPrefill:", journalPrefill);
    if (!journalPrefill) return;
    setSelectedDate(journalPrefill.date);
    setEntryItemIds(journalPrefill.itemIds);
    console.log("[journal prefill] itemIds set:", journalPrefill.itemIds);
    setEntryNotes(journalPrefill.notes || "");
    setShowEntryForm(true);
    console.log("[journal prefill] form should be open now");
    onPrefillConsumed?.();
  }, [journalPrefill]);

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
            const thumbItem = entry?.item_ids?.length > 0
              ? items.find(i => String(i.id) === String(entry.item_ids[0]))
              : wornItems[0] || null;
            const photo = entry?.photo || thumbItem?.imageThumb || thumbItem?.imageData || null;
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const col = i % 7;
            return (
              <div key={i} onClick={() => setSelectedDate(dateStr)} style={{
                position: "relative", cursor: "pointer", overflow: "hidden",
                aspectRatio: "1/1",
                borderRight: col < 6 ? `1px solid ${T.rule}` : "none",
                borderBottom: `1px solid ${T.rule}`,
                background: isSelected ? T.ink : T.surface,
              }}>
                {photo && !isSelected && (
                  <img src={photo} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                <div style={{
                  position: "absolute", top: 4, left: 5,
                  fontFamily: T.mono, fontSize: 10, fontWeight: 400,
                  color: isSelected ? "#fff" : photo ? "#fff" : isToday ? T.hot : T.ink3,
                }}>
                  {String(day).padStart(2, "0")}
                </div>
                {(entry || wornItems.length > 0) && !isSelected && (
                  <div style={{ position: "absolute", bottom: 4, right: 5, width: 4, height: 4, borderRadius: "50%", background: T.sage }} />
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
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const dObj = toLocalDate(dateStr);
            const photo = entry?.photo || (entry?.item_ids?.length > 0 ? items.find(it => String(it.id) === String(entry.item_ids[0]))?.imageThumb : null);
            return (
              <div key={dateStr} onClick={() => setSelectedDate(dateStr)} style={{
                position: "relative", cursor: "pointer", overflow: "hidden",
                aspectRatio: "1/1",
                borderRight: i < 6 ? `1px solid ${T.rule}` : "none",
                borderBottom: `1px solid ${T.rule}`,
                background: isSelected ? T.ink : T.surface,
              }}>
                {photo && !isSelected && (
                  <img src={photo} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                <div style={{ position: "absolute", top: 4, left: 5, fontFamily: T.mono, fontSize: 10, color: isSelected ? "#fff" : photo ? "#fff" : isToday ? T.hot : T.ink3 }}>
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

      {/* ── Selected day panel ───────────────────────────── */}
      <div style={{ borderTop: `1px solid ${T.rule}`, margin: "0 28px 28px" }}>
        <div style={{ padding: "16px 0", borderBottom: `1px solid ${T.rule}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 500, color: T.ink }}>
            {formatDate(selectedDate)}{selectedDate === today ? " · Today" : isFuture ? " · Planned" : ""}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {selectedEntry && (
              <button onClick={deleteEntry} style={{ background: "none", border: "none", color: T.ink3, fontFamily: T.mono, fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", cursor: "pointer", padding: 0 }}>Delete</button>
            )}
            {!selectedEntry && (
              <button onClick={openEntryForm} style={{ background: T.ink, color: "#fff", border: "none", borderRadius: 0, padding: "6px 14px", fontFamily: T.mono, fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer" }}>
                {isFuture ? "+ Plan" : "+ Log"}
              </button>
            )}
          </div>
        </div>

        {selectedEntry ? (
          <div style={{ paddingTop: 16 }}>
            {selectedEntry.photo && (
              <img src={selectedEntry.photo} style={{ width: "100%", maxHeight: 300, objectFit: "cover", display: "block", marginBottom: 16 }} />
            )}
            {selectedEntry.item_ids?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ ...ML, color: T.ink3 }}>Items worn</div>
                  <button onClick={openEntryForm} style={{ background: T.ink, color: "#fff", border: "none", borderRadius: 0, padding: "4px 12px", fontFamily: T.mono, fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer" }}>Edit</button>
                </div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
                  {selectedEntry.item_ids.map(id => {
                    const item = items.find(i => String(i.id) === String(id));
                    if (!item) return null;
                    return (
                      <div key={id} style={{ flexShrink: 0, width: 72, position: "relative", cursor: "pointer" }}
                           onClick={openEntryForm}>
                        <div style={{ width: 72, height: 96, background: T.paper, border: `1px solid ${T.rule}`, overflow: "hidden" }}>
                          {(item.imageThumb || item.imageData) && <img src={item.imageThumb ?? item.imageData} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                        </div>
                        <button
                          onClick={async e => {
                            e.stopPropagation();
                            const newIds = selectedEntry.item_ids.filter(i => String(i) !== String(id));
                            const ok = await sbSaveJournalEntry({ ...selectedEntry, item_ids: newIds });
                            if (ok) await onEntrySaved();
                          }}
                          style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.55)", border: "none", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 11, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0 }}>×</button>
                        <div style={{ fontFamily: T.sans, fontSize: 8, color: T.ink3, marginTop: 3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {selectedEntry.notes && (
              <p style={{ fontFamily: T.sans, fontSize: 12, color: T.ink2, lineHeight: 1.6, margin: "0 0 16px" }}>{selectedEntry.notes}</p>
            )}
            <button onClick={() => { setChatInput?.(`Let's talk about my outfit on ${formatDate(selectedDate)}: ${selectedEntry.item_ids.map(id => items.find(i => String(i.id) === String(id))?.name).filter(Boolean).join(", ")}`); setView?.("chat"); }}
              style={{ background: "none", border: `1px solid ${T.rule}`, color: T.ink3, fontFamily: T.mono, fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer", padding: "8px 14px" }}>
              Chat about this →
            </button>
          </div>
        ) : wornMap[selectedDate]?.length > 0 ? (
          <div style={{ paddingTop: 16 }}>
            <div style={{ ...ML, color: T.ink3, marginBottom: 10 }}>Items worn</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", marginBottom: 16 }}>
              {(wornMap[selectedDate] || []).map(item => (
                <div key={item.id} style={{ flexShrink: 0, width: 72 }}>
                  <div style={{ width: 72, height: 96, background: T.paper, border: `1px solid ${T.rule}`, overflow: "hidden" }}>
                    {(item.imageThumb || item.imageData) && <img src={item.imageThumb ?? item.imageData} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  </div>
                  <div style={{ fontFamily: T.sans, fontSize: 8, color: T.ink3, marginTop: 3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                </div>
              ))}
            </div>
            <button onClick={() => { setChatInput?.(`Let's talk about my outfit on ${formatDate(selectedDate)}: ${(wornMap[selectedDate] || []).map(i => i.name).join(", ")}`); setView?.("chat"); }}
              style={{ background: "none", border: `1px solid ${T.rule}`, color: T.ink3, fontFamily: T.mono, fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer", padding: "8px 14px" }}>
              Chat about this →
            </button>
          </div>
        ) : (
          <div style={{ padding: "24px 0", fontFamily: T.sans, fontSize: 12, color: T.ink3 }}>
            {isFuture ? "No outfit planned yet" : "Nothing logged for this day"}
          </div>
        )}
      </div>

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
