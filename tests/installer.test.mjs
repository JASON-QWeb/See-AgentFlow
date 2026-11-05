import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { installationPlan, setup } from '../macos/runtime/setup.mjs';

const execute = promisify(execFile);
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'agent-flow-installer-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const home = join(directory, 'User & Local'), appPath = join(directory, 'Applications/Agent Ops Screen Saver.app');
  const source = join(appPath, 'Contents/Resources/runtime');
  await mkdir(source, { recursive: true });
  // Use actual project code as payload. These tests never register system jobs or generate log events.
  await cp(resolve('server'), join(source, 'server'), { recursive: true });
  await writeFile(join(source, 'manifest.json'), JSON.stringify({ version: '1.1.0', revision: 1 }));
  const calls = []; let running = false, failBootstrap = false;
  const command = async (file, args) => {
    calls.push([file, ...args]);
    if (args[0] === 'print') return { code: running ? 0 : 1 };
    if (args[0] === 'bootout') running = false;
    if (args[0] === 'bootstrap') {
      if (failBootstrap) { failBootstrap = false; return { code: 5, stderr: 'Registration test failure' }; }
      running = true;
    }
    return { code: 0 };
  };
  const options = { appPath, home, uid: 501, command, freePort: async () => {}, ready: async () => {} };
  return { options, source, calls, plan: installationPlan(appPath, home), failNext: () => { failBootstrap = true; } };
}

test('standalone install points to bundled runtime and starts login App quietly', async t => {
  const f = await fixture(t);
  const result = await setup(f.options);
  assert.equal(result.changed, true); assert.equal(result.restarted, true);
  const { stdout } = await execute('/usr/bin/plutil', ['-convert', 'json', '-o', '-', f.plan.observerFile]);
  const observer = JSON.parse(stdout);
  assert.deepEqual(observer.ProgramArguments, [join(f.plan.runtime, 'node'), join(f.plan.runtime, 'server/index.mjs')]);
  assert.equal(observer.Nice, 10); assert.equal(observer.LowPriorityIO, true);
  const desktop = JSON.parse((await execute('/usr/bin/plutil', ['-convert', 'json', '-o', '-', f.plan.desktopFile])).stdout);
  assert.equal(desktop.ProgramArguments.at(-1), '--background'); assert.equal(desktop.RunAtLoad, true);
  assert.equal(desktop.KeepAlive, undefined);
  assert.equal(f.calls.filter(call => call[1] === 'bootstrap').length, 1);
  assert.deepEqual(await readFile(join(f.plan.runtime, 'server/index.mjs')), await readFile(resolve('server/index.mjs')));
});

test('reopening preserves preferences and avoids restarting the unchanged observer', async t => {
  const f = await fixture(t); await setup(f.options);
  const file = join(f.plan.base, 'preferences.json'), value = '{"theme":"white","language":"zh-CN"}\n';
  await writeFile(file, value); f.calls.length = 0;
  const result = await setup(f.options);
  assert.equal(result.changed, false); assert.equal(result.restarted, false);
  assert.equal(await readFile(file, 'utf8'), value);
  assert.equal(f.calls.some(call => ['bootout', 'bootstrap'].includes(call[1])), false);
});

test('runtime upgrade retains the previous payload and saved settings', async t => {
  const f = await fixture(t); await setup(f.options);
  const previous = await readFile(join(f.plan.runtime, 'manifest.json'), 'utf8');
  await writeFile(join(f.source, 'manifest.json'), JSON.stringify({ version: '1.1.0', revision: 2 }));
  await writeFile(join(f.plan.base, 'preferences.json'), '{"theme":"paper"}');
  assert.equal((await setup(f.options)).restarted, true);
  assert.equal(await readFile(join(`${f.plan.runtime}.previous`, 'manifest.json'), 'utf8'), previous);
  assert.equal(await readFile(join(f.plan.base, 'preferences.json'), 'utf8'), '{"theme":"paper"}');
});

test('failed service update restores the previous runtime and job definition', async t => {
  const f = await fixture(t); await setup(f.options);
  const previous = await readFile(join(f.plan.runtime, 'manifest.json'), 'utf8');
  const definition = await readFile(f.plan.observerFile, 'utf8');
  await writeFile(join(f.source, 'manifest.json'), JSON.stringify({ version: '1.1.0', revision: 2 }));
  f.failNext();
  await assert.rejects(setup(f.options), /Registration test failure/);
  assert.equal(await readFile(join(f.plan.runtime, 'manifest.json'), 'utf8'), previous);
  assert.equal(await readFile(f.plan.observerFile, 'utf8'), definition);
  assert.equal(f.calls.at(-1)[1], 'bootstrap');
});

test('disk image and translocated App paths cannot become login services', async () => {
  for (const appPath of ['/Volumes/See-AgentFlow/Agent Ops Screen Saver.app', '/private/var/AppTranslocation/test/Agent Ops Screen Saver.app']) {
    await assert.rejects(setup({ appPath }), /Drag Agent Ops/);
  }
});
