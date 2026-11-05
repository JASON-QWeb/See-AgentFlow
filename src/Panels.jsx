import { useEffect, useRef } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';
import { bytes, count, labels, time } from './format.js';
import { hash } from './scene/geometry.js';

function EventGraph({ events }) {
  const canvas = useRef(null);
  useEffect(() => {
    const node = canvas.current;
    const paint = () => {
      const { width, height } = node.getBoundingClientRect();
      node.width = width * 1.25; node.height = height * 1.25;
      const ctx = node.getContext('2d'); ctx.scale(1.25, 1.25);
      ctx.clearRect(0, 0, width, height);
      const recent = events.slice(-180);
      recent.forEach((event, index) => {
        const seed = hash(event.id), progress = index / Math.max(1, recent.length - 1);
        const x = 12 + progress * (width - 24);
        const y = height * .5 + Math.sin(progress * Math.PI * 3) * height * .25 + (seed - .5) * height * .48;
        ctx.strokeStyle = `rgba(139,244,216,${event.historical ? .12 : .35})`;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 4); ctx.stroke();
        ctx.fillStyle = event.provider === 'codex' ? '#8bf4d8' : '#d8eae6';
        ctx.globalAlpha = event.historical ? .35 : .8;
        ctx.fillRect(x, y, 1.5, 1.5);
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#6b8580'; ctx.font = '8px "IBM Plex Mono", monospace';
      if (!recent.length) ctx.fillText('WAITING FOR LOCAL RECORDS', 14, height / 2);
    };
    paint(); const observer = new ResizeObserver(paint); observer.observe(node);
    return () => observer.disconnect();
  }, [events]);
  return <canvas ref={canvas} role="img" aria-label="最近真实事件的分布图，暗点为历史记录" />;
}

export function Panels({ events, data, selected, onInspect, onConsole, onSession }) {
  const recent = events.slice(-9).reverse();
  const current = selected || events.at(-1);
  const sessions = data?.sessions.slice(0, 10) || [];
  const maxBytes = Math.max(1, ...sessions.map(session => session.bytes));
  return <section className="panel-grid" aria-label="监控面板">
    <div className="panel event-panel">
      <div className="panel-heading"><h2>TASK FEED <span>EVENT LOG</span></h2><button onClick={onConsole} title="打开全部事件">{count(data?.resource.bufferedEvents)} BUFFERED <ArrowUpRight /></button></div>
      <div className="event-lines">
        {!recent.length && <p className="empty">等待本地会话记录…</p>}
        {recent.map(event => <button className="event-line" key={event.id} onClick={() => onInspect(event)}>
          <time>{time(event.timestamp)}</time><b className={event.provider}>{labels[event.kind]}</b><span>{event.tool || event.preview.replace(/\s+/g, ' ') || event.kind}</span>
        </button>)}
      </div>
      <div className="panel-note">{recent.every(event => event.historical) ? 'RECENT HISTORY' : 'LIVE RECORDS'} <span>CLICK TO INSPECT</span></div>
    </div>
    <div className="panel graph-panel">
      <div className="panel-heading"><h2>OBSERVED / <span>PARTICLE EVENT FIELD</span></h2><span>{events.length} PTS</span></div>
      <EventGraph events={events} />
      <div className="graph-legend"><span><i className="legend-dot codex" /> CODEX</span><span><i className="legend-dot claude" /> CLAUDE</span><span>LAST {Math.min(180, events.length)} EVENTS</span></div>
    </div>
    <div className="panel code-panel">
      <div className="panel-heading"><h2>WORKSPACE <span>RUNTIME CORE</span></h2><span>{current?.provider.toUpperCase() || '—'}</span></div>
      <button className="code-preview" onClick={() => current && onInspect(current)} disabled={!current} title="查看完整输入输出">
        {(current?.preview || 'Awaiting a local session…').split('\n').slice(0, 9).map((line, index) => <div key={index}><em>{String(index + 1).padStart(3, '0')}</em><span>{line || ' '}</span></div>)}
      </button>
      <div className="panel-note"><span>{current ? `${labels[current.kind]} / ${bytes(current.bytes)}` : 'NO RECORD'}</span><span>READ ONLY <ArrowUpRight /></span></div>
    </div>
    <div className="panel orchestration-panel">
      <div className="panel-heading"><h2>AGENTS / <span>SESSION ACTIVITY</span></h2><span>{count(data?.totalSessions)} LOGS</span></div>
      <div className="session-bars">
        {sessions.map((session, index) => <button key={session.id} onClick={() => onSession(session)} title={`${session.title} · ${session.provider}`}>
          <em>{String(index + 1).padStart(2, '0')}</em><span>{session.title.slice(0, 16)}<i style={{ width: `${Math.max(2, session.bytes / maxBytes * 100)}%` }} /></span>
        </button>)}
      </div>
      <div className="panel-note">OBSERVED BYTES <span>LOCAL SESSION LOGS</span></div>
    </div>
  </section>;
}
