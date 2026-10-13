import type { StorybookConfig } from '@storybook/react-vite';
import { documentThemeScript } from './document-theme';

// `title` is an internal preset key that seeds the static <title> ("<title> - Storybook"); it is
// absent from the public config typings, hence the extension.
const config = {
  title: 'jfrader ui',
  stories: [
    '../../../packages/ui/src/**/*.stories.@(ts|tsx)',
    '../home/**/*.@(mdx|stories.@(ts|tsx))',
    '../showcase/**/*.stories.@(ts|tsx)',
  ],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-themes', '@storybook/addon-vitest'],
  framework: '@storybook/react-vite',
  staticDirs: ['../public'],
  previewHead: (head) => `${head}${documentThemeScript}`,
  // The workbench is served under /storybook/ when it shares a domain with the docs front; its
  // asset URLs have to carry that prefix. Defaults to the root, which is how it deploys alone.
  viteFinal: async (vite) => ({ ...vite, base: process.env.STORYBOOK_BASE ?? '/' }),
} satisfies StorybookConfig & { title: string };

export default config;
