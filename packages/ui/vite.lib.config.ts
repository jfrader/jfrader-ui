import { readFileSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const srcDir = path.join(import.meta.dirname, 'src');
const componentsDir = path.join(srcDir, 'components');

const pkg = JSON.parse(readFileSync(path.join(import.meta.dirname, 'package.json'), 'utf8'));
// Optional peers (shiki) are external too: only their opt-in subpath imports them.
const externalPackages = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})];

// One entry per exports-map subpath so `dist/<name>.js` can back `@jfrader/ui/<name>`:
// `./<component>` builds from its index, `./<component>/<module>` from the module beside it.
const componentEntries = Object.fromEntries(
  Object.keys(pkg.exports)
    .filter((subpath) => subpath !== '.')
    .map((subpath) => subpath.slice('./'.length))
    .map((name) => [name, path.join(componentsDir, name.includes('/') ? `${name}.ts` : `${name}/index.ts`)]),
);

export default defineConfig({
  // Same Emotion JSX runtime as the Storybook app so the `css` prop compiles.
  plugins: [react({ jsxImportSource: '@emotion/react' })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: { index: path.join(srcDir, 'index.ts'), ...componentEntries },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rolldownOptions: {
      // Dependencies and peers (react, react-dom, @emotion/react, @floating-ui/react, @jfrader/tokens)
      // and their subpaths (react/jsx-runtime, @emotion/react/jsx-runtime, @jfrader/tokens/vars) stay external.
      external: (id) => externalPackages.some((name) => id === name || id.startsWith(`${name}/`)),
      // Every chunk is a client module for React Server Components; postBanner lands after minification.
      output: { postBanner: "'use client';" },
    },
  },
});
