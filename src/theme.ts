export const config = {
  supabaseUrl: 'https://jutrmafktwlabkyjlfmi.supabase.co',
  supabasePublishableKey: 'sb_publishable_BLTTdipFMb85f9BIksQAhA_nfMHR-rm',
};

export type Theme = {
  paper: string;
  surface: string;
  cream: string;
  ink: string;
  sub: string;
  coral: string;
  line: string;
  glass: string;
  fade: string;
};

const CHAVES: (keyof Theme)[] = ['paper', 'surface', 'cream', 'ink', 'sub', 'coral', 'line', 'glass', 'fade'];

const FALLBACK: Theme = {
  paper: '#E9E4D8',
  surface: '#F4EFE4',
  cream: '#CFC8B8',
  ink: '#1E1E1E',
  sub: '#5E5A52',
  coral: '#2E2E2E',
  line: '#D2CBBB',
  glass: '#E9E4D8EB',
  fade: 'linear-gradient(#E9E4D8E6,#E9E4D800)',
};

let atual: Theme = FALLBACK;

function lerDoCss(): Theme {
  const estilo = getComputedStyle(document.body);
  const out = {} as Theme;
  CHAVES.forEach(k => {
    const v = estilo.getPropertyValue('--' + k).trim();
    out[k] = v || FALLBACK[k];
  });
  return out;
}

export function getTheme(): Theme {
  return atual;
}

const CHAVE_TEMA = 'mipas-tema';

export function setTheme(mode: 'dark' | 'light', persistir = true) {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.body.classList.toggle('dark', mode === 'dark');
  atual = lerDoCss();
  if (!persistir) return;
  try {
    localStorage.setItem(CHAVE_TEMA, mode);
  } catch (e) {
  }
}

export function initialTheme(): 'dark' | 'light' {
  try {
    localStorage.removeItem('mipas-theme');
    return (localStorage.getItem(CHAVE_TEMA) as 'dark' | 'light') || 'dark';
  } catch (e) {
    return 'dark';
  }
}

export const listColors = [
  '#036D9A', '#FDEA6F', '#CF0000', '#4E5FBB', '#B8CE53', '#1A0089', '#FE5E32',
];
