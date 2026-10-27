import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createBrowserWorkbench } from './browser-workbench.mjs';

let workbench;
before(async () => { workbench = await createBrowserWorkbench(); });
after(async () => workbench?.close());

async function openDocsWithSections(page, id, sections) {
  await page.goto(`${workbench.baseURL}/iframe.html?id=${id}--default&viewMode=story`);
  await page.waitForFunction(() => window.__STORYBOOK_PREVIEW__?.currentRender?.phase === 'finished');
  await page.evaluate(async ({ id, sections }) => {
    const preview = window.__STORYBOOK_PREVIEW__;
    const store = preview.storyStoreValue;
    const prepareMeta = store.preparedMetaFromCSFFile.bind(store);
    store.preparedMetaFromCSFFile = (options) => {
      const meta = prepareMeta(options);
      const docs = { ...meta.parameters.docs };
      if (sections === null) delete docs.sections;
      else docs.sections = sections;
      return { ...meta, parameters: { ...meta.parameters, docs } };
    };
    await preview.onSetCurrentStory({ storyId: `${id}--docs`, viewMode: 'docs' });
  }, { id, sections });
  await page.locator('.docs-story').first().waitFor();
}

test('a featured-only first section has no empty heading', async () => {
  const page = await workbench.browser.newPage();
  try {
    await page.goto(`${workbench.baseURL}/iframe.html?id=data-filtertoolbar--docs&viewMode=docs`);
    await page.locator('.docs-story').first().waitFor();
    assert.ok(!(await page.locator('h2').allTextContents()).includes('Basic'));
    assert.ok(await page.locator('.docs-story').count() > 1);
  } finally {
    await page.close();
  }
});

test('unknown story names do not break the docs page', async () => {
  const page = await workbench.browser.newPage();
  try {
    await openDocsWithSections(page, 'data-filtertoolbar', [
      { title: 'Featured', stories: ['Default'] },
      { title: 'Missing', stories: ['MisspelledStory'] },
      { title: 'Filters', stories: ['Composed'] },
    ]);
    await page.waitForFunction(() => document.querySelectorAll('.docs-story').length === 2);
    assert.deepEqual(await page.locator('h2').allTextContents(), ['Filters']);
    assert.deepEqual(await page.locator('.docs-story').evaluateAll((elements) => elements.map((element) => element.querySelector('[id^="story--"]')?.id)), [
      'story--data-filtertoolbar--default--primary',
      'story--data-filtertoolbar--composed',
    ]);
  } finally {
    await page.close();
  }
});

test('empty sections use the same fallback as absent sections', async () => {
  const examples = [];
  for (const sections of [null, []]) {
    const page = await workbench.browser.newPage();
    try {
      await openDocsWithSections(page, 'showcase-paymentflow', sections);
      await page.locator('h2').filter({ hasText: /^Stories$/ }).waitFor();
      examples.push(await page.locator('.docs-story').evaluateAll((elements) => elements.map((element) => element.querySelector('[id^="story--"]')?.id)));
    } finally {
      await page.close();
    }
  }
  assert.ok(examples[0].length > 1);
  assert.deepEqual(examples[1], examples[0]);
});

test('curated PaymentFlow docs render each listed example once and keep QA stories reachable', async () => {
  const page = await workbench.browser.newPage();
  try {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${workbench.baseURL}/iframe.html?id=showcase-paymentflow--docs&viewMode=docs`);
      await page.locator('[data-ui="payment-flow"]').first().waitFor();
      await page.waitForFunction(() => document.querySelectorAll('[data-ui="payment-flow"]').length === 3);
      const examples = page.locator('.docs-story');
      assert.equal(await examples.count(), 3);
      const ids = await examples.evaluateAll((elements) => elements.map((element) =>
        element.querySelector('[id^="story--"]')?.id));
      assert.deepEqual(ids, [
        'story--showcase-paymentflow--default--primary',
        'story--showcase-paymentflow--vertical',
        'story--showcase-paymentflow--paused',
      ]);
      assert.ok(await examples.first().evaluate((element) =>
        Boolean(element.compareDocumentPosition(document.querySelector('.component-usage')) & Node.DOCUMENT_POSITION_FOLLOWING)));
      assert.deepEqual(await page.locator('h2').allTextContents(), ['Layout', 'Playback']);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth));
      for (const example of await examples.all()) {
        assert.ok(await example.evaluate((element) => element.scrollWidth <= element.clientWidth));
        const figure = example.locator('figure');
        const nodes = figure.locator('[data-ui="payment-flow-node"]');
        const first = await nodes.first().boundingBox();
        const last = await nodes.last().boundingBox();
        if (width === 390) assert.equal(first.x, last.x, 'auto orientation stacks in a narrow container');
        const toggle = example.getByRole('button', { name: /^(Pause|Resume)$/ });
        if (await toggle.textContent() === 'Pause') await toggle.click();
        const phase = await figure.getAttribute('data-phase');
        await example.getByRole('button', { name: 'Next phase', exact: true }).click();
        assert.notEqual(await figure.getAttribute('data-phase'), phase);
        await example.getByRole('button', { name: 'Replay', exact: true }).click();
        assert.equal(await figure.getAttribute('data-phase'), 'authorize');
        for (const button of await example.getByRole('button', { name: /^(Resume|Next phase|Replay)$/ }).all()) {
          const box = await button.boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= width, 'playback controls stay inside the viewport');
        }
      }
    }
    await page.goto(`${workbench.baseURL}/iframe.html?id=showcase-paymentflow--keyboard-replay&viewMode=story`);
    await page.locator('[data-ui="payment-flow"]').waitFor();
  } finally {
    await page.close();
  }
});
