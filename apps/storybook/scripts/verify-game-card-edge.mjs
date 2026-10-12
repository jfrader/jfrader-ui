import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const storybookUrl = process.argv[2] ?? 'http://localhost:6006';
const pixelTolerance = 2;
const edgeRowCount = 3;
const sizes = [32, 72, 112];
const stories = [
  ...['diagonal', 'checks'].flatMap(pattern => [
    ['games-gamecard--back-patterns', 'emoji', `[data-test-pattern="${pattern}"][data-face="emoji"]`, pattern],
    ['games-gamecard--back-patterns', 'back', `[data-test-pattern="${pattern}"][data-face="back"]`, pattern],
    ['games-flipgamecard--pattern-fronts', 'emoji', `[data-test-pattern="${pattern}"] [data-face="emoji"]`, pattern],
    ['games-flipgamecard--pattern-backs', 'back', `[data-test-pattern="${pattern}"] [data-face="back"]`, pattern],
  ]),
  ['games-gamecard--default', 'emoji'],
  ['games-gamecard--face-down', 'back'],
  ['games-flipgamecard--default', 'emoji'],
  ['games-flipgamecard--front-final-state', 'emoji'],
  ['games-flipgamecard--back-final-state', 'back'],
];

async function measureEdges(element, { base64, edgeRowCount, deviceScaleFactor, pixelTolerance, edges }) {
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
  const rows = Object.fromEntries(edges.map(edge => [edge, []]));
  for (const edge of edges) {
    for (let offset = 0; offset < edgeRowCount * deviceScaleFactor; offset++) {
      const horizontal = edge === 'top' || edge === 'bottom';
      const cross = edge === 'top' || edge === 'left' ? offset : (horizontal ? image.height : image.width) - 1 - offset;
      rows[edge].push(Array.from({ length: (horizontal ? end : image.height - start) - start }, (_, index) =>
        Array.from(context.getImageData(horizontal ? start + index : cross, horizontal ? cross : start + index, 1, 1).data).slice(0, 3),
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

async function measureTileEdges(svg, { base64, deviceScaleFactor, pixelTolerance }) {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Missing tile canvas');
  context.drawImage(image, 0, 0);
  const tile = svg.querySelector('pattern');
  const period = Number(tile.getAttribute('width')) * deviceScaleFactor;
  const inks = [tile.querySelector('rect'), tile.querySelector('g')].map(node => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = getComputedStyle(node).fill;
    context.fillRect(0, 0, 1, 1);
    const color = Array.from(context.getImageData(0, 0, 1, 1).data);
    if (color[3] !== 255) throw new Error('Card tiles must be opaque');
    return color;
  });
  const inkDirection = inks[1].map((channel, index) => channel - inks[0][index]);
  const inkLengthSquared = inkDirection.reduce((sum, channel) => sum + channel * channel, 0);
  const card = svg.closest('[data-ui="game-card"]');
  const margin = Math.ceil(Number.parseFloat(getComputedStyle(card).borderTopLeftRadius)) * deviceScaleFactor;
  const inset = 2 * deviceScaleFactor;
  const edges = {};
  for (const edge of ['top', 'bottom', 'left', 'right']) {
    const horizontal = edge === 'top' || edge === 'bottom';
    const length = horizontal ? image.width : image.height;
    const cross = edge === 'top' || edge === 'left' ? inset : (horizontal ? image.height : image.width) - 1 - inset;
    let error = 0;
    let paintError = 0;
    let samples = 0;
    for (let position = margin; position < length - margin - period; position++) {
      const read = offset => Array.from(context.getImageData(horizontal ? offset : cross, horizontal ? cross : offset, 1, 1).data);
      const a = read(position);
      const b = read(position + period);
      error = Math.max(error, ...a.map((channel, index) => Math.abs(channel - b[index])));
      for (const color of [a, b]) {
        const projection = color.reduce((sum, channel, index) =>
          sum + (channel - inks[0][index]) * inkDirection[index], 0) / inkLengthSquared;
        const coverage = Math.max(0, Math.min(1, projection));
        paintError = Math.max(paintError, ...color.map((channel, index) =>
          Math.abs(channel - inks[0][index] - coverage * inkDirection[index]),
        ));
      }
      samples++;
    }
    if (!samples) throw new Error(`No tile samples for ${edge}`);
    if (error > pixelTolerance) throw new Error(`${edge} tile discontinuity: ${error}/255`);
    if (paintError > pixelTolerance) throw new Error(`${edge} crop seam contains foreign paint: ${paintError}/255`);
    edges[edge] = { samples, error, paintError };
  }
  return edges;
}

const browser = await chromium.launch({ headless: true });
try {
  for (const deviceScaleFactor of [1, 4]) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor });
    for (const theme of ['dark', 'light']) {
      for (const [story, face, selector, pattern] of stories) {
        const url = new URL('/iframe.html', storybookUrl);
        url.search = new URLSearchParams({ id: story, viewMode: 'story', globals: `theme:${theme}` }).toString();
        await page.goto(url.href);
        if (story.endsWith('-final-state')) {
          await page.locator(`[data-ui="flip-game-card"][data-state="${face === 'back' ? 'back' : 'front'}"]`).waitFor();
          await page.locator('[data-ui="flip-game-card-rotator"]').evaluate(async (element) => {
            await Promise.all(element.getAnimations().map(animation => animation.finished));
          });
        }
        const card = page.locator(selector ?? `[data-ui="game-card"][data-face="${face}"]:visible`).first();
        await card.waitFor();
        if (face === 'back' && pattern) {
          assert.equal(await card.locator(`[data-ui="pattern"][data-variant="${pattern}"]`).count(), 1,
            `${story} must render the ${pattern} Pattern, not the previous CSS back`);
        }
        for (const size of sizes) {
          await card.evaluate((element, width) => {
            const frame = element.closest('[data-ui="flip-game-card"]') ?? element;
            frame.style.setProperty('--game-card-width', `${width}px`);
            frame.style.setProperty('--flip-game-card-width', `${width}px`);
          }, size);
          const screenshot = await card.screenshot();
          const measurement = await card.evaluate(measureEdges, {
            base64: screenshot.toString('base64'), edgeRowCount, deviceScaleFactor, pixelTolerance,
            edges: pattern ? ['top', 'bottom', 'left', 'right'] : ['top', 'bottom'],
          });
          for (const [edge, errors] of Object.entries(measurement.errors)) {
            const error = Math.max(errors.border, errors.uniformBand);
            assert.ok(error <= pixelTolerance,
              `${theme} ${story} ${size}px DPR ${deviceScaleFactor} ${edge}: band differs from ink over ${measurement.material}; expected ${measurement.expected}, border error ${errors.border}, unexpected uniform band error ${errors.uniformBand}`);
            console.log(`PASS ${theme} ${story} ${size}px DPR ${deviceScaleFactor} ${edge}: channel error ${error}/255`);
          }
          if (face === 'back' && pattern) {
            const svg = card.locator('[data-ui="pattern"]');
            const tileScreenshot = await svg.screenshot();
            const seams = await svg.evaluate(measureTileEdges, {
              base64: tileScreenshot.toString('base64'), deviceScaleFactor, pixelTolerance,
            });
            for (const [edge, seam] of Object.entries(seams)) {
              console.log(`SEAM ${theme} ${pattern} ${story} ${size}px DPR ${deviceScaleFactor} ${edge}: ${seam.samples} samples, repeat error ${seam.error}/255, paint error ${seam.paintError}/255`);
            }
          }
        }
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}
