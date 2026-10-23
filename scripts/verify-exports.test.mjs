import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const gate = readFileSync(path.join(import.meta.dirname, 'verify-exports.mjs'), 'utf8');
const sourceEntry = (target) => ({ types: target, import: target });

function runFixture(mutate = () => {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'verify-exports-'));
  const manifest = {
    exports: {
      '.': sourceEntry('./src/index.ts'),
      './button': sourceEntry('./src/components/button/index.ts'),
      './code-block': sourceEntry('./src/components/code-block/index.ts'),
      './code-block/shiki': sourceEntry('./src/components/code-block/shiki.ts'),
      './person-avatar': sourceEntry('./src/components/person-avatar/index.ts'),
      './person-avatar/appearance': sourceEntry('./src/components/person-avatar/appearance.ts'),
      './person-avatar/kit': sourceEntry('./src/components/person-avatar/kit.ts'),
      // Subpath-only by design (GURI-2359): must NOT be required in the barrel.
      './game-card': sourceEntry('./src/components/game-card/index.ts'),
    },
    sideEffects: false,
    peerDependencies: { react: '^19.0.0', 'react-dom': '^19.0.0', shiki: '^4.4.3' },
    peerDependenciesMeta: { shiki: { optional: true } },
  };
  const fixture = { manifest, index: "export * from './components/button';\nexport * from './components/code-block';\nexport * from './components/person-avatar';\n" };
  mutate(fixture);
  try {
    mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    writeFileSync(path.join(dir, 'scripts/verify-exports.mjs'), gate);
    for (const file of ['src/components/button/index.ts', 'src/components/code-block/index.ts', 'src/components/code-block/shiki.ts', 'src/components/game-card/index.ts', 'src/components/person-avatar/index.ts', 'src/components/person-avatar/appearance.ts', 'src/components/person-avatar/kit.ts']) {
      const target = path.join(dir, 'packages/ui', file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, 'export {};\n');
    }
    writeFileSync(path.join(dir, 'packages/ui/src/index.ts'), fixture.index);
    writeFileSync(path.join(dir, 'packages/ui/package.json'), JSON.stringify(manifest));
    return spawnSync(process.execPath, [path.join(dir, 'scripts/verify-exports.mjs')], { encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('accepts complete source exports', () => assert.equal(runFixture().status, 0));

for (const [name, mutate, message] of [
  ['missing subpath', ({ manifest }) => { delete manifest.exports['./button']; }, /export "\.\/button"/],
  ['missing kit subpath', ({ manifest }) => { delete manifest.exports['./person-avatar/kit']; }, /export "\.\/person-avatar\/kit"/],
  ['wrong existing target', ({ manifest }) => { manifest.exports['./button'] = manifest.exports['./code-block']; }, /export "\.\/button"/],
  ['missing types condition', ({ manifest }) => { delete manifest.exports['./button'].types; }, /types then import/],
  ['types after import', ({ manifest }) => { manifest.exports['./button'] = { import: './src/components/button/index.ts', types: './src/components/button/index.ts' }; }, /types before import/],
  ['missing barrel export', (fixture) => { fixture.index = "export * from './components/code-block';\n"; }, /re-export all values and types.*button/],
  ['type-only barrel export', (fixture) => { fixture.index = fixture.index.replace('export *', 'export type *'); }, /re-export all values and types.*button/],
  ['nonoptional shiki', ({ manifest }) => { manifest.peerDependenciesMeta.shiki.optional = false; }, /optional peer/],
  ['side effects drift', ({ manifest }) => { manifest.sideEffects = true; }, /sideEffects must be false/],
  ['unsupported react peer', ({ manifest }) => { manifest.peerDependencies.react = '^18.0.0'; }, /react peer range/],
  ['unexpected internal export', ({ manifest }) => { manifest.exports['./utils'] = manifest.exports['.']; }, /unexpected export/],
  ['missing file', ({ manifest }) => { manifest.exports['./button'].import = './missing.ts'; }, /missing file/],
]) {
  test(`rejects ${name}`, () => {
    const result = runFixture(mutate);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, message);
  });
}
