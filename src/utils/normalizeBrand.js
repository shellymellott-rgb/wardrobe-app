const BRAND_CANONICAL = {
  ag: "AG",
  abercrombieandfitch: "Abercrombie & Fitch",
  adriennevittadini: "Adrienne Vittadini",
  amazonessentials: "Amazon Essentials",
  andnowthis: "And Now This",
  anntaylor: "Ann Taylor",
  armoire: "Armoire",
  bcbg: "BCBG",
  bananarepublic: "Banana Republic",
  brbananarepublic: "Banana Republic",
  bananarepublicfactory: "Banana Republic Factory",
  birkenstock: "Birkenstock",
  bjorndal: "Bjorndal",
  bostonproper: "Boston Proper",
  calvinklein: "Calvin Klein",
  caslon: "Caslon",
  cece: "CeCe",
  clarks: "Clarks",
  clogau: "Clogau",
  cottonon: "Cotton On",
  dkny: "DKNY",
  dvdolcevita: "DV Dolce Vita",
  dubarry: "Dubarry",
  editorstudio: "Editor Studio",
  express: "Express",
  faherty: "Faherty",
  favoritedaughter: "Favorite Daughter",
  francosarto: "Franco Sarto",
  frye: "Frye",
  gap: "Gap",
  gapfactory: "Gap Factory",
  goodamerican: "Good American",
  heydude: "HEYDUDE",
  incinternationalconcepts: "INC International Concepts",
  jcrew: "J.Crew",
  jcrewfactory: "J.Crew Factory",
  journeyecollection: "Journee Collection",
  kada: "Kada",
  kancan: "KanCan",
  laotepo: "Laotepo",
  lilysilk: "LILYSILK",
  loft: "LOFT",
  landsend: "Lands' End",
  laurenralphlauren: "Lauren Ralph Lauren",
  levistrausssignature: "Levi Strauss Signature",
  macys: "Macy's",
  madewell: "Madewell",
  melroseandmarket: "Melrose and Market",
  merrell: "Merrell",
  michaelkors: "Michael Kors",
  nydj: "NYDJ",
  naturalizer: "Naturalizer",
  nicolemiller: "Nicole Miller",
  nordstrom: "Nordstrom",
  olukai: "Olukai",
  olakai: "Olukai",
  oliverlogan: "Oliver Logan",
  on34th: "On 34th",
  openedit: "Open Edit",
  paige: "PAIGE",
  quince: "Quince",
  ripskirt: "Rip Skirt",
  saintlaurentysl: "Saint Laurent YSL",
  spartina: "Spartina 449",
  spartina449: "Spartina 449",
  staud: "Staud",
  stevemadden: "Steve Madden",
  ttahari: "Tahari",
  tahari: "Tahari",
  taos: "Taos",
  taosfootwear: "Taos",
  target: "Target",
  threedots: "Three Dots",
  thursdaybootclub: "Thursday Boot Club",
  tsonga: "Tsonga",
  up: "Up!",
  vervet: "Vervet",
  varley: "Varley",
  vince: "Vince",
  whbm: "White House Black Market",
  whitehouseblackmarket: "White House Black Market",
  yeokou: "Yeokou",
};

export function normalizeBrandKey(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/\+/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function titleCaseBrand(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

export function canonicalizeBrand(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const key = normalizeBrandKey(raw);
  return BRAND_CANONICAL[key] || titleCaseBrand(raw);
}

export function sameBrand(a, b) {
  return normalizeBrandKey(a) === normalizeBrandKey(b);
}

export function normalizeBrandList(values = []) {
  const byKey = new Map();
  values.forEach(value => {
    const canonical = canonicalizeBrand(value);
    const key = normalizeBrandKey(canonical);
    if (canonical && !byKey.has(key)) byKey.set(key, canonical);
  });
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}
