import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const storybookUrl = process.argv[2] ?? 'http://localhost:6006';
const pixelTolerance = 2;
const edgeRowCount = 3;
const sizes = [32, 72, 112];
const stories = [
  ['games-gamecard--default', 'emoji'],
  ['games-gamecard--face-down', 'back'],
  ['games-flipgamecard--default', 'emoji'],
  ['games-flipgamecard--flipped', 'back'],
  ['games-flipgamecard--front-final-state', 'emoji'],
  ['games-flipgamecard--back-final-state', 'back'],
];

async function measureEdges(element, { base64, edgeRowCount, deviceScaleFactor, pixelTolerance }) {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Missing pixel canvas');
  context.drawImage(image, 0, 0);
  const style = getComputedStyle(element);
  const start = (Math.ceil(Number.parseFloat(style.borderBottomLeftRadius)) + Math.ceil(Number.parseFloat(style.borderBottomWidth))) * deviceScaleFactor;
  const end = image.width - start;
  if (end <= start) throw new Error('No straight edge to sample');
  const rows = { top: [], bottom: [] };
  for (const edge of ['top', 'bottom']) {
    for (let offset = 0; offset < edgeRowCount * deviceScaleFactor; offset++) {
      const y = edge === 'top' ? offset : image.height - 1 - offset;
      rows[edge].push(Array.from({ length: end - start }, (_, index) =>
        Array.from(context.getImageData(start + index, y, 1, 1).data).slice(0, 3),
      ));
    }
  }

  const back = element.querySelector('[data-ui="game-card-back"]');
  const material = back ? getComputedStyle(back).backgroundColor : style.backgroundColor;
  const swatch = document.createElement('span');
  swatch.style.backgroundColor = 'var(--ui-color-bg)';
  element.append(swatch);
  const pageColor = getComputedStyle(swatch).backgroundColor;
  swatch.remove();
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = pageColor;
  context.fillRect(0, 0, 1, 1);
  const background = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = material;
  context.fillRect(0, 0, 1, 1);
  context.fillStyle = style.borderBottomColor;
  context.fillRect(0, 0, 1, 1);
  const expected = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
  const direction = background.map((channel, index) => channel - expected[index]);
  const lengthSquared = direction.reduce((sum, channel) => sum + channel * channel, 0);
  const errors = {};
  for (const [edge, samples] of Object.entries(rows)) {
    const rowErrors = samples.map(row => Math.max(...row.flatMap(pixel =>
      pixel.map((channel, index) => Math.abs(channel - expected[index])),
    )));
    const border = Math.min(...rowErrors);
    const borderRow = rowErrors.findIndex(error => error <= pixelTolerance);
    let uniformBand = 0;
    for (const row of samples.slice(0, borderRow + 1)) {
      const spread = Math.max(...expected.map((_, index) =>
        Math.max(...row.map(pixel => pixel[index])) - Math.min(...row.map(pixel => pixel[index])),
      ));
      if (spread > pixelTolerance) continue;
      const color = row[0];
      const projection = lengthSquared === 0 ? 0 : color.reduce((sum, channel, index) =>
        sum + (channel - expected[index]) * direction[index], 0) / lengthSquared;
      const coverage = Math.max(0, Math.min(1, projection));
      uniformBand = Math.max(uniformBand, ...color.map((channel, index) =>
        Math.abs(channel - expected[index] - coverage * direction[index]),
      ));
    }
    errors[edge] = { border, uniformBand };
  }
  return { expected, errors, material };
}

const browser = await chromium.launch({ headless: true });
try {
  for (const deviceScaleFactor of [1, 4]) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor });
    for (const theme of ['dark', 'light']) {
      for (const [story, face] of stories) {
        const url = new URL('/iframe.html', storybookUrl);
        url.search = new URLSearchParams({ id: story, viewMode: 'story', globals: `theme:${theme}` }).toString();
        await page.goto(url.href);
        if (story.endsWith('-final-state')) {
          await page.locator(`[data-ui="flip-game-card"][data-state="${face === 'back' ? 'back' : 'front'}"]`).waitFor();
          await page.locator('[data-ui="flip-game-card-rotator"]').evaluate(async (element) => {
            await Promise.all(element.getAnimations().map(animation => animation.finished));
          });
        }
        const card = page.locator(`[data-ui="game-card"][data-face="${face}"]:visible`).first();
        await card.waitFor();
        for (const size of sizes) {
          await card.evaluate((element, width) => {
            const frame = element.closest('[data-ui="flip-game-card"]') ?? element;
            frame.style.setProperty('--game-card-width', `${width}px`);
            frame.style.setProperty('--flip-game-card-width', `${width}px`);
          }, size);
          const screenshot = await card.screenshot();
          const measurement = await card.evaluate(measureEdges, {
            base64: screenshot.toString('base64'), edgeRowCount, deviceScaleFactor, pixelTolerance,
          });
          for (const [edge, errors] of Object.entries(measurement.errors)) {
            const error = Math.max(errors.border, errors.uniformBand);
            assert.ok(error <= pixelTolerance,
              `${theme} ${story} ${size}px DPR ${deviceScaleFactor} ${edge}: band differs from ink over ${measurement.material}; expected ${measurement.expected}, border error ${errors.border}, unexpected uniform band error ${errors.uniformBand}`);
            console.log(`PASS ${theme} ${story} ${size}px DPR ${deviceScaleFactor} ${edge}: channel error ${error}/255`);
          }
        }
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}
