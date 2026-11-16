// Fails when a published declaration file keeps a relative specifier without an explicit
// JavaScript extension. Consumers using `node16` or `nodenext` cannot resolve those, and a
// wildcard re-export then silently loses every name.
//
// Usage: node scripts/verify-dts-specifiers.mjs [packages-dir]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}(?:\/[^'"]*)?)\2/g;
const JS_EXTENSIONS = ['.js', '.mjs', '.cjs', '.json'];
const packagesDir = process.argv[2] ?? path.join(import.meta.dirname, '..', 'packages');

function declarationFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return declarationFiles(target);
    return entry.name.endsWith('.d.ts') ? [target] : [];
  });
}

const failures = [];
let checked = 0;
for (const packageName of readdirSync(packagesDir)) {
  const typesDir = path.join(packagesDir, packageName, 'dist', 'types');
  if (!existsSync(typesDir)) continue;
  for (const file of declarationFiles(typesDir)) {
    checked += 1;
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(SPECIFIER)) {
      const specifier = match[3];
      if (JS_EXTENSIONS.some((extension) => specifier.endsWith(extension))) continue;
      failures.push(`${path.relative(packagesDir, file)}: extensionless specifier "${specifier}"`);
    }
  }
}

if (failures.length) {
  console.error(`dts-specifiers: ${failures.length} unresolved specifier(s)`);
  console.error(failures.slice(0, 40).join('\n'));
  process.exit(1);
}
console.log(`dts-specifiers: ${checked} declaration files use explicit specifiers`);
