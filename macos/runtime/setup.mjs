import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const observerLabel = 'local.agentops.observer';
const desktopLabel = 'local.agentops.desktop';
const delay = ms => new Promise(done => setTimeout(done, ms));
const read = path => readFile(path, 'utf8').catch(() => '');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);

export function plist(value) {
  const encode = item => {
    if (typeof item === 'boolean') return item ? '<true/>' : '<false/>';
    if (typeof item === 'number') return `<integer>${item}</integer>`;
    if (typeof item === 'string') return `<string>${escape(item)}</string>`;
    if (Array.isArray(item)) return `<array>${item.map(encode).join('')}</array>`;
    return `<dict>${Object.entries(item).map(([key, next]) => `<key>${escape(key)}</key>${encode(next)}`).join('')}</dict>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0">${encode(value)}</plist>\n`;
}

async function run(file, args) {
  try { return { code: 0, ...await execute(file, args, { timeout: 15000, maxBuffer: 1024 * 1024 }) }; }
  catch (error) { return { code: error.code || 1, stderr: error.stderr || error.message }; }
}

async function atomicWrite(file, content) {
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, content, { mode: 0o600 });
  await rename(temp, file);
}

export async function installPayload(source, target) {
  const stage = `${target}.${randomUUID()}.staging`, previous = `${target}.previous`;
  let moved = false;
  try {
    await cp(source, stage, { recursive: true, errorOnExist: true, force: false });
    await rm(previous, { recursive: true, force: true });
    try { await rename(target, previous); moved = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { await rename(stage, target); }
    catch (error) { if (moved) await rename(previous, target); throw error; }
  } finally { await rm(stage, { recursive: true, force: true }); }
}

async function waitForFreePort() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const available = await new Promise(done => {
      const socket = createServer();
      socket.once('error', () => done(false));
      socket.listen(4318, '127.0.0.1', () => socket.close(() => done(true)));
    });
    if (available) return;
    await delay(100);
  }
  throw new Error('Port 4318 is in use. Close the other local observer, then reopen Agent Ops.');
}

async function waitForObserver() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:4318/api/health', { signal: AbortSignal.timeout(1000) });
      const health = await response.json();
      if (response.ok && health.ok && health.mode === 'read-only') return;
    } catch { /* launchd may still be starting the observer. */ }
    await delay(200);
  }
  throw new Error('The local observer did not start. Check Agent Ops in System Settings > General > Login Items & Extensions and ~/Library/Logs/Agent Ops.');
}

export function installationPlan(appPath, home = homedir()) {
  const base = join(home, 'Library/Application Support/Agent Ops');
  const runtime = join(base, 'runtime'), agents = join(home, 'Library/LaunchAgents');
  const logs = join(home, 'Library/Logs/Agent Ops');
  const observer = {
    Label: observerLabel, ProgramArguments: [join(runtime, 'node'), join(runtime, 'server/index.mjs')],
    WorkingDirectory: runtime, RunAtLoad: true, KeepAlive: { SuccessfulExit: false },
    ThrottleInterval: 30, Nice: 10, ProcessType: 'Background', LowPriorityIO: true,
    StandardOutPath: join(logs, 'observer.log'), StandardErrorPath: join(logs, 'observer-error.log'),
  };
  const desktop = {
    Label: desktopLabel, ProgramArguments: [join(appPath, 'Contents/MacOS/AgentOpsPreview'), '--background'],
    RunAtLoad: true, ProcessType: 'Interactive',
    StandardOutPath: join(logs, 'desktop.log'), StandardErrorPath: join(logs, 'desktop-error.log'),
  };
  return { base, runtime, agents, logs, observer, desktop,
    observerFile: join(agents, `${observerLabel}.plist`), desktopFile: join(agents, `${desktopLabel}.plist`) };
}

async function activateObserver({ plan, source, changed, running, command, freePort, ready, domain, job }) {
  const oldDefinition = await read(plan.observerFile);
  let installed = false;
  try {
    if (running) {
      const stop = await command('/bin/launchctl', ['bootout', job]);
      if (stop.code !== 0) throw new Error(`Unable to stop the previous observer: ${stop.stderr}`);
      await waitForServiceStop(command, job);
    }
    await freePort();
    if (changed) { await installPayload(source, plan.runtime); installed = true; }
    await atomicWrite(plan.observerFile, plist(plan.observer));
    const start = await command('/bin/launchctl', ['bootstrap', domain, plan.observerFile]);
    if (start.code !== 0) throw new Error(`Unable to register the local observer: ${start.stderr}`);
    await ready();
  } catch (error) {
    // An unsuccessful update restores the previous runtime and its launch definition.
    // Preferences and captured transcripts are outside this transaction.
    await command('/bin/launchctl', ['bootout', job]);
    await waitForServiceStop(command, job);
    if (installed) {
      await rm(plan.runtime, { recursive: true, force: true });
      if (await stat(`${plan.runtime}.previous`).catch(() => null)) await rename(`${plan.runtime}.previous`, plan.runtime);
    }
    if (oldDefinition) await atomicWrite(plan.observerFile, oldDefinition);
    else await rm(plan.observerFile, { force: true });
    if (running && oldDefinition) await command('/bin/launchctl', ['bootstrap', domain, plan.observerFile]);
    throw error;
  }
}

async function waitForServiceStop(command, job) {
  // bootout may return while launchd is still removing a job; wait before reusing its label.
  for (let attempt = 0; attempt < 30; attempt++) {
    if ((await command('/bin/launchctl', ['print', job])).code !== 0) return;
    await delay(100);
  }
  throw new Error('The previous observer is still stopping. Reopen Agent Ops in a moment.');
}

export async function setup({ appPath, home = homedir(), uid = process.getuid(), command = run,
  freePort = waitForFreePort, ready = waitForObserver } = {}) {
  // Mounted images and App Translocation paths disappear; never register them for login.
  if (appPath.startsWith('/Volumes/') || appPath.includes('/AppTranslocation/')) {
    throw new Error('Drag Agent Ops Screen Saver.app to Applications, eject the disk image, then open the installed App.');
  }
  const plan = installationPlan(appPath, home);
  const source = join(appPath, 'Contents/Resources/runtime');
  const revision = await read(join(source, 'manifest.json'));
  if (!revision) throw new Error('The bundled runtime is missing. Reinstall the App from the DMG.');
  const job = `gui/${uid}/${observerLabel}`, domain = `gui/${uid}`;
  const changed = revision !== await read(join(plan.runtime, 'manifest.json'));
  const definition = plist(plan.observer);
  const running = (await command('/bin/launchctl', ['print', job])).code === 0;
  const restart = !running || changed || definition !== await read(plan.observerFile);
  for (const path of [plan.base, plan.agents, plan.logs]) await mkdir(path, { recursive: true, mode: 0o700 });
  if (restart) await activateObserver({ plan, source, changed, running, command, freePort, ready, domain, job });
  else await ready();
  // The current App already supplies the menu bar. launchd reads this at the next login;
  // bootstrapping it now would start an unnecessary second App instance.
  await atomicWrite(plan.desktopFile, plist(plan.desktop));
  const extension = join(appPath, 'Contents/PlugIns/AgentOpsSaver.appex');
  const registration = await command('/usr/bin/pluginkit', ['-a', extension]);
  if (registration.code !== 0) throw new Error(`Unable to register the screen saver: ${registration.stderr}`);
  return { changed, restarted: restart, runtime: plan.runtime };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const appPath = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  setup({ appPath }).then(() => console.log('Agent Ops background services are ready.')).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
