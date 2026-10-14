import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const packageDir = path.resolve(import.meta.dirname, '..');
const generate = (t, base, light) => {
  const dir = mkdtempSync('/tmp/opencode/token-generator-');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(path.join(dir, 'scripts'));
  mkdirSync(path.join(dir, 'src'));
  copyFileSync(path.join(import.meta.dirname, 'generate.ts'), path.join(dir, 'scripts/generate.ts'));
  writeFileSync(path.join(dir, 'src/tokens.ts'), `export const base = ${JSON.stringify(base)};\nexport const light = ${JSON.stringify(light)};`);
  const run = () => spawnSync(path.join(packageDir, 'node_modules/.bin/tsx'), [path.join(dir, 'scripts/generate.ts')], { encoding: 'utf8' });
  return { dir, run };
};

test('nested groups emit matching CSS and var references deterministically', (t) => {
  const { dir, run } = generate(t, { motion: { duration: { fast: '120ms' } }, color: { text: '#fff' } }, { color: { text: '#000' } });
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const css = readFileSync(path.join(dir, 'dist/tokens.css'), 'utf8');
  const vars = readFileSync(path.join(dir, 'src/generated/vars.ts'), 'utf8');
  assert.match(css, /--ui-motion-duration-fast: 120ms;/);
  assert.match(vars, /var\(--ui-motion-duration-fast\)/);
  assert.match(css, /\[data-theme='light'\] \{\n  --ui-color-text: #000;/);
  assert.equal(run().status, 0);
  assert.equal(readFileSync(path.join(dir, 'dist/tokens.css'), 'utf8'), css);
  assert.equal(readFileSync(path.join(dir, 'src/generated/vars.ts'), 'utf8'), vars);
});

for (const [label, base, light, message] of [
  ['base collisions', { fooBar: 'a', 'foo-bar': 'b' }, {}, /base: duplicate/],
  ['nested path collisions', { foo: { bar: 'a' }, 'foo-bar': 'b' }, {}, /base: duplicate/],
  ['light collisions', { fooBar: 'a' }, { fooBar: 'b', 'foo-bar': 'c' }, /light: duplicate/],
  ['orphan overrides', { foo: 'a' }, { bar: 'b' }, /no counterpart in base/],
]) {
  test(`rejects ${label} before generating files`, (t) => {
    const { dir, run } = generate(t, base, light);
    const result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, message);
    assert.throws(() => readFileSync(path.join(dir, 'dist/tokens.css')));
    assert.throws(() => readFileSync(path.join(dir, 'src/generated/vars.ts')));
  });
}
