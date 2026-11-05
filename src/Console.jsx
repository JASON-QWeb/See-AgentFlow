import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Check, Copy, MagnifyingGlass, X } from '@phosphor-icons/react';
import { bytes, labels, time } from './format.js';
import { useTranslation } from './i18n/useTranslation.js';

export function Console({ open, onClose, events, data, initialEvent, initialSession }) {
  const t = useTranslation();
  const dialog = useRef(null);
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('all');
  const [kind, setKind] = useState('all');
  const [sessionId, setSessionId] = useState('all');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [raw, setRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [older, setOlder] = useState([]);
  const [sessionOptions, setSessionOptions] = useState([]);
  useEffect(() => {
    if (open && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current.open) dialog.current.close();
    if (open) {
      setSelected(initialEvent || null); setSessionId(initialSession?.id || 'all');
      const controller = new AbortController();
      fetch('/api/events', { signal: controller.signal }).then(res => res.json()).then(body => setOlder(body.events || [])).catch(() => {});
      fetch('/api/sessions', { signal: controller.signal }).then(res => res.json()).then(body => setSessionOptions(body.sessions || [])).catch(() => {});
      return () => controller.abort();
    }
  }, [open, initialEvent, initialSession]);
  useEffect(() => {
    if (!selected || !open) { setDetail(null); return; }
    const controller = new AbortController();
    setDetail(null); setError(null); setRaw(false);
    fetch(`/api/event/${encodeURIComponent(selected.id)}`, { signal: controller.signal })
      .then(async res => { const body = await res.json(); if (!res.ok) throw new Error(body.error); return body; })
      .then(setDetail).catch(error => { if (error.name !== 'AbortError') setError(error.message); });
    return () => controller.abort();
  }, [selected, open]);
  const all = [...new Map([...older, ...events].map(event => [event.id, event])).values()];
  const filtered = all.filter(event => (provider === 'all' || event.provider === provider)
    && (kind === 'all' || event.kind === kind) && (sessionId === 'all' || event.sessionId === sessionId)
    && `${event.preview} ${event.tool || ''}`.toLowerCase().includes(query.toLowerCase())).reverse();
  const session = sessionOptions.find(session => session.id === (selected?.sessionId || sessionId));
  const copy = async () => {
    try { await navigator.clipboard.writeText(raw ? detail.raw : detail.text); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setError(t("Copy failed. Select the text and copy it directly.")); }
  };
  return <dialog ref={dialog} className="console-dialog" onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="console-shell">
      <header className="dialog-heading"><div><span className="eyebrow">{t("LOCAL / READ ONLY")}</span><h2>{t("EVENT CONSOLE")} </h2></div><button className="icon-button" onClick={onClose} aria-label={t("Close event console")}><X size={20} /></button></header>
      <div className="console-toolbar">
        <label className="search"><MagnifyingGlass size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Search recent events…")} aria-label={t("Search events")} /></label>
        <select aria-label={t("Filter source")} value={provider} onChange={event => setProvider(event.target.value)}><option value="all">{t("ALL SOURCES")}</option><option value="codex">CODEX</option><option value="claude">CLAUDE</option></select>
        <select aria-label={t("Filter event type")} value={kind} onChange={event => setKind(event.target.value)}><option value="all">{t("ALL EVENTS")}</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}</select>
        <select aria-label={t("Filter session")} value={sessionId} onChange={event => setSessionId(event.target.value)}><option value="all">{t("ALL SESSIONS")}</option>{sessionOptions.map(session => <option key={session.id} value={session.id}>{session.provider} / {session.title} / {session.shortId}</option>)}</select>
      </div>
      <div className="console-body">
        <div className="console-events"><div className="list-heading">{filtered.length} {t("RECORDS")} <span>{t("RECENT BUFFER")}</span></div>
          {filtered.slice(0, 400).map(event => <button key={event.id} className={`console-event ${event.id === selected?.id ? 'selected' : ''}`} onClick={() => setSelected(event)}>
            <div><b className={event.provider}>{event.provider.toUpperCase()}</b><span>{t(labels[event.kind])}</span><time>{time(event.timestamp)}</time></div>
            <p>{event.tool ? `${event.tool} · ` : ''}{event.preview.slice(0, 180) || t("(empty record)")}</p>
            <small>{event.historical ? t("HISTORY") : t("CAPTURED LIVE")}{event.bytes ? ` / ${bytes(event.bytes)}` : ''}</small>
          </button>)}
          {!filtered.length && <p className="empty">{t("No matching records. New events appear automatically.")}</p>}
        </div>
        <div className="console-detail">
          {selected ? <>
            <div className="detail-heading"><div><b>{selected.tool || t(labels[selected.kind])}</b><span>{session?.title || selected.sessionId}</span></div><div className="detail-actions"><button onClick={() => setRaw(!raw)} disabled={!detail}>{raw ? t("TEXT") : t("RAW JSON")}</button><button onClick={copy} disabled={!detail} aria-label={t("Copy full content")}>{copied ? <Check size={16} /> : <Copy size={16} />}</button><a href={`/api/session/${selected.sessionId}/raw`} title={t("Download complete original session log")} aria-label={t("Download complete session log")}><ArrowDown size={16} /></a></div></div>
            {error ? <p className="error">{error}</p> : detail ? <><pre className="full-content">{raw ? detail.raw : detail.text}</pre>{detail.truncated && <p className="warning">{t("Record exceeds 8 MB. Download the original session log for the full content.")}</p>}</> : <p className="empty">{t("Reading the original record…")}</p>}
          </> : <div className="detail-empty"><span>{t("SELECT A RECORD")}</span><h3>{t("Every input. Every response.")}</h3><p>{t("Select an event to inspect its full content and raw JSON.")}<br />{t("Download the complete original log for this session.")}</p>{sessionId !== 'all' && <a className="text-button" href={`/api/session/${sessionId}/raw`}>{t("Download session log")} <ArrowDown /></a>}</div>}
        </div>
      </div>
      <footer className="console-footer">{t("LOCAL ONLY · SEARCH CACHED PREVIEWS · DOWNLOAD ORIGINAL LOGS FOR FULL HISTORY")} <span>{t("ESC TO CLOSE")}</span></footer>
    </div>
  </dialog>;
}
