import { readFileSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(path.join(import.meta.dirname, 'package.json'), 'utf8'));
const externalPackages = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)];
const names = ['index', 'css', 'sx', 'native-scrollbar', 'theme', 'media'];

export default defineConfig({
  plugins: [react({ jsxImportSource: '@emotion/react' })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: Object.fromEntries(names.map((name) => [
        name, path.join(import.meta.dirname, 'src', `${name}.${name === 'sx' ? 'tsx' : 'ts'}`),
      ])),
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rolldownOptions: {
      external: (id) => externalPackages.some((name) => id === name || id.startsWith(`${name}/`)),
      output: { postBanner: "'use client';" },
    },
  },
});
