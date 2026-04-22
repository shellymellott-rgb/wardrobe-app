// Category sort order: head/top → bottom → shoes → accessories
const CATEGORY_ORDER = { Tops: 0, Dresses: 1, Outerwear: 2, Bottoms: 3, Shoes: 4, Accessories: 5 };

/**
 * 2×2 grid of item thumbnail photos, Fits-app composite style.
 * Items sorted by garment layer. Up to 4 shown; overflow is a "+N" badge.
 * Empty cells render as subtle dark fill so the grid always looks intentional.
 */
export default function CompositeOutfitCard({ items }) {
  if (!items || items.length === 0) return null;

  const sorted = [...items].sort(
    (a, b) => (CATEGORY_ORDER[a.category] ?? 6) - (CATEGORY_ORDER[b.category] ?? 6)
  );

  // Build exactly 4 cells. If >4 items, 4th cell becomes an overflow badge.
  const overflow = sorted.length > 4 ? sorted.length - 3 : 0;
  const visible  = overflow > 0 ? sorted.slice(0, 3) : sorted.slice(0, 4);
  // Pad to 4 with undefined (empty cells)
  const cells = [...visible, ...(overflow > 0 ? [null] : []), ...Array(Math.max(0, 4 - visible.length - (overflow > 0 ? 1 : 0))).fill(undefined)];

  return (
    <div style={{
      width: "100%",
      aspectRatio: "4/5",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr 1fr",
      gap: 1,
      background: "#0d0d0d",
      overflow: "hidden",
    }}>
      {cells.map((item, i) => (
        <div key={i} style={{ position: "relative", overflow: "hidden", background: "#141414" }}>
          {item === null ? (
            // Overflow badge
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#141414" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>+{overflow}</div>
            </div>
          ) : item === undefined ? (
            // Empty cell — intentional dark fill
            <div style={{ width: "100%", height: "100%", background: "#141414" }} />
          ) : (item.imageThumb || item.imageData) ? (
            <img
              src={item.imageThumb ?? item.imageData}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            // No image fallback
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 8, gap: 4 }}>
              <div style={{ fontSize: 16, color: "#2a2a2a" }}>◻</div>
              <div style={{ fontSize: 8, color: "#444", textAlign: "center", lineHeight: 1.3, overflow: "hidden" }}>{item.name}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
