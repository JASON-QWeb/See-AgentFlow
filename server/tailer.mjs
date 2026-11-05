import { open, stat, readdir } from 'node:fs/promises';
import { watch } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { normalize } from './normalize.mjs';

const CHUNK = 128 * 1024;
const MAX_LINE = 8 * 1024 * 1024;
const idFor = path => createHash('sha256').update(path).digest('hex').slice(0, 16);

export class Collector extends EventEmitter {
  constructor(roots, { historyFiles = 16, historyBytes = 192 * 1024, maxEvents = 1600 } = {}) {
    super();
    Object.assign(this, { roots, historyFiles, historyBytes, maxEvents });
    this.files = new Map();
    this.sessions = new Map();
    this.events = [];
    this.dirty = new Set();
    this.watchers = [];
    this.fileWatchers = new Map();
    this.status = roots.map(root => ({ ...root, available: false, watching: false, files: 0, error: null }));
    this.counters = { events: 0, input: 0, output: 0, tools: 0, bytes: 0, malformed: 0, oversized: 0 };
    this.lastEventAt = 0;
    this.samples = [];
    this.startedAt = Date.now();
    this.closed = false;
  }

  async start() {
    await this.discover(true);
    const recent = [...this.files.values()].sort((a, b) => b.mtime - a.mtime).slice(0, this.historyFiles);
    for (const file of recent) {
      await this.loadMetadata(file);
      const start = Math.max(0, file.offset - this.historyBytes);
      file.offset = start;
      file.lineStart = start;
      file.skipFirst = start > 0;
      await this.read(file, true);
    }
    this.events.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    this.events = this.events.slice(-this.maxEvents);
    this.ready = true;
    this.installWatchers();
    for (const file of this.files.values()) this.watchFile(file);
    // Low-frequency reconciliation covers missed OS notifications and new roots.
    this.rescan = setInterval(() => this.discover().catch(error => this.emit('warning', error.message)), 30_000);
    this.rescan.unref();
    this.emit('ready');
  }

  async loadMetadata(file) {
    const handle = await open(file.path, 'r').catch(() => null);
    if (!handle) return;
    try {
      const buffer = Buffer.alloc(64 * 1024);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      for (const line of buffer.subarray(0, bytesRead).toString('utf8').split('\n').slice(0, 8)) {
        try { normalize(JSON.parse(line), this.sessions.get(file.id)); } catch { /* Last line may be partial. */ }
      }
    } finally { await handle.close(); }
  }

