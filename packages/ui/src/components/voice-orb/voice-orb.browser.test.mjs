import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createBrowserWorkbench } from '../../../../../apps/storybook/scripts/browser-workbench.mjs';

let workbench;

before(async () => {
  workbench = await createBrowserWorkbench();
});

after(async () => workbench?.close());

async function sample(page) {
  return page.evaluate(async () => {
    for (let frame = 0; frame < 8; frame++) {
      await new Promise(requestAnimationFrame);
    }
    return {
      draws: window.orbDraws,
      image: document.querySelector('[data-ui="voice-orb-visual"] canvas').toDataURL(),
    };
  });
}

async function waitForStill(page) {
  return page.evaluate(async () => {
    let previous = window.orbDraws;
    let quietFrames = 0;
    for (let frame = 0; frame < 120; frame++) {
      await new Promise(requestAnimationFrame);
      quietFrames = window.orbDraws === previous ? quietFrames + 1 : 0;
      previous = window.orbDraws;
      if (quietFrames === 8) {
        return {
          draws: previous,
          image: document.querySelector('[data-ui="voice-orb-visual"] canvas').toDataURL(),
        };
      }
    }
    throw new Error('Reduced motion did not produce eight consecutive still frames');
  });
}

test('speaking moves the whole volume at steady output while idle and listening stay calm', async () => {
  const context = await workbench.browser.newContext({ reducedMotion: 'no-preference' });
  try {
    const spans = {};
    for (const state of ['default-idle', 'listening', 'speaking']) {
      const page = await context.newPage();
      await page.goto(`${workbench.baseURL}/iframe.html?id=media-voiceorb--${state}&viewMode=story`);
      await page.getByRole('img').waitFor();
      spans[state] = await page.evaluate(async () => {
        const drawing = document.querySelector('[data-ui="voice-orb-visual"] canvas').getContext('2d');
        const scale = drawing.scale.bind(drawing);
        const widths = [];
        drawing.scale = (x, y) => {
          widths.push(x);
          return scale(x, y);
        };
        try {
          for (let frame = 0; frame < 100; frame++) await new Promise(requestAnimationFrame);
          return widths.length ? Math.max(...widths) - Math.min(...widths) : 0;
        } finally {
          drawing.scale = scale;
        }
      });
      await page.close();
    }
    assert.equal(spans['default-idle'], 0);
    assert.ok(spans.listening < 0.035);
    assert.ok(spans.speaking > 0.12, 'steady outputLevel=0.65 must visibly reshape the speaking orb');
  } finally {
    await context.close();
  }
});

test('speaking canvas stops and resumes when reduced-motion preference changes live', async () => {
  const context = await workbench.browser.newContext({ reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage();
    await page.goto(`${workbench.baseURL}/iframe.html?id=media-voiceorb--speaking&viewMode=story`);
    const visual = page.getByRole('img', { name: 'Speaking' });
    await visual.waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      const canvas = document.querySelector('[data-ui="voice-orb-visual"] canvas');
      window.orbCanvas = canvas;
      window.orbDraws = 0;
      const drawing = canvas.getContext('2d');
      const clear = drawing.clearRect.bind(drawing);
      drawing.clearRect = (...args) => {
        window.orbDraws++;
        return clear(...args);
      };
    });
    await page.waitForFunction(() => window.orbDraws > 2);

    for (let change = 0; change < 2; change++) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const stopped = await waitForStill(page);
      const still = await sample(page);
      assert.equal(still.draws, stopped.draws, 'reduced motion must cancel the drawing loop');
      assert.equal(still.image, stopped.image, 'reduced motion must hold a still frame');
      assert.equal(await visual.getAttribute('data-state'), 'speaking');
      assert.equal(await page.evaluate(() => window.orbCanvas === document.querySelector('canvas')), true);

      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForFunction((draws) => window.orbDraws > draws + 2, still.draws);
      const resumed = await sample(page);
      assert.notEqual(resumed.image, still.image, 'restoring motion must resume the orb');
    }
  } finally {
    await context.close();
  }
});
