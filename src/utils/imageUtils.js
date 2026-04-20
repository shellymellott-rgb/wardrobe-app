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
 *   full  — 600px longest side, quality 0.7  (~30-60KB) — for detail view
 *   thumb — 200px longest side, quality 0.4  (~5-10KB)  — for grid/cards
 */
export async function generateImageVersions(dataUrl) {
  const [full, thumb] = await Promise.all([
    compressImage(dataUrl, 600, 0.7),
    compressImage(dataUrl, 200, 0.4),
  ]);
  return { full, thumb };
}
