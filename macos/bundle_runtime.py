"""Bundle the existing signed Node runtime, app code and web assets; never include logs."""
import hashlib
import json
import os
import pathlib
import shutil
import subprocess


def bundle_runtime(root, resources, version):
    node = pathlib.Path(os.environ.get('AGENT_FLOW_NODE') or shutil.which('node')).resolve()
    info = json.loads(subprocess.check_output([str(node), '-p',
        'JSON.stringify({version:process.versions.node,arch:process.arch,platform:process.platform})'], text=True))
    if info['arch'] != 'arm64' or info['platform'] != 'darwin' or int(info['version'].split('.')[0]) < 22:
        raise RuntimeError('Bundle a macOS arm64 Node.js 22+ executable.')
    dependencies = subprocess.check_output(['otool', '-L', str(node)], text=True).splitlines()[1:]
    if any(not line.strip().startswith(('/usr/lib/', '/System/Library/')) for line in dependencies):
        raise RuntimeError('Node has external dylib dependencies. Use the official standalone Node distribution.')
    license_file = pathlib.Path(os.environ.get('AGENT_FLOW_NODE_LICENSE') or node.parent.parent / 'LICENSE')
    if not license_file.is_file():
        raise RuntimeError('Node LICENSE is required; set AGENT_FLOW_NODE_LICENSE if needed.')
    subprocess.run(['codesign', '--verify', '--strict', str(node)], check=True)
    runtime = resources / 'runtime'
    runtime.mkdir(parents=True, exist_ok=True)
    shutil.copy2(node, runtime / 'node')  # Retain Node Foundation signing and JIT entitlements.
    shutil.copy2(license_file, runtime / 'NODE-LICENSE.txt')
    shutil.copytree(root / 'server', runtime / 'server', ignore=shutil.ignore_patterns('*.log', '.DS_Store'))
    shutil.copytree(root / 'dist/client', runtime / 'dist/client')
    (runtime / 'package.json').write_text('{"private":true,"type":"module"}\n')
    digest = hashlib.sha256()
    for file in sorted(runtime.rglob('*')):
        if not file.is_file():
            continue
        digest.update(file.relative_to(runtime).as_posix().encode() + b'\0')
        with file.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
    (runtime / 'manifest.json').write_text(json.dumps({
        'version': version, 'node': info['version'], 'sha256': digest.hexdigest(),
    }, sort_keys=True) + '\n')
    shutil.copy2(root / 'macos/runtime/setup.mjs', resources / 'setup.mjs')
