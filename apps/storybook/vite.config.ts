/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

const configDir = path.join(import.meta.dirname, ".storybook");

/**
 * Stories tagged `touch` assert `(pointer: coarse)` sizes. They run in their own browser context
 * with touch enabled, because touch emulation applies to the whole page and would leak into story
 * files running beside them.
 */
const storybookProject = (
  name: string,
  tags: { include?: string[]; exclude?: string[] },
  hasTouch = false,
) => ({
  extends: true,
  plugins: [storybookTest({ configDir, tags })],
  test: {
    name,
    setupFiles: path.join(configDir, "vitest.setup.ts"),
    // Stress stories (e.g. GameTable's aspect bands renders 84 tables) are CPU-bound:
    // 9.5s alone, ~20s on CI, and they time out at 30s once the suite runs in parallel.
    testTimeout: 60000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({ contextOptions: { hasTouch } }),
      instances: [
        {
          browser: "chromium" as const,
        },
      ],
    },
  },
});

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  // Compile JSX through Emotion's runtime so the `css` prop works in stories and components.
  plugins: [
    react({
      jsxImportSource: "@emotion/react",
    }),
  ],
  resolve: {
    alias: [
      {
        // See .storybook/emotion-jsx-dev-runtime.ts: works around the optimizer's broken
        // CJS interop for Emotion's dev JSX runtime inside this pipeline.
        find: /^@emotion\/react\/jsx-dev-runtime$/,
        replacement: path.join(
          import.meta.dirname,
          ".storybook/emotion-jsx-dev-runtime.ts",
        ),
      },
    ],
  },
  test: {
    projects: [
      // See plugin options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookProject("storybook", { exclude: ["touch"] }),
      storybookProject("storybook-touch", { include: ["touch"] }, true),
      {
        extends: true,
        test: {
          name: "design",
          include: ["src/design-assertions.test.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
