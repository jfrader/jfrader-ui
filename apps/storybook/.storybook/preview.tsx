import { useLayoutEffect, useSyncExternalStore, type PropsWithChildren } from 'react';
import type { Decorator, Preview } from '@storybook/react-vite';
import { DocsContainer, type DocsContainerProps } from '@storybook/addon-docs/blocks';
import { DecoratorHelpers } from '@storybook/addon-themes';
import { GLOBALS_UPDATED, SET_GLOBALS } from 'storybook/internal/core-events';
import '@jfrader/tokens/tokens.css';
import './preview.css';
import { lightTheme, theme } from './theme';

const THEMES = ['dark', 'light'];
const DEFAULT_THEME = 'dark';

const { initializeThemeState } = DecoratorHelpers;

initializeThemeState(THEMES, DEFAULT_THEME);

function DocumentTheme({ theme, children }: PropsWithChildren<{ theme: string }>) {
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return <>{children}</>;
}

const withDocumentTheme: Decorator = (Story, context) => {
  if (context.viewMode === 'docs') return <Story />;

  const selected = context.globals.theme === 'light' ? 'light' : DEFAULT_THEME;
  return (
    <DocumentTheme theme={selected}>
      <Story />
    </DocumentTheme>
  );
};

function ThemedDocsContainer({ context, children, ...props }: PropsWithChildren<DocsContainerProps>) {
  const { channel } = context;
  const selected = useSyncExternalStore(
    (onChange) => {
      channel.on(GLOBALS_UPDATED, onChange);
      channel.on(SET_GLOBALS, onChange);
      return () => {
        channel.off(GLOBALS_UPDATED, onChange);
        channel.off(SET_GLOBALS, onChange);
      };
    },
    () => {
      const globals = channel.last(GLOBALS_UPDATED)?.[0]?.userGlobals ?? channel.last(SET_GLOBALS)?.[0]?.globals;
      return globals?.theme === 'light' ? 'light' : DEFAULT_THEME;
    },
  );

  return (
    <DocumentTheme theme={selected}>
      <DocsContainer {...props} context={context} theme={selected === 'light' ? lightTheme : theme}>
        {children}
      </DocsContainer>
    </DocumentTheme>
  );
}

const preview: Preview = {
  initialGlobals: { theme: DEFAULT_THEME },
  decorators: [withDocumentTheme],
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
      },
    },
    a11y: { test: 'error' },
    docs: { container: ThemedDocsContainer },
    options: {
      storySort: {
        order: ['Home', 'Foundations', 'Inputs', 'Pickers', 'Data display', 'Feedback', 'Navigation', 'Surfaces', 'Layout', 'Showcase'],
      },
    },
  },
  tags: ['autodocs', 'test'],
};

export default preview;
