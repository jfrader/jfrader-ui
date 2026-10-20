import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paintOrb } from './orb-painter.ts';

const palette = {
  accent: 'accent', highlight: 'highlight', shadow: 'shadow', light: 'light',
  listening: 'cyan', thinking: 'indigo', speaking: 'rose',
};

function geometry(phase, activity, amplitude, expression, clouds) {
  const calls = [];
  const drawing = new Proxy({}, {
    get: (_, key) => (...args) => {
      calls.push([key, ...args]);
      if (String(key).startsWith('create')) return {
        addColorStop: (...stop) => calls.push(['addColorStop', ...stop]),
      };
    },
    set: (_, key, value) => { calls.push([key, value]); return true; },
  });
  paintOrb(drawing, 300, phase, activity, amplitude, palette, expression, clouds);
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

test('state clouds tint the interior without replacing the violet body or rim', () => {
  for (const [state, color] of [['listening', 'cyan'], ['thinking', 'indigo'], ['speaking', 'rose']]) {
    const calls = geometry(1, 0.5, 0.65, 0.4, { [state]: 1 });
    assert.ok(calls.some(([name, stop, value]) => name === 'addColorStop' && stop === 0 && value === color));
    assert.ok(calls.some(([name, stop, value]) => name === 'addColorStop' && stop === 0.36 && value === 'accent'));
    assert.ok(calls.some(([name, stop, value]) => name === 'addColorStop' && stop === 1 && value === 'accent'));
    assert.equal(calls.filter(([name]) => name === 'clip').length, 1, 'clouds stay inside the shell');
  }
});

test('cloud weights crossfade independently at a shared phase and gather/release internally', () => {
  const from = geometry(1, 0.5, 0.65, 0.4, { listening: 1 });
  const blended = geometry(1, 0.5, 0.65, 0.4, { listening: 0.6, thinking: 0.4 });
  const to = geometry(1, 0.5, 0.65, 0.4, { thinking: 1 });
  const tints = (calls) => calls.filter(([name, stop, color]) => name === 'addColorStop' && stop === 0 && ['cyan', 'indigo', 'rose'].includes(color));
  assert.equal(tints(from).length, 2);
  assert.equal(tints(blended).length, 4);
  assert.equal(tints(to).length, 2);
  const opacity = (calls, color) => {
    const first = calls.findIndex(([name, stop, value]) => name === 'addColorStop' && stop === 0 && value === color);
    return calls.slice(first).find(([name]) => name === 'globalAlpha')[1];
  };
  assert.equal(opacity(blended, 'cyan'), opacity(from, 'cyan') * 0.6);
  assert.equal(opacity(blended, 'indigo'), opacity(to, 'indigo') * 0.4);
  for (const name of ['scale', 'rotate', 'bezierCurveTo']) {
    assert.deepEqual(blended.filter(([key]) => key === name), from.filter(([key]) => key === name), 'tint does not reset the filament phase');
  }
  const clouds = (calls) => calls.filter(([name]) => name === 'createRadialGradient').slice(4, 6);
  assert.notDeepEqual(clouds(from), clouds(to), 'thinking gathers a denser cloud than listening');
  assert.notDeepEqual(clouds(to), clouds(geometry(2, 0.5, 0.65, 0.4, { thinking: 1 })), 'clouds breathe within a state');
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
