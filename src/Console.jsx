import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Check, Copy, MagnifyingGlass, X } from '@phosphor-icons/react';
import { bytes, labels, time } from './format.js';

export function Console({ open, onClose, events, data, initialEvent, initialSession }) {
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
    catch { setError('复制失败，请直接选择文本复制。'); }
  };
  return <dialog ref={dialog} className="console-dialog" onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="console-shell">
      <header className="dialog-heading"><div><span className="eyebrow">LOCAL / READ ONLY</span><h2>EVENT CONSOLE <span>事件控制台</span></h2></div><button className="icon-button" onClick={onClose} aria-label="关闭控制台"><X size={20} /></button></header>
      <div className="console-toolbar">
        <label className="search"><MagnifyingGlass size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索最近事件…" aria-label="搜索事件" /></label>
        <select aria-label="筛选来源" value={provider} onChange={event => setProvider(event.target.value)}><option value="all">ALL SOURCES</option><option value="codex">CODEX</option><option value="claude">CLAUDE</option></select>
        <select aria-label="筛选类型" value={kind} onChange={event => setKind(event.target.value)}><option value="all">ALL EVENTS</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select aria-label="筛选会话" value={sessionId} onChange={event => setSessionId(event.target.value)}><option value="all">ALL SESSIONS</option>{sessionOptions.map(session => <option key={session.id} value={session.id}>{session.provider} / {session.title} / {session.shortId}</option>)}</select>
      </div>
      <div className="console-body">
        <div className="console-events"><div className="list-heading">{filtered.length} RECORDS <span>RECENT BUFFER</span></div>
          {filtered.slice(0, 400).map(event => <button key={event.id} className={`console-event ${event.id === selected?.id ? 'selected' : ''}`} onClick={() => setSelected(event)}>
            <div><b className={event.provider}>{event.provider.toUpperCase()}</b><span>{labels[event.kind]}</span><time>{time(event.timestamp)}</time></div>
            <p>{event.tool ? `${event.tool} · ` : ''}{event.preview.slice(0, 180) || '(empty record)'}</p>
            <small>{event.historical ? 'HISTORY' : 'CAPTURED LIVE'} / {bytes(event.bytes)}</small>
          </button>)}
          {!filtered.length && <p className="empty">没有匹配的记录。新事件会自动显示。</p>}
        </div>
        <div className="console-detail">
          {selected ? <>
            <div className="detail-heading"><div><b>{selected.tool || labels[selected.kind]}</b><span>{session?.title || selected.sessionId}</span></div><div className="detail-actions"><button onClick={() => setRaw(!raw)} disabled={!detail}>{raw ? 'TEXT' : 'RAW JSON'}</button><button onClick={copy} disabled={!detail} aria-label="复制完整内容">{copied ? <Check size={16} /> : <Copy size={16} />}</button><a href={`/api/session/${selected.sessionId}/raw`} title="下载完整原始会话日志" aria-label="下载完整会话日志"><ArrowDown size={16} /></a></div></div>
            {error ? <p className="error">{error}</p> : detail ? <><pre className="full-content">{raw ? detail.raw : detail.text}</pre>{detail.truncated && <p className="warning">记录超过 8 MB。请下载原始会话日志查看完整内容。</p>}</> : <p className="empty">正在读取原始记录…</p>}
          </> : <div className="detail-empty"><span>SELECT A RECORD</span><h3>每一次输入，每一次回应。</h3><p>选择左侧事件查看完整内容与原始 JSON。<br />下载按钮可保存该会话的全部原始日志。</p>{sessionId !== 'all' && <a className="text-button" href={`/api/session/${sessionId}/raw`}>下载此会话完整日志 <ArrowDown /></a>}</div>}
        </div>
      </div>
      <footer className="console-footer">仅在本机读取 · 搜索范围为最近缓存中的文本预览 · 完整历史请下载原始会话日志 <span>ESC TO CLOSE</span></footer>
    </div>
  </dialog>;
}
