import { useEffect, useState } from 'react';
import { ArrowsIn, ArrowsOut, GearSix, Monitor, Pause, Play, Sparkle } from '@phosphor-icons/react';
import { useTelemetry } from './useTelemetry.js';
import { useReplay } from './useReplay.js';
import { useTheme } from './useTheme.js';
import { useDesktopLayout } from './useDesktopLayout.js';
import { Scene } from './Scene.jsx';
import { Panels } from './Panels.jsx';
import { Console } from './Console.jsx';
import { Settings } from './Settings.jsx';
import { age, bytes, count, time } from './format.js';

export function App({ screensaver = false, displayLayout = null, desktop = false }) {
  const { compact, chromeSpace } = useDesktopLayout(desktop);
  const { data, connected, events, visual } = useTelemetry();
  const themeSettings = useTheme(data?.preferences?.theme);
  const { theme } = themeSettings;
  const [provider, setProvider] = useState('all');
  const [paused, setPaused] = useState(false);
  const [eco, setEco] = useState(() => !screensaver && localStorage.getItem('agent-ops-eco') === 'true');
  const [immersive, setImmersive] = useState(() => screensaver || (localStorage.getItem('agent-ops-immersive') ?? String(desktop)) === 'true');
  const [quality, setQuality] = useState(() => !screensaver && localStorage.getItem('agent-ops-quality') === 'standard' ? 'standard' : 'high');
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [session, setSession] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  useReplay(visual, immersive, provider);
  useEffect(() => {
    Object.assign(visual.current, { paused, eco, provider, immersive, quality, displayLayout, theme });
    if (screensaver) return;
    localStorage.setItem('agent-ops-eco', String(eco));
    localStorage.setItem('agent-ops-immersive', String(immersive));
    localStorage.setItem('agent-ops-quality', quality);
  }, [paused, eco, provider, immersive, quality, visual, screensaver, displayLayout, theme]);
  useEffect(() => {
    const change = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  const inspect = event => { setSelected(event); setSession(null); setConsoleOpen(true); };
  const inspectSession = session => { setSession(session); setSelected(null); setConsoleOpen(true); };
  const openConsole = () => { setSelected(null); setSession(null); setConsoleOpen(true); };
  const visibleEvents = provider === 'all' ? events : events.filter(event => event.provider === provider);
  const sessions = (data?.sessions || []).filter(session => provider === 'all' || session.provider === provider).slice(0, 14);
  const rate = provider === 'all' ? data?.rate || 0 : data?.providerRates[provider] || 0;
  const active = rate > 0;
  const mode = paused ? 'VISUAL PAUSED' : immersive ? 'IMMERSIVE / DISPLAY' : !connected ? 'CONNECTING' : active ? 'TRAFFIC ACTIVE' : 'IDLE / COASTING';
  const toggleImmersive = () => { if (!immersive) setPaused(false); setImmersive(!immersive); };
  const toggleQuality = () => { if (quality !== 'high') setEco(false); setQuality(quality === 'high' ? 'standard' : 'high'); };
  const toggleFullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* Embedded browsers may disable fullscreen. */ } };
  return <main className="dashboard" data-desktop={desktop || undefined} data-compact={compact || undefined} data-panorama={displayLayout?.count > 1 || undefined} style={displayLayout?.count > 1 ? {
    width: displayLayout.worldWidth, height: displayLayout.worldHeight,
    gridTemplateRows: displayLayout.worldWidth >= 1700 ? 'minmax(0, 1fr) 205px 30px' :
      displayLayout.worldWidth > 1100 ? 'minmax(0, 1fr) 180px 28px' : 'minmax(0, 1fr) 170px 28px',
  } : desktop ? { '--window-controls-space': `${chromeSpace}px` } : undefined}>
    <section className="observatory" aria-label="Live agent dashboard">
      <Scene telemetry={visual} layout={displayLayout} />
      <header className="masthead"><h1>AGENT OPS <span>/</span> DISPATCH CENTER</h1><p>LOCAL TELEMETRY <i /> CODEX + CLAUDE <i /> READ ONLY</p></header>
      <nav className="top-controls" aria-label="Dashboard controls"><span className={`connection ${connected ? 'connected' : ''}`}><i />{connected ? 'LOCAL LINK' : 'RECONNECTING'}</span><button className="console-button display-toggle" onClick={toggleImmersive} aria-label="IMMERSIVE" aria-pressed={immersive} title="Continuous display effects; live counters remain unchanged"><Sparkle size={14} /> IMMERSIVE</button><button className="console-button display-toggle" onClick={toggleQuality} aria-label="4K high quality" aria-pressed={quality === 'high'} title="Native 4K pixels, up to 60 FPS; ECO limits frame rate"><Monitor size={14} />{quality === 'high' ? '4K / HQ' : 'STANDARD'}</button><button className={`icon-button ${paused ? 'active' : ''}`} onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume animation' : 'Pause animation'} title={paused ? 'Resume animation' : 'Pause animation'}>{paused ? <Play size={15} /> : <Pause size={15} />}</button><button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings"><GearSix size={16} /></button><button className="icon-button fullscreen-button" onClick={toggleFullscreen} aria-label="Toggle fullscreen" title="Fullscreen">{fullscreen ? <ArrowsIn size={16} /> : <ArrowsOut size={16} />}</button></nav>
      <aside className="left-rail">
        <div className="metrics"><Metric label="SESSION LOGS" value={count(data?.totalSessions)} sub="DISCOVERED" /><Metric label="ACTIVE / 60S" value={String(data?.activeSessions || 0).padStart(2, '0')} sub="RECENT SESSIONS" /><Metric label="EVENTS / SEC" value={rate.toFixed(1)} sub="5S WINDOW" accent /><Metric label="INPUT CAPTURED" value={count(data?.counters.input)} sub="SINCE START" /><Metric label="OUTPUT CAPTURED" value={count(data?.counters.output)} sub="SINCE START" /><Metric label="TOOL EVENTS" value={count(data?.counters.tools)} sub="CALL + RETURN" /></div>
        <div className="source-tabs" role="group" aria-label="Filter sources">{['all', 'codex', 'claude'].map(source => <button key={source} className={provider === source ? 'selected' : ''} onClick={() => setProvider(source)}>{source.toUpperCase()}</button>)}<span>RECENT SESSIONS</span></div>
        <div className="agent-list">{sessions.map((session, index) => <button className={`agent-row ${Date.now() - session.lastSeen < 60000 ? 'working' : ''}`} key={session.id} onClick={() => inspectSession(session)} title={`${session.provider} / ${session.title} / ${session.model || 'model not recorded'}`}><span className="agent-index">{String(index + 1).padStart(2, '0')}</span><div><strong>{session.shortId}<span>{session.provider === 'codex' ? 'CDX' : 'CLD'}</span></strong><small>{session.title}</small></div><span className="agent-age">{age(session.lastSeen)}</span></button>)}{!sessions.length && <p className="empty">{connected ? 'No session logs for this source' : 'Connecting to local observer…'}</p>}</div>
        <div className="rail-bottom"><span>PASSIVE OBSERVER</span><b>01 / LOCALHOST</b></div>
      </aside>
      <div className="core-caption"><span>{immersive ? 'HISTORY / REPLAY' : 'LIVE SESSION FABRIC'}</span><b>{immersive ? 'LOCAL HISTORY LOOP' : 'INPUT → INFERENCE → OUTPUT'}</b></div>
      <div className="throughput"><div className="throughput-label">STREAM VELOCITY / I/O</div><strong>{bytes(data?.bytesPerSecond)}<span>/s</span></strong><div className="throughput-track"><i style={{ width: `${Math.min(100, Math.log2(1 + (data?.bytesPerSecond || 0)) * 6)}%` }} /></div><span>OBSERVED LOG THROUGHPUT</span></div>
      <div className={`core-status ${active || immersive ? 'is-active' : ''}`}><span className="eyebrow">{immersive ? 'DISPLAY / IMMERSIVE MODE' : 'OBSERVER / SYSTEM STATE'}</span><strong><i />{mode}</strong><p>{immersive ? 'HISTORY REPLAY · LIVE COUNTERS UNCHANGED' : !connected ? 'WAITING FOR LOCAL OBSERVER' : active ? 'LOCAL EVENTS STREAMING · OBSERVER ACTIVE' : 'AWAITING EVENTS · CORE COASTING'}</p></div>
      <div className="scene-coordinate">LOCAL OBSERVATORY <span>V.01</span></div>
    </section>
    {!compact && <Panels events={visibleEvents} data={data} selected={selected} onInspect={inspect} onConsole={openConsole} onSession={inspectSession} theme={theme} />}
    <footer className="statusbar"><div><span className="status-light" />{connected ? 'OBSERVER ONLINE' : 'CONNECTING TO OBSERVER'}<span className="separator">/</span><span>CODEX {data?.sources.filter(source => source.provider === 'codex').reduce((n, source) => n + source.files, 0) || 0}</span><span>CLAUDE {data?.sources.find(source => source.provider === 'claude')?.files || 0}</span></div><div className="performance-readout"><span>COLLECTOR CPU {data?.resource.cpu.toFixed(2) || '0.00'}%</span><span>MEM {bytes(data?.resource.rss)}</span><span>{visual.current.fps} FPS</span><button onClick={() => setEco(!eco)} className={eco ? 'mint' : ''}>{eco ? 'ECO ON' : 'ADAPTIVE'}</button><span>{time(data?.now)} LOCAL</span></div></footer>
    {consoleOpen && <Console open onClose={() => setConsoleOpen(false)} events={events} data={data} initialEvent={selected} initialSession={session} />}
    {settingsOpen && <Settings open onClose={() => setSettingsOpen(false)} data={data} eco={eco} setEco={setEco} paused={paused} setPaused={setPaused} visual={visual} themeSettings={themeSettings} />}
  </main>;
}

function Metric({ label, value, sub, accent }) {
  return <div className={`metric ${accent ? 'accent' : ''}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}
