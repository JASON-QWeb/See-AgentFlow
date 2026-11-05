import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

if (process.platform !== 'darwin') {
  console.log('SKIP: native lock verification requires macOS');
  process.exit(0);
}
mkdirSync('artifacts', { recursive: true });
const files = ['LockPasswordStore', 'LockState', 'DesktopPreferences', 'DisplayLayout', 'SaverWebView',
  'LockPromptView', 'PasswordSettingsSheet', 'AppLockCoordinator'].map(name => `macos/AgentOpsSaver/${name}.swift`);
const compiled = spawnSync('xcrun', ['swiftc', '-O', '-swift-version', '5', '-framework', 'AppKit',
  '-framework', 'WebKit', '-framework', 'Security', '-parse-as-library', ...files,
  'tests/native/LockTests.swift', '-o', 'artifacts/native-lock-tests'], { stdio: 'inherit' });
if (compiled.status !== 0) process.exit(compiled.status || 1);
// All windows stay offscreen, with no activation or presentation-option changes.
const tested = spawnSync('artifacts/native-lock-tests', [], { stdio: 'inherit' });
process.exit(tested.status ?? 1);
