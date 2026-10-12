import { useContext, useMemo, type ComponentPropsWithRef, type ReactNode } from 'react';
import { WithSx, type SxProps } from '../../styling/sx';
import { ThemeScopeContext, themeScopeStyle, type ThemeName } from '../../styling/theme-scope';
import { ThemeProvider } from '../theme-provider/theme-provider';

export type { ThemeName };

export interface ThemeRootProps extends ComponentPropsWithRef<'div'>, SxProps {
  theme?: ThemeName;
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
export function ThemeRoot({ ref, theme = 'dark', portalContainer, className, sx, ...rest }: ThemeRootProps) {
  const parent = useContext(ThemeScopeContext);
  // A nested root without its own container keeps the outer one: the outer container is
  // usually a layout boundary (a modal dialog's top layer, an embed's own element) that still applies.
  const resolvedContainer = portalContainer === undefined ? parent?.portalContainer : portalContainer;
  // Naming a different theme redeclares the whole palette, so the surface appearance does not carry
  // over; naming the same theme keeps it, which is what an overlay host inside a panel wants.
  const appearance = parent && parent.theme === theme ? parent.appearance : ('default' as const);
  const scope = useMemo(
    () => ({ theme, appearance, portalContainer: resolvedContainer }),
    [theme, appearance, resolvedContainer],
  );

  return (
    <ThemeScopeContext.Provider value={scope}>
      <ThemeProvider>
        <WithSx className={className} styles={themeScopeStyle} sx={sx}>
          {(className) => <div {...rest} ref={ref} data-ui="theme-root" data-theme={theme} className={className} />}
        </WithSx>
      </ThemeProvider>
    </ThemeScopeContext.Provider>
  );
}

ThemeRoot.displayName = 'ThemeRoot';
