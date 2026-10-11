import { useLayoutEffect, useSyncExternalStore, type PropsWithChildren } from 'react';
import type { Decorator, Preview } from '@storybook/react-vite';
import { DocsContainer, type DocsContainerProps } from '@storybook/addon-docs/blocks';
import { DecoratorHelpers } from '@storybook/addon-themes';
import { GLOBALS_UPDATED, SET_GLOBALS } from 'storybook/internal/core-events';
import { configure, getConfig } from 'storybook/test';
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

type EventWrapper = ReturnType<typeof getConfig>['eventWrapper'];

const reentrancyGuarded = new WeakSet<EventWrapper>();

/**
 * Makes Testing Library's `eventWrapper` reentrant, so play functions run without nested act()
 * diagnostics.
 *
 * `@storybook/react`'s own `beforeAll` sets `eventWrapper` to `act(cb)`. Every
 * `userEvent`/`fireEvent` dispatch in a play function goes through it. A dispatch can trigger
 * another dispatch synchronously: when a click or key closes an editor (InlineEdit), React
 * removes the focused input while committing inside that act. Chromium then fires `blur` on the
 * detached input, and user-event's blur listener sends a synthetic `change` through the same
 * `eventWrapper`. That second dispatch opens a nested act while the outer one is still flushing.
 * The nested act exits first and closes the act scope early, so React reports the rest of the
 * outer update as "not wrapped in act(...)" or "suspended inside an `act` scope ... not awaited".
 * Browsers fire blur on removal, so the component code is fine. Only the harness double-wraps.
 *
 * The guard calls a nested dispatch directly, without the wrapper. It still runs inside the
 * outer act scope, so its updates are batched and flushed by the act that is already open. Event
 * order, state updates and assertions are unchanged. The only thing removed is the redundant
 * inner act. Without the guard, every InlineEdit story that closes its editor in a play function
 * logs these warnings (11 stories). With it, no story logs any.
 *
 * `eventWrapper` only matters when Testing Library dispatches an event, which happens only in
 * play functions (Vitest runs and the Interactions panel). Rendering a story or a docs page never
 * calls it. Project `beforeAll` hooks run after the renderer's, in order, so this wraps the real
 * act wrapper. The returned cleanup restores the original wrapper. Installing the guard twice is
 * a no-op.
 */
function guardEventWrapperReentrancy() {
  const { eventWrapper } = getConfig();
  if (reentrancyGuarded.has(eventWrapper)) return;

  let depth = 0;
  const guarded: EventWrapper = (cb) => {
    if (depth > 0) return cb();
    depth += 1;
    try {
      return eventWrapper(cb);
    } finally {
      depth -= 1;
    }
  };
  reentrancyGuarded.add(guarded);
  configure({ eventWrapper: guarded });
  return () => configure({ eventWrapper });
}

const preview: Preview = {
  initialGlobals: { theme: DEFAULT_THEME },
  beforeAll: guardEventWrapperReentrancy,
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
      // Snippets use Storybook's default (the story's rendered usage with its arg values).
      // Do not set source.type: 'code' here: the authored story source includes the play
      // tests, which read as examples. See GURI-2129.
    },
    options: {
      storySort: {
        order: ['Home', 'Foundations', 'Inputs', 'Pickers', 'Data display', 'Feedback', 'Navigation', 'Surfaces', 'Layout', 'Showcase'],
      },
    },
  },
  tags: ['autodocs', 'test'],
};

export default preview;
