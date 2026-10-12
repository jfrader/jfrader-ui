import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

const cases = [
  { id: 'inputs-linkunfurl--docs', primary: '[data-ui="link-unfurl"]' },
  { id: 'inputs-mentioninput--docs', primary: '[data-ui="mention-input"]' },
];
// A stack that leaves its story block pins its toasts to the viewport, so every example of the
// docs page piles into one corner. Stacks with toasts must stay inside their own block.
const containmentCases = ['feedback-toaststack--docs'];
const viewports = [{ width: 390, height: 844 }, { width: 1440, height: 1000 }];
const server = process.env.STORYBOOK_URL ? null : await preview({
  configFile: false,
  root: fileURLToPath(new URL('..', import.meta.url)),
  build: { outDir: 'storybook-static' },
  preview: { host: '127.0.0.1', port: 0, open: false },
});
let browser;

try {
  const baseURL = process.env.STORYBOOK_URL ?? server.resolvedUrls.local[0];
  browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(30_000);

  for (const { id, primary } of cases) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(new URL(`iframe.html?id=${id}&viewMode=docs`, baseURL).href);
      await page.locator(primary).first().waitFor();
      const usage = page.locator('.component-usage');
      const summary = usage.locator('summary');
      await summary.focus();
      await summary.press('Enter');
      assert.equal(await usage.evaluate((element) => element.open), true, `${id}: Enter opens usage notes`);
      await page.evaluate(() => document.fonts.ready);
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      assert.ok(dimensions.scrollWidth <= dimensions.width,
        `${id} at ${viewport.width}px: expanded docs overflow (${dimensions.scrollWidth}px)`);
      assert.equal(await summary.evaluate((element) => element === document.activeElement), true,
        `${id}: focus stays on the summary`);
      await summary.press('Space');
      assert.equal(await usage.evaluate((element) => element.open), false, `${id}: Space closes usage notes`);
      console.log(`verify-docs-layout: ${id} at ${viewport.width}px OK`);
    }
  }

  for (const id of containmentCases) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(new URL(`iframe.html?id=${id}&viewMode=docs`, baseURL).href);
      await page.locator('[data-ui="toast"][data-populated="true"]').first().waitFor();
      const escaped = await page.evaluate(() => {
        const stacks = Array.from(document.querySelectorAll('[data-ui="toast-stack"]')).filter(
          (stack) => stack.querySelector('[data-ui="toast"]'),
        );
        const outside = stacks.filter((stack) => {
          const block = stack.closest('[data-story-block]');
          if (!block) return true;
          const stackBox = stack.getBoundingClientRect();
          const blockBox = block.getBoundingClientRect();
          return (
            stackBox.left < blockBox.left - 1 ||
            stackBox.right > blockBox.right + 1 ||
            stackBox.top < blockBox.top - 1 ||
            stackBox.bottom > blockBox.bottom + 1
          );
        });
        return {
          counted: stacks.length,
          outside: outside.map((stack) => stack.closest('[data-story-block]')?.id ?? '(no story block)'),
        };
      });
      assert.ok(escaped.counted > 0, `${id} at ${viewport.width}px: no example rendered toasts`);
      assert.deepEqual(
        escaped.outside,
        [],
        `${id} at ${viewport.width}px: stack escaped its story block in ${escaped.outside.join(', ')}`,
      );
      console.log(`verify-docs-layout: ${id} stack containment at ${viewport.width}px OK`);
    }
  }
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => {
    if (!server) return resolve();
    server.httpServer.close((error) => error ? reject(error) : resolve());
  });
}
