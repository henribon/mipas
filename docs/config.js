window.Mipas = window.Mipas || {};

window.Mipas.config = {
  supabaseUrl: 'https://altsfuxppwspqzsrhwmj.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsdHNmdXhwcHdzcHF6c3Jod21qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNzU4ODYsImV4cCI6MjEwMDc1MTg4Nn0.Moh8SZ0Y22XpmCPr5PNYYvA-o3R5tlcJIIUF3iWLqIQ',
};

window.Mipas.themes = {
  dark: {
    paper: '#0D0D0D',
    surface: '#111111',
    cream: '#1E1D1A',
    ink: '#F0EEE6',
    sub: '#9A978D',
    coral: '#C25454',
    line: 'rgba(240,238,230,.65)',
    glass: 'rgba(13,13,13,.92)',
    fade: 'linear-gradient(rgba(13,13,13,.9),rgba(13,13,13,0))',
  },
  light: {
    paper: '#F7F5F0',
    surface: '#FFFFFF',
    cream: '#EDEAE2',
    ink: '#1E1D1A',
    sub: '#6B685F',
    coral: '#C25454',
    line: 'rgba(30,29,26,.55)',
    glass: 'rgba(247,245,240,.92)',
    fade: 'linear-gradient(rgba(247,245,240,.9),rgba(247,245,240,0))',
  },
};

window.Mipas.setTheme = function (mode) {
  window.Mipas.theme = window.Mipas.themes[mode] || window.Mipas.themes.dark;
  document.body.classList.toggle('light', mode === 'light');
  try { localStorage.setItem('mipas-theme', mode); } catch (e) {  }
};

window.Mipas.setTheme((function () {
  try { return localStorage.getItem('mipas-theme') || 'dark'; } catch (e) { return 'dark'; }
})());

window.Mipas.listColors = ['#C25454', '#7B8FC2', '#D9B95C', '#7FB07F', '#C77FA5', '#8ED0C6'];
