import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const guides = ['getting-started.md', 'theming.md', 'styling.md', 'flights.md'];
const pilot = path.join(root, 'apps/pilot');
const directory = mkdtempSync(path.join(pilot, 'node_modules/.guide-examples-'));

try {
  const files = [];
  for (const guide of guides) {
    const content = readFileSync(path.join(root, 'docs', guide), 'utf8');
    const examples = [...content.matchAll(/^```(tsx|ts)(?:[ \t]+[^\n]*)?\n([\s\S]*?)^```/gm)];
    assert.ok(examples.length > 0, `${guide}: no TypeScript examples found`);
    for (const [index, [, language, source]] of examples.entries()) {
      const file = path.join(directory, `${path.basename(guide, '.md')}-${index + 1}.${language}`);
      writeFileSync(file, source);
      files.push(file);
    }
  }
  const config = path.join(directory, 'tsconfig.json');
  writeFileSync(config, JSON.stringify({
    extends: path.join(root, 'tsconfig.base.json'),
    compilerOptions: {
      jsx: 'react-jsx',
      jsxImportSource: '@emotion/react',
      types: ['vite/client'],
    },
    files,
    include: [],
  }));
  execFileSync('pnpm', ['exec', 'tsc', '--project', config, '--noEmit'], { cwd: pilot, stdio: 'inherit' });
  console.log(`verify-guide-examples: ${files.length} TypeScript examples checked against workspace APIs`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
