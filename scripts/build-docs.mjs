/**
 * Builds the published static site: the docs front at the root of ui.jfrader.com and the Storybook
 * workbench under /storybook/.
 *
 * The Render service publishes one directory (apps/storybook/storybook-static) with one command
 * (`pnpm build`), so both apps land inside it. Skipped unless DOCS_BUILD=1, which the service sets:
 * ordinary CI builds the workbench alone and keeps its speed.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = (command, args, cwd, env = {}) =>
  execFileSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storybookApp = path.join(repoRoot, 'apps', 'storybook');
const docsApp = path.join(repoRoot, 'apps', 'docs');
const published = path.join(storybookApp, 'storybook-static');
const workbench = path.join(published, 'storybook');

// One entry point for both build paths: CI and local builds produce the workbench only; the deploy
// (DOCS_BUILD=1) builds it once under /storybook/ and adds the docs front. Never build it twice.
if (process.env.DOCS_BUILD !== '1') {
  run('pnpm', ['exec', 'storybook', 'build'], storybookApp);
  process.exit(0);
}

// 1. The workbench, based under /storybook/ so its own asset URLs resolve there.
// The base comes from .storybook/main.ts, which reads STORYBOOK_BASE: the CLI has no --base option.
run('pnpm', ['exec', 'storybook', 'build', '--output-dir', 'storybook-static/storybook'], storybookApp, {
  STORYBOOK_BASE: '/storybook/',
});

// 3. Copy the docs front to the root. The publish directory must not keep the workbench's top-level
//    build output, or its index.html and iframe would sit beside the docs.
for (const entry of readdirSync(published)) {
  if (entry !== 'storybook') rmSync(path.join(published, entry), { recursive: true, force: true });
}
// 2. The docs front, based at the root of the domain.
run('pnpm', ['build'], docsApp, { DOCS_BASE: '/' });
const dist = path.join(docsApp, 'dist');
if (!existsSync(dist)) {
  console.error('docs: apps/docs/dist is missing; build the docs app first.');
  process.exit(1);
}
mkdirSync(published, { recursive: true });
cpSync(dist, published, { recursive: true });

console.log(`site: docs at the root, workbench at /storybook (${published})`);
