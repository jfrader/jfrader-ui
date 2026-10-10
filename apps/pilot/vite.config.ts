import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // @jfrader/ui ships TSX source that uses Emotion's `css` prop, so it compiles through Emotion's runtime.
  plugins: [react({
    jsxImportSource: '@emotion/react'
  })]
});
