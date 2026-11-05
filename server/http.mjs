import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { publicEvent, createSnapshot } from './snapshot.mjs';
import { createReplayReader } from './replay.mjs';
import { createPreferences, readPreferencesRequest } from './preferences.mjs';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };

export function createDashboardServer(collector, { staticDir = resolve('dist/client'), preferencesFile } = {}) {
  const clients = new Set();
  const telemetrySnapshot = createSnapshot(collector);
  const preferences = createPreferences(preferencesFile);
  const snapshot = includeEvents => ({ ...telemetrySnapshot(includeEvents), preferences: preferences.read() });
  const readReplay = createReplayReader(collector);
  let pending = [];
  const onEvent = event => {
    if (!event.historical && clients.size) pending.push(publicEvent(event));
    if (pending.length > 256) pending = pending.slice(-256);
  };
  collector.on('event', onEvent);
  const interval = setInterval(() => {
    if (!clients.size) return;
    const data = `event: update\ndata: ${JSON.stringify({ ...snapshot(), events: pending })}\n\n`;
    pending = [];
    for (const res of clients) {
      // Disconnect slow consumers instead of retaining an unbounded write queue.
      if (res.writableLength > 256 * 1024) { res.destroy(); clients.delete(res); }
      else res.write(data);
    }
  }, 1000);
  interval.unref();

  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    const host = req.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) return json(res, 403, { error: 'Local access only' });
    if (req.headers.origin && req.headers.origin !== `http://${host}`) return json(res, 403, { error: 'Origin rejected' });
    if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { error: 'Cross-site access rejected' });
    const url = new URL(req.url, 'http://127.0.0.1');
    try {
      if (url.pathname === '/api/preferences' && req.method === 'PUT') {
        if (req.headers.origin !== `http://${host}`) return json(res, 403, { error: 'Same-origin settings request required' });
        const value = await readPreferencesRequest(req);
        if (value.error) return json(res, value.status, { error: value.error });
        return json(res, 200, await preferences.set(value));
      }
      if (req.method !== 'GET') return json(res, 405, { error: 'Read only' });
      if (url.pathname === '/api/preferences') return json(res, 200, preferences.read());
      if (url.pathname === '/api/health') return json(res, 200, { ok: true, mode: 'read-only', uptime: process.uptime() });
      if (url.pathname === '/api/snapshot') return json(res, 200, snapshot(true));
      if (url.pathname === '/api/replay') {
        const provider = url.searchParams.get('provider') || 'all';
        if (!['all', 'codex', 'claude'].includes(provider)) return json(res, 400, { error: 'Unknown provider' });
        return json(res, 200, await readReplay(provider));
      }
      if (url.pathname === '/api/sessions') {
        return json(res, 200, { sessions: [...collector.sessions.values()].sort((a, b) => b.lastSeen - a.lastSeen) });
      }
      if (url.pathname === '/api/stream') {
        if (clients.size >= 5) return json(res, 429, { error: 'Maximum 5 dashboard connections' });
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot(true))}\n\n`);
        clients.add(res);
        req.on('close', () => { clients.delete(res); if (!clients.size) pending = []; });
        return;
      }
      if (url.pathname === '/api/events') {
        const query = url.searchParams.get('q')?.toLowerCase();
        const provider = url.searchParams.get('provider');
        const session = url.searchParams.get('session');
        const events = collector.events.filter(event => (!provider || event.provider === provider)
          && (!session || event.sessionId === session) && (!query || event.preview.toLowerCase().includes(query)));
        return json(res, 200, { events: events.slice(-800).map(publicEvent), retained: collector.events.length });
      }
      if (url.pathname.startsWith('/api/event/')) {
        const detail = await collector.detail(decodeURIComponent(url.pathname.slice(11)));
        return json(res, detail ? 200 : 404, detail || { error: 'Record expired or source rotated. Open the session log.' });
      }
      if (url.pathname.startsWith('/api/session/')) {
        const id = url.pathname.split('/')[3];
        const file = [...collector.files.values()].find(file => file.id === id);
        if (!file) return json(res, 404, { error: 'Unknown session' });
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Content-Disposition': `attachment; filename="${file.provider}-${id}.jsonl"`, 'Cache-Control': 'no-store' });
        const stream = createReadStream(file.path);
        stream.on('error', () => res.destroy());
        res.on('close', () => stream.destroy());
        stream.pipe(res);
        return;
      }
      if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Not found' });
      await serveStatic(url.pathname, res, staticDir);
    } catch { if (!res.headersSent) json(res, 500, { error: 'Unable to read local source' }); else res.destroy(); }
  });
  server.on('close', () => {
    clearInterval(interval); collector.off('event', onEvent); readReplay.close(); pending = [];
    clients.forEach(client => client.end()); clients.clear();
  });
  return server;
}

async function serveStatic(path, res, root) {
  let file = resolve(root, '.' + decodeURIComponent(path === '/' ? '/index.html' : path));
  if (!file.startsWith(root + sep)) return json(res, 403, { error: 'Forbidden' });
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) {
    if (extname(path)) return json(res, 404, { error: 'Not found' });
    file = resolve(root, 'index.html');
  }
  if (!await stat(file).catch(() => null)) return json(res, 503, { error: 'Build the dashboard first: npm run build' });
  res.writeHead(200, { 'Content-Type': `${MIME[extname(file)] || 'application/octet-stream'}${['.html', '.js', '.css'].includes(extname(file)) ? '; charset=utf-8' : ''}`, 'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'max-age=3600' });
  createReadStream(file).pipe(res);
}
