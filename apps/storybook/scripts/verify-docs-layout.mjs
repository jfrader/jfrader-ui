import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

const cases = [
  ...[
    { id: 'showcase-gravitywell--docs', primary: '[data-ui="gravity-well"]' },
    { id: 'games-deck--docs', primary: '[data-ui="game-card"], [data-ui="game-table"]' },
    { id: 'games-gamecard--docs', primary: '[data-ui="game-card"]' },
  ].map(testCase => ({
    ...testCase,
    containPreview: 'all',
    verifyPreviewOverflow: true,
    viewports: [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 900 }],
  })),
  {
    id: 'games-gametable--docs', primary: '[data-table-example-viewport]', containPreview: true,
    viewports: [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 900 }],
  },
  {
    id: 'games-pokertable--docs', primary: '[data-ui="poker-table"]', containPreview: true,
    viewports: [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 900 }],
  },
  {
    id: 'games-trucotable--docs', primary: '[data-ui="truco-table"]', containPreview: true,
    viewports: [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 900 }],
  },
  {
    id: 'data-filtertoolbar--docs', primary: '[data-ui~="filter-toolbar"]', containPreview: 'all',
    verifyPreviewOverflow: true,
    fontFamily: 'monospace',
    viewports: [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 900 }],
  },
  { id: 'games-gamehand--docs', primary: '[data-ui~="game-hand"]', verifyPreviewOverflow: true,
    viewports: [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 900 }] },
  { id: 'games-gamecardstack--docs', primary: '[data-ui~="game-card-stack"]' },
  { id: 'games-gamechip--docs', primary: '[data-ui="game-chip"]' },
  { id: 'games-gamechipstack--docs', primary: '[data-ui="game-chip-stack"]' },
  { id: 'games-gameseat--docs', primary: '[data-ui~="game-seat"]' },
  { id: 'games-gameactions--docs', primary: '[data-ui~="game-actions"]' },
  { id: 'media-lightboxgallery--docs', primary: '[data-ui="lightbox-gallery"]', containPreview: true },
  { id: 'data-display-commentthread--docs', primary: '[data-ui="comment-thread"]', containPreview: true },
  {
    id: 'data-display-chatthread--docs', primary: '[data-ui="chat-thread"]', containPreview: 'all',
    viewports: [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 900 }],
  },
  { id: 'surfaces-bottomsheet--docs', primary: '[data-ui="bottom-sheet-trigger"]' },
  { id: 'media-article--docs', primary: '[data-ui~="article"]' },
  { id: 'media-articlelist--docs', primary: '[data-ui~="article-list"]' },
  { id: 'media-articlesection--docs', primary: '[data-ui~="article-section"]' },
  { id: 'surfaces-dialogstack--docs', primary: '[data-ui="dialog-stack-trigger"]' },
  { id: 'inputs-linkunfurl--docs', primary: '[data-ui="link-unfurl"]' },
  { id: 'inputs-mentioninput--docs', primary: '[data-ui="mention-input"]' },
];
const layoutCases = cases.flatMap((testCase) => testCase.fontFamily
  ? [{ ...testCase, fontFamily: undefined }, testCase]
  : [testCase]);
