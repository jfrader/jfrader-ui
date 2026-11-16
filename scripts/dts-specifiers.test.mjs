import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteFile, resolveSpecifier } from './rewrite-dts-specifiers.mjs';

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'dts-specifiers-'));
  mkdirSync(path.join(root, 'nested'));
  writeFileSync(path.join(root, 'leaf.d.ts'), 'export declare const leaf: 1;\n');
  writeFileSync(path.join(root, 'nested', 'index.d.ts'), 'export declare const nested: 1;\n');
  const entry = path.join(root, 'entry.d.ts');
  writeFileSync(entry, [
    "export * from './leaf';",
    "export * from './nested';",
    "export type { X } from './leaf.js';",
    'export declare const y: import("./leaf").X;',
    '',
  ].join('\n'));
  return { root, entry };
}

test('resolves a declaration file and a directory index', () => {
  const { root, entry } = fixture();
  try {
    assert.equal(resolveSpecifier(entry, './leaf').specifier, './leaf.js');
    assert.equal(resolveSpecifier(entry, './nested').specifier, './nested/index.js');
    assert.equal(resolveSpecifier(entry, './leaf.js'), null);
    assert.equal(resolveSpecifier(entry, './missing').unresolved, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rewrites re-exports and type imports, and leaves explicit extensions alone', () => {
  const { root, entry } = fixture();
  try {
    const result = rewriteFile(entry);
    assert.deepEqual(result.unresolved, []);
    const output = readFileSync(entry, 'utf8');
    assert.match(output, /from '\.\/leaf\.js';/);
    assert.match(output, /from '\.\/nested\/index\.js';/);
    assert.match(output, /from '\.\/leaf\.js';/);
    assert.match(output, /import\("\.\/leaf\.js"\)/);
    assert.equal((output.match(/\.js\.js/g) ?? []).length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reports an unresolved specifier instead of writing a broken path', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'dts-specifiers-'));
  try {
    const entry = path.join(root, 'entry.d.ts');
    writeFileSync(entry, "export * from './nowhere';\n");
    const result = rewriteFile(entry);
    assert.deepEqual(result.unresolved, ['./nowhere']);
    assert.equal(readFileSync(entry, 'utf8'), "export * from './nowhere';\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
