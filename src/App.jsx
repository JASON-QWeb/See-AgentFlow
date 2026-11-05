import { useEffect, useState } from 'react';
import { ArrowsIn, ArrowsOut, GearSix, Monitor, Pause, Play, Sparkle, TerminalWindow } from '@phosphor-icons/react';
import { useTelemetry } from './useTelemetry.js';
import { useReplay } from './useReplay.js';
import { Scene } from './Scene.jsx';
import { Panels } from './Panels.jsx';
import { Console } from './Console.jsx';
import { Settings } from './Settings.jsx';
import { age, bytes, count, time } from './format.js';

export function App() {
  const { data, connected, events, visual } = useTelemetry();
  const [provider, setProvider] = useState('all');
  const [paused, setPaused] = useState(false);
  const [eco, setEco] = useState(() => localStorage.getItem('agent-ops-eco') === 'true');
  const [immersive, setImmersive] = useState(() => localStorage.getItem('agent-ops-immersive') === 'true');
  const [quality, setQuality] = useState(() => localStorage.getItem('agent-ops-quality') === 'standard' ? 'standard' : 'high');
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [session, setSession] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  useReplay(visual, immersive, provider);
  useEffect(() => {
    Object.assign(visual.current, { paused, eco, provider, immersive, quality });
    localStorage.setItem('agent-ops-eco', String(eco));
    localStorage.setItem('agent-ops-immersive', String(immersive));
    localStorage.setItem('agent-ops-quality', quality);
  }, [paused, eco, provider, immersive, quality, visual]);
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
  return <main className="dashboard">
    <section className="observatory" aria-label="Agent 实时运行看板">
      <Scene telemetry={visual} />
      <header className="masthead"><h1>AGENT OPS <span>/</span> DISPATCH CENTER</h1><p>LOCAL TELEMETRY <i /> CODEX + CLAUDE <i /> READ ONLY</p></header>
      <nav className="top-controls" aria-label="看板控制"><span className={`connection ${connected ? 'connected' : ''}`}><i />{connected ? 'LOCAL LINK' : 'RECONNECTING'}</span><button className="console-button display-toggle" onClick={toggleImmersive} aria-label="沉浸模式" aria-pressed={immersive} title="持续播放展示特效，真实采集数据保持不变"><Sparkle size={14} /> 沉浸模式</button><button className="console-button display-toggle" onClick={toggleQuality} aria-label="4K 高画质" aria-pressed={quality === 'high'} title="4K 原生像素，最高 60 FPS；节能模式仍限制帧率"><Monitor size={14} />{quality === 'high' ? '4K / HQ' : 'STANDARD'}</button><button className="console-button" onClick={openConsole}><TerminalWindow size={13} /> CONSOLE</button><button className={`icon-button ${paused ? 'active' : ''}`} onClick={() => setPaused(!paused)} aria-label={paused ? '继续动画' : '暂停动画'} title={paused ? '继续动画' : '暂停动画'}>{paused ? <Play size={15} /> : <Pause size={15} />}</button><button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="观测设置" title="观测设置"><GearSix size={16} /></button><button className="icon-button fullscreen-button" onClick={toggleFullscreen} aria-label="切换全屏" title="全屏">{fullscreen ? <ArrowsIn size={16} /> : <ArrowsOut size={16} />}</button></nav>
      <aside className="left-rail">
        <div className="metrics"><Metric label="SESSION LOGS" value={count(data?.totalSessions)} sub="DISCOVERED" /><Metric label="ACTIVE / 60S" value={String(data?.activeSessions || 0).padStart(2, '0')} sub="RECENT SESSIONS" /><Metric label="EVENTS / SEC" value={rate.toFixed(1)} sub="5S WINDOW" accent /><Metric label="INPUT CAPTURED" value={count(data?.counters.input)} sub="SINCE START" /><Metric label="OUTPUT CAPTURED" value={count(data?.counters.output)} sub="SINCE START" /><Metric label="TOOL EVENTS" value={count(data?.counters.tools)} sub="CALL + RETURN" /></div>
        <div className="source-tabs" role="group" aria-label="数据源筛选">{['all', 'codex', 'claude'].map(source => <button key={source} className={provider === source ? 'selected' : ''} onClick={() => setProvider(source)}>{source.toUpperCase()}</button>)}<span>RECENT SESSIONS</span></div>
        <div className="agent-list">{sessions.map((session, index) => <button className={`agent-row ${Date.now() - session.lastSeen < 60000 ? 'working' : ''}`} key={session.id} onClick={() => inspectSession(session)} title={`${session.provider} / ${session.title} / ${session.model || 'model not recorded'}`}><span className="agent-index">{String(index + 1).padStart(2, '0')}</span><div><strong>{session.shortId}<span>{session.provider === 'codex' ? 'CDX' : 'CLD'}</span></strong><small>{session.title}</small></div><span className="agent-age">{age(session.lastSeen)}</span></button>)}{!sessions.length && <p className="empty">{connected ? '此来源暂无会话日志' : '正在连接本地采集器…'}</p>}</div>
        <div className="rail-bottom"><span>PASSIVE OBSERVER</span><b>01 / LOCALHOST</b></div>
      </aside>
      <div className="core-caption"><span>{immersive ? 'HISTORY / REPLAY' : 'LIVE SESSION FABRIC'}</span><b>{immersive ? '历史日志循环回放' : 'INPUT → INFERENCE → OUTPUT'}</b></div>
      <div className="throughput"><div className="throughput-label">STREAM VELOCITY / I/O</div><strong>{bytes(data?.bytesPerSecond)}<span>/s</span></strong><div className="throughput-track"><i style={{ width: `${Math.min(100, Math.log2(1 + (data?.bytesPerSecond || 0)) * 6)}%` }} /></div><span>OBSERVED LOG THROUGHPUT</span></div>
      <div className={`core-status ${active || immersive ? 'is-active' : ''}`}><span className="eyebrow">{immersive ? 'DISPLAY / IMMERSIVE MODE' : 'OBSERVER / SYSTEM STATE'}</span><strong><i />{mode}</strong><p>{immersive ? '历史日志回放 · 不计入真实流量' : !connected ? '等待本地采集器连接' : active ? '本地事件正在流入 · 实时观测中' : '等待新事件 · 核心低速巡航'}</p></div>
      <div className="scene-coordinate">LOCAL OBSERVATORY <span>V.01</span></div>
    </section>
    <Panels events={visibleEvents} data={data} selected={selected} onInspect={inspect} onConsole={openConsole} onSession={inspectSession} />
    <footer className="statusbar"><div><span className="status-light" />{connected ? 'OBSERVER ONLINE' : 'CONNECTING TO OBSERVER'}<span className="separator">/</span><span>CODEX {data?.sources.filter(source => source.provider === 'codex').reduce((n, source) => n + source.files, 0) || 0}</span><span>CLAUDE {data?.sources.find(source => source.provider === 'claude')?.files || 0}</span></div><div className="performance-readout"><span>COLLECTOR CPU {data?.resource.cpu.toFixed(2) || '0.00'}%</span><span>MEM {bytes(data?.resource.rss)}</span><span>{visual.current.fps} FPS</span><button onClick={() => setEco(!eco)} className={eco ? 'mint' : ''}>{eco ? 'ECO ON' : 'ADAPTIVE'}</button><span>{time(data?.now)} LOCAL</span></div></footer>
    {consoleOpen && <Console open onClose={() => setConsoleOpen(false)} events={events} data={data} initialEvent={selected} initialSession={session} />}
    {settingsOpen && <Settings open onClose={() => setSettingsOpen(false)} data={data} eco={eco} setEco={setEco} paused={paused} setPaused={setPaused} visual={visual} />}
  </main>;
}

function Metric({ label, value, sub, accent }) {
  return <div className={`metric ${accent ? 'accent' : ''}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}
