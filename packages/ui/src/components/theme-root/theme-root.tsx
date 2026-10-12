import { useContext, useMemo, type ComponentPropsWithRef, type ReactNode } from 'react';
import { WithSx, type SxProps } from '../../styling/sx';
import { contrastSurfaceStyle } from '../../styling/surface';
import {
  ThemeScopeContext,
  themeScopeStyle,
  useSurfaceAppearance,
  type AppearanceName,
  type ThemeName,
} from '../../styling/theme-scope';
import { ThemeProvider } from '../theme-provider/theme-provider';

export type { AppearanceName, ThemeName };

export interface ThemeRootProps extends ComponentPropsWithRef<'div'>, SxProps {
  theme?: ThemeName;
  /**
   * `contrast` paints the dark family for this subtree on any page theme. Omitted: the enclosing
   * scope's appearance, else the theme's own. `default` returns to the theme's own palette.
   */
  appearance?: AppearanceName;
  /**
   * Where overlays inside this root portal to. Omitted: the enclosing ThemeRoot's container, else
   * the default (`body`). `null`: overlays wait until the host element is set.
   */
  portalContainer?: HTMLElement | null;
  children?: ReactNode;
}

// Mounts the token theme too, so `styled` callbacks and `useTheme()` work anywhere below.
// Overlays read the scope from context to carry this theme and appearance through their portals.
export function ThemeRoot({
  ref,
  theme = 'dark',
  appearance,
  portalContainer,
  className,
  sx,
  ...rest
}: ThemeRootProps) {
  const parent = useContext(ThemeScopeContext);
  // A nested root without its own container keeps the outer one: the outer container is
  // usually a layout boundary (a modal dialog's top layer, an embed's own element) that still applies.
  const resolvedContainer = portalContainer === undefined ? parent?.portalContainer : portalContainer;
  // A nested root keeps the enclosing palette unless it names one, so an overlay host inside a
  // contrast surface stays contrast without repeating the prop.
  const resolvedAppearance = useSurfaceAppearance(appearance);
  const scope = useMemo(
    () => ({ theme, appearance: resolvedAppearance, portalContainer: resolvedContainer }),
    [theme, resolvedAppearance, resolvedContainer],
  );

  return (
    <ThemeScopeContext.Provider value={scope}>
      <ThemeProvider>
        <WithSx className={className} styles={[themeScopeStyle, contrastSurfaceStyle]} sx={sx}>
          {(className) => (
            <div
              {...rest}
              ref={ref}
              data-ui="theme-root"
              data-theme={theme}
              data-appearance={resolvedAppearance}
              className={className}
            />
          )}
        </WithSx>
      </ThemeProvider>
    </ThemeScopeContext.Provider>
  );
}

ThemeRoot.displayName = 'ThemeRoot';
