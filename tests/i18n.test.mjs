import test from 'node:test';
import assert from 'node:assert/strict';
import { messages, translate, languageFor } from '../src/i18n/catalog.js';

test('all supported translations retain interpolation fields and unsupported locales fall back safely', () => {
  const fields = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [source, translations] of Object.entries(messages)) {
    assert.equal(translations.length, 2, source);
    for (const translated of translations) {
      assert.ok(translated.length > 0, source);
      assert.deepEqual(fields(translated), fields(source), source);
    }
  }
  assert.equal(languageFor('unsupported'), 'en');
  assert.equal(translate('en', 'Settings'), 'Settings');
  assert.equal(translate('zh-CN', 'Settings'), '设置');
  assert.equal(translate('zh-TW', 'Settings'), '設定');
  assert.equal(translate('zh-CN', '{count} session logs', { count: 0 }), '0 个会话日志');
  assert.equal(translate('zh-TW', '{count} session logs', { count: 0 }), '0 個工作階段紀錄');
  assert.equal(translate('unsupported', 'Settings'), 'Settings');
});
