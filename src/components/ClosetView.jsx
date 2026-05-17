import { useState, useMemo } from "react";
import { COLORS, SEASONS, MATERIALS, ITEM_TYPES } from "../constants.js";
import { T, ML, tabStyle, chipB } from "../theme.js";

export default function ClosetView({
  items, filtered, activeCategory, setActiveCategory, allCategories,
  activeFilters, setActiveFilters, showFilters, setShowFilters,
  brands, allTags, allCustomColors = [], evaluateItem, syncing,
  showArchived = false, setShowArchived,
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

  const cats = ["All", ...allCategories, "To Go"];

  return (
    <div style={{ fontFamily: T.sans }}>

      {/* Search bar */}
      <div style={{ padding: "20px 28px", borderBottom: `1px solid ${T.rule}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ ...ML, color: T.ink3, flexShrink: 0 }}>SEARCH —</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="name, brand, color…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontFamily: T.serif, fontStyle: "italic", fontSize: 22, color: T.ink,
              padding: 0,
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: T.ink3, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ borderBottom: `1px solid ${T.rule}`, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 22, overflowX: "auto", scrollbarWidth: "none" }}>
          {cats.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={tabStyle(activeCategory === cat)}>
              {cat}
            </button>
          ))}
        </div>
        <span style={{ ...ML, color: T.ink3, flexShrink: 0, marginLeft: 16 }}>{displayItems.length} PIECES</span>
      </div>

      {/* ItemType sub-tabs */}
      {ITEM_TYPES[activeCategory] && (
        <div style={{ padding: "0 28px", borderBottom: `1px solid ${T.rule}`, display: "flex", gap: 18, overflowX: "auto", scrollbarWidth: "none" }}>
          {ITEM_TYPES[activeCategory].map(t => (
            <button key={t} onClick={() => toggleFilter("itemType", t)} style={tabStyle(isActive("itemType", t))}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Filter row */}
      <div style={{ padding: "10px 28px", borderBottom: `1px solid ${T.rule}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => setShowFilters(true)}
          style={{
            background: "transparent", border: `1px solid ${T.rule}`, color: activeFilterCount > 0 ? T.ink : T.ink3,
            fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase",
            padding: "6px 14px", cursor: "pointer",
          }}
        >
          ⊞ Filter{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
        </button>
        {activeFilterCount > 0 && (
          <button onClick={() => setActiveFilters({})} style={{ background: "none", border: "none", color: T.ink3, fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer" }}>
            Clear
          </button>
        )}
        <button
          onClick={() => setShowArchived(prev => !prev)}
          style={{ background: "transparent", border: `1px solid ${showArchived ? T.ink3 : T.rule}`, color: showArchived ? T.ink : T.ink3, fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", padding: "6px 14px", cursor: "pointer", marginLeft: "auto" }}
        >
          {showArchived ? "✓ Archived" : "Archived"}
        </button>
      </div>

      {/* Grid */}
      {displayItems.length === 0 ? (
        syncing && items.length === 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ aspectRatio: "3/4", background: T.paper, animation: "pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.08}s`, borderRight: `1px solid ${T.rule}`, borderBottom: `1px solid ${T.rule}` }} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "80px 28px", color: T.ink3 }}>
            <div style={{ ...ML, marginBottom: 8 }}>{items.length > 0 ? "No matches" : "Nothing here yet"}</div>
            <div style={{ fontSize: 12, fontFamily: T.sans, color: T.ink3 }}>
              {items.length > 0 ? "Try different filters or search" : "Add your first piece"}
            </div>
          </div>
        )
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
          {displayItems.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => evaluateItem(item)}
              style={{
                position: "relative", cursor: "pointer", overflow: "hidden",
                borderRight: `1px solid ${T.rule}`, borderBottom: `1px solid ${T.rule}`,
                background: T.paper,
              }}
            >
              {/* Photo */}
              <div style={{ aspectRatio: "3/4", overflow: "hidden" }}>
                {item.imageData
                  ? <img src={item.imageThumb ?? item.imageData} alt={item.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: T.paper }}>
                      <div style={{ ...ML, color: T.rule, textAlign: "center", padding: 8 }}>{item.name}</div>
                    </div>
                }
              </div>
              {/* NEW badge */}
              {!item.status && !item.wornDates?.length && (
                <div style={{ position: "absolute", top: 6, right: 6, background: T.hot, color: "#fff", fontFamily: T.mono, fontSize: 8, letterSpacing: ".12em", textTransform: "uppercase", padding: "3px 6px" }}>NEW</div>
              )}
              {/* DONATE / SELL badges */}
              {item.status === "donate" && (
                <div style={{ position: "absolute", top: 6, right: 6, background: T.cobalt, color: "#fff", fontFamily: T.mono, fontSize: 8, letterSpacing: ".12em", textTransform: "uppercase", padding: "3px 6px" }}>Donate</div>
              )}
              {item.status === "sell" && (
                <div style={{ position: "absolute", top: 6, right: 6, background: T.sage, color: "#fff", fontFamily: T.mono, fontSize: 8, letterSpacing: ".12em", textTransform: "uppercase", padding: "3px 6px" }}>Sell</div>
              )}
              {/* Metadata */}
              <div style={{ padding: "10px 12px 12px" }}>
                <div style={{ ...ML, color: T.ink3, fontSize: 9, marginBottom: 4 }}>
                  <span style={{ color: T.cobalt }}>{String(idx + 1).padStart(3, "0")}</span>
                  {item.brand && <> · <span>{item.brand.toUpperCase()}</span></>}
                </div>
                <div style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 500, color: T.ink, lineHeight: 1.2, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                {item.color && <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.color}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter bottom sheet */}
      {showFilters && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(10,10,10,0.4)" }} onClick={() => setShowFilters(false)}>
          <div
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: T.surface, borderTop: `1px solid ${T.rule}`, padding: "0 28px 40px", maxHeight: "78vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 3, background: T.rule, margin: "14px auto 20px" }} />
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <span style={{ fontFamily: T.serif, fontSize: 22, color: T.ink }}>Filter</span>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                {activeFilterCount > 0 && (
                  <button onClick={() => setActiveFilters({})} style={{ background: "none", border: "none", color: T.hot, fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer" }}>
                    Clear all
                  </button>
                )}
                <button onClick={() => setShowFilters(false)} style={{ background: "none", border: "none", color: T.ink3, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
              </div>
            </div>
            {/* Filter groups */}
            {[
              { key: "color",    label: "Color",    opts: [...COLORS.filter(c => c !== "Other"), ...allCustomColors] },
              { key: "season",   label: "Season",   opts: SEASONS },
              { key: "material", label: "Material", opts: MATERIALS },
              ...(brands.length ? [{ key: "brand", label: "Brand", opts: brands }] : []),
              ...(allTags.length ? [{ key: "tag",  label: "Tags",  opts: allTags }] : []),
            ].map(({ key, label, opts }) => (
              <div key={key} style={{ marginBottom: 24 }}>
                <div style={{ ...ML, color: T.ink3, marginBottom: 10 }}>{label}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {opts.map(o => (
                    <button key={o} onClick={() => toggleFilter(key, o)} style={chipB(isActive(key, o))}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {/* Apply */}
            <button
              onClick={() => setShowFilters(false)}
              style={{ width: "100%", background: T.cobalt, color: "#fff", border: "none", borderRadius: 0, padding: "14px", fontFamily: T.mono, fontSize: 11, letterSpacing: ".24em", textTransform: "uppercase", cursor: "pointer", marginTop: 8 }}
            >
              Show {displayItems.length} pieces
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
