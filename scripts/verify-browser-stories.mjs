import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyBrowserStories(source, entries) {
  const failures = [];
  const ids = new Set();
  for (const [, id] of source.matchAll(/['"`]([a-z][a-z0-9]*(?:-[a-z0-9]+)*--[a-z0-9]+(?:-[a-z0-9]+)*)['"`]/g)) ids.add(id);
  for (const [, template] of source.matchAll(/`([^`]*)`/g)) {
    if (/[a-z0-9]--[^&]*\$\{|\$\{[^}]*\}--[a-z]/.test(template)) {
      failures.push('Use complete literal story ids instead of assembling story id fragments');
    }
  }
  for (const [, id] of source.matchAll(/[?&]id=([^&\s'"`]+)/g)) {
    if (!id.startsWith('${')) ids.add(id);
  }
  for (const id of ids) if (!Object.hasOwn(entries, id)) failures.push(`Unknown Storybook id: ${id}`);
  return { ids: ids.size, failures };
}

function browserTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return browserTests(target);
    return entry.name.endsWith('.browser.test.mjs') ? [target] : [];
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(import.meta.dirname, '..');
  const output = path.join(root, 'apps/storybook/storybook-static');
  const index = process.argv[2] ?? [path.join(output, 'index.json'), path.join(output, 'storybook/index.json')].find(existsSync);
  if (!index) throw new Error('Build Storybook before verifying browser story ids');
  const { entries } = JSON.parse(readFileSync(index, 'utf8'));
  let checked = 0;
  const failures = [];
  for (const file of [...browserTests(path.join(root, 'packages')), ...browserTests(path.join(root, 'apps/storybook/scripts'))]) {
    const result = verifyBrowserStories(readFileSync(file, 'utf8'), entries);
    checked += result.ids;
    failures.push(...result.failures.map(failure => `${path.relative(root, file)}: ${failure}`));
  }
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else console.log(`browser-stories: ${checked} story references resolve in ${index}`);
}
