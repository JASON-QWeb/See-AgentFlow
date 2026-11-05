import { useEffect, useState } from 'react';

const readSize = () => window.__AGENT_DESKTOP_SIZE__ || { width: innerWidth, height: innerHeight };

export function useDesktopLayout(desktop) {
  const [size, setSize] = useState(readSize);
  useEffect(() => {
    if (!desktop) return;
    const nativeResize = event => setSize(event.detail);
    const browserResize = () => setSize(readSize());
    window.addEventListener('agent-desktop-size', nativeResize);
    window.addEventListener('resize', browserResize);
    return () => {
      window.removeEventListener('agent-desktop-size', nativeResize);
      window.removeEventListener('resize', browserResize);
    };
  }, [desktop]);
  // Native dimensions precede WKWebView page zoom; CSS viewport size alone is misleading.
  const compact = desktop && (size.width < 1120 || size.height < 700);
  const scale = window.__AGENT_DESKTOP_SIZE__ ? Math.min(1, size.width / 1100, size.height / (compact ? 620 : 730)) : 1;
  return { compact, chromeSpace: 88 / scale };
}
