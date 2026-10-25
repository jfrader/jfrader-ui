import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { findUnwiredKeys } from './verify-slot-wiring.mjs';
import { componentDirectory } from './component-directory.mjs';

function fixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'slot-wiring-'));
  for (const [name, source] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), source);
  }
  return root;
}

const family = (body) => `packages/ui/src/components/widget/widget.tsx`;

test('package re-exports keep the owning component in slot verification', (t) => {
  const root = fixture({
    'components/widget/index.ts': "export { Widget } from '@jfrader/fixture/widget';\n",
    'node_modules/@jfrader/fixture/package.json': JSON.stringify({
      name: '@jfrader/fixture', type: 'module',
      exports: { './widget': { types: './src/widget/index.ts', import: './src/widget/index.ts' } },
    }),
    'node_modules/@jfrader/fixture/src/widget/index.ts': "export { Widget } from './widget';\n",
    'node_modules/@jfrader/fixture/src/widget/widget.tsx': 'export interface WidgetSlots {\n  header?: ComponentType<X>;\n}\n',
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'components/widget');
  const owner = path.join(root, 'node_modules/@jfrader/fixture/src/widget');
  assert.equal(componentDirectory(directory), owner);
  assert.deepEqual(findUnwiredKeys(path.join(root, 'components')), [{ family: 'widget', unwired: ['header'] }]);
  writeFileSync(path.join(owner, 'index.ts'), "export { Widget } from '@jfrader/fixture/widget';\n");
  assert.throws(() => componentDirectory(directory), /Circular component re-export/);
  writeFileSync(path.join(directory, 'index.ts'), "export { Widget } from '@jfrader/missing/widget';\n");
  assert.throws(() => componentDirectory(directory), /Cannot resolve component re-export/);
});

test('a declared key that the family renders passes', () => {
  const root = fixture({
    [family()]: `export interface WidgetSlots {\n  header?: ComponentType<X>;\n}\nexport const W = ({ slots }) => <Header />;\nconst Header = slots?.header ?? 'div';\n`,
  });
  try {
    assert.deepEqual(findUnwiredKeys(path.join(root, 'packages/ui/src/components')), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a declared key that nothing renders is reported', () => {
  const root = fixture({
    [family()]: `export interface WidgetSlots {\n  header?: ComponentType<X>;\n  footer?: ComponentType<X>;\n}\nconst Header = slots?.header ?? 'div';\n`,
  });
  try {
    assert.deepEqual(findUnwiredKeys(path.join(root, 'packages/ui/src/components')), [{ family: 'widget', unwired: ['footer'] }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a key rendered from a sibling file counts', () => {
  const root = fixture({
    'packages/ui/src/components/widget/widget-chrome.tsx': `const Header = slots?.header ?? 'div';\n`,
    [family()]: `export interface WidgetSlots {\n  header?: ComponentType<X>;\n}\n`,
  });
  try {
    assert.deepEqual(findUnwiredKeys(path.join(root, 'packages/ui/src/components')), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a dynamic lookup counts when the key is named as a literal', () => {
  const root = fixture({
    [family()]: `export interface WidgetSlots {\n  next?: ComponentType<X>;\n  previous?: ComponentType<X>;\n}\nconst parts = ['next', 'previous'];\nconst Part = slots?.[part] ?? 'button';\n`,
  });
  try {
    assert.deepEqual(findUnwiredKeys(path.join(root, 'packages/ui/src/components')), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a local alias of the slots map counts', () => {
  const root = fixture({
    [family()]: `export interface WidgetSlots {\n  presets?: ComponentType<X>;\n}\nconst Presets = contentSlots?.presets ?? 'div';\n`,
  });
  try {
    assert.deepEqual(findUnwiredKeys(path.join(root, 'packages/ui/src/components')), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the root seam and the internal customization bags are exempt', () => {
  const root = fixture({
    [family()]: `export interface WidgetSlots {\n  root?: ComponentType<X>;\n  component?: ComponentType<X>;\n}\n`,
  });
  try {
    assert.deepEqual(findUnwiredKeys(path.join(root, 'packages/ui/src/components')), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('stories do not satisfy a declaration', () => {
  const root = fixture({
    'packages/ui/src/components/widget/widget.stories.tsx': `const x = <Widget slots={{ header: H }} />;\n`,
    [family()]: `export interface WidgetSlots {\n  header?: ComponentType<X>;\n}\n`,
  });
  try {
    assert.deepEqual(findUnwiredKeys(path.join(root, 'packages/ui/src/components')), [{ family: 'widget', unwired: ['header'] }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
