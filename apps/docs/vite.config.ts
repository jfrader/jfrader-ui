import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // @jfrader/ui ships TSX source that uses Emotion's `css` prop, and this app imports
  // the library's own `.stories.tsx` modules (portable stories), which are compiled the
  // same way in Storybook's Vite pipeline.
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
    }),
  ],
  server: {
    port: 4300,
  },
});
