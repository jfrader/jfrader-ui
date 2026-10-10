import type { Preview } from '@storybook/react-vite';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import '@jfrader/tokens/tokens.css';
import './preview.css';
import { theme } from './theme';

const preview: Preview = {
  decorators: [
    withThemeByDataAttribute({
      themes: { dark: 'dark', light: 'light' },
      defaultTheme: 'dark',
      attributeName: 'data-theme',
    }),
  ],
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
      },
    },
    a11y: { test: 'error' },
    docs: { theme },
    options: {
      storySort: { order: ['Home', 'Showcase', 'Components'] },
    },
  },
  tags: ['autodocs', 'test'],
};

export default preview;
