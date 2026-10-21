import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createBrowserWorkbench } from '../../../../../apps/storybook/scripts/browser-workbench.mjs';

let workbench;
before(async () => { workbench = await createBrowserWorkbench(); });
after(async () => workbench?.close());

test('sharing previews fit desktop, tablet, and phone viewports', async () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
    const context = await workbench.browser.newContext({ viewport, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      for (const story of ['default', 'light', 'link-access', 'rtl']) {
        await page.goto(`${workbench.baseURL}/iframe.html?id=actions-shareaccess--${story}&viewMode=story`);
        const root = page.locator('[data-ui="share-access"]');
        await root.waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${story}: preview overflow at ${viewport.width}px`);
        const bounds = await root.boundingBox();
        for (const control of await root.locator('button, input').all()) {
          const box = await control.boundingBox();
          if (!box) continue;
          assert.ok(box.x >= bounds.x - 1 && box.x + box.width <= bounds.x + bounds.width + 1);
        }
      }
    } finally {
      await context.close();
    }
  }
});
