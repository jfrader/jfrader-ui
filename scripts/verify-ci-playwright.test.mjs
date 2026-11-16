import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const gate = readFileSync(path.join(import.meta.dirname, 'verify-ci-playwright.mjs'), 'utf8');
const workflow = readFileSync(path.join(import.meta.dirname, '../.github/workflows/ci.yml'), 'utf8');

function runFixture({ config = workflow, version = '1.64.0' } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'verify-ci-playwright-'));
  const write = (file, content) => {
    const target = path.join(dir, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  try {
    write('scripts/verify-ci-playwright.mjs', gate);
    write('.github/workflows/ci.yml', config);
    write('apps/storybook/package.json', JSON.stringify({ devDependencies: { playwright: '^1.0.0' } }));
    if (version !== null) {
      write('node_modules/playwright/package.json', JSON.stringify({ version: '0.0.0' }));
      write('apps/storybook/node_modules/playwright/package.json', JSON.stringify({ version }));
    }
    return spawnSync(process.execPath, [path.join(dir, 'scripts/verify-ci-playwright.mjs')], { encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('accepts the real CI configuration with matching Storybook-installed Playwright', () => {
  const result = runFixture();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /installed Playwright 1\.64\.0 matches/);
});

for (const [name, options, message] of [
  ['installed dependency drift', { version: '1.64.1' }, /Installed Storybook Playwright 1\.64\.1 does not match CI image 1\.64\.0/],
  ['image version drift', { config: workflow.replace('playwright:v1.64.0-', 'playwright:v1.64.1-') }, /does not match CI image 1\.64\.1/],
  ['missing installed dependency', { version: null }, /Cannot resolve installed Playwright from apps\/storybook/],
  ['missing container', { config: workflow.replace(/^    container:\n(?: {6}[^\n]*\n)*/m, '') }, /check\.container must contain/],
  ['untrusted registry', { config: workflow.replace('mcr.microsoft.com/playwright:', 'example.com/playwright:') }, /check\.container must contain/],
  ['missing digest', { config: workflow.replace(/@sha256:[a-f0-9]{64}/, '') }, /check\.container must contain/],
  ['malformed digest', { config: workflow.replace(/@sha256:[a-f0-9]{64}/, '@sha256:not-a-digest') }, /check\.container must contain/],
  ['expression instead of literal image', { config: workflow.replace(/      image: .*/, '      image: ${{ vars.PLAYWRIGHT_IMAGE }}') }, /check\.container must contain/],
  ['duplicate container', { config: workflow.replace('    container:', '    container: untrusted/image\n    container:') }, /check\.container must contain/],
]) {
  test(`rejects ${name}`, () => {
    const result = runFixture(options);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, message);
  });
}
