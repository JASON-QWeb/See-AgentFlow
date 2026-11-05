import { readFileSync, statSync } from 'node:fs';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

const valid = theme => theme === 'mint' || theme === 'paper';

export function createPreferences(file) {
  let theme = 'mint', writes = Promise.resolve();
  try {
    if (file && statSync(file).size <= 1024) {
      const saved = JSON.parse(readFileSync(file, 'utf8'));
      if (valid(saved.theme)) theme = saved.theme;
    }
  } catch { /* Missing or invalid app preferences use the original theme. */ }
  return {
    read: () => ({ theme }),
    set(next) {
      if (!valid(next)) return Promise.reject(new Error('Unknown theme'));
      // Only this tiny app-preference file is writable; source transcripts remain read-only.
      writes = writes.catch(() => {}).then(async () => {
        if (file) {
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file + '.tmp', JSON.stringify({ theme: next }) + '\n', { mode: 0o600 });
          await rename(file + '.tmp', file);
        }
        theme = next;
        return { theme };
      });
      return writes;
    },
  };
}

export async function readThemeRequest(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') return { status: 415, error: 'JSON required' };
  let body = '', size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size <= 1024) body += chunk;
  }
  if (size > 1024) return { status: 413, error: 'Preference request too large' };
  try {
    const value = JSON.parse(body);
    if (!value || Object.keys(value).length !== 1 || !valid(value.theme)) throw new Error();
    return { theme: value.theme };
  } catch { return { status: 400, error: 'Unknown theme preference' }; }
}
