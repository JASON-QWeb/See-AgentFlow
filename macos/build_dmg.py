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
            'Fullscreen lock: first set your own password in App Settings > Fullscreen Lock.\n'
            'Fullscreen then covers every display; returning from the screen saver locks again by default.\n'
            'Recovery: click the password field border 10 times in succession.\n'
            'This is an App-level cover; macOS authentication stays unchanged.\n\n'
            'Local build: ad-hoc signed, not Apple-notarized. Node retains its Node.js Foundation signature.\n'
            'Preferences: ~/Library/Application Support/Agent Ops/preferences.json\n'
            'Logs: ~/Library/Logs/Agent Ops\n'
            'Source: https://github.com/JASON-QWeb/See-AgentFlow (private)\n'
        )
        # hdiutil's automatic estimate can underallocate the filesystem for the bundled Node binary.
        payload = sum(path.stat().st_size for path in stage.rglob('*') if path.is_file() and not path.is_symlink())
        image_mib = max(256, (payload * 5 // 4) // (1024 * 1024) + 64)
        subprocess.run(['hdiutil', 'create', '-ov', '-size', f'{image_mib}m', '-format', 'UDZO', '-volname', 'See-AgentFlow',
                        '-srcfolder', str(stage), str(destination)], check=True)
    subprocess.run(['hdiutil', 'verify', str(destination)], check=True)
    digest = hashlib.sha256()
    with destination.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    destination.with_suffix('.dmg.sha256').write_text(f'{digest.hexdigest()}  {destination.name}\n')
    # Keep the verified image, not a second launchable development App in Spotlight.
    registry = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
    subprocess.run(['pluginkit', '-r', str(APP / 'Contents/PlugIns/AgentOpsSaver.appex')], capture_output=True)
    # A copy Spotlight has not indexed yet has nothing to unregister, and lsregister reports that as an error.
    subprocess.run([registry, '-u', str(APP)], capture_output=True)
    shutil.rmtree(APP)
    print(destination)


if __name__ == '__main__':
    main()
