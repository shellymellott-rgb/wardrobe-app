/**
 * Return materials as an array regardless of whether the raw item has
 * the legacy singular `material` string or the current `materials` array.
 */
export function getMaterials(item) {
  if (Array.isArray(item.materials) && item.materials.length) return item.materials;
  if (item.material) return [item.material];
  return [];
}

export function fmtMaterials(item) {
  return getMaterials(item).join(" / ");
}

/**
 * Ensure a raw item (from DB, import, or any other source) uses the
 * current data model.  Removes legacy `material` string field and
 * guarantees every expected field is present.
 */
export function normalizeItem(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const materials = getMaterials(raw);
  // eslint-disable-next-line no-unused-vars
  const { material, ...rest } = raw; // drop legacy singular field
  return {
    ...rest,
    materials,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    wornDates: Array.isArray(raw.wornDates) ? raw.wornDates : [],
    sleeveLength: raw.sleeveLength || "N/A",
    length: raw.length || "N/A",
    season: raw.season || "All Year",
  };
}

/** Initial state for the add/edit form. */
export function emptyForm() {
  return {
    name:"",brand:"",category:"Tops",color:"",customColor:"",
    season:"All Year",sleeveLength:"N/A",length:"N/A",
    materials:[],customMaterial:"",
    tags:[],customTag:"",
    comments:"",datePurchased:"",price:"",
    imageData:null,imageThumb:null,originalImageData:null,
  };
}

/**
 * Build a persisted item object from a filled-out form.
 * Always produces `materials` array; never produces legacy `material`.
 */
export function buildItem(form) {
  return {
    id: Date.now() + Math.random(),
    name: form.name,
    brand: form.brand || "",
    category: form.category,
    color: form.color === "Other" ? (form.customColor || "") : form.color,
    materials: Array.isArray(form.materials) ? form.materials : [],
    season: form.season,
    sleeveLength: form.sleeveLength,
    length: form.length,
    tags: Array.isArray(form.tags) ? form.tags : [],
    comments: form.comments || "",
    datePurchased: form.datePurchased || "",
    price: form.price ? parseFloat(form.price) : null,
    imageData:  form.imageData  || null,
    imageThumb: form.imageThumb || null,
    wornDates: [],
    addedAt: new Date().toISOString(),
  };
}
