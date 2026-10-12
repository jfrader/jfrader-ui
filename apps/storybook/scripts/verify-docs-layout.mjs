import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

const cases = [
  { id: 'inputs-linkunfurl--docs', primary: '[data-ui="link-unfurl"]' },
  { id: 'inputs-mentioninput--docs', primary: '[data-ui="mention-input"]' },
];
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
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => {
    if (!server) return resolve();
    server.httpServer.close((error) => error ? reject(error) : resolve());
  });
}
