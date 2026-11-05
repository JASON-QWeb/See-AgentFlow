import { useEffect, useRef } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';
import { bytes, count, labels, time } from './format.js';
import { hash } from './scene/geometry.js';
import { themeFor } from './themes.js';
import { useTranslation } from './i18n/useTranslation.js';

function EventGraph({ events, theme }) {
  const t = useTranslation();
  const canvas = useRef(null);
  useEffect(() => {
    const node = canvas.current;
    const palette = themeFor(theme);
    const paint = () => {
      const { width, height } = node.getBoundingClientRect();
      const scale = Math.min(2, Math.max(1.25, window.devicePixelRatio || 1));
      node.width = width * scale; node.height = height * scale;
      const ctx = node.getContext('2d'); ctx.scale(scale, scale);
      ctx.clearRect(0, 0, width, height);
      const recent = events.slice(-180);
      recent.forEach((event, index) => {
        const seed = hash(event.id), progress = index / Math.max(1, recent.length - 1);
        const x = 12 + progress * (width - 24);
        const y = height * .5 + Math.sin(progress * Math.PI * 3) * height * .25 + (seed - .5) * height * .48;
        ctx.strokeStyle = `rgba(${palette.accent},${event.historical ? .12 : .35})`;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 4); ctx.stroke();
        ctx.fillStyle = `rgb(${event.provider === 'codex' ? palette.accent : palette.ink})`;
        ctx.globalAlpha = event.historical ? .35 : .8;
        ctx.fillRect(x, y, 1.5, 1.5);
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.id === 'mint' ? '#6b8580' : palette.muted; ctx.font = '8px "IBM Plex Mono", monospace';
      if (!recent.length) ctx.fillText(t("WAITING FOR LOCAL RECORDS"), 14, height / 2);
    };
    // A new observer reports the current size immediately, so this is also the first paint.
    const observer = new ResizeObserver(paint); observer.observe(node);
    return () => observer.disconnect();
  }, [events, theme, t]);
  return <canvas ref={canvas} role="img" aria-label={t("Recent event distribution; dim points indicate history")} />;
}

export function Panels({ events, data, sessions: sourceSessions, selected, onInspect, onConsole, onSession, theme }) {
  const t = useTranslation();
  const recent = events.slice(-9).reverse();
  const current = selected || events.at(-1);
  const sessions = sourceSessions.slice(0, 10);
  const maxBytes = Math.max(1, ...sessions.map(session => session.bytes));
  return <section className="panel-grid" aria-label={t("Monitoring panels")}>
    <div className="panel event-panel">
      <div className="panel-heading"><h2>{t("TASK FEED")} <span>{t("EVENT LOG")}</span></h2><button onClick={onConsole} title={t("Inspect all events")}>{count(data?.resource.bufferedEvents)} {t("BUFFERED")} <ArrowUpRight /></button></div>
      <div className="event-lines">
        {!recent.length && <p className="empty">{t("Waiting for local session records…")}</p>}
        {recent.map(event => <button className="event-line" key={event.id} onClick={() => onInspect(event)}>
          <time>{time(event.timestamp)}</time><b className={event.provider}>{t(labels[event.kind])}</b><span>{event.tool || event.preview.replace(/\s+/g, ' ') || event.kind}</span>
        </button>)}
      </div>
      <div className="panel-note">{recent.every(event => event.historical) ? t("RECENT HISTORY") : t("LIVE RECORDS")} <span>{t("CLICK TO INSPECT")}</span></div>
    </div>
    <div className="panel graph-panel">
      <div className="panel-heading"><h2>{t("OBSERVED /")} <span>{t("PARTICLE EVENT FIELD")}</span></h2><span>{events.length} {t("PTS")}</span></div>
      <EventGraph events={events} theme={theme} />
      <div className="graph-legend"><span><i className="legend-dot codex" /> CODEX</span><span><i className="legend-dot claude" /> CLAUDE</span><span>{t('LAST {count} EVENTS', { count: Math.min(180, events.length) })}</span></div>
    </div>
    <div className="panel code-panel">
      <div className="panel-heading"><h2>{t("WORKSPACE")} <span>{t("RUNTIME CORE")}</span></h2><span>{current?.provider.toUpperCase() || '—'}</span></div>
      <button className="code-preview" onClick={() => current && onInspect(current)} disabled={!current} title={t("Inspect full input and output")}>
        {(current?.preview || t("Awaiting a local session…")).split('\n').slice(0, 9).map((line, index) => <div key={index}><em>{String(index + 1).padStart(3, '0')}</em><span>{line || ' '}</span></div>)}
      </button>
      <div className="panel-note"><span>{current ? `${t(labels[current.kind])}${current.bytes ? ` / ${bytes(current.bytes)}` : ''}` : t("NO RECORD")}</span><span>{t("READ ONLY")} <ArrowUpRight /></span></div>
    </div>
    <div className="panel orchestration-panel">
      <div className="panel-heading"><h2>{t("AGENTS /")} <span>{t("SESSION ACTIVITY")}</span></h2><span>{count(data?.totalSessions)} {t("LOGS")}</span></div>
      <div className="session-bars">
        {sessions.map((session, index) => <button key={session.id} onClick={() => onSession(session)} title={`${session.title} · ${session.provider}`}>
          <em>{String(index + 1).padStart(2, '0')}</em><span>{session.title.slice(0, 16)}<i style={{ width: `${Math.max(2, session.bytes / maxBytes * 100)}%` }} /></span>
        </button>)}
      </div>
      <div className="panel-note">{t("OBSERVED BYTES")} <span>{t("LOCAL SESSION LOGS")}</span></div>
    </div>
  </section>;
}
