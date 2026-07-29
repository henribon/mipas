// window.Mipas — namespace compartilhado entre os módulos do site (sem build step / bundler).
window.Mipas = window.Mipas || {};

// Credenciais do Supabase: preencha depois de criar o projeto em supabase.com
// (Project Settings → API → Project URL / anon public key).
//
// É seguro deixar isso público/comitado: a anon key não é um segredo de acesso,
// é uma credencial pública por design do Supabase. Quem protege os dados são as
// políticas de Row Level Security (ver docs/supabase-schema.sql) — nunca a
// service_role key, que é secreta e NUNCA deve entrar aqui.
window.Mipas.config = {
  supabaseUrl: 'https://altsfuxppwspqzsrhwmj.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsdHNmdXhwcHdzcHF6c3Jod21qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNzU4ODYsImV4cCI6MjEwMDc1MTg4Nn0.Moh8SZ0Y22XpmCPr5PNYYvA-o3R5tlcJIIUF3iWLqIQ',
};

// Dois temas com o mesmo "esqueleto sketch" (blocos separados por bordas
// tipo traço de giz/lápis): dark é quadro-negro, light é papel claro.
// A chave do acento continua se chamando "coral" pra não ter que tocar em
// todos os componentes — hoje é o vermelho-giz.
// Os componentes leem window.Mipas.theme a cada render; trocar de tema é
// trocar esse objeto (setTheme) + a classe no body (pro CSS puro acompanhar).
window.Mipas.themes = {
  dark: {
    paper: '#0D0D0D',                  // fundo: quadro-negro
    surface: '#111111',                // cards/sheets: quase o mesmo preto — quem separa é a borda
    cream: '#1E1D1A',                  // superfície secundária (chips não selecionados)
    ink: '#F0EEE6',                    // texto principal: branco-giz
    sub: '#9A978D',                    // texto secundário: giz esmaecido
    coral: '#C25454',                  // acento: vermelho-giz (rótulo da fita)
    line: 'rgba(240,238,230,.65)',     // bordas: traço branco de giz
    glass: 'rgba(13,13,13,.92)',       // barras translúcidas (tab bar)
    fade: 'linear-gradient(rgba(13,13,13,.9),rgba(13,13,13,0))', // gradiente do topo sobre o mapa
  },
  light: {
    paper: '#F7F5F0',                  // fundo: papel claro
    surface: '#FFFFFF',                // cards/sheets
    cream: '#EDEAE2',                  // superfície secundária
    ink: '#1E1D1A',                    // texto principal: tinta escura
    sub: '#6B685F',                    // texto secundário
    coral: '#C25454',                  // mesmo acento nos dois temas
    line: 'rgba(30,29,26,.55)',        // bordas: traço de lápis escuro
    glass: 'rgba(247,245,240,.92)',
    fade: 'linear-gradient(rgba(247,245,240,.9),rgba(247,245,240,0))',
  },
};

window.Mipas.setTheme = function (mode) {
  window.Mipas.theme = window.Mipas.themes[mode] || window.Mipas.themes.dark;
  document.body.classList.toggle('light', mode === 'light');
  try { localStorage.setItem('mipas-theme', mode); } catch (e) { /* modo privado etc */ }
};

// Aplica já na carga (antes do React montar) pra não piscar no tema errado.
window.Mipas.setTheme((function () {
  try { return localStorage.getItem('mipas-theme') || 'dark'; } catch (e) { return 'dark'; }
})());

window.Mipas.listColors = ['#C25454', '#7B8FC2', '#D9B95C', '#7FB07F', '#C77FA5', '#8ED0C6'];
