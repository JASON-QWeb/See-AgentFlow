import { readFileSync, statSync } from 'node:fs';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

const options = { theme: ['mint', 'paper', 'white'], language: ['en', 'zh-CN', 'zh-TW'] };
const valid = value => value && !Array.isArray(value) && typeof value === 'object'
  && Object.keys(value).length > 0 && Object.entries(value).every(([key, next]) => Object.hasOwn(options, key) && options[key].includes(next));

export function createPreferences(file) {
  let value = { theme: 'mint', language: 'en' }, writes = Promise.resolve();
  try {
    if (file && statSync(file).size <= 1024) {
      const saved = JSON.parse(readFileSync(file, 'utf8'));
      for (const key of Object.keys(options)) if (options[key].includes(saved?.[key])) value[key] = saved[key];
    }
  } catch { /* Missing or invalid app preferences use the original theme. */ }
  return {
    read: () => ({ ...value }),
    set(next) {
      if (!valid(next)) return Promise.reject(new Error('Unknown preference'));
      const patch = { ...next };
      // Only this tiny app-preference file is writable; source transcripts remain read-only.
      writes = writes.catch(() => {}).then(async () => {
        // Merge inside the queue so concurrent theme/language changes cannot overwrite one another.
        const saved = { ...value, ...patch };
        if (file) {
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file + '.tmp', JSON.stringify(saved) + '\n', { mode: 0o600 });
          await rename(file + '.tmp', file);
        }
        value = saved;
        return { ...value };
      });
      return writes;
    },
  };
}

export async function readPreferencesRequest(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') return { status: 415, error: 'JSON required' };
  let body = '', size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size <= 1024) body += chunk;
  }
  if (size > 1024) return { status: 413, error: 'Preference request too large' };
  try {
    const value = JSON.parse(body);
    if (!valid(value)) throw new Error();
    return value;
  } catch { return { status: 400, error: 'Unknown preference' }; }
}
