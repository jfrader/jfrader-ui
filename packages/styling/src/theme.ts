// The app-facing theme is the token object itself. Its values are `var(--ui-*)` references, so
// ThemeRoot's dark/light switch restyles without re-rendering and server output does not depend
// on the active theme.
import { vars } from '@jfrader/tokens/vars';

export const theme = vars;

export type JfraderTheme = typeof theme;

// Types `({ theme })` in styled callbacks, function `css`/`sx` values and `useTheme()`.
declare module '@emotion/react' {
  interface Theme extends JfraderTheme {}
}
