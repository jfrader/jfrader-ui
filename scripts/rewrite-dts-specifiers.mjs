// Rewrites relative module specifiers in emitted declaration files to explicit `.js` paths.
//
// `tsc` emits declarations with the specifiers used in `src/`, which are extensionless because
// the repo resolves with `moduleResolution: "bundler"`. The packages declare `"type": "module"`,
// so a consumer under `node16`/`nodenext` cannot resolve those specifiers: wildcard re-exports
// silently drop every name. Vite already writes explicit `.js` in the runtime bundles; this
// script makes the declaration tree match.
//
// Usage: node scripts/rewrite-dts-specifiers.mjs <declaration-dir> [...more]
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JS_EXTENSIONS = ['.js', '.mjs', '.cjs', '.json'];
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}(?:\/[^'"]*)?)\2/g;

/** Resolves one relative specifier to the declaration it points at. */
export function resolveSpecifier(fromFile, specifier) {
  if (JS_EXTENSIONS.some((extension) => specifier.endsWith(extension))) return null;
  const base = path.dirname(fromFile);
  const file = path.resolve(base, `${specifier}.d.ts`);
  if (existsSync(file)) return { specifier: `${specifier}.js`, target: file };
  const directoryIndex = path.resolve(base, specifier, 'index.d.ts');
  if (existsSync(directoryIndex)) return { specifier: `${specifier}/index.js`, target: directoryIndex };
  return { unresolved: true };
}

export function rewriteFile(file) {
  const source = readFileSync(file, 'utf8');
  const unresolved = [];
  const rewritten = source.replace(SPECIFIER, (match, prefix, quote, specifier) => {
    const result = resolveSpecifier(file, specifier);
    if (!result) return match;
    if (result.unresolved) {
      unresolved.push(specifier);
      return match;
    }
    return `${prefix}${quote}${result.specifier}${quote}`;
  });
  if (unresolved.length) return { file, unresolved };
  if (rewritten !== source) writeFileSync(file, rewritten);
  return { file, unresolved: [] };
}

function declarationFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return declarationFiles(target);
    return entry.name.endsWith('.d.ts') ? [target] : [];
  });
}

export function main(roots) {
  const failures = [];
  let rewritten = 0;
  for (const root of roots) {
    if (!existsSync(root) || !statSync(root).isDirectory()) {
      failures.push(`${root}: not a directory`);
      continue;
    }
    for (const file of declarationFiles(root)) {
      const before = readFileSync(file, 'utf8');
      const result = rewriteFile(file);
      if (result.unresolved.length) failures.push(`${file}: unresolved ${result.unresolved.join(', ')}`);
      else if (readFileSync(file, 'utf8') !== before) rewritten += 1;
    }
  }
  if (failures.length) {
    console.error(failures.join('\n'));
    return 1;
  }
  console.log(`dts-specifiers: rewrote ${rewritten} declaration files`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const roots = process.argv.slice(2);
  if (roots.length === 0) {
    console.error('usage: node scripts/rewrite-dts-specifiers.mjs <declaration-dir> [...more]');
    process.exit(1);
  }
  process.exit(main(roots));
}
