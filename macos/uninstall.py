#!/usr/bin/env python3
"""Stop this user's Agent Ops installation and move installed files to Trash."""
import datetime
import os
import pathlib
import plistlib
import re
import shutil
import signal
import subprocess
import time

HOME_DIRECTORY = pathlib.Path.home()
BASE = HOME_DIRECTORY / 'Library/Application Support/Agent Ops'
LABELS = ['local.agentops.desktop', 'local.agentops.observer']


def installed_apps():
    result = []
    for folder in [HOME_DIRECTORY / 'Applications', pathlib.Path('/Applications')]:
        app = folder / 'Agent Ops Screen Saver.app'
        if not app.exists(): continue
        with (app / 'Contents/Info.plist').open('rb') as stream:
            if plistlib.load(stream).get('CFBundleIdentifier') != 'local.agentops.saver':
                raise RuntimeError(f'Unexpected app identity; left untouched: {app}')
        if not os.access(app.parent, os.W_OK): raise RuntimeError(f'Cannot move to Trash: {app}')
        result.append(app)
    return result


def stop_app(app):
    executable = app / 'Contents/MacOS/AgentOpsPreview'
    processes = subprocess.run(['pgrep', '-f', '^' + re.escape(str(executable)) + '($| )'], capture_output=True, text=True)
    for raw in processes.stdout.split():
        pid = int(raw)
        try: os.kill(pid, signal.SIGTERM)
        except ProcessLookupError: continue
        for _ in range(30):
            try: os.kill(pid, 0)
            except ProcessLookupError: break
            time.sleep(0.1)
        else: raise RuntimeError(f'App process {pid} is still running; files were kept.')


def main():
    apps = installed_apps()
    agents = [HOME_DIRECTORY / 'Library/LaunchAgents' / f'{label}.plist' for label in LABELS]
    for path, label in zip(agents, LABELS):
        if path.exists():
            with path.open('rb') as stream:
                if plistlib.load(stream).get('Label') != label: raise RuntimeError(f'Unexpected launch agent: {path}')
    for label in LABELS:
        subprocess.run(['launchctl', 'bootout', f'gui/{os.getuid()}/{label}'], capture_output=True)
        for _ in range(30):
            if subprocess.run(['launchctl', 'print', f'gui/{os.getuid()}/{label}'], capture_output=True).returncode != 0: break
            time.sleep(0.1)
        else: raise RuntimeError(f'Background service is still loaded; files were kept: {label}')
    for app in apps:
        stop_app(app)
        subprocess.run(['pluginkit', '-r', str(app / 'Contents/PlugIns/AgentOpsSaver.appex')], capture_output=True)
        registry = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
        subprocess.run([registry, '-u', str(app)], capture_output=True)
    trash = HOME_DIRECTORY / '.Trash' / ('See-AgentFlow-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
    trash.mkdir(parents=True, exist_ok=False)
    for index, app in enumerate(apps): shutil.move(str(app), str(trash / f'{index + 1}-{app.name}'))
    for path in [*agents, BASE / 'runtime', BASE / 'runtime.previous']:
        if path.exists(): shutil.move(str(path), str(trash / path.name))
    print(f'Installed App and services moved to: {trash}')
    print(f'Preserved preferences: {BASE / "preferences.json"}')


if __name__ == '__main__':
    main()
