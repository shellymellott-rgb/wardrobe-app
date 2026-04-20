export function readFile(file) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.readAsDataURL(file);
  });
}

export function compressImage(dataUrl, maxDim = 2000, quality = 0.95) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width  = Math.round(img.width  * s);
      c.height = Math.round(img.height * s);
      const ctx = c.getContext("2d");
      // High-quality downscaling — avoids the pixelation/grain from default "low"
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

/**
 * Generate two versions from a raw cropped image (crop outputs at quality 1.0).
 * Compression happens exactly once here — no earlier, no later.
 * Returns { full, thumb } where:
 *   full  — 2000px max, quality 0.95 — for detail view
 *   thumb — 600px max,  quality 0.90 — for grid/cards
 */
export async function generateImageVersions(dataUrl) {
  const [full, thumb] = await Promise.all([
    compressImage(dataUrl, 2000, 0.95),
    compressImage(dataUrl, 600,  0.90),
  ]);
  return { full, thumb };
}
