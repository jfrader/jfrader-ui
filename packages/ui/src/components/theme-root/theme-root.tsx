import { useContext, useMemo, type ComponentPropsWithRef, type ReactNode } from 'react';
import { WithSx, type SxProps } from '../../styling/sx';
import { ThemeScopeContext, themeScopeStyle, type ThemeName } from '../../styling/theme-scope';
import { ThemeProvider } from '../theme-provider/theme-provider';

export type { ThemeName };

export interface ThemeRootProps extends ComponentPropsWithRef<'div'>, SxProps {
  theme?: ThemeName;
  /**
   * Where overlays inside this root portal to. Omitted: the enclosing ThemeRoot's container, else
   * the default (`body`). `null`: overlays wait until the host element is set.
   */
  portalContainer?: HTMLElement | null;
  children?: ReactNode;
}

// Mounts the token theme too, so `styled` callbacks and `useTheme()` work anywhere below.
// Overlays read the scope from context to carry this theme through their portals.
export function ThemeRoot({ ref, theme = 'dark', portalContainer, className, sx, ...rest }: ThemeRootProps) {
  const parent = useContext(ThemeScopeContext);
  // A nested root without its own container keeps the outer one: the outer container is
  // usually a layout boundary (a modal dialog's top layer, an embed's own element) that still applies.
  const resolvedContainer = portalContainer === undefined ? parent?.portalContainer : portalContainer;
  const scope = useMemo(() => ({ theme, portalContainer: resolvedContainer }), [theme, resolvedContainer]);

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
