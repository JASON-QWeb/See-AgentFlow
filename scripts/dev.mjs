import { spawn } from 'node:child_process';

const collector = spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit' });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...process.argv.slice(2)], { stdio: 'inherit' });
const stop = () => { collector.kill('SIGTERM'); vite.kill('SIGTERM'); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
collector.on('exit', code => { if (code) { vite.kill('SIGTERM'); process.exitCode = code; } });
vite.on('exit', code => { collector.kill('SIGTERM'); process.exitCode = code || 0; });
