import { useEffect, useState } from 'react';
import { ArrowsIn, ArrowsOut, GearSix, Monitor, Pause, Play, Sparkle } from '@phosphor-icons/react';
import { useTelemetry } from './useTelemetry.js';
import { useReplay } from './useReplay.js';
import { usePreferences } from './usePreferences.js';
import { LanguageContext, useTranslation } from './i18n/useTranslation.js';
import { useDesktopLayout } from './useDesktopLayout.js';
import { useNativeLock } from './useNativeLock.js';
import { Scene } from './Scene.jsx';
import { Panels } from './Panels.jsx';
import { Console } from './Console.jsx';
import { Settings } from './Settings.jsx';
import { age, bytes, count, time } from './format.js';

export function App({ screensaver = false, displayLayout = null, desktop = false }) {
  const { compact, chromeSpace } = useDesktopLayout(desktop);
  const { data, connected, events, visual } = useTelemetry();
  const nativeLock = useNativeLock();
  const themeSettings = usePreferences(data?.preferences);
  const { theme, language } = themeSettings;
  const t = useTranslation(language);
  const [provider, setProvider] = useState('all');
  const [paused, setPaused] = useState(false);
  const [eco, setEco] = useState(() => !screensaver && localStorage.getItem('agent-ops-eco') === 'true');
  const [immersive, setImmersive] = useState(() => screensaver || (localStorage.getItem('agent-ops-immersive') ?? String(desktop)) === 'true');
  const [quality, setQuality] = useState(() => !screensaver && localStorage.getItem('agent-ops-quality') === 'standard' ? 'standard' : 'high');
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() => !!window.__AGENT_OPEN_LOCK_SETTINGS__);
  const [selected, setSelected] = useState(null);
  const [session, setSession] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  useReplay(visual, immersive, provider);
  useEffect(() => {
    Object.assign(visual.current, { paused, eco, provider, immersive, quality, displayLayout, theme, language });
    if (screensaver) return;
    localStorage.setItem('agent-ops-eco', String(eco));
    localStorage.setItem('agent-ops-immersive', String(immersive));
    localStorage.setItem('agent-ops-quality', quality);
  }, [paused, eco, provider, immersive, quality, visual, screensaver, displayLayout, theme, language]);
  useEffect(() => {
    const change = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  useEffect(() => {
    const open = () => { window.__AGENT_OPEN_LOCK_SETTINGS__ = false; setSettingsOpen(true); };
    if (window.__AGENT_OPEN_LOCK_SETTINGS__) open();
    window.addEventListener('agent-open-lock-settings', open);
    return () => window.removeEventListener('agent-open-lock-settings', open);
  }, []);
  const inspect = event => { if (screensaver) return; setSelected(event); setSession(null); setConsoleOpen(true); };
  const inspectSession = session => { if (screensaver) return; setSession(session); setSelected(null); setConsoleOpen(true); };
  const openConsole = () => { if (screensaver) return; setSelected(null); setSession(null); setConsoleOpen(true); };
  const visibleEvents = provider === 'all' ? events : events.filter(event => event.provider === provider);
  const sessions = (data?.sessions || []).filter(session => provider === 'all' || session.provider === provider).slice(0, 14);
  const rate = provider === 'all' ? data?.rate || 0 : data?.providerRates[provider] || 0;
  const active = rate > 0;
  const mode = paused ? t("VISUAL PAUSED") : immersive ? t("IMMERSIVE / DISPLAY") : !connected ? t("CONNECTING") : active ? t("TRAFFIC ACTIVE") : t("IDLE / COASTING");
  const toggleImmersive = () => { if (!immersive) setPaused(false); setImmersive(!immersive); };
  const toggleQuality = () => { if (quality !== 'high') setEco(false); setQuality(quality === 'high' ? 'standard' : 'high'); };
  const toggleFullscreen = async () => {
    if (nativeLock.available) {
      const result = await nativeLock.fullscreen();
      if (result?.needsPassword) setSettingsOpen(true);
      return;
    }
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { /* Embedded browsers may disable fullscreen. */ }
  };
  return <LanguageContext.Provider value={language}><main className="dashboard" data-screensaver={screensaver || undefined} data-desktop={desktop || undefined} data-compact={compact || undefined} data-panorama={displayLayout?.count > 1 || undefined} style={displayLayout?.count > 1 ? {
    width: displayLayout.worldWidth, height: displayLayout.worldHeight,
    gridTemplateRows: displayLayout.worldWidth >= 1700 ? 'minmax(0, 1fr) 205px 30px' :
      displayLayout.worldWidth > 1100 ? 'minmax(0, 1fr) 180px 28px' : 'minmax(0, 1fr) 170px 28px',
  } : desktop ? { '--window-controls-space': `${chromeSpace}px` } : undefined}>
    <section className="observatory" aria-label={t("Live agent dashboard")}>
      <Scene telemetry={visual} layout={displayLayout} />
      <header className="masthead"><h1>AGENT OPS <span>/</span> {t("DISPATCH CENTER")}</h1><p>{t("LOCAL TELEMETRY")} <i /> CODEX + CLAUDE <i /> {t("READ ONLY")}</p></header>
      {!screensaver && <nav className="top-controls" aria-label={t("Dashboard controls")}><span className={`connection ${connected ? 'connected' : ''}`}><i />{connected ? t("LOCAL LINK") : t("RECONNECTING")}</span><button className="console-button display-toggle" onClick={toggleImmersive} aria-label={t("IMMERSIVE")} aria-pressed={immersive} title={t("Continuous display effects; live counters remain unchanged")}><Sparkle size={14} /> {t("IMMERSIVE")}</button><button className="console-button display-toggle" onClick={toggleQuality} aria-label={t("4K high quality")} aria-pressed={quality === 'high'} title={t("Native 4K pixels, up to 60 FPS; ECO limits frame rate")}><Monitor size={14} />{quality === 'high' ? '4K' : t("STANDARD")}</button><button className={`icon-button ${paused ? 'active' : ''}`} onClick={() => setPaused(!paused)} aria-label={paused ? t("Resume animation") : t("Pause animation")} title={paused ? t("Resume animation") : t("Pause animation")}>{paused ? <Play size={15} /> : <Pause size={15} />}</button><button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label={t("Settings")} title={t("Settings")}><GearSix size={16} /></button><button className="icon-button fullscreen-button" onClick={toggleFullscreen} aria-label={t("Toggle fullscreen")} title={t("Fullscreen")}>{fullscreen ? <ArrowsIn size={16} /> : <ArrowsOut size={16} />}</button></nav>}
      <aside className="left-rail">
        <div className="metrics"><Metric label={t("SESSION LOGS")} value={count(data?.totalSessions)} sub={t("DISCOVERED")} /><Metric label={t("ACTIVE / 60S")} value={String(data?.activeSessions || 0).padStart(2, '0')} sub={t("RECENT SESSIONS")} /><Metric label={t("EVENTS / SEC")} value={rate.toFixed(1)} sub={t("5S WINDOW")} accent /><Metric label={t("INPUT CAPTURED")} value={count(data?.counters.input)} sub={t("SINCE START")} /><Metric label={t("OUTPUT CAPTURED")} value={count(data?.counters.output)} sub={t("SINCE START")} /><Metric label={t("TOOL EVENTS")} value={count(data?.counters.tools)} sub={t("CALL + RETURN")} /></div>
        <div className="source-tabs" role="group" aria-label={t("Filter sources")}>{['all', 'codex', 'claude'].map(source => <button key={source} className={provider === source ? 'selected' : ''} onClick={() => setProvider(source)}>{t(source.toUpperCase())}</button>)}<span>{t("RECENT SESSIONS")}</span></div>
        <div className="agent-list">{sessions.map((session, index) => <button className={`agent-row ${Date.now() - session.lastSeen < 60000 ? 'working' : ''}`} key={session.id} onClick={() => inspectSession(session)} title={`${session.provider} / ${session.title} / ${session.model || t("model not recorded")}`}><span className="agent-index">{String(index + 1).padStart(2, '0')}</span><div><strong>{session.shortId}<span>{session.provider === 'codex' ? 'CDX' : 'CLD'}</span></strong><small>{session.title}</small></div><span className="agent-age">{age(session.lastSeen, t)}</span></button>)}{!sessions.length && <p className="empty">{connected ? t("No session logs for this source") : t("Connecting to local observer…")}</p>}</div>
        <div className="rail-bottom"><span>{t("PASSIVE OBSERVER")}</span><b>01 / LOCALHOST</b></div>
      </aside>
      <div className="core-caption"><span>{immersive ? t("HISTORY / REPLAY") : t("LIVE SESSION FABRIC")}</span><b>{immersive ? t("LOCAL HISTORY LOOP") : t("INPUT → INFERENCE → OUTPUT")}</b></div>
      <div className="throughput"><div className="throughput-label">{t("STREAM VELOCITY / I/O")}</div><strong>{bytes(data?.bytesPerSecond)}<span>/s</span></strong><div className="throughput-track"><i style={{ width: `${Math.min(100, Math.log2(1 + (data?.bytesPerSecond || 0)) * 6)}%` }} /></div><span>{t("OBSERVED LOG THROUGHPUT")}</span></div>
      <div className={`core-status ${active || immersive ? 'is-active' : ''}`}><span className="eyebrow">{immersive ? t("DISPLAY / IMMERSIVE MODE") : t("OBSERVER / SYSTEM STATE")}</span><strong><i />{mode}</strong><p>{immersive ? t("HISTORY REPLAY · LIVE COUNTERS UNCHANGED") : !connected ? t("WAITING FOR LOCAL OBSERVER") : active ? t("LOCAL EVENTS STREAMING · OBSERVER ACTIVE") : t("AWAITING EVENTS · CORE COASTING")}</p></div>
      <div className="scene-coordinate">{t("LOCAL OBSERVATORY")} <span>V.01</span></div>
    </section>
    {!compact && <Panels events={visibleEvents} data={data} selected={selected} onInspect={inspect} onConsole={openConsole} onSession={inspectSession} theme={theme} />}
    <footer className="statusbar"><div><span className="status-light" />{connected ? t("OBSERVER ONLINE") : t("CONNECTING TO OBSERVER")}<span className="separator">/</span><span>CODEX {data?.sources.filter(source => source.provider === 'codex').reduce((n, source) => n + source.files, 0) || 0}</span><span>CLAUDE {data?.sources.find(source => source.provider === 'claude')?.files || 0}</span></div><div className="performance-readout"><span>{t("COLLECTOR CPU")} {data?.resource.cpu.toFixed(2) || '0.00'}%</span><span>{t("MEM")} {bytes(data?.resource.rss)}</span><span>{visual.current.fps} FPS</span>{screensaver ? <span>4K</span> : <button onClick={() => setEco(!eco)} className={eco ? 'mint' : ''}>{eco ? t("ECO ON") : t("ADAPTIVE")}</button>}<span>{time(data?.now)} {t("LOCAL")}</span></div></footer>
    {!screensaver && consoleOpen && <Console open onClose={() => setConsoleOpen(false)} events={events} data={data} initialEvent={selected} initialSession={session} />}
    {!screensaver && settingsOpen && <Settings open onClose={() => setSettingsOpen(false)} data={data} eco={eco} setEco={setEco} paused={paused} setPaused={setPaused} visual={visual} themeSettings={themeSettings} nativeLock={nativeLock} />}
  </main></LanguageContext.Provider>;
}

function Metric({ label, value, sub, accent }) {
  return <div className={`metric ${accent ? 'accent' : ''}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}
