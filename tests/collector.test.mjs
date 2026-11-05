import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, appendFile, mkdir, rename, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Collector } from '../server/tailer.mjs';
import { realRecords, until } from './real-records.mjs';

const codex = await realRecords('codex');
const claude = await realRecords('claude');

async function fixture(t, provider = 'codex', options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'agent-ops-test-'));
  const path = join(dir, 'session.jsonl');
  await writeFile(path, '');
  const collector = new Collector([{ provider, path: dir }], { historyFiles: 0, ...options });
  await collector.start();
  t.after(async () => { collector.close(); await rm(dir, { recursive: true, force: true }); });
  return { dir, path, collector };
}

test('canonical real Codex and Claude records expose input, output and tools', t => {
  if (!codex.length || !claude.length) return t.skip('Local transcripts unavailable');
  for (const records of [codex, claude]) {
    const kinds = new Set(records.flatMap(record => record.items.map(item => item.kind)));
    for (const kind of ['input', 'output', 'tool_call', 'tool_result']) assert.ok(kinds.has(kind), kind);
  }
});

test('native append notification preserves partial UTF-8 records and exact full content', async t => {
  if (!codex.length) return t.skip('Local transcripts unavailable');
  const sample = codex.find(item => item.items.length === 1 && /[^\x00-\x7f]/.test(item.line));
  const { path, collector } = await fixture(t);
  const bytes = Buffer.from(sample.line + '\n');
  const split = bytes.findIndex(byte => byte > 127) + 1;
  await appendFile(path, bytes.subarray(0, split));
  await until(() => [...collector.files.values()][0].offset === split);
  assert.equal(collector.events.length, 0);
  const started = performance.now();
  await appendFile(path, bytes.subarray(split));
  await until(() => collector.events.length === 1);
  assert.ok(performance.now() - started < 2000, 'Append arrives in under 2 seconds');
  const event = collector.events[0];
  const detail = await collector.detail(event.id);
  assert.equal(detail.raw, sample.line);
  assert.equal(detail.text, sample.items[0].text);
  assert.equal(event.historical, false);
  collector.enqueue(path);
  await until(() => !collector.dirty.size && !collector.draining);
  assert.equal(collector.events.length, 1, 'Repeated notifications do not duplicate records');
});

test('new nested Claude subagent logs are discovered and captured', async t => {
  if (!claude.length) return t.skip('Local transcripts unavailable');
  const { dir, collector } = await fixture(t, 'claude');
  await mkdir(join(dir, 'parent', 'subagents'), { recursive: true });
  const sample = claude.find(item => item.items.length === 1);
  await writeFile(join(dir, 'parent', 'subagents', 'agent.jsonl'), sample.line + '\n');
  await until(() => collector.events.length > 0);
  assert.equal(collector.events[0].preview, sample.items[0].text.slice(0, 700));
});

test('rotation and truncation recover without serving stale original content', async t => {
  if (!codex.length) return t.skip('Local transcripts unavailable');
  const { path, collector } = await fixture(t);
  const sample = codex.find(item => item.items.length === 1);
  await appendFile(path, sample.line + '\n');
  await until(() => collector.events.length === 1);
  const old = collector.events[0].id;
  await rename(path, path + '.old');
  await writeFile(path, sample.line + '\n');
  await collector.discover();
  await until(() => collector.events.length === 2);
  assert.equal(await collector.detail(old), null);
  const beforeTruncate = collector.events[1].id;
  await writeFile(path, '');
  await until(() => [...collector.files.values()][0].offset === 0);
  await appendFile(path, sample.line + '\n');
  await until(() => collector.events.length === 3);
  assert.notEqual(collector.events[2].id, beforeTruncate);
  assert.equal(await collector.detail(beforeTruncate), null);
});

test('history stays historical, event buffers stay bounded, previews resolve full text', async t => {
  if (!codex.length) return t.skip('Local transcripts unavailable');
  const dir = await mkdtemp(join(tmpdir(), 'agent-ops-history-'));
  const path = join(dir, 'session.jsonl');
  const rows = codex.slice(-30);
  await writeFile(path, rows.map(item => item.line).join('\n') + '\n');
  const collector = new Collector([{ provider: 'codex', path: dir }], { historyFiles: 1, maxEvents: 4 });
  await collector.start();
  t.after(async () => { collector.close(); await rm(dir, { recursive: true, force: true }); });
  assert.ok(collector.events.length <= 4);
  assert.ok(collector.events.every(event => event.historical));
  assert.equal(collector.counters.events, 0);
  await appendFile(path, rows.map(item => item.line).join('\n') + '\n');
  await until(() => collector.counters.events === rows.reduce((sum, row) => sum + row.items.length, 0));
  assert.equal(collector.events.length, 4);
  assert.ok((await collector.detail(collector.events.at(-1).id)).raw);
});

test('idle retention expires previews while preserving counters, source logs and later capture', async t => {
  if (!codex.length) return t.skip('Local transcripts unavailable');
  const { path, collector } = await fixture(t, 'codex', { eventMaxAge: 300, sweepInterval: 25 });
  const sample = codex.find(item => item.items.length === 1);
  await appendFile(path, sample.line + '\n');
  await until(() => collector.events.length === 1);
  const id = collector.events[0].id, before = { ...collector.counters };
  await until(() => collector.events.length === 0);
  assert.deepEqual(collector.counters, before);
  assert.equal(await collector.detail(id), null);
  assert.equal(collector.sessions.size, 1);
  assert.equal(await readFile(path, 'utf8'), sample.line + '\n');
  await appendFile(path, sample.line + '\n');
  await until(() => collector.counters.events === 2);
  assert.ok((await collector.detail(collector.events.at(-1).id)).raw);
  collector.prune(Date.now() + 60_001);
  assert.equal(collector.samples.length, 0);
  assert.equal(collector.events.length, 0);
  collector.close();
  assert.equal(collector.fileWatchers.size + collector.files.size + collector.sessions.size, 0);
});
