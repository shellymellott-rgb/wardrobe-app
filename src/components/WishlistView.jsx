import { useState, useRef } from "react";
import { T, ML, chipB } from "../theme.js";
import { inputStyle, labelStyle } from "../styles.js";
import { callClaude } from "../utils/callClaude.js";
import { parseJsonObject } from "../utils/parseJson.js";
import { URL_PROMPT } from "../constants.js";

const WISH_TAGS = ["Need", "Maybe", "Saved"];
const TAG_LABELS = { Need: "PRIORITY", Maybe: "MAYBE", Saved: "SAVED" };
const TAG_COLORS = { Need: T.hot, Maybe: T.ink3, Saved: T.cobalt };

function WishCard({ item, idx, total, onRemove, onMoveToCloset, onUpdateImage, onUpdateTag }) {
  const fileRef = useRef();
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ borderRight: `1px solid ${T.rule}`, borderBottom: `1px solid ${T.rule}`, display: "flex", flexDirection: "column" }}>
      {/* Image block */}
      <div
        onClick={() => fileRef.current?.click()}
        style={{ position: "relative", aspectRatio: "4/5", maxHeight: 260, background: item.imageData || item.imageUrl ? T.paper : "#1e1c1a", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        {(item.imageData || item.imageUrl) ? (
          <img src={item.imageData || item.imageUrl} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <div style={{ color: "rgba(255,255,255,.4)", fontSize: 20 }}>+</div>
            <div style={{ ...ML, fontSize: 8, color: "rgba(255,255,255,.3)" }}>ADD PHOTO</div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => onUpdateImage(item.id, ev.target.result); r.readAsDataURL(f); e.target.value = ""; }} />
        {/* Index */}
        <div style={{ position: "absolute", top: 8, left: 8, ...ML, fontSize: 8, color: "rgba(255,255,255,.7)" }}>{String(idx+1).padStart(2,"0")}/{String(total).padStart(2,"0")}</div>
        {/* Tag pill */}
        <div style={{ position: "absolute", bottom: 8, right: 8, background: TAG_COLORS[item.tag||"Saved"], padding: "3px 7px", borderRadius: 2 }}>
          <span style={{ ...ML, fontSize: 7, color: "#fff" }}>{TAG_LABELS[item.tag||"Saved"]}</span>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "10px 12px 12px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: T.serif, fontSize: 15, color: T.ink, lineHeight: 1.2, marginBottom: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {item.name || item.note}
        </div>
        {item.brand && <div style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>{item.brand}</div>}
        {item.currentPrice && <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink2, marginBottom: 2 }}>${item.currentPrice}</div>}
        {item.targetPrice && <div style={{ fontFamily: T.mono, fontSize: 9, color: T.cobalt }}>Alert at ${item.targetPrice}</div>}
        {item.description && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink3, lineHeight: 1.4, display: expanded ? "block" : "-webkit-box", WebkitLineClamp: expanded ? undefined : 2, WebkitBoxOrient: "vertical", overflow: expanded ? "visible" : "hidden" }}>
              {item.description}
            </div>
            {item.description.length > 80 && (
              <button onClick={() => setExpanded(e => !e)} style={{ background: "none", border: "none", color: T.ink3, fontFamily: T.mono, fontSize: 8, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", padding: "2px 0" }}>{expanded ? "less" : "more"}</button>
            )}
          </div>
        )}

        {/* Tag switcher */}
        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
          {WISH_TAGS.map(tag => (
            <button key={tag} onClick={() => onUpdateTag(item.id, tag)} style={{ ...ML, fontSize: 7, padding: "3px 6px", border: `1px solid ${item.tag===tag ? TAG_COLORS[tag] : T.rule}`, background: item.tag===tag ? TAG_COLORS[tag] : "transparent", color: item.tag===tag ? "#fff" : T.ink3, cursor: "pointer", borderRadius: 2 }}>{tag}</button>
          ))}
        </div>

        {/* Footer actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.rule}`, alignItems: "center" }}>
          {item.url && <a href={item.url} target="_blank" rel="noreferrer" style={{ ...ML, fontSize: 8, color: T.ink2, textDecoration: "none" }}>BUY →</a>}
          <button onClick={() => onMoveToCloset(item)} style={{ ...ML, fontSize: 8, color: T.cobalt, background: "none", border: "none", cursor: "pointer", padding: 0 }}>→ CLOSET</button>
          <button onClick={() => onRemove(item.id)} style={{ ...ML, fontSize: 8, color: T.ink3, background: "none", border: "none", cursor: "pointer", padding: 0, marginLeft: "auto" }}>REMOVE</button>
        </div>
      </div>
    </div>
  );
}

export default function WishlistView({ wishlist, persistWishlist, onMoveToCloset }) {
  const [addingWish, setAddingWish] = useState(false);
  const [wishForm, setWishForm] = useState({ name: "", brand: "", url: "", currentPrice: "", targetPrice: "", description: "", tag: "Need" });
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  async function fetchUrl() {
    if (!wishForm.url.trim()) return;
    setFetchingUrl(true);
    try {
      const pageRes = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fetchUrl: wishForm.url.trim() }) });
      const pageData = await pageRes.json();
      const text = await callClaude(URL_PROMPT, [{ type: "text", text: `Extract product details:\n\n${pageData.pageText || "URL: " + wishForm.url}` }], 400);
      const parsed = parseJsonObject(text);
      setWishForm(f => ({
        ...f,
        name: parsed.name || f.name,
        brand: parsed.brand || f.brand,
        currentPrice: pageData.price || parsed.price || f.currentPrice,
        imageUrl: pageData.imageData || pageData.imageUrl || f.imageUrl,
      }));
    } catch {}
    setFetchingUrl(false);
  }

  function saveItem() {
    if (!wishForm.name && !wishForm.description) return;
    const item = {
      id: Date.now() + Math.random(),
      name: wishForm.name,
      brand: wishForm.brand,
      url: wishForm.url,
      currentPrice: wishForm.currentPrice,
      targetPrice: wishForm.targetPrice ? parseFloat(wishForm.targetPrice) : null,
      description: wishForm.description,
      tag: wishForm.tag,
      imageUrl: wishForm.imageUrl || null,
      imageData: null,
      addedAt: new Date().toISOString(),
    };
    persistWishlist([...wishlist, item]);
    setWishForm({ name: "", brand: "", url: "", currentPrice: "", targetPrice: "", description: "", tag: "Need" });
    setAddingWish(false);
  }

  function removeItem(id) { persistWishlist(wishlist.filter(w => w.id !== id)); }
  function updateTag(id, tag) { persistWishlist(wishlist.map(w => w.id === id ? { ...w, tag } : w)); }
  function updateImage(id, imageData) { persistWishlist(wishlist.map(w => w.id === id ? { ...w, imageData } : w)); }

  const tabs = [
    { key: "all", label: "ALL" },
    { key: "Need", label: "PRIORITY" },
    { key: "Saved", label: "SAVED" },
    { key: "Maybe", label: "MAYBE" },
  ];
  const filtered = activeTab === "all" ? wishlist : wishlist.filter(w => (w.tag || "Saved") === activeTab);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: "40px 28px 24px", borderBottom: `1px solid ${T.rule}`, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ ...ML, color: T.ink3, marginBottom: 10 }}>The List</div>
          <h2 style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 40, fontWeight: 400, letterSpacing: "-.02em", lineHeight: 1.0, color: T.hot, margin: 0 }}>Wishlist</h2>
        </div>
        <button onClick={() => setAddingWish(true)} style={{ background: T.hot, color: "#fff", border: "none", borderRadius: 0, padding: "10px 20px", fontFamily: T.mono, fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", cursor: "pointer" }}>+ Add Item</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${T.rule}`, padding: "0 28px" }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ background: "none", border: "none", borderBottom: activeTab === tab.key ? `2px solid ${T.ink}` : "2px solid transparent", padding: "12px 16px 10px", fontFamily: T.mono, fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", color: activeTab === tab.key ? T.ink : T.ink3, cursor: "pointer" }}>{tab.label}{tab.key !== "all" && ` (${wishlist.filter(w => (w.tag||"Saved") === tab.key).length})`}</button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 28px", color: T.ink3 }}>
          <div style={{ ...ML, marginBottom: 8 }}>Nothing here</div>
          <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3 }}>Add pieces you want to buy</div>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderLeft: `1px solid ${T.rule}`, borderTop: `1px solid ${T.rule}` }}>
          {filtered.map((item, idx) => (
            <WishCard
              key={item.id}
              item={item}
              idx={idx}
              total={filtered.length}
              onRemove={removeItem}
              onMoveToCloset={onMoveToCloset}
              onUpdateImage={updateImage}
              onUpdateTag={updateTag}
            />
          ))}
        </div>
      )}

      {/* Add modal */}
      {addingWish && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(10,10,10,0.5)", overflowY: "auto" }}>
          <div style={{ maxWidth: 480, margin: "0 auto", background: T.surface, minHeight: "100vh", padding: "28px 28px 100px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <span style={{ fontFamily: T.serif, fontSize: 22, color: T.ink }}>Add to Wishlist</span>
              <button onClick={() => setAddingWish(false)} style={{ background: "none", border: "none", color: T.ink3, fontSize: 22, cursor: "pointer" }}>×</button>
            </div>

            <label style={labelStyle}>Item Name *</label>
            <input value={wishForm.name} onChange={e => setWishForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cream structured blazer" style={inputStyle} />

            <label style={labelStyle}>Brand</label>
            <input value={wishForm.brand} onChange={e => setWishForm(f => ({ ...f, brand: e.target.value }))} placeholder="Brand" style={inputStyle} />

            <label style={labelStyle}>URL</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={wishForm.url} onChange={e => setWishForm(f => ({ ...f, url: e.target.value }))} placeholder="https://…" style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
              <button onClick={fetchUrl} disabled={fetchingUrl || !wishForm.url} style={{ ...chipB(false), flexShrink: 0, opacity: fetchingUrl || !wishForm.url ? 0.5 : 1 }}>{fetchingUrl ? "…" : "Fetch"}</button>
            </div>

            <label style={labelStyle}>Current Price ($)</label>
            <input value={wishForm.currentPrice} onChange={e => setWishForm(f => ({ ...f, currentPrice: e.target.value }))} placeholder="e.g. 248" style={inputStyle} />

            <label style={labelStyle}>Alert me when price drops to ($)</label>
            <input value={wishForm.targetPrice} onChange={e => setWishForm(f => ({ ...f, targetPrice: e.target.value }))} placeholder="e.g. 150" style={inputStyle} />

            <label style={labelStyle}>Notes</label>
            <textarea value={wishForm.description} onChange={e => setWishForm(f => ({ ...f, description: e.target.value }))} placeholder="Why you want it, what it goes with..." style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} />

            <label style={labelStyle}>Priority</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {WISH_TAGS.map(tag => (
                <button key={tag} onClick={() => setWishForm(f => ({ ...f, tag }))} style={chipB(wishForm.tag === tag)}>{tag}</button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveItem} disabled={!wishForm.name && !wishForm.description} style={{ flex: 1, background: T.hot, color: "#fff", border: "none", borderRadius: 0, padding: "14px", fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer", opacity: (!wishForm.name && !wishForm.description) ? 0.5 : 1 }}>Save</button>
              <button onClick={() => setAddingWish(false)} style={{ ...chipB(false), padding: "14px 20px" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
