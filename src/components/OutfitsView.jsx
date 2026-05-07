import { useRef, useState } from "react";
import { T, ML, chipB } from "../theme.js";
import { ghostBtn } from "../styles.js";
import { sbCreateOutfit } from "../supabase.js";
import CompositeOutfitCard from "./CompositeOutfitCard.jsx";

const OCCASION_CHIPS = ["Errands", "Dinner", "Travel", "Boat day", "Work from home", "Date night", "Beach", "Gym"];

export default function OutfitsView({
  items, occasion, setOccasion, outfits, outfitText, loadingOutfit, generateOutfits,
  inspoImage, inspoResult, setInspoResult, setInspoImage, loadingInspo, analyzeInspo,
  underloved, markWorn, user,
  savedOutfits, outfitsLoading, onOutfitSaved,
  wishlist, persistWishlist, setChatInput, setView,
}) {
  const inspoRef = useRef();
  const [inspoSaved, setInspoSaved] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [addedToWishlist, setAddedToWishlist] = useState({});

  async function saveInspoOutfit() {
    if (!inspoResult || !user?.id) return;
    const matchedIds = (inspoResult.pieces || []).map(name => {
      const q = name.toLowerCase().trim();
      return (
        items.find(i => i.name.toLowerCase() === q) ||
        items.find(i => i.name.toLowerCase().includes(q) || q.includes(i.name.toLowerCase())) ||
        items.find(i => q.split(/\s+/).filter(w => w.length > 3).some(w => i.name.toLowerCase().includes(w))) ||
        null
      );
    }).filter(Boolean).map(i => String(i.id));

    const id = crypto.randomUUID();
    const name = inspoResult.outfitName || "Inspo Look";
    try {
      await sbCreateOutfit({ id, user_id: user.id, name }, matchedIds);
      setInspoSaved(true);
      onOutfitSaved?.();
    } catch (e) {
      console.error("[saveInspoOutfit]", e.message);
    }
  }

  function findItem(name) {
    const q = name.toLowerCase().trim();
    return (
      items.find(i => i.name.toLowerCase() === q) ||
      items.find(i => i.name.toLowerCase().includes(q) || q.includes(i.name.toLowerCase())) ||
      items.find(i => q.split(/\s+/).filter(w => w.length > 3).some(w => i.name.toLowerCase().includes(w))) ||
      null
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>

      {/* ── Hero ─────────────────────────────────────────── */}
      <div style={{ padding: "40px 28px 24px", borderBottom: `1px solid ${T.rule}` }}>
        <div style={{ ...ML, color: T.ink3, marginBottom: 12 }}>Outfit Studio</div>
        <h2 style={{ fontFamily: T.serif, fontSize: 44, fontWeight: 400, letterSpacing: "-.02em", lineHeight: 1.0, color: T.ink, margin: "0 0 20px" }}>
          What are you{" "}
          <em style={{ fontStyle: "italic", color: T.cobalt }}>dressing for?</em>
        </h2>

        {/* Occasion chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {OCCASION_CHIPS.map(s => (
            <button key={s} onClick={() => setOccasion(occasion === s ? "" : s)} style={chipB(occasion === s)}>
              {s}
            </button>
          ))}
        </div>

        {/* Generate CTA */}
        <button
          onClick={generateOutfits}
          disabled={loadingOutfit || items.length < 2}
          style={{
            width: "100%", background: items.length < 2 ? T.rule : T.cobalt,
            color: items.length < 2 ? T.ink3 : T.bg,
            border: "none", borderRadius: 0, padding: "16px",
            fontFamily: T.mono, fontSize: 11, letterSpacing: ".24em",
            textTransform: "uppercase",
            cursor: items.length < 2 ? "not-allowed" : "pointer",
          }}
        >
          {loadingOutfit ? "Styling…" : items.length < 2 ? "Add at least 2 pieces first" : "Generate Outfits"}
        </button>
      </div>

      {/* ── Generated outfit results ─────────────────────── */}
      {outfits.length > 0 && (
        <div style={{ padding: "28px 28px 0", borderBottom: `1px solid ${T.rule}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ ...ML, color: T.ink3 }}>Generated Looks</div>
            <button onClick={generateOutfits} style={{ ...ML, background: "none", border: "none", color: T.ink3, cursor: "pointer", padding: 0 }}>↻ Regenerate</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
            {outfits.map((outfit, oi) => {
              const outfitItems = (outfit.pieces || []).map(name => {
                const q = name.toLowerCase().trim();
                return (
                  items.find(i => i.name.toLowerCase() === q) ||
                  items.find(i => i.name.toLowerCase().includes(q) || q.includes(i.name.toLowerCase())) ||
                  null
                );
              }).filter(Boolean);
              return (
                <div key={oi} style={{ borderRight: oi < outfits.length - 1 ? `1px solid ${T.rule}` : "none", borderBottom: `1px solid ${T.rule}`, overflow: "hidden" }}>
                  {/* 2×2 quadrant */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    {[0,1,2,3].map(idx => (
                      <div key={idx} style={{ aspectRatio: "1/1", overflow: "hidden", background: T.paper, borderRight: idx % 2 === 0 ? `1px solid ${T.rule}` : "none", borderBottom: idx < 2 ? `1px solid ${T.rule}` : "none" }}>
                        {outfitItems[idx]?.imageData
                          ? <img src={outfitItems[idx].imageThumb ?? outfitItems[idx].imageData} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          : null
                        }
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "12px 14px 14px" }}>
                    <div style={{ ...ML, color: T.ink3, marginBottom: 4 }}>{outfit.why?.slice(0, 24) || "Outfit"}</div>
                    <div style={{ fontFamily: T.serif, fontSize: 18, color: T.ink, lineHeight: 1.1 }}>{outfit.name}</div>
                    {outfit.tip && <div style={{ fontFamily: T.sans, fontSize: 10, color: T.ink3, marginTop: 4 }}>✦ {outfit.tip}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {outfitText && (
        <div style={{ padding: "16px 28px", background: T.paper, borderBottom: `1px solid ${T.rule}`, fontFamily: T.sans, fontSize: 13, lineHeight: 1.8, color: T.ink2, whiteSpace: "pre-wrap" }}>
          {outfitText}
        </div>
      )}

      {/* ── Inspo section ────────────────────────────────── */}
      <div style={{ padding: "28px 28px 0", borderBottom: `1px solid ${T.rule}` }}>
        <div style={{ ...ML, color: T.ink3, marginBottom: 14 }}>Outfit Inspiration</div>
        <input ref={inspoRef} type="file" accept="image/*" onChange={analyzeInspo} style={{ display: "none" }} />

        {!inspoResult && (
          <div
            onClick={() => inspoRef.current.click()}
            style={{ border: `1px solid ${T.rule}`, padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", marginBottom: 24 }}
          >
            {inspoImage
              ? <img src={inspoImage} style={{ width: "100%", maxHeight: 200, objectFit: "cover", marginBottom: 8 }} />
              : <>
                  <div style={{ fontSize: 24, marginBottom: 10 }}>📸</div>
                  <div style={{ ...ML, color: T.ink3, marginBottom: 4 }}>Upload Inspo Photo</div>
                  <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink3, textAlign: "center" }}>I'll recreate the look from your wardrobe</div>
                </>
            }
          </div>
        )}

        {loadingInspo && (
          <div style={{ textAlign: "center", ...ML, color: T.ink3, padding: "16px 0 28px", animation: "pulse 1.2s ease-in-out infinite" }}>
            Analyzing look…
          </div>
        )}

        {inspoResult && (() => {
          const allPieces = (inspoResult.pieces || []).map(name => ({ name, item: findItem(name) }));
          return (
            <>
              {lightboxOpen && (
                <div onClick={() => setLightboxOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                  <img src={inspoImage} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </div>
              )}
              <div style={{ border: `1px solid ${T.rule}`, overflow: "hidden", marginBottom: 24 }}>
                <div onClick={() => setLightboxOpen(true)} style={{ position: "relative", width: "100%", paddingBottom: "100%", cursor: "zoom-in", overflow: "hidden" }}>
                  <img src={inspoImage} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,rgba(10,10,10,0.8))", padding: "28px 16px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div style={{ fontFamily: T.serif, fontSize: 18, color: T.bg }}>{inspoResult.outfitName}</div>
                    <button onClick={e => { e.stopPropagation(); setInspoResult(null); setInspoImage(null); setInspoSaved(false); setLightboxOpen(false); }}
                      style={{ background: "none", border: `1px solid rgba(255,255,255,0.3)`, color: "rgba(255,255,255,0.6)", padding: "3px 8px", fontFamily: T.mono, fontSize: 9, letterSpacing: ".12em", cursor: "pointer", textTransform: "uppercase" }}>New photo</button>
                  </div>
                </div>
                {allPieces.length > 0 && (
                  <div>
                    <div style={{ ...ML, color: T.ink3, padding: "12px 16px 8px" }}>Recreate with your wardrobe</div>
                    <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 16px 14px", scrollbarWidth: "none" }}>
                      {allPieces.map(({ name, item }, i) => (
                        <div key={i} style={{ flexShrink: 0, width: 96 }}>
                          <div style={{ position: "relative", width: 96, height: 128, background: T.paper, border: `1px solid ${T.rule}`, overflow: "hidden" }}>
                            {item?.imageData
                              ? <img src={item.imageThumb ?? item.imageData} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 8, gap: 6 }}>
                                  <div style={{ ...ML, color: T.rule, fontSize: 8, textAlign: "center" }}>{name}</div>
                                </div>
                            }
                          </div>
                          <div style={{ fontFamily: T.sans, fontSize: 9, color: item ? T.ink : T.hot, marginTop: 3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item ? item.name : "not in closet"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ padding: "14px 16px" }}>
                  {inspoResult.why && <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink2, lineHeight: 1.6, marginBottom: 8 }}>{inspoResult.why}</div>}
                  {inspoResult.tip && <div style={{ fontFamily: T.sans, fontSize: 10, color: T.cobalt, marginBottom: 8 }}>✦ {inspoResult.tip}</div>}
                  {inspoResult.gaps?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ ...ML, color: T.ink3, marginBottom: 8 }}>Still need:</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {inspoResult.gaps.map((g, i) => {
                          const key = `gap-${i}`;
                          const added = addedToWishlist[key];
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: T.paper, border: `1px solid ${T.rule}`, padding: "10px 12px" }}>
                              <div style={{ flex: 1, fontFamily: T.sans, fontSize: 12, color: T.ink2, lineHeight: 1.4 }}>{g}</div>
                              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                <button
                                  onClick={() => { persistWishlist?.([...(wishlist || []), { id: crypto.randomUUID(), name: g, category: "Other", brand: "", color: "", imageData: null, worn: 0 }]); setAddedToWishlist(prev => ({ ...prev, [key]: true })); }}
                                  disabled={added}
                                  style={{ background: "transparent", border: `1px solid ${T.rule}`, color: added ? T.sage : T.ink3, fontFamily: T.mono, fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", padding: "5px 9px", cursor: added ? "default" : "pointer" }}
                                >{added ? "✓ Saved" : "+ Wishlist"}</button>
                                <button
                                  onClick={() => { setChatInput?.(`I need help finding: ${g}. What should I look for?`); setView?.("chat"); }}
                                  style={{ background: "transparent", border: `1px solid ${T.rule}`, color: T.ink3, fontFamily: T.mono, fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", padding: "5px 9px", cursor: "pointer" }}
                                >Ask stylist</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <button onClick={saveInspoOutfit} disabled={inspoSaved} style={{
                    width: "100%", border: "none", borderRadius: 0, padding: "11px",
                    fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase",
                    cursor: inspoSaved ? "default" : "pointer",
                    background: inspoSaved ? "transparent" : T.cobalt,
                    color: inspoSaved ? T.sage : T.bg,
                  }}>
                    {inspoSaved ? "✓ Outfit saved" : "Save outfit"}
                  </button>
                </div>
              </div>
              <button onClick={() => inspoRef.current.click()} style={{ ...ghostBtn, fontSize: 10, letterSpacing: ".18em", marginBottom: 24 }}>
                📸 Try different photo
              </button>
            </>
          );
        })()}
      </div>

      {/* ── Saved Looks ──────────────────────────────────── */}
      <div style={{ padding: "28px 28px 0" }}>
        <div style={{ ...ML, color: T.ink3, marginBottom: 20 }}>
          Saved Looks{savedOutfits?.length > 0 ? ` · ${savedOutfits.length}` : ""}
        </div>

        {outfitsLoading ? (
          <div style={{ textAlign: "center", ...ML, color: T.ink3, padding: "20px 0", animation: "pulse 1.2s ease-in-out infinite" }}>Loading…</div>
        ) : savedOutfits === null || savedOutfits.length === 0 ? (
          <div style={{ ...ML, color: T.ink3, padding: "20px 0" }}>No outfits yet</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
            {savedOutfits.map((outfit, idx) => {
              const outfitItems = (outfit.itemIds || []).map(id => items.find(i => String(i.id) === id)).filter(Boolean);
              return (
                <div key={outfit.id} style={{ borderRight: idx % 3 < 2 ? `1px solid ${T.rule}` : "none", borderBottom: `1px solid ${T.rule}`, overflow: "hidden" }}>
                  {/* 2×2 quadrant */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    {[0,1,2,3].map(i => (
                      <div key={i} style={{ aspectRatio: "1/1", overflow: "hidden", background: T.paper, borderRight: i % 2 === 0 ? `1px solid ${T.rule}` : "none", borderBottom: i < 2 ? `1px solid ${T.rule}` : "none" }}>
                        {outfitItems[i]?.imageData
                          ? <img src={outfitItems[i].imageThumb ?? outfitItems[i].imageData} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          : null
                        }
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "12px 14px 14px" }}>
                    <div style={{ fontFamily: T.serif, fontSize: 18, color: T.ink, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{outfit.name}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Never worn ───────────────────────────────────── */}
      {underloved.length > 0 && (
        <div style={{ padding: "28px 28px 0" }}>
          <div style={{ ...ML, color: T.hot, marginBottom: 14 }}>Never worn — {underloved.length} pieces</div>
          {underloved.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${T.rule}` }}>
              {item.imageData && <img src={item.imageThumb ?? item.imageData} loading="lazy" style={{ width: 32, height: 42, objectFit: "cover", flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 500, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name || "Unnamed"}</div>
                <div style={{ ...ML, color: T.ink3, fontSize: 9, marginTop: 2 }}>{item.brand || item.category}</div>
              </div>
              <button onClick={() => markWorn(item.id)} style={{ background: "transparent", border: `1px solid ${T.rule}`, color: T.ink3, fontFamily: T.mono, fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", padding: "5px 10px", cursor: "pointer", flexShrink: 0 }}>worn</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
