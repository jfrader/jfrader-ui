import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createBrowserWorkbench } from '../../../../../apps/storybook/scripts/browser-workbench.mjs';

let workbench;
before(async () => { workbench = await createBrowserWorkbench(); });
after(async () => workbench?.close());

test('forced colors keep every caret size visible with reduced motion', async () => {
  const context = await workbench.browser.newContext({
    viewport: { width: 390, height: 844 },
    forcedColors: 'active',
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    for (const story of ['default', 'small', 'large']) {
      await page.goto(`${workbench.baseURL}/iframe.html?id=feedback-streamingcaret--${story}&viewMode=story`);
      const caret = page.locator('[data-ui="streaming-caret"]');
      await caret.waitFor();
      const paint = await caret.evaluate((element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return {
          background: style.backgroundColor,
          foreground: style.color,
          animation: style.animationName,
          opacity: style.opacity,
          width: bounds.width,
          height: bounds.height,
        };
      });
      assert.equal(paint.background, paint.foreground, `${story}: caret must paint in the system text color`);
      assert.equal(paint.animation, 'none');
      assert.equal(paint.opacity, '1');
      assert.ok(paint.width > 0 && paint.height > 0);
      assert.equal(await caret.getAttribute('aria-hidden'), 'true');
    }
  } finally {
    await context.close();
  }
});
