/**
 * Internal geometry gate. Run from apps/storybook; requires a running Storybook.
 * Measures getBoundingClientRect(): transformed viewport-aligned border boxes, NOT ink,
 * shadows, rounded corners or curved silhouettes. Negative edge distances mean overflow.
 * Default contracts: inside the surface and no pair overlap, with 1 CSS px tolerance.
 * Symmetry/alignment/edge placement are opt-in: arbitrary layouts need not be symmetric.
 * Exit 0 = contracts pass, 1 = measured violation, 2 = invalid input/render/measurement error.
 * Example: node scripts/measure-geometry.mjs games-gametable--desktop-dark \
 *   --surface '[data-ui="theme-root"]:nth-child(1) [data-game-surface]' \
 *   --items '[data-ui="theme-root"]:nth-child(1) [data-ui="game-table-seat"]'
 */
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const HELP = `Usage: node scripts/measure-geometry.mjs <storyId> [options]
  --surface <selector>     Exactly one surface (default: #storybook-root)
  --items <selector>       Document-scoped items (default: surface's direct children)
  --viewport <WxH>         CSS pixels (default: 1440x900)
  --dir <ltr|rtl>          Direction on document and surface (default: ltr)
  --screenshot <path>      Optional full-page PNG
  --base-url <url>         Storybook origin (default: http://localhost:6006)
  --tolerance <px>         Nonnegative tolerance (default: 1)
  --inset-percent <0..50>  Surface inset per dimension (default: 0)
  --mirror-axis <axis>    Require vertical (left/right), horizontal (top/bottom), or both
  --align <edge>           Require left/right/top/bottom/center-x/center-y alignment
  --edge-distance <px>    Require minimum signed edge clearance (negative: =-10)
  --args <string>         Storybook args URL parameter
  --help                  Show this help
All measurements are viewport border-box AABBs, not curved/painted outlines.
Inside and no-overlap always checked. Symmetry tables report nearest reflected
partner (self allowed for centered items); only --mirror-axis makes this a gate.
Exit codes: 0 pass, 1 contract violation, 2 usage or measurement error.`;
const AXES = ['vertical', 'horizontal'];
const EDGES = ['left', 'right', 'top', 'bottom', 'center-x', 'center-y'];
const TIMEOUT_MS = 15_000;

export function parseOptions(args) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    help: { type: 'boolean' },
    ...Object.fromEntries(['surface', 'items', 'viewport', 'dir', 'screenshot', 'base-url', 'tolerance',
      'inset-percent', 'mirror-axis', 'align', 'edge-distance', 'args'].map((key) => [key, { type: 'string' }])),
  } });
  if (values.help) return { help: true };
  if (positionals.length !== 1 || !/^[\w-]+--[\w-]+$/.test(positionals[0])) throw new Error('Provide one storyId, e.g. games-gametable--default');
  const size = /^(\d+)x(\d+)$/.exec(values.viewport ?? '1440x900');
  if (!size || Number(size[1]) < 1 || Number(size[2]) < 1) throw new Error('Invalid viewport; expected positive WxH');
  const number = (key, fallback) => {
    if (values[key] === undefined) return fallback;
    const value = Number(values[key]);
    if (!values[key].trim() || !Number.isFinite(value)) throw new Error(`Invalid --${key}: ${values[key]}`);
    return value;
  };
  const tolerance = number('tolerance', 1);
  const inset = number('inset-percent', 0);
  if (tolerance < 0 || inset < 0 || inset > 50) throw new Error('Tolerance must be >=0; inset-percent must be 0..50');
  const dir = values.dir ?? 'ltr';
  if (!['ltr', 'rtl'].includes(dir)) throw new Error('Invalid --dir');
  if (values['mirror-axis'] && ![...AXES, 'both'].includes(values['mirror-axis'])) throw new Error('Invalid --mirror-axis');
  if (values.align && !EDGES.includes(values.align)) throw new Error('Invalid --align');
  const base = new URL(values['base-url'] ?? 'http://localhost:6006');
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('base-url must be HTTP(S)');
  for (const key of ['surface', 'items', 'screenshot']) {
    if (values[key] !== undefined && !values[key].trim()) throw new Error(`Empty --${key}`);
  }
  const url = new URL('iframe.html', `${base.href.replace(/\/$/, '')}/`);
  url.searchParams.set('id', positionals[0]);
  url.searchParams.set('viewMode', 'story');
  if (values.args) url.searchParams.set('args', values.args);
  return {
    storyId: positionals[0], url: url.href, surface: values.surface ?? '#storybook-root', items: values.items,
    viewport: { width: Number(size[1]), height: Number(size[2]) }, dir, tolerance, inset,
    axes: values['mirror-axis'] === 'both' ? AXES : values['mirror-axis'] ? [values['mirror-axis']] : [],
    align: values.align, edgeDistance: number('edge-distance', undefined), screenshot: values.screenshot,
  };
}

