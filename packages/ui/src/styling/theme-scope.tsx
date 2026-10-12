// Named-theme scope shared by scope roots and portaled content. Token variables are scoped by
// `[data-theme]` and `[data-appearance]` and inherit through DOM parents, so content portaled out of
// a scope root (to the body or a `portalContainer`) loses both. Scope roots publish what they set
// through context; ThemeBoundary re-applies it inside the portal exactly like the root does. Only the
// named axes cross the portal: arbitrary ancestor CSS overrides do not.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from './css';
import { contrastSurfaceStyle } from './surface';

export type ThemeName = 'dark' | 'light';

/** Surface palette in scope: `contrast` paints the dark family on any page theme, `default` its own. */
export type AppearanceName = 'default' | 'contrast';

export interface ThemeScope {
  /** Named theme in scope; `undefined` leaves `data-theme` to the page (no ThemeRoot above). */
  theme?: ThemeName;
  appearance: AppearanceName;
  /** `undefined` keeps default portal routing; `null` holds portals until the host exists. */
  portalContainer: HTMLElement | null | undefined;
}

export const ThemeScopeContext = createContext<ThemeScope | null>(null);

/** The nearest theme scope (ThemeRoot or contrast surface), or `null` outside any. */
export function useThemeScope(): ThemeScope | null {
  return useContext(ThemeScopeContext);
}

/**
 * The appearance a surface paints: its own value, else the enclosing scope's, else the theme's own.
 * `undefined` inherits, so a surface nested in a contrast one stays contrast unless it says otherwise.
 */
export function useSurfaceAppearance(appearance?: AppearanceName): AppearanceName {
  const parent = useContext(ThemeScopeContext);
  return appearance ?? parent?.appearance ?? 'default';
}

/** What a scope root sets besides the attributes: inherited text color and native `color-scheme`. */
export const themeScopeStyle = css({
  color: vars.color.text,
  colorScheme: 'dark',
  '&[data-theme="light"]': { colorScheme: 'light' },
  // A contrast subtree is the dark family whatever the page theme is; keep this last so it wins.
  '&[data-appearance="contrast"]': { colorScheme: 'dark' },
});

// Custom properties and color-scheme inherit through `display: contents`, so the wrapper
// re-scopes the theme without adding a box around positioned or fixed overlay content.
const boundaryStyle = css({ display: 'contents' });

/**
 * Publishes a surface's resolved appearance to descendants (portaled overlays included) without
 * rendering a box, and only when it changes the enclosing scope.
 */
export function AppearanceScope({ appearance, children }: { appearance: AppearanceName; children?: ReactNode }) {
  const parent = useContext(ThemeScopeContext);
  const scope = useMemo<ThemeScope>(
    () => ({ theme: parent?.theme, appearance, portalContainer: parent?.portalContainer }),
    [parent?.theme, parent?.portalContainer, appearance],
  );
  if (parent ? parent.appearance === appearance : appearance === 'default') return children;
  return <ThemeScopeContext.Provider value={scope}>{children}</ThemeScopeContext.Provider>;
}

/** Re-applies the nearest scope around portaled content; renders children bare outside one. */
export function ThemeBoundary({ children }: { children?: ReactNode }) {
  const scope = useThemeScope();
  if (!scope) return children;
  return (
    <div
      data-ui="theme-boundary"
      data-theme={scope.theme}
      data-appearance={scope.appearance}
      css={[scope.theme && themeScopeStyle, scope.appearance === 'contrast' && contrastSurfaceStyle, boundaryStyle]}
    >
      {children}
    </div>
  );
}

ThemeBoundary.displayName = 'ThemeBoundary';
