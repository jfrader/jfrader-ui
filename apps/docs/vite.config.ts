import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { reactStorydocs } from '@jfrader/react-storydocs/vite';
import config from './docs.config.mjs';

export default defineConfig({
  // The docs share a service with the Storybook workbench, which serves them under /docs/. Local
  // development stays at the root.
  base: process.env.DOCS_BASE ?? '/',
  plugins: [reactStorydocs({ config }), react({ jsxImportSource: '@emotion/react' })],
  resolve: {
    alias: [{
      find: /^@storybook\/addon-docs\/blocks$/,
      replacement: fileURLToPath(new URL('./src/storybook-blocks.ts', import.meta.url)),
    }],
    // Stories are rendered from the linked design system's own files, so anything it imports
    // resolves to its copy rather than this app's: two instances of the styling runtime means a
    // story that provides a cache (Next.js registry) or reads a context sees a different one
    // than the components do. Dedupe resolves them from this app instead.
    dedupe: ['@emotion/react', '@emotion/cache'],
  },
});