export function assessGeometry(surface, items, options) {
  const { tolerance, inset, axes = [], align, edgeDistance } = options;
  const failures = [];
  for (const [index, box] of [surface, ...items].entries()) {
    if (!['left', 'top', 'right', 'bottom', 'width', 'height'].every((key) => Number.isFinite(box[key])) || box.width <= 0 || box.height <= 0) {
      throw new Error(`Empty/invalid box ${index}: ${JSON.stringify(box)}`);
    }
  }
  if (!items.length) throw new Error('No items to measure');
  const rows = items.map((box, index) => {
    const distances = { left: box.left - surface.left, right: surface.right - box.right,
      top: box.top - surface.top, bottom: surface.bottom - box.bottom };
    for (const [edge, distance] of Object.entries(distances)) {
      const clearance = distance - (['left', 'right'].includes(edge) ? surface.width : surface.height) * inset / 100;
      if (clearance < -tolerance) failures.push(`item ${index} ${edge} clearance=${clearance.toFixed(3)}px after ${inset}% inset`);
    }
    const nearest = Math.min(...Object.values(distances));
    if (edgeDistance !== undefined && Math.abs(nearest - edgeDistance) > tolerance) {
      failures.push(`item ${index} nearest edge=${nearest.toFixed(3)}px; expected=${edgeDistance}px; delta=${(nearest - edgeDistance).toFixed(3)}px`);
    }
    return { item: index, label: box.label ?? '', x: box.left, y: box.top, width: box.width, height: box.height,
      'edge L': distances.left, 'edge R': distances.right, 'edge T': distances.top, 'edge B': distances.bottom };
  });
  const pairs = [];
  for (const [i, a] of items.entries()) for (let j = i + 1; j < items.length; j++) {
    const b = items[j];
    const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    pairs.push({ pair: `${i}/${j}`, 'center Δx': b.left + b.width / 2 - a.left - a.width / 2,
      'center Δy': b.top + b.height / 2 - a.top - a.height / 2, 'overlap x': overlapX, 'overlap y': overlapY });
    if (Math.min(overlapX, overlapY) > tolerance) failures.push(`items ${i}/${j} overlap=${overlapX.toFixed(3)}×${overlapY.toFixed(3)}px`);
  }
  const mirrors = [];
  for (const axis of AXES) for (const [i, a] of items.entries()) {
    const targetX = axis === 'vertical' ? surface.left + surface.right - a.right : a.left;
    const targetY = axis === 'horizontal' ? surface.top + surface.bottom - a.bottom : a.top;
    const candidates = items.map((b, j) => {
      const deltas = { 'Δx': b.left - targetX, 'Δy': b.top - targetY, 'Δw': b.width - a.width, 'Δh': b.height - a.height };
      return { item: i, axis, partner: j, ...deltas, residual: Math.max(...Object.values(deltas).map(Math.abs)) };
    });
    const nearest = candidates.reduce((a, b) => a.residual <= b.residual ? a : b);
    mirrors.push(nearest);
    if (axes.includes(axis) && nearest.residual > tolerance) failures.push(`item ${i} ${axis} nearest mirror=${nearest.partner}; residual=${nearest.residual.toFixed(3)}px`);
  }
  if (align) {
    if (items.length < 2) throw new Error('Alignment requires at least two items');
    const coordinates = items.map((box) => ({ ...box, 'center-x': box.left + box.width / 2, 'center-y': box.top + box.height / 2 })[align]);
    const spread = Math.max(...coordinates) - Math.min(...coordinates);
    if (spread > tolerance) failures.push(`alignment ${align}: spread=${spread.toFixed(3)}px`);
  }
  return { rows, pairs, mirrors, failures };
}

