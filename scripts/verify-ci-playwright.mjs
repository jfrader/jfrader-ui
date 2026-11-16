import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');

try {
  const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  const jobs = [...workflow.matchAll(/^  check:[^\n]*$/gm)];
  const job = workflow.match(/^  check:\n((?: {4}[^\n]*\n|\n)*)/m)?.[1];
  const containers = [...(job ?? '').matchAll(/^    container:[^\n]*$/gm)];
  const container = job?.match(/^    container:\n((?: {6}[^\n]*\n|\n)*)/m)?.[1];
  const image = container?.match(
    /^      image: mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-noble@sha256:[a-f0-9]{64}\n      options: --init --ipc=host\n$/,
  );
  if (jobs.length !== 1 || containers.length !== 1 || !image) {
    throw new Error('check.container must contain a literal, digest-pinned official Playwright noble image and --init --ipc=host options. Update the guard explicitly if changing this YAML shape.');
  }

  const require = createRequire(path.join(root, 'apps/storybook/package.json'));
  let installed;
  try {
    installed = require('playwright/package.json').version;
  } catch {
    throw new Error('Cannot resolve installed Playwright from apps/storybook. Run pnpm install --frozen-lockfile first.');
  }
  if (installed !== image[1]) {
    throw new Error(`Installed Storybook Playwright ${installed} does not match CI image ${image[1]}. Update the image tag and verified digest to match the frozen dependency.`);
  }
  console.log(`verify-ci-playwright: installed Playwright ${installed} matches the pinned CI image`);
} catch (error) {
  console.error(`verify-ci-playwright: ${error.message}`);
  process.exitCode = 1;
}
