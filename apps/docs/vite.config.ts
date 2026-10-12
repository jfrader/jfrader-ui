import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { storybookDocs } from '@jfrader/storybook-docs/vite';
import config from './docs.config.mjs';

export default defineConfig({
  plugins: [storybookDocs({ config }), react({ jsxImportSource: '@emotion/react' })],
  resolve: {
    // Stories are rendered from the linked design system's own files, so anything it imports
    // resolves to its copy rather than this app's: two instances of the styling runtime means a
    // story that provides a cache (Next.js registry) or reads a context sees a different one
    // than the components do. Dedupe resolves them from this app instead.
    dedupe: ['@emotion/react', '@emotion/cache'],
  },
});