const popupSelector = '[role="listbox"]';
const editableDetails = {
  title: 'Data display/EditableDetails',
  id: 'data-display-editabledetails',
  editors: [
    'default', 'native-scalar-form', 'grouped-fields', 'async-validation-and-confirmation',
    'react-hook-form', 'action-state-form', 'inline-edit-comparison', 'persistent-open-and-error',
    'nested-contract', 'light', 'mobile', 'rtl',
  ],
  pickers: ['portaled-picker', 'picker-focus-moved-away', 'modal-picker', 'open-picker', 'open-modal'],
};
// A stack that leaves its story block pins its toasts to the viewport, so every example of the
// docs page piles into one corner. Stacks with toasts must stay inside their own block.
const containmentCases = ['feedback-toaststack--docs'];
const guides = [
  { id: 'foundations-getting-started--docs', title: 'Getting started', source: 'getting-started.md' },
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
  for (const page of ['games-pokertable--docs', 'games-trucotable--docs']) {
    assert.ok(index.entries[page]?.tags.includes('autodocs'), `${page} documentation remains enabled`);
  }
  for (const story of ['default', 'prebuilt-slots-and-empty-places', 'seat-placement-modes', 'poker-community-board', 'lobby', 'with-avatars']) {
    assert.ok(index.entries[`games-gametable--${story}`]?.tags.includes('autodocs'),
      `GameTable preserves its curated ${story} example`);
  }
  for (const story of ['responsive-four-places', 'compact-four-plays', 'four-play-container-matrix', 'play-ellipse-containment']) {
    const entry = index.entries[`games-gametable--${story}`];
    assert.ok(entry && !entry.tags.includes('autodocs'), `GameTable keeps ${story} in hidden QA`);
  }
  const detailsEntries = Object.values(index.entries).filter(({ title }) => title === editableDetails.title);
  assert.ok(detailsEntries.filter(({ type }) => type === 'story').length > 0,
    'EditableDetails examples are indexed under one navigation entry');
  const docs = index.entries[`${editableDetails.id}--docs`];
  assert.equal(docs?.type, 'docs', 'EditableDetails documentation is indexed');
  assert.ok(docs.tags.includes('autodocs'), 'EditableDetails documentation remains enabled');
  for (const entry of detailsEntries) {
    assert.equal(entry.title, editableDetails.title, `${entry.id}: example belongs to EditableDetails`);
  }
  console.log('verify-docs-layout: EditableDetails navigation and example coverage OK');
  browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(30_000);

  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    for (const theme of ['dark', 'light']) {
      await page.setViewportSize(viewport);
      await page.goto(new URL(`iframe.html?id=icons-all-icons--docs&viewMode=docs&globals=theme:${theme}`, baseURL).href);
      await page.getByRole('searchbox', { name: 'Search icons' }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      const nestedScrollers = await page.locator('.icon-browser-controls').evaluate((controls) => {
        const scrollers = [];
        for (let element = controls; element && element !== document.scrollingElement; element = element.parentElement) {
          const initial = element.scrollTop;
          element.scrollTop = element.scrollHeight;
          if (element.scrollTop > 0) scrollers.push({ tag: element.tagName, scrollTop: element.scrollTop });
          element.scrollTop = initial;
        }
        return scrollers;
      });
      assert.deepEqual(nestedScrollers, [], `Icon browser ${viewport.width}px ${theme}: only the document scrolls`);
    }
  }
  console.log('verify-docs-layout: Icon browser natural height OK');

  for (const { id, primary, containPreview, verifyPreviewOverflow, fontFamily, viewports: caseViewports = viewports } of layoutCases) {
    for (const viewport of caseViewports) {
      await page.setViewportSize(viewport);
      await page.goto(new URL(`iframe.html?id=${id}&viewMode=docs`, baseURL).href);
      await page.locator(primary).first().waitFor();
      if (fontFamily) {
        await page.addStyleTag({ content: `:root,[data-theme]{--ui-font-sans:${fontFamily} !important;}` });
      }
      const usage = page.locator('.component-usage');
      const summary = usage.locator('summary');
      await summary.focus();
      await summary.press('Enter');
      assert.equal(await usage.evaluate((element) => element.open), true, `${id}: Enter opens usage notes`);
      await page.evaluate(() => document.fonts.ready);
      if (verifyPreviewOverflow) {
        for (let offset = 0; offset < await page.evaluate(() => document.documentElement.scrollHeight); offset += viewport.height / 2) {
          await page.evaluate((top) => window.scrollTo(0, top), offset);
          await page.waitForTimeout(200);
        }
        const previews = await page.locator('.docs-story').evaluateAll((elements) =>
          elements.map((element) => ({
            id: element.querySelector('[id^="story--"]')?.id,
            width: element.clientWidth,
            scrollWidth: element.scrollWidth,
          })),
        );
        for (const preview of previews) {
          assert.ok(preview.scrollWidth <= preview.width + 1,
            `${id} at ${viewport.width}px (${fontFamily ?? 'theme font'}): ${preview.id ?? 'story preview'} overflows (${preview.scrollWidth}px > ${preview.width}px)`);
        }
        const escapedPopups = await page.locator(popupSelector).evaluateAll((elements) =>
          elements.filter((element) => element.getClientRects().length > 0 && !element.closest('.docs-story')).length,
        );
        assert.equal(escapedPopups, 0, `${id}: persistent popup escaped its docs example`);
        for (const iframe of await page.locator('.docs-story iframe').all()) {
          const handle = await iframe.elementHandle();
          assert.ok(handle, `${id}: story iframe is rendered`);
          const frame = await handle.contentFrame();
          assert.ok(frame, `${id}: story iframe is available`);
          await frame.locator(primary).first().waitFor();
          if (fontFamily) {
            await frame.addStyleTag({ content: `:root,[data-theme]{--ui-font-sans:${fontFamily} !important;}` });
          }
          await frame.evaluate(() => document.fonts.ready);
          await frame.getByRole('listbox').waitFor({ state: 'visible' });
          const bounds = await frame.evaluate(({ primary, popupSelector }) => {
            const elements = document.querySelectorAll(`${primary}, ${popupSelector}`);
            return {
              width: document.documentElement.clientWidth,
              height: document.documentElement.clientHeight,
              scrollWidth: document.documentElement.scrollWidth,
              elements: [...elements].map((element) => element.getBoundingClientRect().toJSON()),
            };
          }, { primary, popupSelector });
          assert.ok(bounds.scrollWidth <= bounds.width, `${id}: story iframe overflows horizontally`);
          for (const element of bounds.elements) {
            assert.ok(element.left >= -1 && element.right <= bounds.width + 1 && element.top >= -1 && element.bottom <= bounds.height + 1,
              `${id}: story iframe clips its toolbar or popup`);
          }
        }
      }
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      assert.ok(dimensions.scrollWidth <= dimensions.width,
        `${id} at ${viewport.width}px: expanded docs overflow (${dimensions.scrollWidth}px)`);
      if (containPreview) {
        if (containPreview === 'all') {
          const previews = page.locator('.sbdocs-preview');
          for (let index = 0; index < await previews.count(); index += 1) {
            await previews.nth(index).scrollIntoViewIfNeeded();
          }
        }
        const examples = page.locator(primary);
        const count = containPreview === 'all' ? await examples.count() : 1;
        for (let index = 0; index < count; index += 1) {
          const contained = await examples.nth(index).evaluate((element) => {
            const preview = element.closest('.docs-story');
            if (!preview) return false;
            const bounds = preview.getBoundingClientRect();
            const content = element.getBoundingClientRect();
            return content.left >= bounds.left - 1 && content.right <= bounds.right + 1;
          });
          assert.ok(contained, `${id} at ${viewport.width}px: example ${index + 1} is clipped by its preview`);
        }
      }
      assert.equal(await summary.evaluate((element) => element === document.activeElement), true,
        `${id}: focus stays on the summary`);
      await summary.press('Space');
      assert.equal(await usage.evaluate((element) => element.open), false, `${id}: Space closes usage notes`);
      console.log(`verify-docs-layout: ${id} at ${viewport.width}px (${fontFamily ?? 'theme font'}) OK`);
    }
  }

  for (const story of ['responsive-four-places', 'compact-four-plays']) {
    for (const viewport of [...viewports, { width: 768, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto(new URL(`iframe.html?id=games-gametable--${story}&viewMode=story`, baseURL).href);
      const tables = page.locator('[data-ui="game-table"]');
      await tables.first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const expectedFit = story === 'compact-four-plays' || viewport.width === 390 ? 'scaled' : 'fitted';
      await page.waitForFunction((fit) => document.querySelector('[data-ui="game-table"]')?.dataset.layoutFit === fit, expectedFit);
      assert.equal(await tables.count(), 1, `${story}: one composition is rendered`);
      const geometry = await tables.first().evaluate((table) => {
        const felt = table.querySelector('[data-game-surface]').getBoundingClientRect();
        const plays = [...table.querySelectorAll('[data-ui="game-table-play"]')];
        const corners = plays.flatMap((play) => {
          const box = play.getBoundingClientRect();
          return [box.left, box.right].flatMap((x) => [box.top, box.bottom].map((y) =>
            Math.hypot((x - felt.left - felt.width / 2) / (felt.width / 2), (y - felt.top - felt.height / 2) / (felt.height / 2))));
        });
        const regions = [...table.querySelectorAll('[data-ui="game-table-seat"], [data-ui="game-table-play"], [data-ui="game-table-center"]')];
        const collisions = regions.flatMap((region, index) => regions.slice(index + 1).filter((other) => {
          const a = region.getBoundingClientRect();
          const b = other.getBoundingClientRect();
          return Math.min(Math.min(a.right, b.right) - Math.max(a.left, b.left),
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) > 0.1;
        })).length;
        return { plays: plays.length, corners, collisions, fit: table.dataset.layoutFit,
          scale: Number(getComputedStyle(table).getPropertyValue('--game-table-content-scale')),
          width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
      });
      assert.equal(geometry.fit, expectedFit);
      if (expectedFit === 'fitted') assert.equal(geometry.scale, 1);
      else assert.ok(geometry.scale > 0 && geometry.scale < 1);
      assert.equal(geometry.plays, 4);
      assert.equal(geometry.collisions, 0);
      assert.ok(geometry.corners.every((corner) => corner <= 1), `${story}: every play corner stays inside the ellipse`);
      assert.ok(geometry.scrollWidth <= geometry.width, `${story} at ${viewport.width}px: no horizontal overflow`);
      console.log(`verify-docs-layout: ${story} at ${viewport.width}px ${expectedFit} OK`);
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

  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 900 }]) {
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize(viewport);
      await page.goto(new URL(`iframe.html?id=icons-usage--docs&viewMode=docs&globals=theme:${theme}`, baseURL).href);
      await page.locator('.foundation-guide').getByRole('heading', { name: 'Icons', exact: true }).waitFor();
      await page.goto(new URL(`iframe.html?id=icons-all-icons--docs&viewMode=docs&globals=theme:${theme}`, baseURL).href);
      const browser = page.locator('.icon-browser');
      await browser.waitFor();
      assert.equal(await browser.getByRole('status').textContent(), '', 'All icons: no copy notice on first load');
      const colors = await browser.evaluate((element) => {
        const page = getComputedStyle(document.body);
        const browser = getComputedStyle(element);
        const preview = getComputedStyle(element.querySelector('.icon-browser-preview'));
        return {
          theme: document.documentElement.dataset.theme,
          page: { color: page.color, background: page.backgroundColor },
          browser: { color: browser.color, background: browser.backgroundColor },
          preview: { color: preview.color, background: preview.backgroundColor },
        };
      });
      assert.equal(colors.theme, theme, 'All icons: the page uses the selected theme');
      assert.deepEqual(colors.browser, colors.page, 'All icons: the browser inherits the page theme');
      assert.deepEqual(colors.preview, colors.page, 'All icons: the preview inherits the page theme');
      await browser.getByRole('combobox', { name: 'Size', exact: true }).selectOption('32');
      const initialCount = await browser.getByRole('button').count();
      await browser.getByRole('searchbox', { name: 'Search icons' }).fill('search');
      assert.ok(await browser.getByRole('button').count() < initialCount, 'All icons: search narrows the grid');
      await browser.getByRole('button', { name: 'Copy Search import', exact: true }).waitFor();
      const geometry = await browser.evaluate((element) => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        width: element.clientWidth,
        scroll: element.scrollWidth,
        glyph: element.querySelector('svg').getBoundingClientRect().width,
      }));
      assert.ok(geometry.document <= geometry.viewport + 1, `All icons at ${viewport.width}px ${theme}: page overflows`);
      assert.ok(geometry.scroll <= geometry.width + 1, `All icons at ${viewport.width}px ${theme}: browser clips content`);
      assert.equal(geometry.glyph, 32, 'All icons: 32px preview is not squeezed');
      console.log(`verify-docs-layout: All icons browser at ${viewport.width}px ${theme} OK`);
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
      await page.locator('.foundation-guide').getByRole('heading', { name: title, exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      const rendered = page.locator('.foundation-guide [data-guide-example]');
      assert.equal(await rendered.count(), examples.length, `${id}: every Markdown fence uses a component`);
      for (const [index, [, language, code]] of examples.entries()) {
        const example = rendered.nth(index);
        if (language === 'sh') {
          const terminal = example.locator('[data-ui="typewriter-terminal"]');
          assert.ok((await terminal.locator('[data-ui="typewriter-terminal-screen"]').textContent()).endsWith(code),
            `${id}: command ${index} is immediately readable`);
          await terminal.getByRole('button', { name: 'Copy commands', exact: true }).waitFor();
          assert.equal(await terminal.getByRole('slider').count(), 0, `${id}: command ${index} has no playback timeline`);
          assert.equal(await terminal.getByRole('button', { name: /^(Play|Pause|Replay)$/ }).count(), 0,
            `${id}: command ${index} has no playback controls`);
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

  await page.goto(new URL('?path=/docs/theme-themeroot--docs', baseURL).href);
  await frame.locator('.component-usage summary').click();
  await frame.getByRole('link', { name: 'Theming guide', exact: true }).click();
  await page.waitForURL(new URL('?path=/docs/foundations-theming--docs', baseURL).href);
  await frame.getByRole('heading', { name: 'Theming', exact: true }).waitFor();
  console.log('verify-docs-layout: component links reach the guide OK');

  await page.goto(new URL(`?path=/docs/${editableDetails.id}--docs`, baseURL).href);
  await frame.locator('.component-usage summary').waitFor();
  assert.equal(await frame.locator('dialog:modal').count(), 0, 'EditableDetails docs do not open a modal on load');
  console.log('verify-docs-layout: EditableDetails docs page reachable OK');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => {
    if (!server) return resolve();
    server.httpServer.close((error) => error ? reject(error) : resolve());
  });
}
