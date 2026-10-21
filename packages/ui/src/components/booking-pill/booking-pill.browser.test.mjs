import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createBrowserWorkbench } from '../../../../../apps/storybook/scripts/browser-workbench.mjs';

let workbench;
before(async () => { workbench = await createBrowserWorkbench(); });
after(async () => workbench?.close());

test('booking and game previews keep their controls inside narrow viewports', async () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
    const context = await workbench.browser.newContext({ viewport, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      for (const [story, marker] of [
        ['showcase-bookingpill--date', 'booking-pill'],
        ['showcase-bookingpill--long-content', 'booking-pill'],
        ['showcase-controlcenter--default', 'control-center'],
        ['games-cardflights--deal-and-play', 'game-table'],
        ['games-cardflights--composed-board', 'game-table'],
        ['games-flipgamecard--sizes', 'flip-game-card'],
      ]) {
        await page.goto(`${workbench.baseURL}/iframe.html?id=${story}&viewMode=story`);
        const root = page.locator(`[data-ui="${marker}"]`).first();
        await root.waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${story}: preview overflows at ${viewport.width}px`);
        const bounds = await root.boundingBox();
        if (marker === 'game-table') assert.ok(bounds.width >= Math.min(600, viewport.width - 32), `${story}: table collapses to its controls' intrinsic width`);
        for (const control of await root.locator('button, [role="slider"]').all()) {
          const box = await control.boundingBox();
          if (!box) continue;
          assert.ok(box.x >= bounds.x - 1 && box.x + box.width <= bounds.x + bounds.width + 1, `${story}: control escapes the panel`);
          assert.ok(box.width >= 24 && box.height >= 24, `${story}: target is smaller than 24px`);
        }
      }
    } finally {
      await context.close();
    }
  }
});
