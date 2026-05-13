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

const JournalView = forwardRef(function JournalView({ items, user, journalEntries, journalLoading, onEntrySaved, onEntryDeleted, markWorn, removeWornDate, setChatInput, setView, sbSaveJournalEntry, sbDeleteJournalEntry, journalPrefill, onPrefillConsumed }, ref) {
  const [calView, setCalView] = useState("month");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [entryPhoto, setEntryPhoto] = useState(null);
  const [entryItemIds, setEntryItemIds] = useState([]);
  const [entryNotes, setEntryNotes] = useState("");

  useImperativeHandle(ref, () => ({
    prefillEntry(date, itemIds, notes) {
      setSelectedDate(date);
      setEditingEntryId(null);
      setEntryItemIds(itemIds);
      setEntryNotes(notes || "");
      setShowEntryForm(true);
    },
  }));

  useEffect(() => {
    if (!journalPrefill) return;
    setSelectedDate(journalPrefill.date);
    setEditingEntryId(null);
    setEntryItemIds(journalPrefill.itemIds);
    setEntryNotes(journalPrefill.notes || "");
    setShowEntryForm(true);
    onPrefillConsumed?.();
  }, [journalPrefill]);

  const [saving, setSaving] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [editingWornItem, setEditingWornItem] = useState(null); // { itemId, currentDate, newDate }
  const photoRef = useRef();

  function saveWornDate() {
    const { itemId, currentDate, newDate } = editingWornItem;
    if (newDate && newDate !== currentDate) {
      const item = items.find(i => String(i.id) === String(itemId));
      const idx = item ? (item.wornDates || []).indexOf(currentDate) : -1;
      if (idx !== -1) removeWornDate(itemId, idx);
      markWorn(itemId, newDate);
    }
    setEditingWornItem(null);
  }

  const today = todayStr();
  const isFuture = selectedDate > today;

  // Build entry map: { date: [entry, entry, ...] }
  const entryMap = {};
  journalEntries.forEach(e => {
    if (!entryMap[e.date]) entryMap[e.date] = [];
    entryMap[e.date].push(e);
  });

  // Build worn map for dates with no journal entries
  const wornMap = {};
  items.forEach(item => {
    (item.wornDates || []).forEach(date => {
      if (!entryMap[date]?.length) {
        if (!wornMap[date]) wornMap[date] = [];
        wornMap[date].push(item);
      }
    });
  });

  const entriesForDate = entryMap[selectedDate] || [];
  const wornMapItems = wornMap[selectedDate] || [];

  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
  function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay(); }

  async function saveEntry() {
    if (!user?.id) return;
    setSaving(true);
    const entry = {
      id: editingEntryId || crypto.randomUUID(),
      user_id: user.id,
      date: selectedDate,
      photo: entryPhoto || null,
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
      setEditingEntryId(null);
    }
    setSaving(false);
  }

  function openEntryForm(entryToEdit = null) {
    if (entryToEdit) {
      setEditingEntryId(entryToEdit.id);
      setEntryPhoto(entryToEdit.photo || null);
      setEntryItemIds(entryToEdit.item_ids || []);
      setEntryNotes(entryToEdit.notes || "");
    } else {
      setEditingEntryId(null);
      setEntryPhoto(null);
      setEntryItemIds([]);
      setEntryNotes("");
    }
    setShowEntryForm(true);
  }

  async function deleteEntry(entryId) {
    if (!entryId || !user?.id) return;
    await sbDeleteJournalEntry(entryId, user.id);
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
    (i.name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
     i.brand?.toLowerCase().includes(itemSearch.toLowerCase())) &&
    !entryItemIds.includes(String(i.id))
  );

  // Chat label — all items from all entries for the selected date
  const allEntryItems = entriesForDate.flatMap(e =>
    (e.item_ids || []).map(id => items.find(i => String(i.id) === String(id))).filter(Boolean)
  );
  const allDisplayItems = entriesForDate.length > 0 ? allEntryItems : wornMapItems;
  const chatLabel = `Let's talk about my outfit on ${formatDate(selectedDate)}${allDisplayItems.length > 0 ? `: ${allDisplayItems.map(d => d.name).join(", ")}` : ""}`;

  // 2×2 collage helper for calendar cells
  function renderCollage(thumbItems) {
    const slots = [0, 1, 2, 3].map(i => thumbItems[i] || null);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", position: "absolute", inset: 0, gap: 1 }}>
        {slots.map((item, idx) => (
          <div key={idx} style={{ background: T.paper, overflow: "hidden" }}>
            {item && (item.imageThumb || item.imageData) && (
              <img src={item.imageThumb ?? item.imageData} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            )}
          </div>
        ))}
      </div>
    );
  }

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
            const entries = entryMap[dateStr] || [];
            const wornItems = !entries.length ? (wornMap[dateStr] || []) : [];
            const thumbItems = entries.length > 0
              ? entries.flatMap(e => (e.item_ids || []).map(id => items.find(it => String(it.id) === String(id))).filter(Boolean)).slice(0, 4)
              : wornItems.slice(0, 4);
            const hasContent = !!(entries.length > 0 || wornItems.length > 0);
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const col = i % 7;
            const dateColor = isToday ? T.citron : isSelected ? T.ink : thumbItems.length > 0 ? T.surface : T.ink3;
            return (
              <div key={i} onClick={() => setSelectedDate(dateStr)} style={{
                position: "relative", cursor: "pointer", overflow: "hidden",
                aspectRatio: "1/1",
                borderRight: col < 6 ? `1px solid ${T.rule}` : "none",
                borderBottom: `1px solid ${T.rule}`,
                background: isSelected ? T.paper : T.surface,
                boxShadow: isSelected ? `inset 0 0 0 2px ${T.ink}` : "none",
                zIndex: isSelected ? 1 : 0,
              }}>
                {thumbItems.length > 0 && renderCollage(thumbItems)}
                <div style={{
                  position: "absolute", top: 3, left: 4,
                  fontFamily: T.mono, fontSize: 9, fontWeight: 400,
                  color: dateColor,
                  textShadow: thumbItems.length > 0 && !isSelected ? "0 1px 2px rgba(0,0,0,0.5)" : "none",
                  zIndex: 2,
                }}>
                  {String(day).padStart(2, "0")}
                </div>
                {hasContent && (
                  <div style={{ position: "absolute", bottom: 3, right: 4, width: 4, height: 4, borderRadius: "50%", background: T.sage, zIndex: 2 }} />
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
            const entries = entryMap[dateStr] || [];
            const wornItems = !entries.length ? (wornMap[dateStr] || []) : [];
            const thumbItems = entries.length > 0
              ? entries.flatMap(e => (e.item_ids || []).map(id => items.find(it => String(it.id) === String(id))).filter(Boolean)).slice(0, 4)
              : wornItems.slice(0, 4);
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const dObj = toLocalDate(dateStr);
            const dateColor = isToday ? T.citron : isSelected ? T.ink : thumbItems.length > 0 ? T.surface : T.ink3;
            return (
              <div key={dateStr} onClick={() => setSelectedDate(dateStr)} style={{
                position: "relative", cursor: "pointer", overflow: "hidden",
                aspectRatio: "1/1",
                borderRight: i < 6 ? `1px solid ${T.rule}` : "none",
                borderBottom: `1px solid ${T.rule}`,
                background: isSelected ? T.paper : T.surface,
                boxShadow: isSelected ? `inset 0 0 0 2px ${T.ink}` : "none",
                zIndex: isSelected ? 1 : 0,
              }}>
                {thumbItems.length > 0 && renderCollage(thumbItems)}
                <div style={{
                  position: "absolute", top: 3, left: 4,
                  fontFamily: T.mono, fontSize: 9,
                  color: dateColor,
                  textShadow: thumbItems.length > 0 && !isSelected ? "0 1px 2px rgba(0,0,0,0.5)" : "none",
                  zIndex: 2,
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

      {/* ── Detail strip ─────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${T.rule}` }}>

        {/* Date header row */}
        <div style={{ padding: "14px 28px", borderBottom: `1px solid ${T.rule}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: ".08em", color: T.ink }}>
            {formatDate(selectedDate)}
            {selectedDate === today && <span style={{ color: T.ink3, marginLeft: 8, fontSize: 10 }}>· Today</span>}
            {isFuture && selectedDate !== today && <span style={{ color: T.ink3, marginLeft: 8, fontSize: 10 }}>· Planned</span>}
          </div>
          {entriesForDate.length > 0 && (
            <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: ".1em", color: T.ink3 }}>
              {entriesForDate.length} {entriesForDate.length === 1 ? "outfit" : "outfits"}
            </div>
          )}
        </div>

        {/* Journal entries — one card per entry */}
        {entriesForDate.length > 0 && (
          <div>
            {entriesForDate.map((entry, eIdx) => {
              const entryDisplayItems = (entry.item_ids || [])
                .map(id => { const item = items.find(i => String(i.id) === String(id)); return item ? { key: String(id), item, rawId: id } : null; })
                .filter(Boolean);
              return (
                <div key={entry.id}>
                  {eIdx > 0 && <div style={{ height: 1, background: T.rule, margin: "0 28px" }} />}

                  {/* Entry photo */}
                  {entry.photo && (
                    <img src={entry.photo} style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }} />
                  )}

                  {/* Item cards */}
                  {entryDisplayItems.length > 0 && (
                    <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", padding: "20px 28px 8px" }}>
                      {entryDisplayItems.map(({ key, item, rawId }, idx) => (
                        <div key={key} onClick={() => setEditingWornItem({ itemId: item.id, currentDate: selectedDate, newDate: selectedDate })} style={{ flexShrink: 0, width: 100, position: "relative", cursor: "pointer" }}>
                          <div style={{ width: 100, height: 133, background: T.paper, border: `1px solid ${T.rule}`, overflow: "hidden", position: "relative" }}>
                            {(item.imageThumb || item.imageData) && (
                              <img src={item.imageThumb ?? item.imageData} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            )}
                            <div style={{ position: "absolute", top: 6, left: 6, background: T.citron, color: T.ink, fontFamily: T.mono, fontSize: 8, letterSpacing: ".08em", padding: "2px 5px", lineHeight: 1.4 }}>
                              {String(idx + 1).padStart(2, "0")}
                            </div>
                          </div>
                          <button
                            onClick={async e => {
                              e.stopPropagation();
                              const newIds = entry.item_ids.filter(i => String(i) !== String(rawId));
                              const ok = await sbSaveJournalEntry({ ...entry, item_ids: newIds });
                              if (ok) await onEntrySaved();
                            }}
                            style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.55)", border: "none", color: T.surface, borderRadius: "50%", width: 18, height: 18, fontSize: 12, lineHeight: "18px", textAlign: "center", cursor: "pointer", padding: 0 }}>×</button>
                          <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink, marginTop: 7, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                          {item.brand && <div style={{ fontFamily: T.sans, fontSize: 10, color: T.ink3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.brand}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {entry.notes && (
                    <p style={{ fontFamily: T.sans, fontSize: 12, color: T.ink2, lineHeight: 1.6, margin: "4px 28px 8px", padding: 0 }}>{entry.notes}</p>
                  )}

                  {/* Per-entry Edit / Delete */}
                  <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "8px 28px 16px" }}>
                    <button onClick={() => openEntryForm(entry)} style={{ background: "none", border: "none", color: T.ink3, fontFamily: T.mono, fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", cursor: "pointer", padding: 0 }}>Edit</button>
                    <button onClick={() => deleteEntry(entry.id)} style={{ background: "none", border: "none", color: T.ink3, fontFamily: T.mono, fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", cursor: "pointer", padding: 0 }}>Delete</button>
                  </div>
                </div>
              );
            })}

            {/* Bottom actions */}
            <div style={{ display: "flex", gap: 10, padding: "8px 28px 24px", alignItems: "center", flexWrap: "wrap", borderTop: `1px solid ${T.rule}` }}>
              <button onClick={() => openEntryForm()} style={{ background: T.citron, color: T.ink, border: "none", padding: "8px 16px", fontFamily: T.mono, fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer" }}>
                + Add outfit
              </button>
              <button onClick={() => { setChatInput?.(chatLabel); setView?.("chat"); }}
                style={{ background: "none", border: `1px solid ${T.rule}`, color: T.ink3, fontFamily: T.mono, fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer", padding: "8px 14px" }}>
                Chat about this →
              </button>
            </div>
          </div>
        )}

        {/* Worn-map items (no journal entry, but worn dates exist) */}
        {entriesForDate.length === 0 && wornMapItems.length > 0 && (
          <div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", padding: "20px 28px 8px" }}>
              {wornMapItems.map((item, idx) => (
                <div key={String(item.id)} onClick={() => setEditingWornItem({ itemId: item.id, currentDate: selectedDate, newDate: selectedDate })} style={{ flexShrink: 0, width: 100, position: "relative", cursor: "pointer" }}>
                  <div style={{ width: 100, height: 133, background: T.paper, border: `1px solid ${T.rule}`, overflow: "hidden", position: "relative" }}>
                    {(item.imageThumb || item.imageData) && (
                      <img src={item.imageThumb ?? item.imageData} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    )}
                    <div style={{ position: "absolute", top: 6, left: 6, background: T.citron, color: T.ink, fontFamily: T.mono, fontSize: 8, letterSpacing: ".08em", padding: "2px 5px", lineHeight: 1.4 }}>
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                  </div>
                  <button
                    onClick={async e => {
                      e.stopPropagation();
                      removeWornDate(item.id, item.wornDates.indexOf(selectedDate));
                      await onEntrySaved();
                    }}
                    style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.55)", border: "none", color: T.surface, borderRadius: "50%", width: 18, height: 18, fontSize: 12, lineHeight: "18px", textAlign: "center", cursor: "pointer", padding: 0 }}>×</button>
                  <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink, marginTop: 7, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                  {item.brand && <div style={{ fontFamily: T.sans, fontSize: 10, color: T.ink3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.brand}</div>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, padding: "8px 28px 24px", alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => openEntryForm()} style={{ background: T.citron, color: T.ink, border: "none", padding: "8px 16px", fontFamily: T.mono, fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer" }}>
                + {isFuture ? "Plan outfit" : "Log outfit"}
              </button>
              <button onClick={() => { setChatInput?.(chatLabel); setView?.("chat"); }}
                style={{ background: "none", border: `1px solid ${T.rule}`, color: T.ink3, fontFamily: T.mono, fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer", padding: "8px 14px" }}>
                Chat about this →
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {entriesForDate.length === 0 && wornMapItems.length === 0 && (
          <div style={{ padding: "32px 28px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
            <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3 }}>
              {isFuture ? "No outfit planned yet" : "Nothing logged for this day"}
            </div>
            <button onClick={() => openEntryForm()} style={{ background: T.citron, color: T.ink, border: "none", padding: "10px 20px", fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer" }}>
              + {isFuture ? "Plan outfit" : "Log outfit"}
            </button>
          </div>
        )}
      </div>

      {/* ── Worn date editor ─────────────────────────────── */}
      {editingWornItem && (() => {
        const ewItem = items.find(i => String(i.id) === String(editingWornItem.itemId));
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 210, background: "rgba(10,10,10,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setEditingWornItem(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: T.surface, border: `1px solid ${T.ink3}`, borderRadius: 4, padding: 24, width: 280 }}>
              <div style={{ fontFamily: T.serif, fontSize: 18, color: T.ink, marginBottom: 4 }}>{ewItem?.name || "Item"}</div>
              {ewItem?.brand && <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink3, marginBottom: 16 }}>{ewItem.brand}</div>}
              <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: T.ink3, marginBottom: 6 }}>Worn date</div>
              <input
                type="date"
                value={editingWornItem.newDate}
                onChange={e => setEditingWornItem(prev => ({ ...prev, newDate: e.target.value }))}
                style={{ width: "100%", background: T.paper, border: `1px solid ${T.rule}`, color: T.ink, fontFamily: T.mono, fontSize: 13, padding: "8px 10px", marginBottom: 16, boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveWornDate} style={{ flex: 1, background: T.citron, color: T.ink, border: "none", padding: "9px 0", fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer" }}>Save</button>
                <button onClick={() => setEditingWornItem(null)} style={{ flex: 1, background: "none", border: `1px solid ${T.rule}`, color: T.ink3, padding: "9px 0", fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Entry form ────────────────────────────────────── */}
      {showEntryForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(10,10,10,0.5)", overflowY: "auto" }}>
          <div style={{ maxWidth: 480, margin: "0 auto", background: T.surface, minHeight: "100vh", padding: "28px 28px 100px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: T.serif, fontSize: 22, color: T.ink }}>
                {editingEntryId ? "Edit Outfit" : (isFuture ? "Plan Outfit" : "Log Outfit")} · {formatDate(selectedDate)}
              </div>
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
              {saving ? "Saving…" : editingEntryId ? "Save Changes" : (isFuture ? "Save Plan" : "Log Outfit")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default JournalView;
