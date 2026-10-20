import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

export async function createBrowserWorkbench() {
  let baseURL = process.env.STORYBOOK_URL;
  let server;
  if (!baseURL) {
    server = await preview({
      configFile: false,
      root: fileURLToPath(new URL('..', import.meta.url)),
      build: { outDir: 'storybook-static' },
      preview: { host: '127.0.0.1', port: 0, open: false },
    });
    baseURL = server.resolvedUrls.local[0].replace(/\/$/, '');
  }
  try {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
    return {
      baseURL,
      browser,
      async close() {
        try {
          await browser.close();
        } finally {
          await server?.close();
        }
      },
    };
  } catch (error) {
    await server?.close();
    throw error;
  }
}
