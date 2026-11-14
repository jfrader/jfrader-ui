import { useContext, useMemo, useRef, type ComponentPropsWithRef, type ReactNode } from 'react';
import { useMergeRefs } from '@floating-ui/react';
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
  /**
   * Base palette for this scope. Overrides `appearance="inherit"`; otherwise defaults to `dark`.
   * @default 'dark'
   */
  theme?: ThemeName;
  /** Inherit the enclosing palette and CSS when `theme` is omitted, without declaring a theme or color-scheme. */
  appearance?: 'inherit';
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
  /** Render content within this theme and token scope. */
  children?: ReactNode;
}

// Mounts the token theme too, so `styled` callbacks and `useTheme()` work anywhere below.
// Overlays read the scope from context to carry this theme through their portals. Naming a different
// theme also clears any contrast appearance: the root redeclares the whole palette locally.
export function ThemeRoot(props: ThemeRootProps) {
  const {
    ref,
    theme: themeProp = 'dark',
    appearance: appearanceProp,
    tokens,
    portalContainer,
    className,
    style,
    sx,
    ...rest
  } = props;
  const parent = useContext(ThemeScopeContext);
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergeRefs([rootRef, ref]);
  const inherit = appearanceProp === 'inherit' && props.theme === undefined;
  const inheritRoot = inherit ? rootRef : undefined;
  const theme = inherit ? parent?.theme ?? null : themeProp;
  // A nested root without its own container keeps the outer one: the outer container is
  // usually a layout boundary (a modal dialog's top layer, an embed's own element) that still applies.
  const resolvedContainer = portalContainer === undefined ? parent?.portalContainer : portalContainer;
  // Naming a different theme redeclares the whole palette, so the surface appearance does not carry
  // over; naming the same theme keeps it, which is what an overlay host inside a panel wants.
  const appearance = parent && parent.theme === theme ? parent.appearance : ('default' as const);
  const ownTokenStyle = useMemo(() => tokens && themeTokenStyle(tokens), [tokens]);
  const tokenStyle = ownTokenStyle ?? (inherit ? parent?.tokenStyle : carriedTokenStyle(parent, theme));
  const scope = useMemo(
    () => ({ theme, appearance, portalContainer: resolvedContainer, tokenStyle, inheritRoot }),
    [theme, appearance, resolvedContainer, tokenStyle, inheritRoot],
  );

  return (
    <ThemeScopeContext.Provider value={scope}>
      <ThemeProvider>
        <WithSx className={className} styles={inherit ? undefined : themeScopeStyle} sx={sx}>
          {(className) => (
            <div
              {...rest}
              ref={mergedRef}
              data-ui="theme-root"
              data-theme={inherit ? undefined : theme ?? undefined}
              className={className}
              style={scopeStyle(inherit ? ownTokenStyle : tokenStyle, style)}
            />
          )}
        </WithSx>
      </ThemeProvider>
    </ThemeScopeContext.Provider>
  );
}

ThemeRoot.displayName = 'ThemeRoot';
