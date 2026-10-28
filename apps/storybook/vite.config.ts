/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  // Compile JSX through Emotion's runtime so the `css` prop works in stories and components.
  plugins: [react({
    jsxImportSource: '@emotion/react'
  })],
  resolve: {
    alias: [
      {
        // See .storybook/emotion-jsx-dev-runtime.ts: works around the optimizer's broken
        // CJS interop for Emotion's dev JSX runtime inside this pipeline.
        find: /^@emotion\/react\/jsx-dev-runtime$/,
        replacement: path.join(import.meta.dirname, '.storybook/emotion-jsx-dev-runtime.ts')
      }
    ]
  },
  test: {
    projects: [{
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(import.meta.dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        setupFiles: path.join(import.meta.dirname, '.storybook/vitest.setup.ts'),
        testTimeout: 30000,
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium',
            provide: { touchInput: false },
          }, {
            browser: 'chromium',
            name: 'storybook (touch chromium)',
            provider: playwright({ contextOptions: { hasTouch: true } }),
            provide: { touchInput: true },
          }]
        }
      }
    }, {
      extends: true,
      test: {
        name: 'design',
        include: ['src/design-assertions.test.ts'],
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{ browser: 'chromium' }],
        },
      },
    }]
  }
});
