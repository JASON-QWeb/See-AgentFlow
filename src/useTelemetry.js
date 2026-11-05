import { useEffect, useRef, useState } from 'react';
import { HIDDEN_RELEASE_DELAY, retainRecentEvents } from './eventRetention.js';

export function useTelemetry() {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const visual = useRef({ data: null, events: [], queue: [], paused: false, eco: false, immersive: false, quality: 'high', provider: 'all', fps: 0, frameMs: 0 });
  useEffect(() => {
    let stream, releaseTimer;
    let retained = [];
    const publish = next => {
      if (next === retained) return;
      retained = next; visual.current.events = next; setEvents(next);
    };
    const release = () => {
      publish([]); visual.current.queue = []; visual.current.data = null; setData(null);
    };
    const ingest = (message, initial) => {
      if (document.hidden) return;
      const { events: batch = [], ...packet } = JSON.parse(message.data);
      const known = new Set(retained.map(event => event.id));
      const incoming = batch.filter(event => !known.has(event.id));
      publish(retainRecentEvents(retained, incoming));
      if (!initial) visual.current.queue.push(...incoming.filter(event => !event.historical));
      visual.current.queue = visual.current.queue.slice(-96);
      visual.current.data = packet;
      setData(packet);
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
      clearTimeout(releaseTimer);
      if (document.hidden) {
        setConnected(false); visual.current.queue = [];
        releaseTimer = setTimeout(release, HIDDEN_RELEASE_DELAY);
      } else connect();
    };
    const sweeper = setInterval(() => publish(retainRecentEvents(retained)), 15_000);
    connect();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stream?.close(); clearInterval(sweeper); clearTimeout(releaseTimer);
      document.removeEventListener('visibilitychange', visibility);
      visual.current.events = []; visual.current.queue = []; visual.current.data = null;
    };
  }, []);
  return { data, connected, events, visual };
}
