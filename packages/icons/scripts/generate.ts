import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifacts, readMetadata, readSources } from './sources';

const root = fileURLToPath(new URL('..', import.meta.url));
const metadata = readMetadata(root);
const sources = readSources(root);
const files = artifacts(sources, metadata);
const generated = join(root, 'src/generated');
mkdirSync(generated, { recursive: true });
for (const file of readdirSync(generated)) {
  if (!files.has(`src/generated/${file}`)) rmSync(join(generated, file));
}
for (const [file, contents] of files) {
  const target = join(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}
console.log(`Generated ${Object.keys(metadata).length} icons (${sources.length} variants) → src/generated, icons.json`);
