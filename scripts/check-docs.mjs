// Public docs must have working local links and images, and stay off the fullscreen-lock feature.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const notes = existsSync('docs/release-notes') ? readdirSync('docs/release-notes').map(name => join('docs/release-notes', name)) : [];
const documents = ['README.md', 'docs/TECHNICAL.md', ...notes];
const withheld = /密码|密碼|解锁|解鎖|全屏锁定|password|fullscreen lock/i;
const problems = [];

for (const document of documents) {
  const text = readFileSync(document, 'utf8');
  if (withheld.test(text)) problems.push(`${document}: mentions a withheld feature (${text.match(withheld)[0]})`);
  const targets = [...text.matchAll(/\]\(([^)\s]+)\)|\bsrc="([^"]+)"/g)].map(match => match[1] || match[2]);
  for (const target of targets) {
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    if (!existsSync(join(dirname(document), target.split('#')[0]))) problems.push(`${document}: broken link ${target}`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`PASS: ${documents.length} public documents, links resolve and nothing withheld`);