async function measure(options) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: options.viewport, reducedMotion: 'reduce' });
    page.setDefaultTimeout(TIMEOUT_MS);
    await page.goto(options.url);
    await page.locator('#storybook-root > *').first().waitFor();
    const surface = page.locator(options.surface);
    await surface.first().waitFor();
    if (await surface.count() !== 1) throw new Error(`Surface must match exactly once; matched ${await surface.count()}`);
    await page.evaluate(({ surface, dir }) => {
      document.documentElement.dir = dir;
      document.querySelector(surface).setAttribute('dir', dir);
    }, options);
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    await page.waitForFunction(() => [...document.images].every((image) => image.complete));
    await page.waitForFunction(({ surface, items }) => {
      const frame = document.querySelector(surface);
      const elements = items ? [...document.querySelectorAll(items)] : [...frame.children];
      if (!elements.length) throw new Error('Items selector matched 0 elements');
      const measured = [frame, ...elements];
      const signature = JSON.stringify(measured.map((element) => element.getBoundingClientRect().toJSON()));
      const pending = measured.some((element) => element.getAnimations({ subtree: true }).some((animation) =>
        animation.playState === 'running' && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))));
      const state = window.__geometryMeasurement ?? { signature: '', stable: 0 };
      state.stable = !pending && signature === state.signature ? state.stable + 1 : 0;
      state.signature = signature;
      window.__geometryMeasurement = state;
      return state.stable >= 3;
    }, options, { polling: 'raf', timeout: TIMEOUT_MS });
    const measurement = await page.evaluate(({ surface, items }) => {
      const frame = document.querySelector(surface);
      const elements = items ? [...document.querySelectorAll(items)] : [...frame.children];
      const box = (element) => ({ ...element.getBoundingClientRect().toJSON(),
        label: element.getAttribute('data-slot-key') ?? element.getAttribute('data-ui') ?? element.tagName });
      return { surface: box(frame), items: elements.map(box) };
    }, options);
    if (options.screenshot) await page.screenshot({ path: options.screenshot, fullPage: true });
    return measurement;
  } finally {
    await browser.close();
  }
}

export async function main(args) {
  try {
    const options = parseOptions(args);
    if (options.help) { console.log(HELP); return 0; }
    const { surface, items } = await measure(options);
    const result = assessGeometry(surface, items, options);
    console.log(`${options.storyId} | ${options.viewport.width}×${options.viewport.height} | ${options.dir} | tolerance=${options.tolerance}px`);
    console.log(`Surface: x=${surface.left.toFixed(3)} y=${surface.top.toFixed(3)} width=${surface.width.toFixed(3)} height=${surface.height.toFixed(3)} (viewport border box)`);
    for (const [heading, rows] of [['Items (CSS px)', result.rows], ['Pairs (negative overlap = gap)', result.pairs], ['Nearest reflected box (self permitted)', result.mirrors]]) {
      console.log(heading);
      console.table(rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'number' ? Number(value.toFixed(3)) : value]))));
    }
    for (const failure of result.failures) console.error(`FAIL: ${failure}; tolerance=${options.tolerance}px`);
    console.log(`${result.failures.length ? 'FAIL' : 'PASS'}: inside + no-overlap${options.axes.length ? ` + mirror ${options.axes.join('/')}` : ''}${options.align ? ` + align ${options.align}` : ''}${options.edgeDistance !== undefined ? ` + nearest edge ${options.edgeDistance}px` : ''}`);
    return result.failures.length ? 1 : 0;
  } catch (error) {
    console.error(`measure-geometry: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2));
