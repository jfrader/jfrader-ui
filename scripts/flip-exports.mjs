// Switches packages' `exports` between the repo layout (`src`, consumed by the workspace) and the
// publish layout (`dist`). Usage: node scripts/flip-exports.mjs <src|dist> [--package ui|tokens].
// Defaults to both packages. If packing fails after prepack, restore with node scripts/flip-exports.mjs src.
// Idempotent; fails without
// writing when an entry matches neither layout or a target file of the requested layout is missing.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const LAYOUTS = ['src', 'dist'];
const packagesDir = path.join(import.meta.dirname, '..', 'packages');

const uiLayouts = (subpath) => {
  const name = subpath === '.' ? 'index' : subpath.slice('./'.length);
  const source = subpath === '.' ? './src/index.ts' : `./src/components/${name}/index.ts`;
  const types = subpath === '.' ? './dist/types/index.d.ts' : `./dist/types/components/${name}/index.d.ts`;
  return {
    src: { types: source, import: source },
    dist: { types, import: `./dist/${name}.js` },
  };
};

const tokensLayouts = {
  '.': {
    src: './src/index.ts',
    dist: { types: './dist/types/index.d.ts', import: './dist/index.js' },
  },
  './vars': {
    src: './src/generated/vars.ts',
    dist: { types: './dist/types/generated/vars.d.ts', import: './dist/generated/vars.js' },
  },
  './tokens.css': { src: './dist/tokens.css', dist: './dist/tokens.css' },
  './base.css': { src: './base.css', dist: './base.css' },
};

const packages = [
  { dir: 'ui', layoutsOf: uiLayouts },
  { dir: 'tokens', layoutsOf: (subpath) => tokensLayouts[subpath] },
];

const targetsOf = (entry) => (typeof entry === 'string' ? [entry] : Object.values(entry));

const inline = (entry) =>
  typeof entry === 'string'
    ? JSON.stringify(entry)
    : `{ ${Object.entries(entry).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(', ')} }`;

// Standard 2-space JSON with one line per export, matching the checked-in package.json files.
const serialize = (manifest) => {
  const exportsBlock = Object.entries(manifest.exports)
    .map(([subpath, entry]) => `    ${JSON.stringify(subpath)}: ${inline(entry)}`)
    .join(',\n');
  const placeholder = '__FLIP_EXPORTS__';
  return `${JSON.stringify({ ...manifest, exports: placeholder }, null, 2).replace(
    JSON.stringify(placeholder),
    () => `{\n${exportsBlock}\n  }`,
  )}\n`;
};

const [layout, ...args] = process.argv.slice(2);
const scopedPackage = args.length === 2 && args[0] === '--package'
  ? packages.find(({ dir }) => dir === args[1])
  : undefined;
if (!LAYOUTS.includes(layout) || (args.length > 0 && !scopedPackage)) {
  console.error(`usage: node scripts/flip-exports.mjs <${LAYOUTS.join('|')}> [--package ui|tokens]`);
  process.exit(1);
}

const errors = [];
const writes = [];

for (const { dir, layoutsOf } of scopedPackage ? [scopedPackage] : packages) {
  const packageDir = path.join(packagesDir, dir);
  const manifestPath = path.join(packageDir, 'package.json');
  const current = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(current);
  if (typeof manifest.exports !== 'object' || manifest.exports === null) {
    errors.push(`${manifest.name}: package.json has no exports map`);
    continue;
  }

  const flipped = Object.fromEntries(
    Object.entries(manifest.exports).map(([subpath, entry]) => {
      const layouts = layoutsOf(subpath);
      if (!layouts || !LAYOUTS.some((name) => isDeepStrictEqual(entry, layouts[name]))) {
        errors.push(`${manifest.name}: export "${subpath}" matches neither the src nor the dist layout`);
        return [subpath, entry];
      }
      for (const target of targetsOf(layouts[layout])) {
        if (!existsSync(path.join(packageDir, target))) {
          errors.push(`${manifest.name}: export "${subpath}" ${layout} target ${target} does not exist`);
        }
      }
      return [subpath, layouts[layout]];
    }),
  );

  const next = serialize({ ...manifest, exports: flipped });
  if (next !== current) writes.push([manifestPath, next]);
}

if (errors.length > 0) {
  console.error(`flip-exports: ${errors.length} problem(s), nothing written\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}

for (const [manifestPath, contents] of writes) writeFileSync(manifestPath, contents);

console.log(`flip-exports: ${layout} layout, ${writes.length} package.json file(s) rewritten`);
