import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdir, appendFile } from 'node:fs/promises';
import { createBrowserWorkbench } from '../../../../../apps/storybook/scripts/browser-workbench.mjs';

const require = createRequire(import.meta.url);
const evidence = process.env.OVERLAY_FOCUS_EVIDENCE;
let workbench;
before(async () => {
  workbench = await createBrowserWorkbench();
  if (evidence) await mkdir(evidence, { recursive: true });
});
after(async () => workbench?.close());

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function visibleFocus(page) {
  await settle(page);
  const focused = await page.evaluate(() => {
    const element = document.activeElement;
    const rect = element.getBoundingClientRect();
    const panel = element.closest('[data-ui="date-range-picker-content"]')?.getBoundingClientRect();
    const outline = parseFloat(getComputedStyle(element).outlineWidth);
    return {
      text: element.textContent,
      visible: rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth,
      uncovered: element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)),
      outline: getComputedStyle(element).outlineStyle,
      contained: !panel || (rect.top - outline >= panel.top && rect.bottom + outline <= panel.bottom),
    };
  });
  assert.ok(focused.visible && focused.uncovered && focused.contained && focused.outline !== 'none', JSON.stringify(focused));
}

async function doubleText(page) {
  await page.evaluate(() => {
    const sizes = [...document.querySelectorAll('*')].map(element => {
      const style = getComputedStyle(element);
      return { element, font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight) };
    });
    for (const { element, font, line } of sizes) {
      if (element === document.documentElement) continue;
      element.style.setProperty('font-size', `${font * 2}px`, 'important');
      if (Number.isFinite(line)) element.style.setProperty('line-height', `${line * 2}px`, 'important');
    }
  });
  await settle(page);
}

async function audit(page, name) {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        return (await window.axe.run(document)).violations;
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('Axe is already running')) throw error;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    throw new Error('Storybook axe scan did not release the analyzer');
  });
  if (evidence) {
    await page.screenshot({ path: `${evidence}/${name}.png` });
    await appendFile(`${evidence}/cells.jsonl`, `${JSON.stringify({ name, viewport: page.viewportSize(), violations })}\n`);
  }
  assert.deepEqual(violations.filter(v => ['serious', 'critical'].includes(v.impact)), []);
}

async function withStory(story, viewport, run, theme = 'light') {
  const context = await workbench.browser.newContext({ viewport, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(`${workbench.baseURL}/iframe.html?id=surfaces-overlay-focus-regressions--${story}&viewMode=story&embed=true`);
    await page.locator('#storybook-root button').first().waitFor();
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    await run(page);
  } finally { await context.close(); }
}

const viewports = [
  [320, 812], [375, 812], [390, 844], [639, 900], [640, 900], [641, 900],
  [768, 1024], [1023, 900], [1024, 900], [1025, 900], [1440, 900], [844, 390],
];
for (const story of ['owner', 'compact']) for (const [width, height] of viewports) for (const zoom of [1, 2]) {
  test(`${story} ${width}x${height} ${zoom * 100}% text: unfiltered axe and trusted focus exit`, async () => {
    await withStory(story, { width, height }, async page => {
      const trigger = page.getByRole('button', { name: /^Account(?:,|$)/ });
      await trigger.focus();
      await page.keyboard.press('Enter');
      const panel = page.locator(story === 'owner' ? '[data-ui="user-menu"]' : '[data-ui="popover"]');
      await panel.waitFor();
      if (zoom === 2) await doubleText(page);
      await settle(page);
      if (story === 'owner') {
        const clipped = await panel.locator('[data-ui="user-menu-identity"] span').evaluateAll(elements =>
          elements.filter(e => !e.closest('[aria-hidden="true"]') && e.childElementCount === 0 && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)).map(e => e.textContent));
        assert.deepEqual(clipped, []);
      }
      await audit(page, `${story}-${width}x${height}-${zoom * 100}`);
      if (story === 'compact') await page.keyboard.press('Tab');
      await visibleFocus(page);
      await page.keyboard.press('Shift+Tab');
      assert.ok(await trigger.evaluate(e => e === document.activeElement));
      await page.keyboard.press('Tab');
      if (story === 'compact') await page.keyboard.press('Tab');
      await visibleFocus(page);
      await page.keyboard.press('Tab');
      await panel.waitFor({ state: 'detached' });
      assert.ok(await page.getByRole('button', { name: 'After', exact: true }).evaluate(e => e === document.activeElement));
      await visibleFocus(page);
      await trigger.focus();
      await page.keyboard.press('Enter');
      await panel.waitFor();
      await page.keyboard.press('Escape');
      await panel.waitFor({ state: 'detached' });
      assert.ok(await trigger.evaluate(e => e === document.activeElement));
      await page.keyboard.press('Enter');
      await panel.waitFor();
      await page.mouse.click(1, 1);
      await panel.waitFor({ state: 'detached' });
      assert.ok(await trigger.evaluate(e => e !== document.activeElement));
    });
  });
}

for (const height of [479, 480, 481]) for (const theme of ['light', 'dark']) for (const locale of ['en', 'es']) {
  test(`dates 844x${height} ${theme} ${locale}: Cancel stays visible after trusted Tab and resize`, async () => {
    await withStory(locale === 'es' ? 'dates-spanish' : 'dates', { width: 844, height }, async page => {
      await page.getByRole('button', { name: /^Report period/ }).click();
      const dialog = page.locator('[data-ui="date-range-picker-content"]');
      await dialog.waitFor();
      const cancel = dialog.getByRole('button', { name: locale === 'es' ? 'Cancelar' : 'Cancel', exact: true });
      for (let i = 0; i < 15 && !await cancel.evaluate(e => e === document.activeElement); i++) await page.keyboard.press('Tab');
      assert.ok(await cancel.evaluate(e => e === document.activeElement));
      await visibleFocus(page);
      await audit(page, `dates-844x${height}-${theme}-${locale}`);
      const clipPath = await dialog.evaluate(element => {
        const previous = element.style.clipPath;
        element.style.clipPath = 'inset(0 0 100% 0)';
        return previous;
      });
      await assert.rejects(() => visibleFocus(page), /uncovered/);
      await dialog.evaluate((element, previous) => { element.style.clipPath = previous; }, clipPath);
      await cancel.focus();
      await visibleFocus(page);
      await page.setViewportSize({ width: 844, height: height - 160 });
      await settle(page);
      await visibleFocus(page);
      await page.keyboard.press('Enter');
      await dialog.waitFor({ state: 'detached' });
      assert.ok(await page.getByRole('button', { name: /^Report period/ }).evaluate(e => e === document.activeElement));
    }, theme);
  });
}
