#!/usr/bin/env python3
"""Install a development build using the same first-launch setup as the DMG App."""
import datetime
import pathlib
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = pathlib.Path.home() / 'Library' / 'Application Support' / 'Agent Ops'
APP = pathlib.Path.home() / 'Applications' / 'Agent Ops Screen Saver.app'


def main():
    source = ROOT / 'artifacts/macos' / APP.name
    if not (source / 'Contents/Resources/runtime/manifest.json').exists():
        raise RuntimeError('Build first with npm run build:saver')
    backup = BASE / 'backups' / datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    if APP.exists():
        backup.mkdir(parents=True, exist_ok=True)
        shutil.copytree(APP, backup / APP.name)
    APP.parent.mkdir(parents=True, exist_ok=True)
    stage = APP.with_name(APP.name + '.staging')
    if stage.exists(): shutil.rmtree(stage)
    shutil.copytree(source, stage)
    if APP.exists(): shutil.rmtree(APP)
    stage.rename(APP)
    registry = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
    subprocess.run([registry, '-f', str(APP)], check=True)
    subprocess.run(['pluginkit', '-r', str(source / 'Contents/PlugIns/AgentOpsSaver.appex')], capture_output=True)
    resources = APP / 'Contents/Resources'
    subprocess.run([str(resources / 'runtime/node'), str(resources / 'setup.mjs')], check=True)
    print(f'Installed: {APP}')


if __name__ == '__main__':
    main()