  async walk(dir, provider, initial, depth = 0) {
    if (depth > 12 || this.closed) return;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await this.walk(path, provider, initial, depth + 1);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) await this.register(path, provider, initial);
    }
  }

  async register(path, provider, initial = false) {
    let info;
    try { info = await stat(path); } catch { return; }
    if (!info.isFile()) return;
    let file = this.files.get(path);
    if (!file) {
      const id = idFor(path);
      const shortId = basename(path).replace(/^rollout-.*T[\d-]+-/, '').replace('.jsonl', '').slice(0, 8);
      const session = { id, shortId, provider, title: shortId, model: null, cwd: null,
        lastSeen: info.mtimeMs, observed: 0, bytes: 0, tokens: null, state: 'idle' };
      file = { path, id, provider, generation: 0, inode: info.ino, mtime: info.mtimeMs, offset: initial ? info.size : 0,
        lineStart: initial ? info.size : 0, pending: Buffer.alloc(0), oversized: false };
      this.files.set(path, file);
      this.sessions.set(id, session);
    }
    if (!initial && (info.size !== file.offset || info.ino !== file.inode)) this.enqueue(path);
    if (this.ready) this.watchFile(file);
  }

  watchFile(file) {
    if (this.fileWatchers.has(file.path) || this.fileWatchers.size >= 512 || this.closed) return;
    // macOS directory watches report entry changes; file watches reliably report appends.
    try {
      const watcher = watch(file.path, { persistent: false }, type => {
        this.enqueue(file.path);
        if (type === 'rename') { watcher.close(); this.fileWatchers.delete(file.path); }
      });
      watcher.on('error', () => { watcher.close(); this.fileWatchers.delete(file.path); });
      this.fileWatchers.set(file.path, watcher);
    } catch { /* Reconciliation reattaches files that are being rotated. */ }
  }

  async discover(initial = false) {
    if (this.discovering || this.closed) return;
    this.discovering = true;
    try {
      for (const root of this.status) {
        root.available = await stat(root.path).then(s => s.isDirectory()).catch(() => false);
        if (root.available) await this.walk(root.path, root.provider, initial);
        root.files = [...this.files.keys()].filter(path => path.startsWith(root.path + '/')).length;
      }
      if (!initial) this.installWatchers();
    } finally { this.discovering = false; }
  }

  installWatchers() {
    for (const root of this.status) {
      if (!root.available || root.watching || this.closed) continue;
      try {
        const watcher = watch(root.path, { recursive: true, persistent: false }, (_type, name) => {
          if (!name) return;
          const path = join(root.path, name.toString());
          if (relative(root.path, path).startsWith('..') || !path.endsWith('.jsonl')) return;
          if (this.files.has(path)) this.enqueue(path);
          else this.register(path, root.provider).catch(() => {});
        });
        watcher.on('error', error => { root.error = error.code; root.watching = false; watcher.close(); });
        root.watching = true;
        root.error = null;
        this.watchers.push(watcher);
      } catch (error) { root.error = error.code; }
    }
  }

  enqueue(path) {
    if (this.closed) return;
    this.dirty.add(path);
    if (!this.timer && !this.draining) this.timer = setTimeout(() => this.drain(), 120);
  }

  async drain() {
    this.timer = null;
    if (this.closed || this.draining) return;
    this.draining = true;
    // Each file gets one chunk per turn, preventing a large log from starving others.
    const batch = [...this.dirty].slice(0, 8);
    for (const path of batch) {
      this.dirty.delete(path);
      const file = this.files.get(path);
      if (file) await this.read(file).catch(error => this.emit('warning', error.code || error.message));
    }
    this.draining = false;
    if (this.dirty.size && !this.closed) this.timer = setTimeout(() => this.drain(), 30);
  }

  async read(file, historical = false) {
    let handle;
    try {
      handle = await open(file.path, 'r');
      const info = await handle.stat();
      if (info.ino !== file.inode || info.size < file.offset) {
        file.generation++;
        Object.assign(file, { inode: info.ino, offset: 0, lineStart: 0, pending: Buffer.alloc(0), oversized: false });
      }
      const length = Math.min(info.size - file.offset, historical ? this.historyBytes : CHUNK);
      if (length <= 0) return;
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, file.offset);
      file.offset += bytesRead;
      this.consume(file, buffer.subarray(0, bytesRead), historical);
      if (file.offset < info.size) this.enqueue(file.path);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    } finally { await handle?.close(); }
  }

  consume(file, chunk, historical) {
    let start = 0;
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] !== 10) continue;
      const fragment = chunk.subarray(start, i);
      const length = file.pending.length + fragment.length;
      if (!file.skipFirst) {
        if (file.oversized || length > MAX_LINE) this.recordOversized(file, file.lineStart, file.offset - chunk.length + i, historical);
        else this.recordLine(file, Buffer.concat([file.pending, fragment]), file.lineStart, historical);
      }
      file.skipFirst = false;
      file.oversized = false;
      file.pending = Buffer.alloc(0);
      file.lineStart = file.offset - chunk.length + i + 1;
      start = i + 1;
    }
    if (start < chunk.length && !file.oversized) {
      if (file.pending.length + chunk.length - start > MAX_LINE) {
        file.pending = Buffer.alloc(0);
        file.oversized = true;
      } else file.pending = Buffer.concat([file.pending, chunk.subarray(start)]);
    }
  }

  recordLine(file, buffer, offset, historical) {
    if (!buffer.length) return;
    let record;
    try { record = JSON.parse(buffer.toString('utf8')); } catch { this.counters.malformed++; return; }
    const session = this.sessions.get(file.id);
    const items = normalize(record, session);
    items.forEach((item, index) => this.addEvent(file, item, { offset, length: buffer.length, index }, historical));
  }

  recordOversized(file, offset, end, historical) {
    this.counters.oversized++;
    this.addEvent(file, { kind: 'raw', text: 'Large record · open raw source to inspect', timestamp: null },
      { offset, length: end - offset, index: -1 }, historical);
  }

  addEvent(file, item, location, historical) {
    const now = Date.now();
    const bytes = location.index === 0 || location.index === -1 ? location.length : 0;
    const entry = { ...item, text: undefined, preview: item.text.slice(0, 700), characters: item.text.length,
      id: `${file.id}:${file.inode}:${file.generation}:${location.offset}:${location.index}`, sessionId: file.id, provider: file.provider,
      receivedAt: now, historical, bytes, source: { ...location, inode: file.inode, generation: file.generation } };
    this.events.push(entry);
    if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents);
    const session = this.sessions.get(file.id);
    session.observed++;
    session.bytes += bytes;
    session.lastSeen = Math.max(session.lastSeen, item.timestamp || 0);
    if (!historical) {
      this.lastEventAt = now;
      this.counters.events++;
      this.counters.bytes += bytes;
      if (item.kind === 'input') this.counters.input++;
      if (item.kind === 'output') this.counters.output++;
      if (item.kind.startsWith('tool_')) this.counters.tools++;
      this.samples.push({ at: now, bytes, provider: file.provider, kind: item.kind });
      this.samples = this.samples.filter(sample => now - sample.at < 60_000).slice(-12000);
    }
    this.emit('event', entry);
  }

  async detail(id) {
    const entry = this.events.find(item => item.id === id);
    if (!entry) return null;
    const file = [...this.files.values()].find(item => item.id === entry.sessionId);
    const handle = await open(file.path, 'r');
    try {
      const info = await handle.stat();
      if (file.generation !== entry.source.generation || info.ino !== entry.source.inode || info.size < entry.source.offset + entry.source.length) return null;
      const length = Math.min(entry.source.length, MAX_LINE);
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, entry.source.offset);
      const raw = buffer.toString('utf8');
      if (length < entry.source.length) return { ...entry, text: raw, truncated: true, raw };
      const record = JSON.parse(raw);
      const items = normalize(record, { ...this.sessions.get(file.id) });
      return { ...entry, text: items[entry.source.index]?.text || raw, raw, truncated: false };
    } finally { await handle.close(); }
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    clearInterval(this.rescan);
    this.watchers.forEach(watcher => watcher.close());
    this.fileWatchers.forEach(watcher => watcher.close());
  }
}
