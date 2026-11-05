import { open } from 'node:fs/promises';
import { normalize } from './normalize.mjs';

async function readHistory(file, session) {
  const handle = await open(file.path, 'r').catch(() => null);
  if (!handle) return [];
  try {
    const { size } = await handle.stat();
    const offset = Math.max(0, size - 128 * 1024);
    const buffer = Buffer.alloc(size - offset);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
    const lines = buffer.subarray(0, bytesRead).toString('utf8').split('\n').slice(offset ? 1 : 0);
    const events = [];
    lines.forEach((line, row) => {
      try {
        const items = normalize(JSON.parse(line), session);
        items.forEach((item, index) => events.push({ id: `replay:${file.id}:${offset}:${row}:${index}`,
          provider: file.provider, sessionId: file.id, kind: item.kind, timestamp: item.timestamp,
          preview: item.text.slice(0, 700), historical: true, replay: true }));
      } catch { /* The tail may contain an incomplete record during an active write. */ }
    });
    return events.slice(-64);
  } finally { await handle.close(); }
}

export function createReplayReader(collector, { ttl = 60_000 } = {}) {
  const cache = new Map();
  const inFlight = new Map();
  let closed = false;
  const load = async provider => {
    const sources = provider === 'all' ? ['codex', 'claude'] : [provider];
    const events = [];
    for (const source of sources) {
      const files = [...collector.files.values()].filter(file => file.provider === source)
        .sort((a, b) => collector.sessions.get(b.id).lastSeen - collector.sessions.get(a.id).lastSeen).slice(0, 3);
      for (const file of files) {
        if (closed) break;
        // Read bounded tails into a separate display buffer; never ingest replay as live traffic.
        events.push(...await readHistory(file, { ...collector.sessions.get(file.id) }));
      }
    }
    events.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const result = { events: events.slice(-96), source: 'local-log-history' };
    if (!closed) {
      const timer = setTimeout(() => cache.delete(provider), ttl);
      timer.unref(); cache.set(provider, { result, timer });
    }
    return result;
  };
  const read = provider => {
    if (closed) return Promise.reject(new Error('Replay reader closed'));
    if (cache.has(provider)) return Promise.resolve(cache.get(provider).result);
    // Both display halves share one bounded disk read when requesting history together.
    if (!inFlight.has(provider)) inFlight.set(provider, load(provider).finally(() => inFlight.delete(provider)));
    return inFlight.get(provider);
  };
  read.close = () => {
    closed = true; cache.forEach(entry => clearTimeout(entry.timer)); cache.clear(); inFlight.clear();
  };
  return read;
}
