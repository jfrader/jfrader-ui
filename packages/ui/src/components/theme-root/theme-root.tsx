import type { ComponentPropsWithRef, ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';

export type ThemeName = 'dark' | 'light';

export interface ThemeRootProps extends ComponentPropsWithRef<'div'> {
  theme?: ThemeName;
  children?: ReactNode;
}

const rootStyle = css({
  color: vars.color.text,
  colorScheme: 'dark',
  '&[data-theme="light"]': { colorScheme: 'light' },
});

export function ThemeRoot({ ref, theme, ...rest }: ThemeRootProps) {
  return <div data-ui="theme-root" data-theme={theme ?? 'dark'} {...rest} ref={ref} css={rootStyle} />;
}

ThemeRoot.displayName = 'ThemeRoot';
