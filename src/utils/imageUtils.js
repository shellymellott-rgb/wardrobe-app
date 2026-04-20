export function readFile(file) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.readAsDataURL(file);
  });
}

export function compressImage(dataUrl, maxDim = 600, quality = 0.65) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width  = Math.round(img.width  * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

/**
 * Generate two compressed versions from a raw cropped image.
 * Returns { full, thumb } where:
 *   full  — 1000px longest side, quality 0.92 — for detail view
 *   thumb — 400px longest side, quality 0.85 — for grid/cards
 */
export async function generateImageVersions(dataUrl) {
  const [full, thumb] = await Promise.all([
    compressImage(dataUrl, 1000, 0.92),
    compressImage(dataUrl, 400, 0.85),
  ]);
  return { full, thumb };
}
