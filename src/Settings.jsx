import { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';
import { bytes } from './format.js';
import { themes } from './themes.js';

export function Settings({ open, onClose, data, eco, setEco, paused, setPaused, visual, themeSettings }) {
  const dialog = useRef(null);
  useEffect(() => { if (open && !dialog.current.open) dialog.current.showModal(); if (!open && dialog.current.open) dialog.current.close(); }, [open]);
  return <dialog className="settings-dialog" ref={dialog} onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="settings-shell">
      <header className="dialog-heading"><div><span className="eyebrow">SYSTEM / PREFERENCES</span><h2>Settings</h2></div><button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={20} /></button></header>
      <section><h3>APPEARANCE / THEME</h3><div className="theme-options" role="radiogroup" aria-label="Theme">{Object.values(themes).map(option => <label className="theme-option" key={option.id} data-selected={themeSettings.theme === option.id}>
        <input type="radio" name="theme" value={option.id} checked={themeSettings.theme === option.id} disabled={themeSettings.saving} onChange={() => themeSettings.selectTheme(option.id)} />
        <span className="theme-swatch" style={{ backgroundColor: `rgb(${option.accent})` }} /><strong>{option.name}</strong><small>{option.description}</small>
      </label>)}</div><p className="theme-hint" role="status">{themeSettings.error || 'Saved automatically. Synced across displays, desktop and screen saver.'}</p></section>
      <section><h3>DISPLAY</h3><label className="setting-row"><div>Eco mode<p>Up to 15 FPS active / 6 FPS idle</p></div><input type="checkbox" checked={eco} onChange={event => setEco(event.target.checked)} /></label><label className="setting-row"><div>Pause animation<p>Freeze motion while collection continues</p></div><input type="checkbox" checked={paused} onChange={event => setPaused(event.target.checked)} /></label></section>
      <section><h3>LOCAL SOURCES</h3>{data?.sources.map(source => <div className="source-setting" key={source.path}><div><strong>{source.label}</strong><span className={source.watching ? 'mint' : 'muted'}>{source.watching ? 'WATCHING' : source.available ? 'POLLING' : 'NOT FOUND'}</span></div><code>{source.path}</code><small>{source.files} session logs{source.error ? ` · ${source.error}` : ''}</small></div>)}</section>
      <section><h3>LIVE RESOURCES</h3><div className="resource-grid"><div><b>{data?.resource.cpu.toFixed(2) || '0'}%</b><span>Collector CPU</span></div><div><b>{bytes(data?.resource.rss)}</b><span>Collector memory</span></div><div><b>{visual.current.fps}</b><span>Render FPS</span></div><div><b>{visual.current.frameMs.toFixed(2)} ms</b><span>Last frame</span></div></div></section>
      <p className="settings-note">Read-only observation of local session logs, including subagents. Only persisted records are available. Rendering pauses when hidden; original files remain in their client directories.</p>
    </div>
  </dialog>;
}
