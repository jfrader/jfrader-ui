import { useContext, useMemo, type ComponentPropsWithRef, type ReactNode } from 'react';
import { themeTokenStyle, type ThemeTokens } from '../../styling/create-theme';
import { WithSx, type SxProps } from '../../styling/sx';
import {
  carriedTokenStyle,
  scopeStyle,
  ThemeScopeContext,
  themeScopeStyle,
  type ThemeName,
} from '../../styling/theme-scope';
import { ThemeProvider } from '../theme-provider/theme-provider';

export type { ThemeName };

export interface ThemeRootProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Base palette for this scope. `tokens` overrides its values. */
  theme?: ThemeName;
  /**
   * Token overrides, applied as inline custom properties. Use `createTheme()` to derive them from
   * an accent. Omit to inherit the enclosing root's tokens when the themes match; otherwise none carry over.
   */
  tokens?: ThemeTokens;
  /**
   * Container for this root's overlays. Omit to inherit the enclosing container or use `body`.
   * With `null`, overlays wait until the host element is set.
   */
  portalContainer?: HTMLElement | null;
  children?: ReactNode;
}

// Mounts the token theme too, so `styled` callbacks and `useTheme()` work anywhere below.
// Overlays read the scope from context to carry this theme through their portals. Naming a different
// theme also clears any contrast appearance: the root redeclares the whole palette locally.
export function ThemeRoot({
  ref,
  theme = 'dark',
  tokens,
  portalContainer,
  className,
  style,
  sx,
  ...rest
}: ThemeRootProps) {
  const parent = useContext(ThemeScopeContext);
  // A nested root without its own container keeps the outer one: the outer container is
  // usually a layout boundary (a modal dialog's top layer, an embed's own element) that still applies.
  const resolvedContainer = portalContainer === undefined ? parent?.portalContainer : portalContainer;
  // Naming a different theme redeclares the whole palette, so the surface appearance does not carry
  // over; naming the same theme keeps it, which is what an overlay host inside a panel wants.
  const appearance = parent && parent.theme === theme ? parent.appearance : ('default' as const);
  const ownTokenStyle = useMemo(() => tokens && themeTokenStyle(tokens), [tokens]);
  const tokenStyle = ownTokenStyle ?? carriedTokenStyle(parent, theme);
  const scope = useMemo(
    () => ({ theme, appearance, portalContainer: resolvedContainer, tokenStyle }),
    [theme, appearance, resolvedContainer, tokenStyle],
  );

  return (
    <ThemeScopeContext.Provider value={scope}>
      <ThemeProvider>
        <WithSx className={className} styles={themeScopeStyle} sx={sx}>
          {(className) => (
            <div
              {...rest}
              ref={ref}
              data-ui="theme-root"
              data-theme={theme}
              className={className}
              style={scopeStyle(tokenStyle, style)}
            />
          )}
        </WithSx>
      </ThemeProvider>
    </ThemeScopeContext.Provider>
  );
}

ThemeRoot.displayName = 'ThemeRoot';
