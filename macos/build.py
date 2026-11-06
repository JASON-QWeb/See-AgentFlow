#!/usr/bin/env python3
"""Build the local macOS screen saver and its multi-display preview host."""
import os
import pathlib
import plistlib
import shutil
import subprocess
from bundle_runtime import bundle_runtime

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'macos' / 'AgentOpsSaver'
ASSETS = ROOT / 'macos' / 'assets'
OUTPUT = ROOT / 'artifacts' / 'macos'
APP = OUTPUT / 'Agent Ops Screen Saver.app'
EXTENSION = APP / 'Contents' / 'PlugIns' / 'AgentOpsSaver.appex'
VERSION = '1.2.0'


def write_plist(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('wb') as file:
        plistlib.dump(value, file)


def bundle_info(name, identifier, executable, kind):
    return {
        'CFBundleName': name, 'CFBundleDisplayName': name,
        'CFBundleIdentifier': identifier, 'CFBundleExecutable': executable,
        'CFBundlePackageType': kind, 'CFBundleInfoDictionaryVersion': '6.0',
        'CFBundleShortVersionString': VERSION, 'CFBundleVersion': '7',
        'LSMinimumSystemVersion': '26.0', 'NSHighResolutionCapable': True,
        'NSAppTransportSecurity': {'NSAllowsLocalNetworking': True},
    }


def compile_binary(files, destination, bridge=False):
    destination.parent.mkdir(parents=True, exist_ok=True)
    command = ['xcrun', 'swiftc', '-O', '-swift-version', '5', '-module-name', 'AgentOpsNative',
               '-target', 'arm64-apple-macos26.0', '-framework', 'AppKit', '-framework', 'ScreenSaver',
               '-framework', 'WebKit', '-framework', 'Security', '-parse-as-library']
    if bridge:
        command += ['-import-objc-header', str(SOURCE / 'ScreenSaverBridge.h')]
    command += [str(SOURCE / name) for name in files]
    subprocess.run(command + ['-o', str(destination)], check=True)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    if APP.exists():
        shutil.rmtree(APP)
    shared = ['DisplayLayout.swift', 'SaverWebView.swift', 'AgentOpsSaverView.swift']
    compile_binary(shared + ['DesktopPreferences.swift', 'FloatingChrome.swift', 'FloatingDashboard.swift',
                   'LockPasswordStore.swift', 'LockState.swift', 'LockPromptView.swift', 'PasswordSettingsSheet.swift',
                   'AppLockCoordinator.swift', 'RuntimeSetup.swift', 'PreviewApp.swift'], APP / 'Contents/MacOS/AgentOpsPreview')
    compile_binary(shared + ['Extension.swift'], EXTENSION / 'Contents/MacOS/AgentOpsSaver', True)
    app_info = bundle_info('Agent Ops Screen Saver', 'local.agentops.saver', 'AgentOpsPreview', 'APPL')
    app_info.update({'NSPrincipalClass': 'NSApplication', 'LSUIElement': False, 'CFBundleIconFile': 'AppIcon'})
    write_plist(APP / 'Contents/Info.plist', app_info)
    (APP / 'Contents/Resources').mkdir(parents=True, exist_ok=True)
    for name in ['AppIcon.icns', 'MenuBarIconTemplate.png', 'MenuBarIconTemplate@2x.png']:
        shutil.copy2(ASSETS / name, APP / 'Contents/Resources' / name)
    extension_info = bundle_info('Agent Ops · Continuous Link', 'local.agentops.saver.extension', 'AgentOpsSaver', 'XPC!')
    extension_info.update({
        'NSExtension': {'NSExtensionPointIdentifier': 'com.apple.screensaver',
                        'NSExtensionPointVersion': '1.0', 'NSExtensionPrincipalClass': 'AgentOpsExtension'},
        'NSExtensionContextClass': 'ScreenSaverExtensionContext',
        'ScreenSaverViewControllerClass': 'AgentOpsViewController',
        'SSENeedsAnimationTimer': False, 'SSEHasConfigureSheet': False,
    })
    write_plist(EXTENSION / 'Contents/Info.plist', extension_info)
    bundle_runtime(ROOT, APP / 'Contents/Resources', VERSION)
    entitlements = OUTPUT / 'saver.entitlements'
    write_plist(entitlements, {'com.apple.security.app-sandbox': True,
                              'com.apple.security.network.client': True})
    subprocess.run(['codesign', '--force', '--sign', '-', '--entitlements', str(entitlements), str(EXTENSION)], check=True)
    subprocess.run(['codesign', '--force', '--sign', '-', str(APP)], check=True)
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(APP)], check=True)
    print(APP)


if __name__ == '__main__':
    main()
