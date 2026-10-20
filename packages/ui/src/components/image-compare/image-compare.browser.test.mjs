import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../../../../apps/storybook/package.json', import.meta.url));
const { chromium } = require('playwright');
let baseURL = process.env.STORYBOOK_URL;
const frameSelector = '[data-ui="image-compare-frame"]';
const viewport = { width: 390, height: 844 };
let browser;
let server;

before(async () => {
  if (!baseURL) {
    const { preview } = await import(require.resolve('vite'));
    server = await preview({
      configFile: false,
      root: fileURLToPath(new URL('../../../../../apps/storybook', import.meta.url)),
      build: { outDir: 'storybook-static' },
      preview: { host: '127.0.0.1', port: 0, open: false },
    });
    baseURL = server.resolvedUrls.local[0].replace(/\/$/, '');
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
});
after(async () => {
  try {
    await browser?.close();
  } finally {
    await server?.close();
  }
});

async function fixture(run, { args = '', reducedMotion = 'no-preference', direction = 'ltr' } = {}) {
  const context = await browser.newContext({ hasTouch: true, viewport, reducedMotion });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/iframe.html?id=media-imagecompare--dark&viewMode=story&args=${args}`);
    const slider = page.getByRole('slider');
    await slider.waitFor();
    await page.evaluate((dir) => { document.documentElement.dir = dir; }, direction);
    const frame = page.locator(frameSelector);
    const box = await frame.boundingBox();
    assert.ok(box);
    assert.ok(box.x >= 0 && box.x + box.width <= viewport.width);
    const session = await context.newCDPSession(page);
    const touch = async (type, x = 0.5, y = 0.5) => {
      await session.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{
          x: box.x + box.width * x,
          y: box.y + box.height * y,
          id: 1,
        }],
      });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    };
    await run({ page, slider, frame, touch });
  } finally {
    await context.close();
  }
}

async function value(slider) {
  return Number(await slider.getAttribute('aria-valuenow'));
}

test('native touch transfers implicit handle capture and keeps dragging outside the handle', async () => {
  await fixture(async ({ page, slider, frame, touch }) => {
    await page.evaluate((selector) => {
      const frame = document.querySelector(selector);
      window.captureEvents = [];
      for (const type of ['gotpointercapture', 'lostpointercapture', 'pointercancel']) {
        frame.addEventListener(type, (event) => window.captureEvents.push({
          type, target: event.target.closest('[data-ui]')?.getAttribute('data-ui'),
        }));
      }
    }, frameSelector);
    await touch('touchStart');
    await touch('touchMove', 0.6);
    await touch('touchMove', 0.75);
    assert.notEqual(await slider.getAttribute('data-dragging'), null);
    assert.equal(await value(slider), 75);
    const captures = await page.evaluate(() => window.captureEvents);
    assert.ok(captures.some((event) => event.type === 'lostpointercapture' && event.target === 'image-compare-handle'));
    assert.ok(captures.some((event) => event.type === 'gotpointercapture' && event.target === 'image-compare-frame'));
    const position = await frame.evaluate((element) => Number.parseFloat(element.style.getPropertyValue('--image-compare-value')));
    assert.equal(position, 75);
    await touch('touchEnd');
    assert.equal(await slider.getAttribute('data-dragging'), null);
    assert.equal(await value(slider), 75);
  });
});

test('native touch from the image cancels cleanly and a fresh gesture works', async () => {
  await fixture(async ({ slider, touch }) => {
    await touch('touchStart', 0.25, 0.8);
    await touch('touchMove', 0.6, 0.8);
    await touch('touchMove', 0.7, 0.8);
    assert.equal(await value(slider), 70);
    await touch('touchCancel');
    assert.equal(await slider.getAttribute('data-dragging'), null);
    assert.equal(await value(slider), 70);
    await touch('touchStart', 0.7, 0.5);
    await touch('touchMove', 0.4, 0.5);
    await touch('touchMove', 0.3, 0.5);
    assert.equal(await value(slider), 30);
    await touch('touchEnd');
  });
});

test('native vertical touch tracks the reveal axis and releases capture on cancellation', async () => {
  await fixture(async ({ slider, touch, frame }) => {
    assert.equal(await slider.getAttribute('aria-orientation'), 'vertical');
    await touch('touchStart');
    await touch('touchMove', 0.5, 0.65);
    await touch('touchMove', 0.5, 0.8);
    assert.equal(await value(slider), 80);
    assert.notEqual(await slider.getAttribute('data-dragging'), null);
    assert.equal(await frame.evaluate((element) => element.style.getPropertyValue('--image-compare-value')), '80%');
    await touch('touchCancel');
    assert.equal(await slider.getAttribute('data-dragging'), null);
  }, { args: 'orientation:vertical' });
});

test('orthogonal touch remains available to page scrolling', async () => {
  await fixture(async ({ page, slider, touch }) => {
    await page.evaluate(() => { document.body.style.minHeight = '200vh'; });
    await touch('touchStart', 0.25, 0.8);
    await touch('touchMove', 0.25, 0.5);
    await touch('touchMove', 0.25, 0.2);
    await touch('touchEnd');
    assert.equal(await slider.getAttribute('data-dragging'), null);
    assert.equal(await value(slider), 50);
    assert.ok(await page.evaluate(() => scrollY > 0));
  });
});

test('native RTL touch and keyboard preserve direction with reduced motion', async () => {
  await fixture(async ({ slider, touch, frame }) => {
    await slider.focus();
    await slider.press('ArrowLeft');
    assert.equal(await value(slider), 51);
    await slider.press('Home');
    assert.equal(await value(slider), 0);
    await touch('touchStart', 0.8, 0.8);
    await touch('touchMove', 0.3, 0.8);
    await touch('touchMove', 0.2, 0.8);
    assert.equal(await value(slider), 80);
    await touch('touchEnd');
    assert.equal(await frame.evaluate((element) => element.style.getPropertyValue('--image-compare-value')), '80%');
    assert.equal(await slider.evaluate((element) => getComputedStyle(element).transform), 'matrix(1, 0, 0, 1, 0, 0)');
  }, { direction: 'rtl', reducedMotion: 'reduce' });
});

test('controlled rejection never moves the reveal during native touch or keyboard input', async () => {
  await fixture(async ({ slider, frame, touch, page }) => {
    await touch('touchStart', 0.4, 0.5);
    await touch('touchMove', 0.6, 0.5);
    await touch('touchMove', 0.8, 0.5);
    assert.notEqual(await slider.getAttribute('data-dragging'), null);
    assert.equal(await value(slider), 40);
    assert.equal(await frame.evaluate((element) => element.style.getPropertyValue('--image-compare-value')), '40%');
    await touch('touchEnd');
    await slider.press('End');
    await page.waitForTimeout(300);
    assert.equal(await value(slider), 40);
    assert.equal(await frame.evaluate((element) => element.style.getPropertyValue('--image-compare-value')), '40%');
  }, { args: 'value:40' });
});
