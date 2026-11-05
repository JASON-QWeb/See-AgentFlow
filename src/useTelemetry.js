import { useEffect, useRef, useState } from 'react';

export function useTelemetry() {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const visual = useRef({ data: null, events: [], queue: [], paused: false, eco: false, immersive: false, quality: 'high', provider: 'all', fps: 0, frameMs: 0 });
  useEffect(() => {
    let stream;
    let retained = [];
    const ingest = (message, initial) => {
      const packet = JSON.parse(message.data);
      const known = new Set(retained.map(event => event.id));
      const incoming = (packet.events || []).filter(event => !known.has(event.id));
      retained = [...retained, ...incoming].slice(-800);
      if (!initial) visual.current.queue.push(...incoming.filter(event => !event.historical));
      visual.current.queue = visual.current.queue.slice(-256);
      visual.current.data = packet;
      visual.current.events = retained;
      setData(packet);
      if (incoming.length || initial) setEvents(retained);
      setConnected(true);
    };
    const connect = () => {
      if (document.hidden) return;
      stream = new EventSource('/api/stream');
      stream.addEventListener('snapshot', message => ingest(message, true));
      stream.addEventListener('update', message => ingest(message, false));
      stream.onerror = () => setConnected(false);
    };
    const visibility = () => {
      stream?.close();
      if (!document.hidden) connect();
    };
    connect();
    document.addEventListener('visibilitychange', visibility);
    return () => { stream?.close(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  return { data, connected, events, visual };
}
