// Writes fictional Codex and Claude session logs, for tests on machines with no real logs such as CI runners.
// Prints the environment variables that point the tests at them. Nothing here comes from a real session.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

if (!process.argv[2]) throw new Error('Usage: node scripts/ci-fixtures.mjs <directory>');
const root = resolve(process.argv[2]);
const started = Date.parse('2026-01-15T09:00:00Z');
const stamp = seconds => new Date(started + seconds * 1000).toISOString();

const turns = [
  { input: '把分页接口改成游标分页，保持旧参数兼容。', thought: 'Cursors need a stable sort, so the key includes the primary key.', tool: 'rg -n "paginate" src', result: 'src/items.ts:18: export function paginate(rows, page) {', output: '已切换为游标分页，旧的 page 参数继续可用。' },
  { input: 'Add a dry-run flag to the deploy command.', thought: 'The planner already computes the diff before applying it.', tool: 'npm test -- --run deploy', result: 'Tests  12 passed (12)', output: 'Added --dry-run, which prints the planned changes as a table.' },
  { input: 'Why does p99 latency jump after each deploy?', thought: 'The pool opens connections lazily, so the first burst pays for every handshake.', tool: 'go test ./internal/pool/...', result: 'ok  example.test/pool  0.342s', output: 'The pool now warms to the median load before accepting traffic.' },
];

function codexLog() {
  const cwd = '/workspace/fixture-codex';
  const item = (seconds, payload) => ({ timestamp: stamp(seconds), type: 'response_item', payload });
  const records = [
    { timestamp: stamp(0), type: 'session_meta', payload: { id: 'fixture', cwd, model: 'fixture-model' } },
    { timestamp: stamp(0), type: 'turn_context', payload: { cwd, model: 'fixture-model' } },
  ];
  turns.forEach((turn, index) => {
    const at = 10 + index * 10, call = `call_${index}`;
    records.push(
      item(at, { type: 'message', role: 'user', content: [{ type: 'input_text', text: turn.input }] }),
      item(at + 1, { type: 'reasoning', summary: [{ type: 'summary_text', text: turn.thought }] }),
      item(at + 2, { type: 'function_call', name: 'shell', arguments: JSON.stringify({ command: turn.tool }), call_id: call }),
      item(at + 3, { type: 'function_call_output', call_id: call, output: turn.result }),
      item(at + 4, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: turn.output }] }),
    );
  });
  return records;
}

function claudeLog() {
  const cwd = '/workspace/fixture-claude';
  const records = [];
  turns.forEach((turn, index) => {
    const at = 10 + index * 10, id = `toolu_${index}`;
    records.push(
      { type: 'user', timestamp: stamp(at), cwd, message: { role: 'user', content: turn.input } },
      { type: 'assistant', timestamp: stamp(at + 1), cwd, message: { model: 'fixture-model', content: [{ type: 'thinking', thinking: turn.thought }, { type: 'tool_use', id, name: 'Bash', input: { command: turn.tool } }] } },
      { type: 'user', timestamp: stamp(at + 2), cwd, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: turn.result }] } },
      { type: 'assistant', timestamp: stamp(at + 3), cwd, message: { model: 'fixture-model', content: [{ type: 'text', text: turn.output }] } },
    );
  });
  return records;
}

function write(directory, name, records) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, name), records.map(record => JSON.stringify(record)).join('\n') + '\n');
}

const codexHome = join(root, 'codex'), claudeHome = join(root, 'claude');
write(join(codexHome, 'sessions/2026/01/15'), 'rollout-2026-01-15T09-00-00-00000000-0000-4000-a000-000000000001.jsonl', codexLog());
write(join(claudeHome, 'projects/-workspace-fixture-claude'), '00000000-0000-4000-a000-000000000002.jsonl', claudeLog());
console.log(`CODEX_HOME=${codexHome}\nCLAUDE_CONFIG_DIR=${claudeHome}\nAGENT_VIEW_REQUIRE_RECORDS=1`);
