// The only module that imports `@emotion/react` (styled.ts does the same for `@emotion/styled`).
// Components import from here so Emotion can be swapped for another engine by changing these files.
export {
  ClassNames,
  css,
  keyframes,
  ThemeProvider as EmotionThemeProvider,
  useTheme as useEmotionTheme,
} from '@emotion/react';
export type { ClassNamesContent, Interpolation, SerializedStyles, Theme } from '@emotion/react';
export type { JfraderTheme } from './theme';
