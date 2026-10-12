import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

const cases = [
  { id: 'inputs-linkunfurl--docs', primary: '[data-ui="link-unfurl"]' },
  { id: 'inputs-mentioninput--docs', primary: '[data-ui="mention-input"]' },
  { id: 'showcase-editabledetails--docs', primary: '[data-ui="editable-details"]' },
];
const editableDetails = {
  title: 'Showcase/EditableDetails',
  id: 'showcase-editabledetails',
  editors: [
    'default', 'native-scalar-form', 'grouped-fields', 'async-validation-and-confirmation',
    'react-hook-form', 'action-state-form', 'inline-edit-comparison', 'persistent-open-and-error',
    'light', 'mobile', 'rtl',
  ],
  pickers: ['portaled-picker', 'picker-focus-moved-away', 'modal-picker', 'open-picker', 'open-modal'],
};
// A stack that leaves its story block pins its toasts to the viewport, so every example of the
// docs page piles into one corner. Stacks with toasts must stay inside their own block.
const containmentCases = ['feedback-toaststack--docs'];
const guides = [
  { id: 'foundations-getting-started--docs', title: 'Getting started', source: 'consuming-jfrader-ui.md' },
  { id: 'foundations-theming--docs', title: 'Theming', source: 'theming.md' },
  { id: 'foundations-styling--docs', title: 'Styling', source: 'styling.md' },
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
  const index = await (await fetch(new URL('index.json', baseURL))).json();
  const detailsEntries = Object.values(index.entries).filter(({ title }) => title.startsWith(editableDetails.title));
  assert.deepEqual([...new Set(detailsEntries.map(({ title }) => title))], [editableDetails.title],
    'EditableDetails examples share one Showcase navigation entry');
  const docs = index.entries[`${editableDetails.id}--docs`];
  assert.equal(docs?.type, 'docs', 'EditableDetails picker documentation is indexed');
  assert.ok(docs.tags.includes('autodocs'), 'EditableDetails picker documentation remains enabled');
  for (const [kind, stories] of [['editors', editableDetails.editors], ['pickers', editableDetails.pickers]]) {
    for (const story of stories) {
      const id = `${editableDetails.id}--${story}`;
      const entry = index.entries[id];
      assert.equal(entry?.type, 'story', `${id}: example is indexed`);
      assert.equal(entry.title, editableDetails.title, `${id}: example belongs to EditableDetails`);
      assert.ok(entry.tags.includes('test'), `${id}: interaction coverage remains enabled`);
      assert.equal(entry.tags.includes('dev'), kind === 'editors', `${id}: sidebar visibility is preserved`);
      assert.equal(entry.tags.includes('autodocs'), kind === 'pickers', `${id}: docs visibility is preserved`);
    }
  }
  console.log('verify-docs-layout: EditableDetails navigation and example coverage OK');
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
      await page.evaluate(() => document.fonts.ready);
      // Inline examples mount over a few passes, so measure only once the populated stacks stop
      // growing; a partially mounted page would let a later example escape unmeasured.
      let previousCount = -1;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const current = await page.evaluate(
          () => document.querySelectorAll('[data-ui="toast"][data-populated="true"]').length,
        );
        if (current > 0 && current === previousCount) break;
        previousCount = current;
        await page.waitForTimeout(750);
      }
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

  for (const { id, title, source } of guides) {
    const markdown = readFileSync(new URL(`../../../docs/${source}`, import.meta.url), 'utf8');
    const examples = [...markdown.matchAll(/^```(\w*)[^\n]*\n([\s\S]*?)^```/gm)];
    assert.ok(index.entries[id], `${id}: guide is indexed`);
    assert.ok(index.entries[id].tags.includes('dev'), `${id}: guide is visible in the sidebar`);
    for (const { viewport, theme } of viewports.flatMap((viewport) =>
      ['dark', 'light'].map((theme) => ({ viewport, theme })))) {
      await page.setViewportSize(viewport);
      await page.goto(new URL(`iframe.html?id=${id}&viewMode=docs&globals=theme:${theme}`, baseURL).href);
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      const rendered = page.locator('.foundation-guide [data-guide-example]');
      assert.equal(await rendered.count(), examples.length, `${id}: every Markdown fence uses a component`);
      for (const [index, [, language, code]] of examples.entries()) {
        const example = rendered.nth(index);
        if (language === 'sh') {
          const terminal = example.locator('[data-ui="typewriter-terminal"]');
          assert.ok((await terminal.locator('[data-ui="typewriter-terminal-screen"]').textContent()).endsWith(code),
            `${id}: command ${index} is immediately readable`);
          const seek = terminal.getByRole('slider');
          assert.equal(await seek.inputValue(), await seek.getAttribute('max'), `${id}: command ${index} starts at the end`);
        } else {
          const block = example.locator('[data-ui="code-block"]');
          if (language !== 'ini') await example.locator('[data-ui="code-block"][data-highlighted]').waitFor();
          assert.equal(await block.locator('code').textContent(), code, `${id}: example ${index} preserves its source`);
        }
      }
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
      console.log(`verify-docs-layout: ${id} at ${viewport.width}px ${theme} OK`);
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

  await page.goto(new URL('?path=/docs/foundations-theme--docs', baseURL).href);
  await frame.locator('.component-usage summary').click();
  await frame.getByRole('link', { name: 'Theming guide', exact: true }).click();
  await page.waitForURL(new URL('?path=/docs/foundations-theming--docs', baseURL).href);
  await frame.getByRole('heading', { name: 'Theming', exact: true }).waitFor();
  console.log('verify-docs-layout: component links reach the guide OK');

  await page.goto(new URL(`?path=/story/${editableDetails.id}--default`, baseURL).href);
  await frame.getByRole('heading', { name: 'Project settings', exact: true }).waitFor();
  const detailsGroup = page.locator(`[data-item-id="${editableDetails.id}"]`);
  await detailsGroup.waitFor();
  assert.equal(await page.locator('[data-item-id="showcase-editabledetails-overlays"]').count(), 0,
    'EditableDetails has no separate overlay navigation entry');
  await page.locator(`a[href="/?path=/docs/${editableDetails.id}--docs"]`).click();
  await frame.locator('.component-usage summary').waitFor();
  for (const story of editableDetails.pickers) {
    await frame.locator(`#anchor--${editableDetails.id}--${story}`).waitFor();
  }
  assert.equal(await frame.locator('dialog:modal').count(), 0, 'picker docs do not open a modal on load');
  console.log('verify-docs-layout: EditableDetails sidebar reaches every picker example OK');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => {
    if (!server) return resolve();
    server.httpServer.close((error) => error ? reject(error) : resolve());
  });
}
