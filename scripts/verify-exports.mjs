// Fails when a packages/ui component folder has no `./<name>` export, or an export points at a missing file.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const packageDir = path.join(import.meta.dirname, '..', 'packages', 'ui');
const componentsDir = path.join(packageDir, 'src', 'components');
const { exports: exportsMap = {} } = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));

const targetsOf = (entry) =>
  typeof entry === 'string' ? [entry] : Object.values(entry ?? {}).flatMap(targetsOf);

const errors = [];

for (const dirent of readdirSync(componentsDir, { withFileTypes: true })) {
  // Internal implementation folders (e.g. field/) have no index.ts and are not public.
  const isComponent =
    dirent.isDirectory() && existsSync(path.join(componentsDir, dirent.name, 'index.ts'));
  if (isComponent && !(`./${dirent.name}` in exportsMap)) {
    errors.push(`missing export "./${dirent.name}" for src/components/${dirent.name}`);
  }
}

for (const [subpath, entry] of Object.entries(exportsMap)) {
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
