import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createBrowserWorkbench } from '../../../../../apps/storybook/scripts/browser-workbench.mjs';

let workbench;
const SETTLED_PRESS_MS = 600;

before(async () => { workbench = await createBrowserWorkbench(); });
after(async () => workbench?.close());

test('native touch toggles details and subsequent keyboard focus paints its ring', async () => {
  const context = await workbench.browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto(`${workbench.baseURL}/iframe.html?id=data-display-lineartimeline--native-input&viewMode=story`);
    const trigger = page.locator('[data-ui="hover-card-trigger"]').first();
    await trigger.waitFor();
    await trigger.tap();
    await page.getByRole('tooltip').waitFor();
    await page.waitForTimeout(SETTLED_PRESS_MS);
    assert.equal(await page.getByRole('tooltip').count(), 1, 'a tap must keep the summary open');
    await trigger.tap();
    await page.getByRole('tooltip').waitFor({ state: 'hidden' });
    await page.keyboard.press('Tab');
    const focused = page.locator('[data-ui="hover-card-trigger"]:focus-visible');
    await focused.waitFor();
    const ring = await focused.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    assert.notEqual(ring.style, 'none');
    assert.ok(ring.width >= 1.9, 'keyboard focus needs the library focus ring');
    await page.getByRole('tooltip').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('tooltip').waitFor({ state: 'hidden' });
    assert.equal(await focused.count(), 1, 'Escape must leave keyboard focus on the marker');
  } finally {
    await context.close();
  }
});
