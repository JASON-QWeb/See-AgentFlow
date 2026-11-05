import { useEffect, useState } from 'react';
import { themeFor } from './themes.js';
import { languageFor } from './i18n/catalog.js';

export function usePreferences(saved) {
  const [preferences, setPreferences] = useState(() => ({
    theme: themeFor(localStorage.getItem('agent-ops-theme')).id,
    language: languageFor(localStorage.getItem('agent-ops-language')),
  }));
  const { theme, language } = preferences;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (saved) setPreferences({ theme: themeFor(saved.theme).id, language: languageFor(saved.language) });
  }, [saved?.theme, saved?.language]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('agent-ops-theme', theme);
    localStorage.setItem('agent-ops-language', language);
    document.documentElement.lang = language;
  }, [theme, language]);
  const update = async patch => {
    const previous = preferences;
    setPreferences({ ...previous, ...patch }); setSaving(true); setError('');
    try {
      const response = await fetch('/api/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      if (!response.ok) throw new Error('Save failed');
      const value = await response.json(); setPreferences({ theme: themeFor(value.theme).id, language: languageFor(value.language) });
    } catch { setPreferences(previous); setError('Preferences could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };
  return { theme, language, selectTheme: theme => update({ theme }), selectLanguage: language => update({ language }), saving, error };
}
