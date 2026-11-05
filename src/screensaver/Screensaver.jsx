import { useEffect, useState } from 'react';
import { App } from '../App.jsx';
import { layoutFromURL, normalizeLayout } from './layout.js';

export function Screensaver() {
  const [layout, setLayout] = useState(() => normalizeLayout(window.__AGENT_SAVER_LAYOUT__ ||
    layoutFromURL(location.search, { width: innerWidth, height: innerHeight })));
  useEffect(() => {
    const update = event => setLayout(normalizeLayout(event.detail));
    window.addEventListener('agent-saver-layout', update);
    document.body.style.cursor = 'none';
    return () => { window.removeEventListener('agent-saver-layout', update); document.body.style.cursor = ''; };
  }, []);
  if (layout.count === 1) return <App screensaver />;
  // Each WebView shows its physical slice of one shared composition; the single-screen UI is untouched.
  return <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
    <div style={{ width: layout.worldWidth, height: layout.worldHeight,
      transform: `translate(${-layout.x}px, ${-layout.y}px)` }}><App screensaver displayLayout={layout} /></div>
  </div>;
}
