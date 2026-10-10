import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';

export type ThemeName = 'dark' | 'light';

export interface ThemeRootProps extends HTMLAttributes<HTMLDivElement> {
  theme?: ThemeName;
  children?: ReactNode;
}

const rootStyle = css({
  color: vars.color.text,
  colorScheme: 'dark',
  '&[data-theme="light"]': { colorScheme: 'light' },
});

export const ThemeRoot = forwardRef<HTMLDivElement, ThemeRootProps>(function ThemeRoot(
  { theme, ...rest },
  ref,
) {
  return <div data-ui="theme-root" data-theme={theme ?? 'dark'} {...rest} ref={ref} css={rootStyle} />;
});
