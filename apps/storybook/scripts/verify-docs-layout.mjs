import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

const cases = [
  { id: 'inputs-linkunfurl--docs', primary: '[data-ui="link-unfurl"]' },
  { id: 'inputs-mentioninput--docs', primary: '[data-ui="mention-input"]' },
];
const guides = [
  { id: 'foundations-getting-started--docs', title: 'Getting started' },
  { id: 'foundations-theming--docs', title: 'Theming' },
  { id: 'foundations-styling--docs', title: 'Styling' },
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

  const index = await (await fetch(new URL('index.json', baseURL))).json();
  for (const { id, title } of guides) {
    assert.ok(index.entries[id], `${id}: guide is indexed`);
    assert.ok(index.entries[id].tags.includes('dev'), `${id}: guide is visible in the sidebar`);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(new URL(`iframe.html?id=${id}&viewMode=docs`, baseURL).href);
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.locator('.foundation-guide pre').count(), `${id}: examples are rendered`);
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      assert.ok(dimensions.scrollWidth <= dimensions.width,
        `${id} at ${viewport.width}px: docs overflow (${dimensions.scrollWidth}px)`);
      const links = await page.locator('.foundation-guide a').evaluateAll((anchors) =>
        anchors.map((anchor) => ({ href: anchor.getAttribute('href'), target: anchor.target })));
      for (const { href, target } of links) {
        if (href?.startsWith('#')) {
          assert.equal(target, '_self', `${id}: section links stay inside the preview frame`);
          assert.ok(await page.evaluate((hash) => document.getElementById(hash.slice(1)) !== null, href),
            `${id}: missing section ${href}`);
        } else if (href?.startsWith('./?path=/docs/')) {
          const linkedId = new URL(href, baseURL).searchParams.get('path').replace('/docs/', '');
          assert.ok(index.entries[linkedId], `${id}: missing guide ${linkedId}`);
          assert.equal(target, '_top', `${id}: guide links navigate the Storybook manager`);
        }
        assert.ok(!href?.includes('.md'), `${id}: Markdown file link was not mapped to Storybook`);
      }
      console.log(`verify-docs-layout: ${id} at ${viewport.width}px OK`);
    }
  }

  await page.setViewportSize(viewports[1]);
  const managerUrl = new URL(`?path=/docs/${guides[0].id}`, baseURL).href;
  await page.goto(managerUrl);
  const frame = page.frameLocator('#storybook-preview-iframe');
  const sectionLink = frame.locator('.foundation-guide a[href^="#"]').first();
  await sectionLink.waitFor();
  const hash = await sectionLink.getAttribute('href');
  await sectionLink.focus();
  await sectionLink.press('Enter');
  assert.equal(page.url(), managerUrl, 'section links preserve the Storybook manager');
  assert.equal(await frame.locator('html').evaluate(() => location.hash), hash, 'section link scrolls the preview');
  console.log('verify-docs-layout: section navigation keeps the sidebar OK');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => {
    if (!server) return resolve();
    server.httpServer.close((error) => error ? reject(error) : resolve());
  });
}
