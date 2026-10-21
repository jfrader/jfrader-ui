import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createBrowserWorkbench } from '../../../../../apps/storybook/scripts/browser-workbench.mjs';

let workbench;
before(async () => { workbench = await createBrowserWorkbench(); });
after(async () => workbench?.close());

test('radial previews and long fallback menus fit desktop, tablet, and phone viewports', async () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
    const context = await workbench.browser.newContext({ viewport, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      for (const story of ['default', 'light', 'long-action-list']) {
        await page.goto(`${workbench.baseURL}/iframe.html?id=showcase-radialmenu--${story}&viewMode=story`);
        const trigger = page.getByRole('button', { name: 'Note actions' });
        await trigger.waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${story}: preview overflow at ${viewport.width}px`);
        if (story !== 'long-action-list') await trigger.press('ArrowDown');
        const menu = page.getByRole('menu');
        await menu.waitFor();
        const bounds = await menu.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
        assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height);
      }
    } finally {
      await context.close();
    }
  }
});
