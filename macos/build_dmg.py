#!/usr/bin/env python3
"""Create a drag-to-Applications image from the signed standalone App."""
import hashlib
import pathlib
import shutil
import subprocess
import tempfile
from build import APP, OUTPUT, VERSION


def main():
    if not (APP / 'Contents/Resources/runtime/manifest.json').exists():
        raise RuntimeError('Run npm run build:saver first.')
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(APP)], check=True)
    destination = OUTPUT / f'See-AgentFlow-{VERSION}-arm64.dmg'
    with tempfile.TemporaryDirectory(prefix='agent-flow-dmg-') as folder:
        stage = pathlib.Path(folder)
        shutil.copytree(APP, stage / APP.name, symlinks=True)
        (stage / 'Applications').symlink_to('/Applications')
        (stage / 'Install.txt').write_text(
            'See-AgentFlow ' + VERSION + ' | Apple Silicon | macOS 26+\n\n'
            '1. Drag Agent Ops Screen Saver.app into Applications.\n'
            '2. Eject this image and open the installed App once.\n'
            '   First launch installs the bundled observer and login services. No Node installation is needed.\n'
            '3. In System Settings > Wallpaper > Screen Saver, select Agent Ops - Continuous Link.\n'
            '   Choose an idle delay in Lock Screen settings. Password protection remains controlled by macOS.\n\n'
            'Closing the floating window leaves the menu bar and observer available.\n'
            'At login the App starts quietly without opening a floating window.\n'
            'Locking hides the floating renderer; the selected screen saver is managed by macOS.\n'
            'Display sleep stops visible animation. This does not replace the authentication screen.\n\n'
            'Local build: ad-hoc signed, not Apple-notarized. Node retains its Node.js Foundation signature.\n'
            'Preferences: ~/Library/Application Support/Agent Ops/preferences.json\n'
            'Logs: ~/Library/Logs/Agent Ops\n'
            'Source: https://github.com/JASON-QWeb/See-AgentFlow (private)\n'
        )
        subprocess.run(['hdiutil', 'create', '-ov', '-format', 'UDZO', '-volname', 'See-AgentFlow',
                        '-srcfolder', str(stage), str(destination)], check=True)
    subprocess.run(['hdiutil', 'verify', str(destination)], check=True)
    digest = hashlib.file_digest(destination.open('rb'), 'sha256').hexdigest()
    destination.with_suffix('.dmg.sha256').write_text(f'{digest}  {destination.name}\n')
    print(destination)


if __name__ == '__main__':
    main()
