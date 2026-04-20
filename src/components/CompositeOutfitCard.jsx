// Category sort order for stacking: top → bottom → shoes → everything else
const CATEGORY_ORDER = { Tops: 0, Dresses: 1, Outerwear: 2, Bottoms: 3, Shoes: 4, Accessories: 5 };

/**
 * Stacks outfit item images vertically in one tall card, Fits-app style.
 * Items are sorted by garment layer (top → bottom → shoes).
 * Each segment gets equal height and fills the full card width.
 */
export default function CompositeOutfitCard({ items }) {
  if (!items || items.length === 0) return null;

  const sorted = [...items].sort(
    (a, b) => (CATEGORY_ORDER[a.category] ?? 6) - (CATEGORY_ORDER[b.category] ?? 6)
  );

  return (
    <div style={{
      width: "100%",
      aspectRatio: "3/5",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: "#141414",
    }}>
      {sorted.map((item, i) => (
        <div key={i} style={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          borderBottom: i < sorted.length - 1 ? "1px solid #0d0d0d" : "none",
        }}>
          {item.imageData
            ? <img
                src={item.imageThumb ?? item.imageData}
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            : <div style={{
                width: "100%", height: "100%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "#1a1a1a",
              }}>
                <div style={{ fontSize: 9, color: "#444", textAlign: "center", lineHeight: 1.3, padding: 8 }}>
                  {item.name}
                </div>
              </div>
          }
        </div>
      ))}
    </div>
  );
}
