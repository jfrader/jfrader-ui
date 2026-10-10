import path from 'node:path';
import { defineConfig } from 'vite';

const srcDir = path.join(import.meta.dirname, 'src');

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: {
        index: path.join(srcDir, 'index.ts'),
        'generated/vars': path.join(srcDir, 'generated/vars.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
  },
});
