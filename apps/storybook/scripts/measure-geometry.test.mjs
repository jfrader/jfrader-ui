import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assessGeometry, main, parseOptions } from './measure-geometry.mjs';

const box = (left, top, width = 20, height = 20) => ({ left, top, width, height, right: left + width, bottom: top + height });
const surface = box(100, 200, 200, 100);
const defaults = { tolerance: 1, inset: 0 };
const assess = (items, options = {}) => assessGeometry(surface, items, { ...defaults, ...options });

test('parses defaults, explicit contracts and URL parameters', () => {
  const defaults = parseOptions(['games-gametable--default']);
  assert.deepEqual(defaults.viewport, { width: 1440, height: 900 });
  assert.equal(defaults.tolerance, 1);
  assert.deepEqual(defaults.axes, []);
  const options = parseOptions(['games-gametable--default', '--viewport', '390x844', '--dir', 'rtl',
    '--mirror-axis', 'both', '--args', 'places:2', '--edge-distance=-10', '--base-url', 'http://localhost:1234/docs/']);
  assert.deepEqual(options.axes, ['vertical', 'horizontal']);
  assert.equal(options.edgeDistance, -10);
  assert.equal(new URL(options.url).searchParams.get('args'), 'places:2');
  assert.equal(new URL(options.url).pathname, '/docs/iframe.html');
  assert.deepEqual(parseOptions(['--help']), { help: true });
});

test('rejects invalid inputs instead of silently disabling checks', () => {
  for (const args of [[], ['bad'], ['x--y', 'extra'], ['x--y', '--unknown'], ...[
    ['viewport', '0x900'], ['viewport', 'a'], ['dir', 'bad'], ['tolerance', '-1'],
    ['tolerance', 'NaN'], ['inset-percent', '51'], ['surface', ''], ['items', ''],
    ['mirror-axis', 'x'], ['align', 'x'], ['base-url', 'file:///tmp'], ['edge-distance', ''],
  ].map(([key, value]) => ['x--y', `--${key}`, value])]) assert.throws(() => parseOptions(args));
});

test('translated surface: inside, aligned, mirrored, nonoverlapping boxes pass', () => {
  assert.deepEqual(assess([box(110, 210), box(270, 210)], { axes: ['vertical'], align: 'top', edgeDistance: 10 }).failures, []);
  assert.deepEqual(assess([box(110, 210), box(110, 270)], { axes: ['horizontal'] }).failures, []);
});

test('inset, containment and touching/penetration use CSS pixel tolerance', () => {
  assert.deepEqual(assess([box(99, 210)]).failures, []);
  assert.match(assess([box(98, 210)]).failures.join(), /left clearance=-2.000px/);
  assert.match(assess([box(110, 210)], { inset: 10 }).failures.join(), /clearance=-10.000px/);
  assert.deepEqual(assess([box(110, 210), box(130, 210)]).failures, []);
  assert.deepEqual(assess([box(110, 210), box(129, 210)]).failures, []);
  assert.match(assess([box(110, 210), box(128, 210)]).failures.join(), /overlap=2.000×20.000px/);
});

test('reports offsets, symmetry deltas and placement without assuming symmetry', () => {
  const items = [box(110, 210), box(269, 212)];
  const result = assess(items);
  assert.deepEqual(result.failures, []);
  assert.equal(result.pairs[0]['center Δx'], 159);
  assert.equal(result.pairs[0]['center Δy'], 2);
  assert.equal(result.mirrors[0]['Δx'], -1);
  assert.equal(result.mirrors[0]['Δy'], 2);
  assert.match(assess(items, { axes: ['vertical'] }).failures.join(), /residual=2.000px/);
  assert.match(assess(items, { align: 'top' }).failures.join(), /spread=2.000px/);
  assert.match(assess(items, { edgeDistance: 0 }).failures.join(), /delta=10.000px/);
});

test('symmetry includes width and height; centered items can mirror themselves', () => {
  assert.deepEqual(assess([box(190, 210)], { axes: ['vertical'] }).failures, []);
  assert.match(assess([box(110, 210), box(270, 210, 20, 22)], { axes: ['vertical'] }).failures.join(), /residual=2.000px/);
});

test('empty, hidden or invalid geometry cannot pass vacuously', () => {
  assert.throws(() => assess([]), /No items/);
  assert.throws(() => assess([box(0, 0, 0)]), /Empty\/invalid/);
  assert.throws(() => assess([box(NaN, 0)]), /Empty\/invalid/);
  assert.throws(() => assess([box(110, 210)], { align: 'left' }), /at least two/);
});

test('isolated browser: actual exit statuses, RTL, selector errors and screenshot', async (context) => {
  const output = [];
  for (const method of ['log', 'error', 'table']) context.mock.method(console, method, (...args) => output.push(...args));
  const directory = await mkdtemp(join(tmpdir(), 'measure-geometry-'));
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(`<div id="storybook-root"><div class="surface" style="position:relative;width:200px;height:120px">
      <span class="item" style="position:absolute;inset-inline-start:10px;top:10px;width:20px;height:20px">A</span>
      <span class="item" style="position:absolute;inset-inline-end:10px;top:10px;width:20px;height:20px">B</span>
      </div></div>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const args = ['fixture--default', '--base-url', `http://127.0.0.1:${server.address().port}`, '--surface', '.surface', '--items', '.item'];
  try {
    const screenshot = join(directory, 'geometry.png');
    assert.equal(await main([...args, '--dir', 'rtl', '--mirror-axis', 'vertical', '--screenshot', screenshot]), 0);
    assert.ok((await stat(screenshot)).size > 0);
    assert.equal(await main([...args, '--edge-distance', '0']), 1);
    assert.ok(output.some((line) => typeof line === 'string' && line.includes('delta=10.000px')));
    assert.equal(await main([...args, '--items', '.missing']), 2);
    assert.ok(output.some((line) => typeof line === 'string' && line.includes('matched 0')));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
