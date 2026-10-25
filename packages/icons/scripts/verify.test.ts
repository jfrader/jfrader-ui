import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { metadata } from '../src/metadata';
import { geometryPoints, pathPoints } from './geometry';
import { artifacts, collect, parseSvg, readSources } from './sources';
import { verify } from './verify';

const root = fileURLToPath(new URL('..', import.meta.url));
const search = readFileSync(join(root, 'src/icons/search.svg'), 'utf8');

for (const [name, change, message] of [
  ['wrong viewBox', (svg: string) => svg.replace('0 0 24 24', '0 0 16 16'), /root attributes/],
  ['stray transform', (svg: string) => svg.replace('<path ', '<path transform="translate(1)" '), /forbidden attribute/],
  ['three-decimal coordinate', (svg: string) => svg.replace('15.1', '15.123'), /two decimals/],
  ['painted line fill', (svg: string) => svg.replace('<path ', '<path fill="currentColor" '), /painted fill/],
  ['out-of-bounds circle', (svg: string) => svg.replace('r="6.5"', 'r="10"'), /outside/],
  ['forbidden element', (svg: string) => svg.replace('<circle', '<ellipse'), /forbidden element/],
  ['forbidden color', (svg: string) => svg.replace('<path ', '<path stroke="#000" '), /forbidden/],
  ['malformed path', (svg: string) => svg.replace('M15.1 15.1 20 20', 'M15 15L20'), /incomplete/],
] as const) {
  test(`rejects ${name}`, () => assert.throws(() => parseSvg(change(search), 'line'), message));
}

test('all eight real seeds and generated exports pass', () => {
  const names = new Set(readSources(root).filter((source) => source.variant === 'line').map((source) => source.name));
  for (const name of ['chart', 'home', 'lock', 'play', 'search', 'send', 'settings', 'wallet']) assert.ok(names.has(name));
  assert.deepEqual(verify(root), []);
});

test('missing metadata, mismatched names, and orphaned entries fail', () => {
  const { search: ignored, ...withoutSearch } = metadata;
  assert.match([...collect(readSources(root), withoutSearch).errors.values()].flat().join('\n'), /missing metadata entry/);
  assert.match([...collect(readSources(root), { ...metadata, search: { ...metadata.search!, name: 'find' } }).errors.values()].flat().join('\n'), /metadata name/);
  assert.match([...collect(readSources(root), { ...metadata, orphan: { ...metadata.search!, name: 'orphan' } }).errors.values()].flat().join('\n'), /orphaned/);
});

test('duplicate path data fails independently of whitespace', () => {
  const sources = readSources(root);
  const original = sources.find((source) => source.name === 'play')!;
  const duplicate = { ...original, name: 'other', file: 'other.svg', svg: original.svg.replace('M8.5 4.5', 'M 8.5,4.5') };
  const result = collect([...sources, duplicate], { ...metadata, other: { ...metadata.play!, name: 'other' } });
  assert.match([...result.errors.values()].flat().join('\n'), /duplicate path data/);
});

test('solid style has no stroke details and line style is complete', () => {
  const solid = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M4 4H20V20H4Z"/></svg>';
  assert.equal(parseSvg(solid, 'solid').length, 1);
  assert.throws(() => parseSvg(solid.replace('<path ', '<path stroke-width="1.5" '), 'solid'), /stroke attributes/);
  assert.throws(() => parseSvg(search.replace(' stroke-linejoin="round"', ''), 'line'), /root attributes/);
});

test('solid companions generate beside the line component and update metadata', () => {
  const source = { name: 'play', file: 'solid/play.svg', variant: 'solid' as const, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M9 5 18 12 9 19Z"/></svg>' };
  const files = artifacts([...readSources(root), source], metadata);
  const play = files.get('src/generated/play.tsx')!;
  assert.match(play, /export const PlaySolid = createSvgIcon\(/);
  assert.match(play, /'Icons\.PlaySolid', \{ variant: 'solid' \}/);
  assert.match(play, /import \{ createSvgIcon \} from '@jfrader\/ui\/svg-icon';/);
  assert.match(files.get('src/generated/index.ts')!, /export \{ Play, PlaySolid \}/);
  const table = JSON.parse(files.get('icons.json')!);
  assert.deepEqual(table.find((entry: { name: string }) => entry.name === 'play').variants, ['line', 'solid']);
  assert.equal(table.find((entry: { name: string }) => entry.name === 'search').category, 'action');
});

test('curve and arc extrema use geometry rather than control-point bounds', () => {
  const points = pathPoints('M4 12C4 0 20 0 20 12');
  assert.equal(Math.min(...points.map((point) => point[1])), 3);
  assert.equal(Math.min(...pathPoints('M8 10V7A4 4 0 0 1 16 7V10').map((point) => point[1])), 3);
  assert.equal(Math.max(...pathPoints('M4 12Q12 40 20 12').map((point) => point[1])), 26);
  assert.deepEqual(geometryPoints('rect', { x: '2', y: '3', width: '20', height: '18' }), [[2, 3], [22, 21]]);
});

test('missing components, stale output, barrel omissions, and broken subpaths fail', () => {
  const directory = mkdtempSync(join(tmpdir(), 'icons-verify-'));
  try {
    cpSync(join(root, 'src'), join(directory, 'src'), { recursive: true });
    cpSync(join(root, 'icons.json'), join(directory, 'icons.json'));
    cpSync(join(root, 'package.json'), join(directory, 'package.json'));
    rmSync(join(directory, 'src/generated/search.tsx'));
    writeFileSync(join(directory, 'src/generated/index.ts'), '');
    writeFileSync(join(directory, 'src/index.ts'), '');
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
    manifest.exports['./*'].import = './missing/*.tsx';
    writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest));
    const errors = verify(directory).join('\n');
    for (const pattern of [/missing generated file/, /stale generated file/, /invalid export/, /does not resolve/, /missing generated index/]) assert.match(errors, pattern);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
