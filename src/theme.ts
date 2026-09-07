export const config = {
  supabaseUrl: 'https://altsfuxppwspqzsrhwmj.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsdHNmdXhwcHdzcHF6c3Jod21qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNzU4ODYsImV4cCI6MjEwMDc1MTg4Nn0.Moh8SZ0Y22XpmCPr5PNYYvA-o3R5tlcJIIUF3iWLqIQ',
};

export type ThemeMode = 'dark' | 'light';

export type Theme = {
  paper: string;
  surface: string;
  cream: string;
  ink: string;
  sub: string;
  coral: string;
  coralText: string;
  line: string;
  danger: string;
  glass: string;
  fade: string;
};

/* Each key mirrors one CSS custom property, and the two palettes below mirror
   the values that :root and .dark set in index.css. The stylesheet stays the
   source of truth — these are only used until it is readable (see readCss). */
const CSS_VAR: Record<keyof Theme, string> = {
  paper: '--paper',
  surface: '--surface',
  cream: '--cream',
  ink: '--ink',
  sub: '--sub',
  coral: '--coral',
  coralText: '--coral-text',
  line: '--line',
  danger: '--danger',
  glass: '--glass',
  fade: '--fade',
};

const KEYS = Object.keys(CSS_VAR) as (keyof Theme)[];

const PALETTES: Record<ThemeMode, Theme> = {
  light: {
    paper: '#E9E4D8',
    surface: '#F4EFE4',
    cream: '#CFC8B8',
    ink: '#1E1E1E',
    sub: '#555149',
    coral: '#2E2E2E',
    coralText: '#E6E4D7',
    line: '#B3AA96',
    danger: '#C81E1E',
    glass: '#E9E4D8EB',
    fade: 'linear-gradient(#E9E4D8E6,#E9E4D800)',
  },
  dark: {
    paper: '#141414',
    surface: '#1C1C1C',
    cream: '#2A2A2A',
    ink: '#E8E3DA',
    sub: '#9A968F',
    coral: '#D1CFC0',
    coralText: '#363636',
    line: '#414141',
    danger: '#FF6B5B',
    glass: '#141414EB',
    fade: 'linear-gradient(#141414E6,#14141400)',
  },
};

const STORAGE_KEY = 'mipas-tema';
const DEFAULT_MODE: ThemeMode = 'dark';

let mode: ThemeMode = DEFAULT_MODE;
let current: Theme = PALETTES[DEFAULT_MODE];
/* False while `current` is still the hardcoded palette. The stylesheet is a
   separate <link> that can land after this module runs, and reading it too
   early used to hand every inline style the light palette while the classes
   already painted dark — the screen came out half light, half dark. */
let fromCss = false;

/* Reads the palette straight off the document so a colour tweak in index.css
   reaches the inline styles too. Any property still missing keeps the value of
   the mode being applied, never the other mode's. */
function readCss(m: ThemeMode): { theme: Theme; complete: boolean } {
  const theme = { ...PALETTES[m] };
  let complete = true;
  if (typeof document === 'undefined' || !document.body) return { theme, complete: false };
  const style = getComputedStyle(document.body);
  KEYS.forEach(k => {
    const value = style.getPropertyValue(CSS_VAR[k]).trim();
    if (value) theme[k] = value;
    else complete = false;
  });
  return { theme, complete };
}

function refresh() {
  const { theme, complete } = readCss(mode);
  current = theme;
  fromCss = complete;
}

export function getTheme(): Theme {
  if (!fromCss) refresh();
  return current;
}

export function getThemeMode(): ThemeMode {
  return mode;
}

/* Keeps the browser chrome (iOS status bar, Android address bar) on the same
   background as the app instead of leaving it on the light default. */
function syncThemeColor(color: string) {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = color;
}

export function setTheme(next: ThemeMode, persist = true) {
  mode = next;
  const dark = next === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  document.body.classList.toggle('dark', dark);
  fromCss = false;
  refresh();
  syncThemeColor(current.paper);
  if (!persist) return;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch (e) {
  }
}

export function initialTheme(): ThemeMode {
  try {
    localStorage.removeItem('mipas-theme');
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : DEFAULT_MODE;
  } catch (e) {
    return DEFAULT_MODE;
  }
}

/* Chips paint a list's own colour as text over a 12% tint of itself. Some of
   the colours a list can take (the yellow, the lime) land near 2:1 on the light
   paper, so the accent is nudged toward the far end of the palette until it is
   readable. Already-readable accents come back untouched. */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function toRgb(color: string): [number, number, number] | null {
  const m = HEX.exec(color.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

const toHex = (rgb: number[]) =>
  '#' + rgb.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

function luminance(rgb: number[]) {
  const [r, g, b] = rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number[], b: number[]) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

export function chipTextColor(accent: string, background: string, tint = 0.12, target = 4.5): string {
  const fg = toRgb(accent);
  const bg = toRgb(background);
  if (!fg || !bg) return accent;
  /* The chip sits on the tint, not on the bare panel. */
  const behind = mix(bg, fg, tint);
  if (contrast(fg, behind) >= target) return accent;
  const towards = luminance(behind) > 0.35 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0.05; t <= 1; t += 0.05) {
    const tried = mix(fg, towards, t);
    if (contrast(tried, behind) >= target) return toHex(tried);
  }
  return toHex(towards);
}

export const listColors = [
  '#036D9A', '#FDEA6F', '#CF0000', '#4E5FBB', '#B8CE53', '#1A0089', '#FE5E32',
];
