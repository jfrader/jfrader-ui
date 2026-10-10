// Renders og/og-card.html to public/og-image.png (1200x630), the Open Graph share card
// referenced by .storybook/manager-head.html. Run from apps/storybook: `pnpm og:image`.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const cardUrl = new URL('./og-card.html', import.meta.url);
const output = fileURLToPath(new URL('../public/og-image.png', import.meta.url));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2,
  });
  await page.goto(cardUrl.href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: output, scale: 'css' });
  console.log(`og-image.png written (${output})`);
} finally {
  await browser.close();
}
