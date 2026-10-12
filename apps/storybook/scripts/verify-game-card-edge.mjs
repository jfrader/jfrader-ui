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
];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  for (const theme of ['dark', 'light']) {
    for (const [story, face] of stories) {
      const url = new URL('/iframe.html', storybookUrl);
      url.search = new URLSearchParams({ id: story, viewMode: 'story', globals: `theme:${theme}` }).toString();
      await page.goto(url.href);
      const card = page.locator(`[data-ui="game-card"][data-face="${face}"]:visible`).first();
      await card.waitFor();
      for (const size of sizes) {
        await card.evaluate((element, width) => {
          const frame = element.closest('[data-ui="flip-game-card"]') ?? element;
          frame.style.setProperty('--game-card-width', `${width}px`);
          frame.style.setProperty('--flip-game-card-width', `${width}px`);
        }, size);
        const screenshot = await card.screenshot();
        const measurement = await card.evaluate(async (element, { base64, edgeRowCount }) => {
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
          const rows = [];
          const start = Math.ceil(Number.parseFloat(style.borderBottomLeftRadius)) + Math.ceil(Number.parseFloat(style.borderBottomWidth));
          const end = image.width - start;
          for (let y = image.height - edgeRowCount; y < image.height; y++) {
            rows.push(Array.from({ length: end - start }, (_, index) =>
              Array.from(context.getImageData(start + index, y, 1, 1).data).slice(0, 3),
            ));
          }
          const back = element.querySelector('[data-ui="game-card-back"]');
          const material = back ? getComputedStyle(back).backgroundColor : style.backgroundColor;
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = material;
          context.fillRect(0, 0, 1, 1);
          context.fillStyle = style.borderBottomColor;
          context.fillRect(0, 0, 1, 1);
          const expected = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
          const error = Math.min(...rows.map(row => Math.max(...row.flatMap(pixel =>
            pixel.map((channel, index) => Math.abs(channel - expected[index])),
          ))));
          return { expected, error, material, rows };
        }, { base64: screenshot.toString('base64'), edgeRowCount });
        assert.ok(measurement.error <= pixelTolerance,
          `${theme} ${story} ${size}px: bottom band differs from ink over ${measurement.material}; expected ${measurement.expected}, maximum channel error ${measurement.error}`);
        console.log(`PASS ${theme} ${story} ${size}px: bottom-band channel error ${measurement.error}/255`);
      }
    }
  }
} finally {
  await browser.close();
}
