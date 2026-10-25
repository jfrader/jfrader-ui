import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metadata } from '../src/metadata';
import { artifacts, collect, readSources, type MetadataSource } from './sources';

export function verify(root: string, entries: MetadataSource = metadata): string[] {
  const sources = readSources(root);
  const { errors, fail } = collect(sources, entries);
  if (!errors.size) {
    const files = artifacts(sources, entries);
    for (const [file, contents] of files) {
      const target = join(root, file);
      if (!existsSync(target)) fail(file, 'missing generated file');
      else if (readFileSync(target, 'utf8') !== contents) fail(file, 'stale generated file; run pnpm generate');
    }
    const directory = join(root, 'src/generated');
    if (existsSync(directory)) for (const file of readdirSync(directory)) {
      if (!files.has(`src/generated/${file}`)) fail(`src/generated/${file}`, 'orphaned generated file');
    }
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const expected = { '.': './src/index.ts', './metadata': './icons.json', './*': './src/generated/*.tsx' };
    for (const [subpath, target] of Object.entries(expected)) {
      const entry = manifest.exports?.[subpath];
      if (typeof entry === 'string' ? entry !== target : entry?.types !== target || entry?.import !== target) fail('package.json', `invalid export ${subpath}`);
    }
    for (const source of sources) {
      for (const condition of ['types', 'import']) {
        const target = manifest.exports?.['./*']?.[condition]?.replace('*', source.name);
        if (!target || !existsSync(join(root, target))) fail(source.file, `subpath ${condition} does not resolve`);
      }
    }
    const index = readFileSync(join(root, 'src/index.ts'), 'utf8');
    if (!/^export \* from ['"]\.\/generated\/index['"];$/m.test(index)) fail('src/index.ts', 'missing generated index re-export');
  }
  return [...errors].map(([file, messages]) => `${file}: ${messages.join('; ')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = verify(fileURLToPath(new URL('..', import.meta.url)));
  for (const error of errors) console.error(error);
  if (errors.length) process.exitCode = 1;
  else console.log('Icon verification passed (sources, geometry, metadata, generated components, and exports).');
}
