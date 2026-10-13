/**
 * Builds the docs front and drops it into the Storybook static site, so one Render service serves
 * both: the workbench at the site root and the docs at /docs/.
 *
 * Skipped unless DOCS_BUILD=1, which is set on the Render service: ordinary CI keeps its speed.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.DOCS_BUILD !== '1') process.exit(0);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engineDir = path.resolve(repoRoot, '..', 'storybook-docs');
const docsApp = path.join(repoRoot, 'apps', 'docs');
const dist = path.join(docsApp, 'dist');
const target = path.join(repoRoot, 'apps', 'storybook', 'storybook-static', 'docs');

if (!existsSync(path.join(engineDir, 'package.json'))) {
  console.error('docs: the engine is missing; scripts/fetch-docs-engine.mjs should have cloned it during install.');
  process.exit(1);
}

const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, DOCS_BASE: '/docs/' } });

run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], engineDir);
run('pnpm', ['build'], docsApp);

rmSync(target, { recursive: true, force: true });
cpSync(dist, target, { recursive: true });
console.log(`docs: published to apps/storybook/storybook-static/docs (${target})`);
