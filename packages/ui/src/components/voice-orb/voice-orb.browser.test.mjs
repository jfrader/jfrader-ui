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

async function traceClouds(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    const canvas = document.querySelector('[data-ui="voice-orb-visual"] canvas');
    window.orbCanvas = canvas;
    window.orbDraws = 0;
    window.orbFrames = [];
    const drawing = canvas.getContext('2d');
    const colors = Object.fromEntries(['listening', 'thinking', 'speaking'].map((state) => [
      getComputedStyle(canvas).getPropertyValue(`--ui-color-voice-orb-cloud-${state}`).trim(), state,
    ]));
    const gradients = new WeakMap();
    const clear = drawing.clearRect.bind(drawing);
    const gradient = drawing.createRadialGradient.bind(drawing);
    const fill = drawing.fillRect.bind(drawing);
    const scale = drawing.scale.bind(drawing);
    drawing.clearRect = (...args) => {
      window.orbDraws++;
      window.orbFrames.push({ state: canvas.parentElement.dataset.state, colors: {}, scale: 1 });
      return clear(...args);
    };
    drawing.createRadialGradient = (...args) => {
      const result = gradient(...args);
      const stop = result.addColorStop.bind(result);
      result.addColorStop = (offset, color) => {
        if (offset === 0 && colors[color]) gradients.set(result, colors[color]);
        return stop(offset, color);
      };
      return result;
    };
    drawing.fillRect = (...args) => {
      const state = gradients.get(drawing.fillStyle);
      const frame = window.orbFrames.at(-1);
      if (frame && state) frame.colors[state] = Math.max(frame.colors[state] ?? 0, drawing.globalAlpha);
      return fill(...args);
    };
    drawing.scale = (x, y) => {
      const frame = window.orbFrames.at(-1);
      if (frame) frame.scale = x;
      return scale(x, y);
    };
  });
}

test('state changes crossfade cloud layers without resetting speaking phase or replacing the canvas', async () => {
  const context = await workbench.browser.newContext({ reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage();
    await page.goto(`${workbench.baseURL}/iframe.html?id=media-voiceorb--state-transitions&viewMode=story`);
    await page.getByRole('img', { name: 'Ready' }).waitFor();
    await traceClouds(page);
    await page.getByRole('button', { name: 'Speaking', exact: true }).click();
    await page.waitForFunction(() => window.orbFrames.at(-1)?.scale > 1.09);
    await page.getByRole('button', { name: 'Thinking', exact: true }).click();
    await page.waitForFunction(() => {
      const frame = window.orbFrames.at(-1);
      return frame?.state === 'thinking' && frame.colors.thinking > 0.5 && (frame.colors.speaking ?? 0) < 0.001;
    });
    const frames = await page.evaluate(() => window.orbFrames);
    const start = frames.findIndex((frame) => frame.state === 'thinking');
    assert.ok(start > 0);
    assert.ok(frames[start].colors.speaking > 0.2, 'the old cloud must remain at the transition boundary');
    assert.ok((frames[start].colors.thinking ?? 0) < 0.2, 'the target tint must not snap on');
    assert.ok(frames.slice(start).some(({ colors }) => colors.thinking > 0.05 && colors.speaking > 0.05), 'both layers must coexist during the crossfade');
    assert.ok(Math.abs(frames[start].scale - frames[start - 1].scale) < 0.04, 'state changes must retain the ongoing silhouette phase');
    assert.equal(await page.evaluate(() => window.orbCanvas === document.querySelector('canvas')), true);
  } finally {
    await context.close();
  }
});

test('reduced-motion state switches immediately paint the current tint on the same still canvas', async () => {
  const context = await workbench.browser.newContext({ reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(`${workbench.baseURL}/iframe.html?id=media-voiceorb--state-transitions&viewMode=story`);
    await page.getByRole('img', { name: 'Ready' }).waitFor();
    await traceClouds(page);
    let previous = await waitForStill(page);
    for (const [state, name] of [['listening', 'Listening'], ['thinking', 'Thinking'], ['speaking', 'Speaking'], ['idle', 'Ready']]) {
      const offset = await page.evaluate(() => window.orbFrames.length);
      await page.getByRole('button', { name, exact: true }).click();
      const stopped = await waitForStill(page);
      assert.notEqual(stopped.image, previous.image, `${state} must repaint despite having no animation loop`);
      const frames = await page.evaluate((offset) => window.orbFrames.slice(offset), offset);
      assert.ok(frames.length > 0, 'state changes request an immediate paint');
      for (const frame of frames) {
        assert.equal(frame.state, state);
        assert.deepEqual(Object.keys(frame.colors), state === 'idle' ? [] : [state], 'even the first paint must use the new target, not stale spring weights');
      }
      const still = await sample(page);
      assert.equal(still.draws, stopped.draws);
      assert.equal(still.image, stopped.image);
      assert.equal(await page.evaluate(() => window.orbCanvas === document.querySelector('canvas')), true);
      previous = stopped;
    }
  } finally {
    await context.close();
  }
});

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
