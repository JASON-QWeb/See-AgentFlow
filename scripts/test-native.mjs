// Compiles and runs the native layout and preferences suites. Neither shows or activates a window.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

if (process.platform !== 'darwin') {
  console.log('SKIP: native tests require macOS');
  process.exit(0);
}
mkdirSync('artifacts', { recursive: true });
const app = name => `macos/AgentOpsSaver/${name}.swift`;
const suites = {
  'layout-tests': [app('DisplayLayout'), 'macos/Tests/LayoutTests.swift'],
  'preferences-tests': ['DisplayLayout', 'SaverWebView', 'AgentOpsSaverView', 'DesktopPreferences', 'FloatingChrome', 'FloatingDashboard',
    'LockPasswordStore', 'LockState', 'LockPromptView', 'PasswordSettingsSheet', 'AppLockCoordinator', 'RuntimeSetup'].map(app)
    .concat('macos/Tests/PreferencesTests.swift'),
};
for (const [name, files] of Object.entries(suites)) {
  const compiled = spawnSync('xcrun', ['swiftc', '-swift-version', '5', '-parse-as-library', '-framework', 'AppKit', '-framework', 'WebKit',
    '-framework', 'Security', '-framework', 'ScreenSaver', ...files, '-o', `artifacts/${name}`], { stdio: 'inherit' });
  if (compiled.status !== 0) process.exit(compiled.status || 1);
  const tested = spawnSync(`artifacts/${name}`, [], { stdio: 'inherit' });
  if (tested.status !== 0) process.exit(tested.status ?? 1);
}
