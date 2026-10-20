import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createBrowserWorkbench } from '../../../../../apps/storybook/scripts/browser-workbench.mjs';

let workbench;
before(async () => { workbench = await createBrowserWorkbench(); });
after(async () => workbench?.close());

test('phone-width dialogs contain their panel without horizontal clipping', async () => {
  const context = await workbench.browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(`${workbench.baseURL}/iframe.html?id=surfaces-commandpalette--open&viewMode=story`);
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    const geometry = await dialog.evaluate((node) => {
      const panel = node.firstElementChild.getBoundingClientRect();
      const bounds = node.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, panelRight: panel.right, viewport: innerWidth,
        scroll: node.scrollWidth, client: node.clientWidth };
    });
    assert.ok(geometry.left >= 0 && geometry.right <= geometry.viewport);
    assert.ok(geometry.panelRight <= geometry.right + 1);
    assert.ok(geometry.scroll <= geometry.client + 1);
  } finally { await context.close(); }
});

test('short viewports scroll results without clipping the dialog or moving the input', async () => {
  const context = await workbench.browser.newContext({ viewport: { width: 768, height: 300 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(`${workbench.baseURL}/iframe.html?id=surfaces-commandpalette--disabled-and-scrollable&viewMode=story`);
    await page.waitForFunction(() => window.__STORYBOOK_PREVIEW__?.currentRender?.phase === 'finished');
    const trigger = page.getByRole('button', { name: 'Open commands' });
    await trigger.waitFor();
    if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
    const input = page.getByRole('combobox');
    await input.waitFor();
    await input.press('Home');
    const before = await input.boundingBox();
    await input.press('End');
    await page.waitForFunction(() => document.querySelector('[role="listbox"]').scrollTop > 0);
    const geometry = await page.getByRole('dialog').evaluate((dialog) => {
      const bounds = dialog.getBoundingClientRect();
      const input = dialog.querySelector('input');
      const list = dialog.querySelector('[role="listbox"]');
      return { bottom: bounds.bottom, top: bounds.top, height: innerHeight,
        scroll: dialog.scrollHeight, client: dialog.clientHeight,
        inputHeight: input.getBoundingClientRect().height,
        overscroll: getComputedStyle(list).overscrollBehaviorY };
    });
    assert.ok(geometry.top >= 0 && geometry.bottom <= geometry.height);
    assert.ok(geometry.scroll <= geometry.client + 1);
    assert.equal(geometry.inputHeight, 48);
    assert.equal(geometry.overscroll, 'contain');
    assert.equal((await input.boundingBox()).y, before.y);
    assert.equal(await input.evaluate((node) => node === document.activeElement), true);
  } finally { await context.close(); }
});
