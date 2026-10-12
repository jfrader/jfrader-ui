import { useLayoutEffect, useSyncExternalStore, type PropsWithChildren } from 'react';
import type { Decorator, Preview } from '@storybook/react-vite';
import { DocsContainer, type DocsContainerProps } from '@storybook/addon-docs/blocks';
import { DecoratorHelpers } from '@storybook/addon-themes';
import { GLOBALS_UPDATED, SET_GLOBALS } from 'storybook/internal/core-events';
import '@jfrader/tokens/tokens.css';
import './preview.css';
import { ComponentDocs } from './component-docs';
import { DEFAULT_THEME, THEMES } from './document-theme';
import { lightTheme, theme } from './theme';

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
    // WCAG 2.0–2.2 AA plus best-practice rules; `test: 'error'` fails the run on violations.
    a11y: {
      test: 'error',
      options: { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    },
    docs: {
      container: ThemedDocsContainer,
      page: ComponentDocs,
      // Snippets use Storybook's default (the story's rendered usage with its arg values).
      // Do not set source.type: 'code' here: the authored story source includes the play
      // tests, which read as examples. See GURI-2129.
    },
    options: {
      storySort: {
        order: ['Home', 'Foundations', 'Inputs', 'Pickers', 'Data display', 'Feedback', 'Navigation', 'Surfaces', 'Layout', 'Games', 'Showcase'],
      },
    },
  },
  // `!dev` follows the official Docs-only stories recipe: every story stays in its component's
  // docs page (inline, anchored) and out of the sidebar, so the tree navigates by component.
  tags: ['autodocs', 'test', '!dev'],
};

export default preview;
