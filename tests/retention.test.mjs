import test from 'node:test';
import assert from 'node:assert/strict';
import { retainRecentEvents, DISPLAY_EVENT_LIMIT, DISPLAY_EVENT_AGE } from '../src/eventRetention.js';
import { realRecords } from './real-records.mjs';

test('a long replay of real records stays bounded, deduplicates and expires without new arrivals', async t => {
  const rows = await realRecords('codex');
  if (!rows.length) return t.skip('Local transcripts unavailable');
  let events = [], now = Date.now();
  for (let index = 0; index < 3600; index++) {
    now += 500;
    const item = rows[index % rows.length].items[0];
    const event = { ...item, id: `retention-test:${index}`, preview: item.text.slice(0, 700), text: undefined, receivedAt: now };
    events = retainRecentEvents(events, [event], now);
    assert.ok(events.length <= DISPLAY_EVENT_LIMIT);
    assert.equal(events.at(-1), event);
    assert.equal(retainRecentEvents(events, [event], now), events, 'Repeated snapshots do not append or rerender');
  }
  assert.equal(events.length, DISPLAY_EVENT_LIMIT);
  const first = events[0], last = events.at(-1);
  const partial = retainRecentEvents(events, [], first.receivedAt + DISPLAY_EVENT_AGE);
  assert.ok(partial.length > 0 && partial.length < events.length);
  assert.equal(partial.at(-1), last);
  assert.deepEqual(retainRecentEvents(partial, [], last.receivedAt + DISPLAY_EVENT_AGE), []);
  assert.deepEqual(retainRecentEvents([], [first], now + DISPLAY_EVENT_AGE), []);
});
