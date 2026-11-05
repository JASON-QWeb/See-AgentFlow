import { performance } from 'node:perf_hooks';
import { homedir } from 'node:os';

export function publicEvent({ source, ...event }) { return event; }

export function createSnapshot(collector) {
  let previousCpu = process.cpuUsage();
  let previousTime = performance.now();
  let cpu = 0;
  return function snapshot(includeEvents = false) {
    const now = Date.now();
    const elapsed = performance.now() - previousTime;
    if (elapsed >= 900) {
      const usage = process.cpuUsage(previousCpu);
      cpu = (usage.user + usage.system) / (elapsed * 10);
      previousCpu = process.cpuUsage();
      previousTime = performance.now();
    }
    const recent = collector.samples.filter(sample => now - sample.at < 5000);
    const sessions = [...collector.sessions.values()].sort((a, b) => b.lastSeen - a.lastSeen);
    const sources = collector.status.map(root => ({ ...root, path: root.path.replace(homedir(), '~'),
      files: [...collector.files.values()].filter(file => file.path.startsWith(root.path + '/')).length }));
    return {
      now, startedAt: collector.startedAt, lastEventAt: collector.lastEventAt,
      counters: collector.counters, sources, totalSessions: sessions.length,
      activeSessions: sessions.filter(session => now - session.lastSeen < 60_000).length,
      sessions: sessions.slice(0, 80),
      rate: recent.length / 5,
      bytesPerSecond: recent.reduce((sum, sample) => sum + sample.bytes, 0) / 5,
      providerRates: Object.fromEntries(['codex', 'claude'].map(provider =>
        [provider, recent.filter(sample => sample.provider === provider).length / 5])),
      resource: { cpu: Math.round(cpu * 100) / 100, rss: process.memoryUsage().rss,
        pendingFiles: collector.dirty.size, bufferedEvents: collector.events.length },
      ...(includeEvents ? { events: collector.events.slice(-160).map(publicEvent) } : {}),
    };
  };
}
