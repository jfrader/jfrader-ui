// Named-theme scope shared by theme roots and portaled content. Token variables are scoped by
// `[data-theme]` (and, for a contrast surface, by `[data-appearance]`) and inherit through DOM
// parents, so content portaled out of a scope root (to the body or a `portalContainer`) loses both.
// Scope roots publish what they set through context; ThemeBoundary re-applies it inside the portal
// exactly like the root does. Only the named axes and the root's `tokens` cross the portal:
// arbitrary ancestor CSS does not.
import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';
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
  /** The scope root's `tokens` as inline custom properties, re-declared wherever `theme` is. */
  tokenStyle: CSSProperties | undefined;
}

export const ThemeScopeContext = createContext<ThemeScope | null>(null);

/** The nearest theme scope (ThemeRoot or contrast surface), or `null` outside any. */
export function useThemeScope(): ThemeScope | null {
  return useContext(ThemeScopeContext);
}

/**
 * The enclosing scope's `tokens` for an element that re-declares `theme`: kept when it names the
 * same theme, dropped for another (they were derived for the enclosing one) or for `null`.
 */
export function carriedTokenStyle(parent: ThemeScope | null, theme: ThemeName | null): CSSProperties | undefined {
  return parent && parent.theme === theme ? parent.tokenStyle : undefined;
}

/** Inline `style` for a scope element: carried tokens first, the consumer's own `style` last. */
export function scopeStyle(tokenStyle: CSSProperties | undefined, style: CSSProperties | undefined) {
  return tokenStyle ? { ...tokenStyle, ...style } : style;
}

/** `style` for a surface that re-declares `theme` (`null`: it re-declares nothing) inside the scope. */
export function useSurfaceStyle(theme: ThemeName | null, style: CSSProperties | undefined) {
  return scopeStyle(carriedTokenStyle(useContext(ThemeScopeContext), theme), style);
}

/** `contrast` establishes charcoal; omitted and `default` inherit the enclosing appearance. */
export function useSurfaceAppearance(appearance?: AppearanceName): AppearanceName {
  const parent = useContext(ThemeScopeContext);
  return appearance === 'contrast' ? 'contrast' : parent?.appearance ?? 'default';
}

export const themeColorSchemeStyle = css({
  colorScheme: 'dark',
  '&[data-theme="light"]': { colorScheme: 'light' },
});

/** What a `data-theme` scope root sets besides the attribute: inherited text color and color-scheme. */
export const themeScopeStyle = css([themeColorSchemeStyle, { color: vars.color.text }]);

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
  const tokenStyle = carriedTokenStyle(parent, resolvedTheme);
  const scope = useMemo<ThemeScope>(
    () => ({ theme: resolvedTheme, appearance, portalContainer: parent?.portalContainer, tokenStyle }),
    [resolvedTheme, appearance, parent?.portalContainer, tokenStyle],
  );
  const unchanged = parent
    ? parent.theme === resolvedTheme && parent.appearance === appearance
    : appearance === 'default';
  return <ThemeScopeContext.Provider value={unchanged ? parent : scope}>{children}</ThemeScopeContext.Provider>;
}

/** Re-applies the nearest scope (theme, appearance and tokens) around portaled content. */
export function ThemeBoundary({ children }: { children?: ReactNode }) {
  const scope = useThemeScope();
  if (!scope) return children;
  return (
    <div
      data-ui="theme-boundary"
      data-theme={scope.theme}
      data-appearance={scope.appearance}
      style={scope.tokenStyle}
      css={[themeScopeStyle, boundaryStyle]}
    >
      {children}
    </div>
  );
}

ThemeBoundary.displayName = 'ThemeBoundary';
