import { homedir, setPriority } from 'node:os';
import { join } from 'node:path';
import { Collector } from './tailer.mjs';
import { createDashboardServer } from './http.mjs';

const codexRoot = process.env.AGENT_VIEW_CODEX_ROOT || process.env.CODEX_HOME || join(homedir(), '.codex');
const claudeRoot = process.env.AGENT_VIEW_CLAUDE_ROOT || process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
const roots = [
  { provider: 'codex', path: join(codexRoot, 'sessions'), label: 'Codex sessions' },
  { provider: 'codex', path: join(codexRoot, 'archived_sessions'), label: 'Codex archive' },
  { provider: 'claude', path: join(claudeRoot, 'projects'), label: 'Claude Code' },
];
try { setPriority(0, 10); } catch { /* Priority is best-effort on hosts without permission. */ }
const collector = new Collector(roots);
collector.on('warning', warning => console.warn('[collector]', warning));
await collector.start();
const server = createDashboardServer(collector);
const port = Number(process.env.PORT || 4318);
server.listen(port, '127.0.0.1', () => console.log(`Agent Ops running at http://127.0.0.1:${port} · ${collector.files.size} local logs · read-only`));
server.on('error', error => { console.error(error.message); collector.close(); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  collector.close();
  server.close();
  server.closeAllConnections();
  setTimeout(() => process.exit(0), 100).unref();
});
