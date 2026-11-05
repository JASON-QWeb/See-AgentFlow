import { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';
import { bytes } from './format.js';

export function Settings({ open, onClose, data, eco, setEco, paused, setPaused, visual }) {
  const dialog = useRef(null);
  useEffect(() => { if (open && !dialog.current.open) dialog.current.showModal(); if (!open && dialog.current.open) dialog.current.close(); }, [open]);
  return <dialog className="settings-dialog" ref={dialog} onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="settings-shell">
      <header className="dialog-heading"><div><span className="eyebrow">SYSTEM / PREFERENCES</span><h2>观测设置</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭设置"><X size={20} /></button></header>
      <section><h3>DISPLAY / 显示</h3><label className="setting-row"><div>节能模式<p>活跃时最高 15 FPS，空闲时 6 FPS</p></div><input type="checkbox" checked={eco} onChange={event => setEco(event.target.checked)} /></label><label className="setting-row"><div>暂停动画<p>采集继续运行，仅冻结数据流画面</p></div><input type="checkbox" checked={paused} onChange={event => setPaused(event.target.checked)} /></label></section>
      <section><h3>LOCAL SOURCES / 本地数据源</h3>{data?.sources.map(source => <div className="source-setting" key={source.path}><div><strong>{source.label}</strong><span className={source.watching ? 'mint' : 'muted'}>{source.watching ? 'WATCHING' : source.available ? 'POLLING' : 'NOT FOUND'}</span></div><code>{source.path}</code><small>{source.files} 个会话日志{source.error ? ` · ${source.error}` : ''}</small></div>)}</section>
      <section><h3>RESOURCE / 实时占用</h3><div className="resource-grid"><div><b>{data?.resource.cpu.toFixed(2) || '0'}%</b><span>采集进程 CPU</span></div><div><b>{bytes(data?.resource.rss)}</b><span>采集进程内存</span></div><div><b>{visual.current.fps}</b><span>实际绘制 FPS</span></div><div><b>{visual.current.frameMs.toFixed(2)} ms</b><span>最近一帧绘制耗时</span></div></div></section>
      <p className="settings-note">只读监听已有会话日志，包含子代理。日志写入后才会显示；未落盘的 token、加密推理与禁用日志的会话无法读取。窗口隐藏后暂停绘制，原始文件始终保留在各客户端目录。</p>
    </div>
  </dialog>;
}
