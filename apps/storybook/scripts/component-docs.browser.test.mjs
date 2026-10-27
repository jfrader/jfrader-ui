import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createBrowserWorkbench } from './browser-workbench.mjs';

let workbench;
before(async () => { workbench = await createBrowserWorkbench(); });
after(async () => workbench?.close());

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
