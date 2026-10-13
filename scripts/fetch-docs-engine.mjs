/**
 * The docs app consumes the documentation engine (jfrader/storybook-docs) through a `link:` path
 * that points beside this repository, which is how it works on a developer machine. Render's build
 * only clones this repository, so fetch the engine at the pinned commit before installing.
 *
 * Runs from `preinstall`, so it is idempotent and quiet when the engine is already there.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENGINE = { repo: 'https://github.com/jfrader/storybook-docs', ref: '0125576af4044311053dad42fee314cd05338bfa' };
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.resolve(repoRoot, '..', 'storybook-docs');

if (existsSync(path.join(target, 'package.json'))) process.exit(0);

process.stdout.write(`docs: fetching the engine at ${ENGINE.ref.slice(0, 7)} into ${target}\n`);
execFileSync('git', ['clone', '--quiet', '--no-checkout', ENGINE.repo, target], { stdio: 'inherit' });
execFileSync('git', ['-C', target, 'checkout', '--quiet', ENGINE.ref], { stdio: 'inherit' });
