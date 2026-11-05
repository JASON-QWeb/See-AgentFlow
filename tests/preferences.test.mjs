import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { createPreferences } from '../server/preferences.mjs';
import { createDashboardServer } from '../server/http.mjs';
import { Collector } from '../server/tailer.mjs';

test('theme preference survives restart and serializes rapid writes without touching transcript sources', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-ops-preferences-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'settings', 'preferences.json');
  const preferences = createPreferences(file);
  assert.deepEqual(preferences.read(), { theme: 'mint' });
  await Promise.all([preferences.set('paper'), preferences.set('mint'), preferences.set('paper')]);
  assert.deepEqual(createPreferences(file).read(), { theme: 'paper' });
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { theme: 'paper' });
  await assert.rejects(preferences.set('../invalid'));
  assert.deepEqual(preferences.read(), { theme: 'paper' });
});

test('only a bounded same-origin theme update is writable and all snapshots receive the saved theme', async t => {
  const collector = new Collector([]); await collector.start();
  const server = createDashboardServer(collector);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { collector.close(); server.close(); server.closeAllConnections(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const put = (body, origin = base, type = 'application/json') => fetch(base + '/api/preferences', {
    method: 'PUT', headers: { ...(origin ? { Origin: origin } : {}), 'Content-Type': type }, body,
  });
  assert.equal((await put('{"theme":"paper"}', 'https://untrusted.example')).status, 403);
  assert.equal((await put('{"theme":"paper"}', '')).status, 403);
  assert.equal((await put('{"theme":"paper"}', base, 'text/plain')).status, 415);
  assert.equal((await put('{"theme":"paper","path":"/tmp/log"}')).status, 400);
  assert.equal((await put('x'.repeat(2048))).status, 413);
  assert.equal((await put('{bad')).status, 400);
  assert.equal((await put('{"theme":"unknown"}')).status, 400);
  assert.deepEqual(await (await put('{"theme":"paper"}')).json(), { theme: 'paper' });
  for (const route of ['/api/preferences', '/api/snapshot']) {
    const response = await fetch(base + route).then(res => res.json());
    assert.equal((response.preferences || response).theme, 'paper');
  }
  assert.equal((await fetch(base + '/api/snapshot', { method: 'PUT', headers: { Origin: base } })).status, 405);
  assert.equal(collector.events.length, 0);
  const controller = new AbortController();
  const stream = await fetch(base + '/api/stream', { signal: controller.signal });
  const reader = stream.body.getReader();
  const { value } = await reader.read();
  assert.match(new TextDecoder().decode(value), /"preferences":\{"theme":"paper"\}/);
  await put('{"theme":"mint"}');
  const next = await reader.read();
  assert.match(new TextDecoder().decode(next.value), /event: update[\s\S]*"preferences":\{"theme":"mint"\}/);
  controller.abort();
});
