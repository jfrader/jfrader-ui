import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const fixture = (t) => {
  const dir = mkdtempSync('/tmp/opencode/release-tooling-');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

const packed = (dir, overrides = {}, missing = false) => {
  mkdirSync(path.join(dir, 'package'), { recursive: true });
  const manifest = { name: '@jfrader/tokens', version: '0.5.1', exports: { '.': './index.js' } };
  writeFileSync(path.join(dir, 'expected.json'), JSON.stringify(manifest));
  writeFileSync(path.join(dir, 'package/package.json'), JSON.stringify({ ...manifest, ...overrides }));
  if (!missing) writeFileSync(path.join(dir, 'package/index.js'), 'export {};');
  execFileSync('tar', ['-czf', path.join(dir, 'artifact.tgz'), '-C', dir, 'package']);
  return manifest;
};

const publish = (dir) => spawnSync(process.execPath, [
  path.join(root, 'scripts/publish-registry.mjs'), path.join(dir, 'artifact.tgz'),
  'https://registry.example.test', path.join(dir, 'expected.json'),
], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}` }, timeout: 10000 });

for (const [label, overrides, missing] of [
  ['wrong name', { name: '@jfrader/ui' }, false],
  ['wrong version', { version: '0.5.2' }, false],
  ['private package', { private: true }, false],
  ['missing exported file', {}, true],
  ['empty exports', { exports: {} }, false],
]) {
  test(`publish rejects ${label} before contacting npm`, (t) => {
    const dir = fixture(t);
    packed(dir, overrides, missing);
    writeFileSync(path.join(dir, 'npm'), '#!/bin/sh\ntouch "' + path.join(dir, 'called') + '"\n', { mode: 0o755 });
    const result = publish(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Artifact/);
    assert.throws(() => readFileSync(path.join(dir, 'called')));
  });
}

test('publish skips an identical existing artifact', (t) => {
  const dir = fixture(t);
  packed(dir);
  writeFileSync(path.join(dir, 'npm'), `#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
if (process.argv[2] !== 'view') process.exit(99);
console.log(JSON.stringify('sha512-' + createHash('sha512').update(readFileSync(${JSON.stringify(path.join(dir, 'artifact.tgz'))})).digest('base64')));
`, { mode: 0o755 });
  writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const result = publish(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /already has the verified artifact/);
});

test('publish rejects an existing different artifact', (t) => {
  const dir = fixture(t);
  packed(dir);
  writeFileSync(path.join(dir, 'npm'), '#!/bin/sh\necho \'"sha512-other"\'\n', { mode: 0o755 });
  const result = publish(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /different integrity/);
});

test('publish sends a new artifact once and verifies its integrity', (t) => {
  const dir = fixture(t);
  packed(dir);
  writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  writeFileSync(path.join(dir, 'npm'), `#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const marker = ${JSON.stringify(path.join(dir, 'published'))};
if (process.argv[2] === 'publish') {
  if (existsSync(marker)) process.exit(99);
  writeFileSync(marker, JSON.stringify(process.argv.slice(2)));
} else if (!existsSync(marker)) {
  console.error('E404 Not Found'); process.exit(1);
} else {
  console.log(JSON.stringify('sha512-' + createHash('sha512').update(readFileSync(${JSON.stringify(path.join(dir, 'artifact.tgz'))})).digest('base64')));
}
`, { mode: 0o755 });
  const result = publish(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /verified @jfrader\/tokens@0.5.1/);
  const args = JSON.parse(readFileSync(path.join(dir, 'published'), 'utf8'));
  assert.ok(args.includes('--ignore-scripts'));
  assert.ok(args.includes('--registry=https://registry.example.test'));
});

const flipFixture = (dir) => {
  mkdirSync(path.join(dir, 'scripts'));
  copyFileSync(path.join(root, 'scripts/flip-exports.mjs'), path.join(dir, 'scripts/flip-exports.mjs'));
  for (const name of ['ui', 'tokens']) {
    const packageDir = path.join(dir, 'packages', name);
    mkdirSync(path.join(packageDir, 'src'), { recursive: true });
    mkdirSync(path.join(packageDir, 'dist/types'), { recursive: true });
    for (const file of ['src/index.ts', 'dist/index.js', 'dist/types/index.d.ts']) {
      writeFileSync(path.join(packageDir, file), '');
    }
    writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ name, exports: {
      '.': name === 'ui' ? { types: './src/index.ts', import: './src/index.ts' } : './src/index.ts',
    } }));
  }
};
const flip = (dir, ...args) => spawnSync(process.execPath, [path.join(dir, 'scripts/flip-exports.mjs'), ...args], { encoding: 'utf8' });

test('flip dry-run does not mutate; repeated flips are idempotent; src restores exports', (t) => {
  const dir = fixture(t);
  flipFixture(dir);
  const manifestPath = path.join(dir, 'packages/ui/package.json');
  const before = readFileSync(manifestPath, 'utf8');
  assert.equal(flip(dir, 'dist', '--dry-run').status, 0);
  assert.equal(readFileSync(manifestPath, 'utf8'), before);
  assert.equal(flip(dir, 'dist').status, 0);
  const dist = readFileSync(manifestPath, 'utf8');
  assert.equal(flip(dir, 'dist').status, 0);
  assert.equal(readFileSync(manifestPath, 'utf8'), dist);
  assert.equal(flip(dir, 'src').status, 0);
  assert.deepEqual(JSON.parse(readFileSync(manifestPath, 'utf8')), JSON.parse(before));
});

test('flip rejects directory targets without mutating either package', (t) => {
  const dir = fixture(t);
  flipFixture(dir);
  const manifestPath = path.join(dir, 'packages/ui/package.json');
  const before = readFileSync(manifestPath, 'utf8');
  const target = path.join(dir, 'packages/tokens/dist/index.js');
  rmSync(target);
  mkdirSync(target);
  assert.notEqual(flip(dir, 'dist').status, 0);
  assert.equal(readFileSync(manifestPath, 'utf8'), before);
});

test('flip restores earlier writes when a later write fails', (t) => {
  const dir = fixture(t);
  flipFixture(dir);
  const manifestPath = path.join(dir, 'packages/ui/package.json');
  const before = readFileSync(manifestPath, 'utf8');
  const preload = path.join(dir, 'fail-write.mjs');
  writeFileSync(preload, `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const original = fs.writeFileSync;
let failed = false;
fs.writeFileSync = (file, ...args) => {
  if (!failed && String(file).endsWith('tokens/package.json')) { failed = true; throw new Error('injected write failure'); }
  return original(file, ...args);
};
syncBuiltinESMExports();`);
  const result = spawnSync(process.execPath, ['--import', preload, path.join(dir, 'scripts/flip-exports.mjs'), 'dist'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /attempted to restore/);
  assert.equal(readFileSync(manifestPath, 'utf8'), before);
});
