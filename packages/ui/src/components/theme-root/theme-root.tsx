import type { ComponentPropsWithRef, ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { ThemeProvider } from '../theme-provider/theme-provider';

export type ThemeName = 'dark' | 'light';

export interface ThemeRootProps extends ComponentPropsWithRef<'div'>, SxProps {
  theme?: ThemeName;
  children?: ReactNode;
}

const rootStyle = css({
  color: vars.color.text,
  colorScheme: 'dark',
  '&[data-theme="light"]': { colorScheme: 'light' },
});

// Mounts the token theme too, so `styled` callbacks and `useTheme()` work anywhere below.
export function ThemeRoot({ ref, theme, className, sx, ...rest }: ThemeRootProps) {
  return (
    <ThemeProvider>
      <WithSx className={className} styles={rootStyle} sx={sx}>
        {(className) => (
          <div data-ui="theme-root" data-theme={theme ?? 'dark'} {...rest} ref={ref} className={className} />
        )}
      </WithSx>
    </ThemeProvider>
  );
}

ThemeRoot.displayName = 'ThemeRoot';
