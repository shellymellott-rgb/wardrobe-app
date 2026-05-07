// Direction B — "Gallery White" design tokens
export const T = {
  bg:     '#ffffff',
  paper:  '#fafaf8',
  ink:    '#0a0a0a',
  ink2:   '#3a3a3a',
  ink3:   '#999999',
  rule:   '#e5e3df',
  hot:    '#d6422a',
  cobalt: '#2a4ad6',
  citron: '#e8d84a',
  sage:   '#3a6b4a',
  blush:  '#f4d4cc',
  serif:  '"Instrument Serif", "Times New Roman", serif',
  sans:   '"Inter", system-ui, sans-serif',
  mono:   '"DM Mono", ui-monospace, monospace',
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
  color: '#999999',
};

/** Occasion / filter chip */
export function chipB(active = false) {
  return {
    border: `1px solid ${T.rule}`,
    background: active ? T.ink : 'transparent',
    color: active ? T.bg : T.ink2,
    padding: '8px 14px',
    fontFamily: T.mono,
    fontSize: 10,
    letterSpacing: '.18em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}
