import { useState } from "react";
import { T, ML, chipB } from "../theme.js";
import { inputStyle, labelStyle } from "../styles.js";
import { callClaude } from "../utils/callClaude.js";
import { parseJsonObject } from "../utils/parseJson.js";
import { URL_PROMPT } from "../constants.js";

const WISH_TAGS = ["Need", "Maybe", "Saved"];
// Map display tag → label shown on tile
const TAG_LABELS = { Need: "PRIORITY", Maybe: "CASUAL", Saved: "STAPLE" };

export default function WishlistView({ wishlist, persistWishlist }) {
  const [wishForm, setWishForm] = useState({ type: "general", tag: "Saved", note: "", url: "", targetPrice: "", name: "", brand: "" });
  const [addingWish, setAddingWish] = useState(false);
  const [fetchingWishUrl, setFetchingWishUrl] = useState(false);

  async function fetchWishUrl() {
    if (!wishForm.url.trim()) return;
    setFetchingWishUrl(true);
    try {
      const pageRes = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fetchUrl: wishForm.url.trim() }) });
      const pageData = await pageRes.json();
      const text = await callClaude(URL_PROMPT, [{ type: "text", text: `Extract product details from this page content:\n\n${pageData.pageText || "URL: " + wishForm.url}` }], 400);
      const parsed = parseJsonObject(text);
      setWishForm(f => ({ ...f, name: parsed.name || f.name, brand: parsed.brand || f.brand, note: pageData.price || parsed.price || f.note }));
    } catch {}
    setFetchingWishUrl(false);
  }

  function addWishItem() {
    if (!wishForm.note && !wishForm.url && !wishForm.name) return;
    const item = {
      id: Date.now() + Math.random(), type: wishForm.type, tag: wishForm.tag || "Saved",
      note: wishForm.note, url: wishForm.url,
      targetPrice: wishForm.targetPrice ? parseFloat(wishForm.targetPrice) : null,
      name: wishForm.name, brand: wishForm.brand, addedAt: new Date().toISOString(),
    };
    persistWishlist([...wishlist, item]);
    setWishForm({ type: "general", tag: "Saved", note: "", url: "", targetPrice: "", name: "", brand: "" });
    setAddingWish(false);
  }

  function updateTag(id, tag) {
    persistWishlist(wishlist.map(w => w.id === id ? { ...w, tag } : w));
  }

  const grouped = { Need: [], Maybe: [], Saved: [], untagged: [] };
  wishlist.forEach(w => {
    const t = w.tag || "Saved";
    if (grouped[t]) grouped[t].push(w); else grouped.Saved.push(w);
  });
  const orderedItems = [...grouped.Need, ...grouped.Saved, ...grouped.Maybe];

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 100 }}>

      {/* ── Hero ─────────────────────────────────────────── */}
      <div style={{ padding: "40px 28px 24px", borderBottom: `1px solid ${T.rule}`, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ ...ML, color: T.ink3, marginBottom: 10 }}>The List</div>
          <h2 style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 40, fontWeight: 400, letterSpacing: "-.02em", lineHeight: 1.0, color: T.hot, margin: 0 }}>
            Wishlist
          </h2>
        </div>
        <button
          onClick={() => setAddingWish(true)}
          style={{ background: T.hot, color: "#fff", border: "none", borderRadius: 0, padding: "10px 20px", fontFamily: T.mono, fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", cursor: "pointer" }}
        >+ Add Item</button>
      </div>

      {/* ── Add form modal ────────────────────────────────── */}
      {addingWish && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(10,10,10,0.5)", overflowY: "auto" }}>
          <div style={{ maxWidth: 480, margin: "0 auto", background: T.surface, minHeight: "100vh", padding: "28px 28px 100px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <span style={{ fontFamily: T.serif, fontSize: 22, color: T.ink }}>Add to Wishlist</span>
              <button onClick={() => setAddingWish(false)} style={{ background: "none", border: "none", color: T.ink3, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {/* Type toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button onClick={() => setWishForm(f => ({ ...f, type: "general" }))} style={chipB(wishForm.type === "general")}>General</button>
              <button onClick={() => setWishForm(f => ({ ...f, type: "specific" }))} style={chipB(wishForm.type === "specific")}>Specific Item</button>
            </div>

            {wishForm.type === "general" ? (
              <>
                <label style={labelStyle}>What are you looking for?</label>
                <input value={wishForm.note} onChange={e => setWishForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Navy structured blazer, under $300" style={inputStyle} />
              </>
            ) : (
              <>
                <label style={labelStyle}>Item Name</label>
                <input value={wishForm.name} onChange={e => setWishForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Everlane The Way-High Jean" style={inputStyle} />
                <label style={labelStyle}>Brand</label>
                <input value={wishForm.brand} onChange={e => setWishForm(f => ({ ...f, brand: e.target.value }))} placeholder="Brand" style={inputStyle} />
                <label style={labelStyle}>URL</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input value={wishForm.url} onChange={e => setWishForm(f => ({ ...f, url: e.target.value }))} placeholder="https://…" style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                  <button onClick={fetchWishUrl} disabled={fetchingWishUrl || !wishForm.url} style={{ ...chipB(false), flexShrink: 0, opacity: fetchingWishUrl || !wishForm.url ? 0.5 : 1 }}>
                    {fetchingWishUrl ? "…" : "Fetch"}
                  </button>
                </div>
                <label style={labelStyle}>Current Price ($)</label>
                <input value={wishForm.note} onChange={e => setWishForm(f => ({ ...f, note: e.target.value }))} placeholder="Current price" style={inputStyle} />
                <label style={labelStyle}>Alert me when price drops to ($)</label>
                <input value={wishForm.targetPrice} onChange={e => setWishForm(f => ({ ...f, targetPrice: e.target.value }))} placeholder="Target price" style={inputStyle} />
              </>
            )}

            <label style={labelStyle}>Tag</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {WISH_TAGS.map(tag => (
                <button key={tag} onClick={() => setWishForm(f => ({ ...f, tag }))} style={chipB(wishForm.tag === tag)}>{tag}</button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={addWishItem} style={{ flex: 1, background: T.hot, color: "#fff", border: "none", borderRadius: 0, padding: "14px", fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer" }}>Save</button>
              <button onClick={() => setAddingWish(false)} style={{ ...chipB(false), padding: "14px 20px" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────── */}
      {wishlist.length === 0 && !addingWish && (
        <div style={{ textAlign: "center", padding: "80px 28px", color: T.ink3 }}>
          <div style={{ ...ML, marginBottom: 8 }}>Nothing yet</div>
          <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3 }}>Add pieces you want to buy</div>
        </div>
      )}

      {/* ── 3-col grid ───────────────────────────────────── */}
      {orderedItems.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
          {orderedItems.map((item, idx) => (
            <div key={item.id} style={{ borderRight: idx % 3 < 2 ? `1px solid ${T.rule}` : "none", borderBottom: `1px solid ${T.rule}` }}>
              {/* Photo block — 4:5 */}
              <div style={{ position: "relative", aspectRatio: "4/5", background: T.paper, overflow: "hidden" }}>
                {/* Index top-left */}
                <div style={{ position: "absolute", top: 8, left: 8, ...ML, fontSize: 8, color: T.ink3 }}>
                  {String(idx + 1).padStart(2, "0")}/{String(orderedItems.length).padStart(2, "0")}
                </div>
                {/* Tag bottom-right */}
                <div style={{ position: "absolute", bottom: 8, right: 8, ...ML, fontSize: 8, color: T.ink3 }}>
                  {TAG_LABELS[item.tag || "Saved"]}
                </div>
              </div>
              {/* Info */}
              <div style={{ padding: "12px 14px 14px" }}>
                <div style={{ fontFamily: T.serif, fontSize: 18, color: T.ink, marginBottom: 4, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name || item.note}
                </div>
                {item.brand && <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink3, marginBottom: 3 }}>{item.brand}</div>}
                {item.note && item.type === "specific" && <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink3, marginBottom: 3 }}>Current: ${item.note}</div>}
                {item.targetPrice && <div style={{ fontFamily: T.sans, fontSize: 11, color: T.cobalt }}>Alert at: ${item.targetPrice}</div>}
                {/* Footer */}
                <div style={{ display: "flex", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.rule}` }}>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noreferrer" style={{ ...ML, fontSize: 9, color: T.ink, textDecoration: "none" }}>Find →</a>
                  )}
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noreferrer" style={{ ...ML, fontSize: 9, color: T.ink, textDecoration: "none" }}>Buy →</a>
                  )}
                  <button onClick={() => persistWishlist(wishlist.filter(w => w.id !== item.id))} style={{ background: "none", border: "none", color: T.ink3, fontFamily: T.mono, fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", cursor: "pointer", marginLeft: "auto", padding: 0 }}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
