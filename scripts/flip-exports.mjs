// Switches packages' `exports` between the repo layout (`src`, consumed by the workspace) and the
// publish layout (`dist`). Usage: node scripts/flip-exports.mjs <src|dist> [--package <name>].
// Defaults to all packages. If packing fails after prepack, restore with node scripts/flip-exports.mjs src.
// Idempotent; fails without
// writing when an entry matches neither layout or a target file of the requested layout is missing.
import { globSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const LAYOUTS = ['src', 'dist'];
const packagesDir = path.join(import.meta.dirname, '..', 'packages');

// `./<component>` maps to the component's index; `./<component>/<module>` to an opt-in module
// beside it (e.g. `./code-block/shiki`).
const uiLayouts = (subpath) => {
  const name = subpath === '.' ? 'index' : subpath.slice('./'.length);
  const module = name.includes('/') ? name : `${name}/index`;
  const source = subpath === '.' ? './src/index.ts' : `./src/components/${module}.ts`;
  const types = subpath === '.' ? './dist/types/index.d.ts' : `./dist/types/components/${module}.d.ts`;
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
  { dir: 'styling', layoutsOf: (subpath) => {
    const name = subpath === '.' ? 'index' : subpath.slice(2);
    if (!['index', 'css', 'sx', 'native-scrollbar', 'theme', 'media'].includes(name)) return;
    return {
      src: `./src/${name}.${name === 'sx' ? 'tsx' : 'ts'}`,
      dist: { types: `./dist/types/${name}.d.ts`, import: `./dist/${name}.js` },
    };
  } },
  { dir: 'icons', layoutsOf: (subpath) => {
    const asset = { './metadata': 'icons.json', './sprite.svg': 'sprite.svg', './paths.json': 'paths.json' }[subpath];
    if (asset) return { src: `./${asset}`, dist: `./dist/${asset}` };
    const name = { '.': 'index', './svg-icon': 'svg-icon/index', './*': 'generated/*' }[subpath];
    if (!name) return;
    const source = `./src/${name}.${subpath === './*' ? 'tsx' : 'ts'}`;
    return {
      src: { types: source, import: source },
      dist: { types: `./dist/types/${name}.d.ts`, import: `./dist/${name}.js` },
    };
  } },
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

const [layout, ...rawArgs] = process.argv.slice(2);
const dryRun = rawArgs.includes('--dry-run');
const args = rawArgs.filter((arg) => arg !== '--dry-run');
const scopedPackage = args.length === 2 && args[0] === '--package'
  ? packages.find(({ dir }) => dir === args[1])
  : undefined;
if (!LAYOUTS.includes(layout) || (args.length > 0 && !scopedPackage)) {
  console.error(`usage: node scripts/flip-exports.mjs <${LAYOUTS.join('|')}> [--package ${packages.map(({ dir }) => dir).join('|')}] [--dry-run]`);
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
      const requestedTargets = targetsOf(layouts[layout]);
      let targets = requestedTargets;
      if (subpath.includes('*')) {
        const source = targetsOf(layouts.src)[0];
        const [prefix, suffix] = source.split('*');
        const sources = globSync(source, { cwd: packageDir });
        if (sources.length === 0) errors.push(`${manifest.name}: export "${subpath}" has no source files`);
        targets = sources.flatMap((file) => {
          const relative = `./${file}`;
          const name = relative.slice(prefix.length, -suffix.length);
          return requestedTargets.map((target) => target.replace('*', name));
        });
      }
      for (const target of targets) {
        if (!statSync(path.join(packageDir, target), { throwIfNoEntry: false })?.isFile()) {
          errors.push(`${manifest.name}: export "${subpath}" ${layout} target ${target} does not exist`);
        }
      }
      return [subpath, layouts[layout]];
    }),
  );

  const next = serialize({ ...manifest, exports: flipped });
  if (next !== current) writes.push([manifestPath, next, current]);
}

if (errors.length > 0) {
  console.error(`flip-exports: ${errors.length} problem(s), nothing written\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}

if (!dryRun) {
  const attempted = [];
  try {
    for (const [manifestPath, contents, original] of writes) {
      attempted.push([manifestPath, original]);
      writeFileSync(manifestPath, contents);
    }
  } catch (error) {
    const failures = [error];
    for (const [manifestPath, original] of attempted.reverse()) {
      try { writeFileSync(manifestPath, original); } catch (restoreError) { failures.push(restoreError); }
    }
    throw new AggregateError(failures, 'flip-exports failed; attempted to restore original manifests');
  }
}

console.log(`flip-exports: ${layout} layout, ${writes.length} package.json file(s) ${dryRun ? 'would be rewritten' : 'rewritten'}`);
