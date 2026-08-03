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
  paper: '#0f1215',
  surface: '#15191e',
  cream: '#2a333c',
  ink: '#f0f2f4',
  sub: '#8899aa',
  coral: '#C25454',
  line: 'rgba(165,179,192,.28)',
  glass: 'rgba(15,18,21,.92)',
  fade: 'linear-gradient(rgba(15,18,21,.9),rgba(15,18,21,0))',
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

export function setTheme(mode: 'dark' | 'light') {
  document.body.classList.toggle('light', mode === 'light');
  atual = lerDoCss();
  try {
    localStorage.setItem('mipas-theme', mode);
  } catch (e) {
    /* modo privado */
  }
}

export function initialTheme(): 'dark' | 'light' {
  try {
    return (localStorage.getItem('mipas-theme') as 'dark' | 'light') || 'dark';
  } catch (e) {
    return 'dark';
  }
}

export const listColors = ['#C25454', '#7B8FC2', '#D9B95C', '#7FB07F', '#C77FA5', '#8ED0C6'];
