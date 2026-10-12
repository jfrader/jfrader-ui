// Named-theme scope shared by theme roots and portaled content. Token variables are scoped by
// `[data-theme]` (and, for a contrast surface, by `[data-appearance]`) and inherit through DOM
// parents, so content portaled out of a scope root (to the body or a `portalContainer`) loses both.
// Scope roots publish what they set through context; ThemeBoundary re-applies it inside the portal
// exactly like the root does. Only the named axes cross the portal: arbitrary ancestor CSS does not.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from './css';

export type ThemeName = 'dark' | 'light';

/** Surface palette in scope: `contrast` adds the elevated-charcoal overrides on the dark theme. */
export type AppearanceName = 'default' | 'contrast';

export interface ThemeScope {
  theme: ThemeName;
  appearance: AppearanceName;
  /** `undefined` keeps default portal routing; `null` holds portals until the host exists. */
  portalContainer: HTMLElement | null | undefined;
}

export const ThemeScopeContext = createContext<ThemeScope | null>(null);

/** The nearest theme scope (ThemeRoot or contrast surface), or `null` outside any. */
export function useThemeScope(): ThemeScope | null {
  return useContext(ThemeScopeContext);
}

/** The appearance a surface wears: its own value, else the enclosing scope's, else the theme's own. */
export function useSurfaceAppearance(appearance?: AppearanceName): AppearanceName {
  const parent = useContext(ThemeScopeContext);
  return appearance ?? parent?.appearance ?? 'default';
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

/**
 * Publishes a surface's theme and appearance to its subtree without taking over the enclosing
 * `portalContainer`, so overlays opened inside a contrast surface keep its palette through their
 * portal. `theme: null` keeps the enclosing theme; publishes only when the pair changes the scope.
 */
export function AppearanceScope({
  theme,
  appearance,
  children,
}: {
  theme: ThemeName | null;
  appearance: AppearanceName;
  children?: ReactNode;
}) {
  const parent = useContext(ThemeScopeContext);
  const resolvedTheme = theme ?? parent?.theme ?? 'dark';
  const scope = useMemo<ThemeScope>(
    () => ({ theme: resolvedTheme, appearance, portalContainer: parent?.portalContainer }),
    [resolvedTheme, appearance, parent?.portalContainer],
  );
  if (parent ? parent.theme === resolvedTheme && parent.appearance === appearance : appearance === 'default') {
    return children;
  }
  return <ThemeScopeContext.Provider value={scope}>{children}</ThemeScopeContext.Provider>;
}

/** Re-applies the nearest scope (theme and appearance) around portaled content. */
export function ThemeBoundary({ children }: { children?: ReactNode }) {
  const scope = useThemeScope();
  if (!scope) return children;
  return (
    <div
      data-ui="theme-boundary"
      data-theme={scope.theme}
      data-appearance={scope.appearance}
      css={[themeScopeStyle, boundaryStyle]}
    >
      {children}
    </div>
  );
}

ThemeBoundary.displayName = 'ThemeBoundary';
