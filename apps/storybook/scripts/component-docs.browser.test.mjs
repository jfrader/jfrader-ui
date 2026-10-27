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
    await page.locator('.docs-story').first().waitFor({ timeout: 90_000 });
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
    await page.locator('#story--data-filtertoolbar--reduced-motion').waitFor();
    assert.deepEqual(await page.locator('h2').allTextContents(), ['Filters']);
    const ids = await page.locator('.docs-story').evaluateAll((elements) => elements.map((element) => element.querySelector('[id^="story--"]')?.id));
    assert.deepEqual(ids.slice(0, 2), [
      'story--data-filtertoolbar--default--primary',
      'story--data-filtertoolbar--composed',
    ]);
    assert.ok(ids.includes('story--data-filtertoolbar--reduced-motion'));
    assert.equal(new Set(ids).size, ids.length);
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

test('partial sections keep every unlisted example after the curated groups', async () => {
  for (const id of ['inputs-button', 'data-filtertoolbar']) {
    const examples = [];
    for (const sections of [null, [{ title: 'Featured', stories: ['Default'] }]]) {
      const page = await workbench.browser.newPage();
      try {
        await openDocsWithSections(page, id, sections);
        examples.push(await page.locator('.docs-story').evaluateAll((elements) => elements.map((element) => element.querySelector('[id^="story--"]')?.id)));
        if (sections) assert.deepEqual(await page.locator('h2').allTextContents(), []);
      } finally {
        await page.close();
      }
    }
    assert.ok(examples[0].length > 1);
    const storyIds = (ids) => [...new Set(ids.map((id) => id.replace(/--primary$/, '')))].sort();
    assert.deepEqual(storyIds(examples[1]), storyIds(examples[0]));
    assert.equal(storyIds(examples[1]).length, examples[1].length);
  }
});

test('curated PaymentFlow docs render every example once in capability order', async () => {
  const page = await workbench.browser.newPage();
  try {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${workbench.baseURL}/iframe.html?id=showcase-paymentflow--docs&viewMode=docs`);
      await page.locator('[data-ui="payment-flow"]').first().waitFor();
      await page.waitForFunction(() => document.querySelectorAll('.docs-story').length === 21);
      const examples = page.locator('.docs-story');
      assert.equal(await examples.count(), 21);
      const ids = await examples.evaluateAll((elements) => elements.map((element) =>
        element.querySelector('[id^="story--"]')?.id));
      assert.deepEqual(ids, [
        'story--showcase-paymentflow--default--primary',
        'story--showcase-paymentflow--horizontal',
        'story--showcase-paymentflow--vertical',
        'story--showcase-paymentflow--light',
        'story--showcase-paymentflow--rtl',
        'story--showcase-paymentflow--paused',
        'story--showcase-paymentflow--long-authorization',
        'story--showcase-paymentflow--keyboard-replay',
        'story--showcase-paymentflow--speed-zero',
        'story--showcase-paymentflow--controlled-pause-rejects',
        'story--showcase-paymentflow--jpy',
        'story--showcase-paymentflow--kwd',
        'story--showcase-paymentflow--locale-de',
        'story--showcase-paymentflow--intl-and-minor-units',
        'story--showcase-paymentflow--zero-amount-fee',
        'story--showcase-paymentflow--fee-equals-amount',
        'story--showcase-paymentflow--summary-sr-only',
        'story--showcase-paymentflow--caption-zero',
        'story--showcase-paymentflow--invalid-currency',
        'story--showcase-paymentflow--unsafe-amount',
        'story--showcase-paymentflow--missing-node',
      ]);
      assert.ok(await examples.first().evaluate((element) =>
        Boolean(element.compareDocumentPosition(document.querySelector('.component-usage')) & Node.DOCUMENT_POSITION_FOLLOWING)));
      assert.deepEqual(await page.locator('h2').allTextContents(), ['Layout', 'Playback', 'Currency and locale', 'Amounts and fees', 'Accessible narrative and caption', 'Invalid and missing values']);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth));
      for (const example of await examples.all()) {
        await example.scrollIntoViewIfNeeded();
        const figure = example.locator('figure');
        await figure.waitFor();
        assert.ok(await example.evaluate((element) => element.scrollWidth <= element.clientWidth));
        if (await example.getByRole('button').count() === 0) continue;
        const nodes = figure.locator('[data-ui="payment-flow-node"]');
        const first = await nodes.first().boundingBox();
        const last = await nodes.last().boundingBox();
        if (width === 390 && await figure.locator('[data-ui="payment-flow-scene"]').getAttribute('data-orientation') !== 'horizontal') assert.equal(first.x, last.x, 'auto orientation stacks in a narrow container');
        const toggle = example.getByRole('button', { name: /^(Pause|Resume)$/ });
        if (await toggle.textContent() === 'Pause') await toggle.click();
        if (await example.getByRole('button', { name: 'Next phase', exact: true }).isDisabled()) continue;
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
