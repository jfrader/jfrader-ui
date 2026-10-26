import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const srcDir = path.join(import.meta.dirname, 'src');
const pkg = JSON.parse(readFileSync(path.join(import.meta.dirname, 'package.json'), 'utf8'));
const externalPackages = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)];
const iconEntries = Object.fromEntries(
  readdirSync(path.join(srcDir, 'generated'))
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => [`generated/${file.slice(0, -4)}`, path.join(srcDir, 'generated', file)]),
);

export default defineConfig({
  plugins: [
    react({ jsxImportSource: '@emotion/react' }),
    {
      name: 'icon-metadata',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'icons.json',
          source: readFileSync(path.join(import.meta.dirname, 'icons.json')),
        });
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: {
        index: path.join(srcDir, 'index.ts'),
        'svg-icon/index': path.join(srcDir, 'svg-icon/index.ts'),
        ...iconEntries,
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rolldownOptions: {
      external: (id) => externalPackages.some((name) => id === name || id.startsWith(`${name}/`)),
      output: { postBanner: "'use client';" },
    },
  },
});
