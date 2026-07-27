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

// Paleta escura e minimalista — um único acento de cor (coral), sem gradientes decorativos.
window.Mipas.theme = {
  paper: '#121214',    // fundo do app
  surface: '#1B1B1F',  // cards, sheets, inputs
  cream: '#232327',    // superfície secundária (chips não selecionados)
  ink: '#F2F1EE',      // texto principal
  sub: '#8B8B93',      // texto secundário/apagado
  coral: '#FF5C38',    // único acento de cor
  line: '#2C2C31',     // bordas/divisores
};

window.Mipas.listColors = ['#FF5C38', '#F5A623', '#12A594', '#7C5CFF', '#E93D82', '#2F6BFF'];
