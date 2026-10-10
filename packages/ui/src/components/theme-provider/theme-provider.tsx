// Hands the token theme to Emotion so `styled` callbacks, function `css`/`sx` values and
// `useTheme()` receive it. Renders no DOM of its own. ThemeRoot already mounts one, so apps
// need it directly only when they do not render ThemeRoot.
// Exported from the package index only: the folder has no index.ts, so no `./theme-provider`
// subpath.
import type { ReactNode } from 'react';
import { EmotionThemeProvider, useEmotionTheme } from '../../styling/css';
import { theme as defaultTheme, type JfraderTheme } from '../../styling/theme';

export interface ThemeProviderProps {
  theme?: JfraderTheme;
  children?: ReactNode;
}

export function ThemeProvider({ theme = defaultTheme, children }: ThemeProviderProps) {
  return <EmotionThemeProvider theme={theme}>{children}</EmotionThemeProvider>;
}

ThemeProvider.displayName = 'ThemeProvider';

export function useTheme(): JfraderTheme {
  return useEmotionTheme();
}
