import { readdir, open, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { normalize } from '../server/normalize.mjs';

// Tests replay local records in isolated temporary directories: real logs on a developer's machine,
// or fictional ones from scripts/ci-fixtures.mjs in CI. No transcripts or credentials are stored in the repository.
export async function realRecords(provider) {
  const root = provider === 'codex' ? join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'sessions')
    : join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects');
  const paths = (await readdir(root, { recursive: true }).catch(() => []))
    .filter(name => name.endsWith('.jsonl')).map(name => join(root, name));
  const recent = await Promise.all(paths.map(async path => ({ path, mtime: (await stat(path)).mtimeMs })));
  recent.sort((a, b) => b.mtime - a.mtime);
  const records = [];
  for (const { path } of recent.slice(0, 8)) {
    const handle = await open(path, 'r');
    try {
      const info = await handle.stat();
      const offset = Math.max(0, info.size - 2 * 1024 * 1024);
      const buffer = Buffer.alloc(Math.min(info.size, 2 * 1024 * 1024));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      for (const line of buffer.subarray(0, bytesRead).toString('utf8').split('\n').slice(offset ? 1 : 0)) {
        if (line.length > 200000) continue;
        try {
          const record = JSON.parse(line);
          const items = normalize(record, { provider, shortId: 'test' });
          if (items.length) records.push({ line, record, items });
        } catch { /* Partial final record. */ }
      }
    } finally { await handle.close(); }
    if (records.some(item => item.items[0].kind === 'input') && records.some(item => item.items[0].kind === 'tool_call')) break;
  }
  if (!records.length && process.env.AGENT_VIEW_REQUIRE_RECORDS) throw new Error(`No ${provider} records found; these tests would silently skip`);
  return records;
}

export async function until(predicate, timeout = 3500) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Condition did not become true before deadline');
}
