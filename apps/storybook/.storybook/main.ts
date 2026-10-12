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
} satisfies StorybookConfig & { title: string };

export default config;
