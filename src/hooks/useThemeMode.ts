import { useState } from 'react';
import { setTheme } from '@/theme';

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState(
    () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'),
  );

  const toggleTheme = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeMode(next);
  };

  return { themeMode, toggleTheme };
}
