// Direction B — "Gallery White" design tokens (final)
export const T = {
  // Surfaces
  bg:         '#dcd6c8',   // outer page — warm sand, frames the white column
  surface:    '#ffffff',   // primary content surface — TRUE white
  paper:      '#f4efe2',   // warm cream band — accent only, NOT default bg
  heroSage:   '#2d4a3f',   // deep sage hero — Home top block
  inkSurface: '#0a0a0a',   // weather card / dark inversions — pure black
  // Ink
  ink:  '#0a0a0a',
  ink2: '#3a3a3a',
  ink3: '#8a8378',
  // Rules — two weights
  rule:       '#d8d2c2',   // soft sand hairline, used inside grids
  ruleStrong: '#0a0a0a',   // strong black rule, section dividers only
  // Accents
  hot:    '#d6422a',   // tomato red — Wishlist, NEW badges, chapter 1
  cobalt: '#2d4a8a',   // softened ink-navy — italic headlines
  citron: '#e8d84a',   // citron yellow — hero italic, Generate CTA, weather
  sage:   '#3a6b4a',   // mid sage — chapter 3 divider, Journal year
  blush:  '#f4d4cc',   // soft blush — bg for UNWORN chip
  cream:  '#f4efe2',   // cream text on dark sage hero
  // Fonts
  serif: '"Instrument Serif", "Times New Roman", serif',
  sans:  '"Inter", system-ui, sans-serif',
  mono:  '"DM Mono", ui-monospace, monospace',
};

/** BTab / nav tab button style */
export function tabStyle(active) {
  return {
    border: 0,
    background: 'transparent',
    padding: '6px 0',
    borderBottom: active ? `1px solid ${T.ink}` : '1px solid transparent',
    fontFamily: T.mono,
    fontSize: 10,
    letterSpacing: '.22em',
    textTransform: 'uppercase',
    color: active ? T.ink : T.ink3,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

/** DM Mono label base styles — spread and override as needed */
export const ML = {
  fontFamily: '"DM Mono", ui-monospace, monospace',
  fontSize: 10,
  letterSpacing: '.22em',
  textTransform: 'uppercase',
  color: '#8a8378',
};

/** Occasion / filter chip */
export function chipB(active = false) {
  return {
    border: `1px solid ${T.rule}`,
    background: active ? T.ink : 'transparent',
    color: active ? '#fff' : T.ink2,
    padding: '8px 14px',
    fontFamily: T.mono,
    fontSize: 10,
    letterSpacing: '.18em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}
