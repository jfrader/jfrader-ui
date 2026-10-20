import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paintOrb } from './orb-painter.ts';

const palette = { accent: 'accent', highlight: 'highlight', shadow: 'shadow', light: 'light' };

function geometry(phase, activity, amplitude, expression) {
  const calls = [];
  const gradient = { addColorStop() {} };
  const drawing = new Proxy({}, {
    get: (_, key) => (...args) => {
      calls.push([key, ...args]);
      if (String(key).startsWith('create')) return gradient;
    },
  });
  paintOrb(drawing, 300, phase, activity, amplitude, palette, expression);
  return calls;
}

test('steady speaking visibly reshapes the volume while idle and listening stay restrained', () => {
  const extent = (activity, expression) => {
    const scales = Array.from({ length: 40 }, (_, frame) =>
      geometry(frame / 20, activity, 0.65, expression).find(([name]) => name === 'scale')?.[1] ?? 1,
    );
    return Math.max(...scales) - Math.min(...scales);
  };
  assert.equal(extent(0, 0), 0, 'idle has no rhythmic shape change');
  assert.ok(extent(0.35, 0.18) < 0.035, 'listening remains attentive, not emphatic');
  assert.ok(extent(0.75, 1) > 0.15, 'speaking must move the silhouette at a steady output level');
});

test('consumer output level modulates speaking geometry without supplying an audio waveform', () => {
  const width = (level) => geometry(Math.PI / 4, 0.75, level, 1)
    .find(([name]) => name === 'scale')?.[1] ?? 1;
  assert.ok(width(1) - width(0) > 0.035, 'level increases the extent of the state motion');
  for (const level of [0, 0.25, 0.65, 1]) {
    const arcs = geometry(1, 0.75, level, 1).filter(([name]) => name === 'arc');
    assert.equal(arcs.at(-1)[3], 300 * (0.32 + level * 0.035));
  }
});
