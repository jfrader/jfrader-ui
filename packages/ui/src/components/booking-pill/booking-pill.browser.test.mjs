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
        ['showcase-bookingpill--docs', 'booking-pill'],
        ['showcase-controlcenter--default', 'control-center'],
        ['showcase-controlcenter--docs', 'control-center'],
        ['games-cardflights--deal-and-play', 'game-table'],
        ['games-cardflights--composed-board', 'game-table'],
        ['games-cardflights--every-card-deals', 'game-table'],
        ['games-cardflights--spanish-flight-back', 'card-flight'],
        ['games-flipgamecard--sizes', 'flip-game-card'],
      ]) {
        await page.goto(`${workbench.baseURL}/iframe.html?id=${story}&viewMode=${story.endsWith('--docs') ? 'docs' : 'story'}`);
        const roots = page.locator(`[data-ui="${marker}"]`);
        await roots.first().waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${story}: preview overflows at ${viewport.width}px`);
        for (const root of await roots.all()) {
          if (!await root.isVisible()) continue;
          const bounds = await root.boundingBox();
          assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= viewport.width + 1, `${story}: root escapes the viewport`);
          if (marker === 'game-table') assert.ok(bounds.width >= Math.min(600, viewport.width - 32), `${story}: table collapses to its controls' intrinsic width`);
          for (const control of await root.locator('button, [role="slider"]').all()) {
            const box = await control.boundingBox();
            if (!box) continue;
            assert.ok(box.x >= bounds.x - 1 && box.x + box.width <= bounds.x + bounds.width + 1, `${story}: control escapes the panel`);
            assert.ok(box.width >= 24 && box.height >= 24, `${story}: target is smaller than 24px`);
            if (await control.evaluate((element) => element.tagName === 'BUTTON')) {
              assert.ok(await control.evaluate((element) => element.scrollWidth <= element.clientWidth), `${story}: button text overflows its target`);
            }
          }
        }
      }
    } finally {
      await context.close();
    }
  }
});
