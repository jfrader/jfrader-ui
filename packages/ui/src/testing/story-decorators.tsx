import type { Decorator } from '@storybook/react-vite';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../styling/css';
import { ThemeRoot } from '../components/theme-root';

// Story decorators sit inside the meta's frame decorator, so the surface takes on the frame's
// layout (grid/flex, direction, gap) to keep multi-element stories spaced as before.
const lightSurfaceStyle = css({
  display: 'inherit',
  flexDirection: 'inherit',
  flexWrap: 'inherit',
  alignItems: 'inherit',
  justifyContent: 'inherit',
  gap: 'inherit',
  padding: vars.space[4],
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bg,
});

/** Story-only: renders the story on a scoped light `ThemeRoot` surface, whatever the page theme. */
export const withLightTheme = <TArgs,>(Story: Parameters<Decorator<TArgs>>[0]) => (
  <ThemeRoot theme="light" data-story-theme-scope="" css={lightSurfaceStyle}>
    <Story />
  </ThemeRoot>
);
