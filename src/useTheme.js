import { useEffect, useState } from 'react';
import { themeFor } from './themes.js';

export function useTheme(savedTheme) {
  const [theme, setTheme] = useState(() => themeFor(localStorage.getItem('agent-ops-theme')).id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (savedTheme) setTheme(themeFor(savedTheme).id); }, [savedTheme]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('agent-ops-theme', theme);
  }, [theme]);
  const selectTheme = async next => {
    const previous = theme;
    setTheme(next); setSaving(true); setError('');
    try {
      const response = await fetch('/api/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: next }) });
      if (!response.ok) throw new Error('Save failed');
      const value = await response.json(); setTheme(themeFor(value.theme).id);
    } catch { setTheme(previous); setError('Theme could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };
  return { theme, selectTheme, saving, error };
}
