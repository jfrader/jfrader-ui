// Checks component subpaths, barrel re-exports, source targets and package peer/side-effect policy.
// Validates the repo (src) layout only; the publish (dist) layout is validated after a build by
// scripts/flip-exports.mjs and the `npm pack --dry-run` check in the package READMEs.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const packageDir = path.join(import.meta.dirname, '..', 'packages', 'ui');
const componentsDir = path.join(packageDir, 'src', 'components');
const manifest = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
const exportsMap = manifest.exports ?? {};
const index = readFileSync(path.join(packageDir, 'src/index.ts'), 'utf8');
const reexports = new Set(Array.from(
  index.matchAll(/^export \* from ['"]([^'"]+)['"];\s*$/gm),
  (match) => match[1],
));

const targetsOf = (entry) =>
  typeof entry === 'string' ? [entry] : Object.values(entry ?? {}).flatMap(targetsOf);

const errors = [];
const expectedExports = new Map([
  ['.', './src/index.ts'],
  ['./code-block/shiki', './src/components/code-block/shiki.ts'],
]);

if (manifest.sideEffects !== false) errors.push('sideEffects must be false');
for (const peer of ['react', 'react-dom']) {
  if (manifest.peerDependencies?.[peer] !== '^19.0.0') errors.push(`${peer} peer range must be ^19.0.0`);
}
if (!manifest.peerDependencies?.shiki || manifest.peerDependenciesMeta?.shiki?.optional !== true) {
  errors.push('shiki must be an optional peer dependency');
}

// Components published as opt-in subpaths only, deliberately absent from the root barrel:
// game/app pieces (GURI-2359) and the next adapter, whose optional peers must stay out of the
// main graph. Every other public component must be re-exported from src/index.ts.
const subpathOnlyComponents = new Set([
  'card-flights',
  'deck',
  'flip-game-card',
  'game-actions',
  'game-card',
  'game-card-stack',
  'game-hand',
  'game-result',
  'game-marks',
  'game-rounds',
  'game-score',
  'game-seat',
  'game-table',
  'next',
  'scene',
]);

for (const dirent of readdirSync(componentsDir, { withFileTypes: true })) {
  // Internal implementation folders (e.g. field/) have no index.ts and are not public.
  const isComponent =
    dirent.isDirectory() && existsSync(path.join(componentsDir, dirent.name, 'index.ts'));
  if (isComponent) {
    expectedExports.set(`./${dirent.name}`, `./src/components/${dirent.name}/index.ts`);
    if (!subpathOnlyComponents.has(dirent.name) && !reexports.has(`./components/${dirent.name}`)) {
      errors.push(`src/index.ts must re-export all values and types from ./components/${dirent.name}`);
    }
  }
}

for (const [subpath, target] of expectedExports) {
  if (!isDeepStrictEqual(exportsMap[subpath], { types: target, import: target })) {
    errors.push(`export "${subpath}" must have types then import pointing at ${target}`);
  } else if (Object.keys(exportsMap[subpath])[0] !== 'types') {
    errors.push(`export "${subpath}" must list types before import`);
  }
}

for (const [subpath, entry] of Object.entries(exportsMap)) {
  if (!expectedExports.has(subpath)) errors.push(`unexpected export "${subpath}"`);
  const targets = targetsOf(entry);
  if (targets.length === 0) {
    errors.push(`export "${subpath}" has no string targets`);
  }
  for (const target of targets) {
    try {
      if (!statSync(path.join(packageDir, target)).isFile()) {
        errors.push(`export "${subpath}" points at a non-file target ${target}`);
      }
    } catch {
      errors.push(`export "${subpath}" points at missing file ${target}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`verify-exports: ${errors.length} problem(s) in @jfrader/ui\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}

console.log(`verify-exports: ${Object.keys(exportsMap).length} @jfrader/ui exports OK`);
