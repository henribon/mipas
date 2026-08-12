export const config = {
  supabaseUrl: 'https://altsfuxppwspqzsrhwmj.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsdHNmdXhwcHdzcHF6c3Jod21qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNzU4ODYsImV4cCI6MjEwMDc1MTg4Nn0.Moh8SZ0Y22XpmCPr5PNYYvA-o3R5tlcJIIUF3iWLqIQ',
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

// Chave nova de propósito. A antiga ('mipas-theme') era regravada a cada
// carregamento com o tema que estava sendo aplicado, então ela guardava o
// padrão de então — claro — e não uma escolha de verdade de ninguém. Herdar
// aquele valor deixaria todo mundo preso no claro pra sempre.
const CHAVE_TEMA = 'mipas-tema';

/** `persistir` só quando a pessoa realmente escolheu, nunca no boot. */
export function setTheme(mode: 'dark' | 'light', persistir = true) {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.body.classList.toggle('dark', mode === 'dark');
  atual = lerDoCss();
  if (!persistir) return;
  try {
    localStorage.setItem(CHAVE_TEMA, mode);
  } catch (e) {
    /* modo privado */
  }
}

// Escuro é o padrão do Mipas: quem nunca tocou no botão de tema entra no
// escuro, e quem já escolheu continua com a escolha guardada.
export function initialTheme(): 'dark' | 'light' {
  try {
    localStorage.removeItem('mipas-theme');
    return (localStorage.getItem(CHAVE_TEMA) as 'dark' | 'light') || 'dark';
  } catch (e) {
    return 'dark';
  }
}

export const listColors = ['#C25454', '#7B8FC2', '#D9B95C', '#7FB07F', '#C77FA5', '#8ED0C6'];
