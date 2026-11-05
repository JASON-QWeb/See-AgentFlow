#!/usr/bin/env python3
"""Install the local build and keep one read-only observer available after login."""
import datetime
import os
import pathlib
import plistlib
import shutil
import signal
import subprocess
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = pathlib.Path.home() / 'Library' / 'Application Support' / 'Agent Ops'
RUNTIME = BASE / 'runtime'
APP = pathlib.Path.home() / 'Applications' / 'Agent Ops Screen Saver.app'
LABEL = 'local.agentops.observer'
PLIST = pathlib.Path.home() / 'Library' / 'LaunchAgents' / f'{LABEL}.plist'


def stop_previous_observer():
    subprocess.run(['launchctl', 'bootout', f'gui/{os.getuid()}/{LABEL}'], capture_output=True)
    result = subprocess.run(['lsof', '-t', '-iTCP:4318', '-sTCP:LISTEN'], capture_output=True, text=True)
    for pid in result.stdout.split():
        directory = subprocess.run(['lsof', '-a', '-p', pid, '-d', 'cwd', '-Fn'], capture_output=True, text=True).stdout
        if f'n{ROOT}\n' not in directory and f'n{RUNTIME}\n' not in directory:
            raise RuntimeError('Port 4318 belongs to another process; it was left running.')
        os.kill(int(pid), signal.SIGTERM)
    for _ in range(30):
        result = subprocess.run(['lsof', '-t', '-iTCP:4318', '-sTCP:LISTEN'], capture_output=True)
        if not result.stdout: return
        time.sleep(0.1)
    raise RuntimeError('Previous observer did not release its port.')


def main():
    source_app = ROOT / 'artifacts' / 'macos' / APP.name
    if not source_app.exists() or not (ROOT / 'dist/client/index.html').exists():
        raise RuntimeError('Build first with npm run build:saver')
    node = shutil.which('node')
    if not node: raise RuntimeError('Node.js is required')
    BASE.mkdir(parents=True, exist_ok=True)
    backup = BASE / 'backups' / datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    for item in [APP, PLIST]:
        if item.exists():
            backup.mkdir(parents=True, exist_ok=True)
            if item.is_dir(): shutil.copytree(item, backup / item.name)
            else: shutil.copy2(item, backup / item.name)
    running = subprocess.run(['launchctl', 'print', f'gui/{os.getuid()}/{LABEL}'], capture_output=True).returncode == 0
    unchanged = all((RUNTIME / 'server' / file.name).exists() and file.read_bytes() == (RUNTIME / 'server' / file.name).read_bytes()
                    for file in (ROOT / 'server').glob('*.mjs'))
    restart = not (running and unchanged)
    if restart: stop_previous_observer()
    RUNTIME.mkdir(parents=True, exist_ok=True)
    for relative in ['server', 'dist/client']:
        if relative == 'server' and not restart: continue
        target = RUNTIME / relative
        if target.exists(): shutil.rmtree(target)
        shutil.copytree(ROOT / relative, target)
    (RUNTIME / 'package.json').write_text('{"type":"module","private":true}\n')
    APP.parent.mkdir(parents=True, exist_ok=True)
    if APP.exists(): shutil.rmtree(APP)
    shutil.copytree(source_app, APP)
    PLIST.parent.mkdir(parents=True, exist_ok=True)
    logs = pathlib.Path.home() / 'Library' / 'Logs' / 'Agent Ops'
    logs.mkdir(parents=True, exist_ok=True)
    with PLIST.open('wb') as file:
        plistlib.dump({
            'Label': LABEL, 'ProgramArguments': [node, str(RUNTIME / 'server/index.mjs')],
            'WorkingDirectory': str(RUNTIME), 'RunAtLoad': True,
            'KeepAlive': {'SuccessfulExit': False}, 'ThrottleInterval': 30, 'Nice': 10,
            'ProcessType': 'Background', 'LowPriorityIO': True,
            'StandardOutPath': str(logs / 'observer.log'), 'StandardErrorPath': str(logs / 'observer-error.log'),
        }, file)
    if restart: subprocess.run(['launchctl', 'bootstrap', f'gui/{os.getuid()}', str(PLIST)], check=True)
    extension = APP / 'Contents/PlugIns/AgentOpsSaver.appex'
    registry = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
    subprocess.run([registry, '-f', str(APP)], check=True)
    subprocess.run(['pluginkit', '-r', str(source_app / 'Contents/PlugIns/AgentOpsSaver.appex')], capture_output=True)
    subprocess.run(['pluginkit', '-a', str(extension)], check=True)
    for _ in range(40):
        try:
            with urllib.request.urlopen('http://127.0.0.1:4318/api/health', timeout=1) as response:
                if response.status == 200:
                    print(f'Installed: {APP}\nObserver: http://127.0.0.1:4318\nLaunchAgent: {PLIST}')
                    return
        except OSError: time.sleep(0.25)
    raise RuntimeError('Observer did not become ready; see ~/Library/Logs/Agent Ops')


if __name__ == '__main__':
    main()
