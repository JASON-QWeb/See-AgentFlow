import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutFromURL, normalizeLayout, sceneSize } from '../src/screensaver/layout.js';
import { packets, packetProgress, flowPoint } from '../src/screensaver/mobiusGeometry.js';

test('single display fills one world; dual viewports share the exact seam and packet clock', () => {
  const single = normalizeLayout({}, { width: 1920, height: 1080 });
  assert.equal(single.worldWidth, 1920);
  assert.equal(single.count, 1);
  const first = normalizeLayout({ width: 1920, height: 1080, worldWidth: 3840, count: 2, mainX: 1920, isMain: 0 });
  const second = normalizeLayout({ ...first, x: 1920, index: 1, isMain: 1 });
  assert.deepEqual(sceneSize(first), { width: 1920, height: 833 });
  assert.deepEqual(sceneSize(second), sceneSize(single));
  for (const particle of packets) {
    const t = packetProgress(particle, 1731000000125);
    const left = flowPoint(particle, t, first.worldWidth, 833);
    const right = flowPoint(particle, t, second.worldWidth, 833);
    assert.deepEqual(left, right);
    assert.ok(Math.abs((left[0] - first.x) - (right[0] - second.x) - 1920) < 1e-9);
  }
});

test('left and right dispatch move outward and the shared clock wraps continuously', () => {
  for (const particle of packets) {
    const start = flowPoint(particle, 0, 3840, 833), end = flowPoint(particle, 1, 3840, 833);
    assert.ok((end[0] - start[0]) * particle.side > 0);
    assert.ok(Math.abs(packetProgress(particle, 120001) - packetProgress(particle, 1)) < 1e-10);
  }
});

test('screen removal and offset layouts produce a new bounded viewport', () => {
  const offset = layoutFromURL('?x=1920&y=120&width=1920&height=1080&worldWidth=3840&worldHeight=1200&count=2&index=1');
  assert.equal(offset.y, 120);
  assert.equal(offset.count, 2);
  assert.deepEqual(normalizeLayout({}, { width: 2560, height: 1440 }), {
    width: 2560, height: 1440, x: 0, y: 0, worldWidth: 2560, worldHeight: 1440, index: 0, count: 1,
    mainX: 0, mainY: 0, mainWidth: 2560, mainHeight: 1440, isMain: 1,
  });
});
