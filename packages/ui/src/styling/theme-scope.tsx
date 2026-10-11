// Named-theme scope shared by ThemeRoot and portaled content. Token variables are scoped by
// `[data-theme]` and inherit through DOM parents, so content portaled out of a ThemeRoot (to the
// body or a `portalContainer`) loses its theme. ThemeRoot publishes the resolved theme through
// context; ThemeBoundary re-applies it inside the portal exactly like ThemeRoot does. Only the
// named theme crosses the portal: arbitrary ancestor CSS overrides do not.
import { createContext, useContext, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from './css';

export type ThemeName = 'dark' | 'light';

export interface ThemeScope {
  theme: ThemeName;
  /** `undefined` keeps default portal routing; `null` holds portals until the host exists. */
  portalContainer: HTMLElement | null | undefined;
}

export const ThemeScopeContext = createContext<ThemeScope | null>(null);

/** The nearest ThemeRoot's scope, or `null` outside any ThemeRoot (page theme applies). */
export function useThemeScope(): ThemeScope | null {
  return useContext(ThemeScopeContext);
}

/** What a `data-theme` scope root sets besides the attribute: inherited text color and color-scheme. */
export const themeScopeStyle = css({
  color: vars.color.text,
  colorScheme: 'dark',
  '&[data-theme="light"]': { colorScheme: 'light' },
});

// Custom properties and color-scheme inherit through `display: contents`, so the wrapper
// re-scopes the theme without adding a box around positioned or fixed overlay content.
const boundaryStyle = css({ display: 'contents' });

/** Re-applies the nearest ThemeRoot's theme around portaled content; renders children bare outside one. */
export function ThemeBoundary({ children }: { children?: ReactNode }) {
  const scope = useThemeScope();
  if (!scope) return children;
  return (
    <div data-ui="theme-boundary" data-theme={scope.theme} css={[themeScopeStyle, boundaryStyle]}>
      {children}
    </div>
  );
}

ThemeBoundary.displayName = 'ThemeBoundary';
