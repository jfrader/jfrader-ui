// Named-theme scope shared by theme roots and portaled content. Token variables are scoped by
// `[data-theme]` and inherit through DOM parents, so content portaled out of a scope root (to the
// body or a `portalContainer`) loses its theme. Scope roots publish the theme they apply through
// context; ThemeBoundary re-applies it inside the portal exactly like the root does. Only the named
// theme crosses the portal: arbitrary ancestor CSS overrides do not.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from './css';

export type ThemeName = 'dark' | 'light';

export interface ThemeScope {
  theme: ThemeName;
  /** `undefined` keeps default portal routing; `null` holds portals until the host exists. */
  portalContainer: HTMLElement | null | undefined;
}

export const ThemeScopeContext = createContext<ThemeScope | null>(null);

/** The nearest theme scope, or `null` outside any (the page's `data-theme` applies). */
export function useThemeScope(): ThemeScope | null {
  return useContext(ThemeScopeContext);
}

/** What a `data-theme` scope root sets besides the attribute: inherited text color and color-scheme. */
export const themeScopeStyle = css({
  color: vars.color.text,
  colorScheme: 'dark',
  '&[data-theme="light"]': { colorScheme: 'light' },
});

/**
 * Publishes a surface's theme to its subtree without taking over the enclosing `portalContainer`, so
 * overlays opened inside a contrast panel keep the panel's palette through their portal. Saying
 * nothing (no scope root) keeps the enclosing theme, which is what a nested surface wants.
 */
export function SurfaceScope({ theme, children }: { theme: ThemeName; children?: ReactNode }) {
  const parent = useContext(ThemeScopeContext);
  const scope = useMemo<ThemeScope>(() => ({ theme, portalContainer: parent?.portalContainer }), [theme, parent?.portalContainer]);
  if (parent?.theme === theme) return children;
  return <ThemeScopeContext.Provider value={scope}>{children}</ThemeScopeContext.Provider>;
}

// Custom properties and color-scheme inherit through `display: contents`, so the wrapper
// re-scopes the theme without adding a box around positioned or fixed overlay content.
const boundaryStyle = css({ display: 'contents' });

/** Re-applies the nearest theme around portaled content; renders children bare outside a scope. */
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
