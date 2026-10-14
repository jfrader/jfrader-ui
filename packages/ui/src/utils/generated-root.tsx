'use client';

import type { ComponentPropsWithRef, ComponentType } from 'react';
import { WithSx, type SxProps } from '../styling/sx';
import type { Interpolation, Theme } from '../styling/css';

export type GeneratedRootProps = ComponentPropsWithRef<'div'> & SxProps & {
  css?: Interpolation<Theme>;
  'data-ui'?: string;
  [attribute: `data-${string}`]: string | number | boolean | undefined;
};
export type GeneratedRootSlotProps = Omit<GeneratedRootProps, 'children' | 'sx'>;

export function GeneratedRoot({
  component,
  rootSlot,
  marker,
  children,
  className,
  style,
  css,
  sx,
  ...props
}: GeneratedRootProps & {
  component?: ComponentType<ComponentPropsWithRef<'div'>>;
  rootSlot?: GeneratedRootSlotProps;
  marker: string;
}) {
  if (!component && !rootSlot && !className && !style && !css && !sx && Object.keys(props).length === 0) return children;
  const Root = component ?? 'div';
  const { css: slotCss, className: slotClassName, style: slotStyle, ...slotRest } = rootSlot ?? {};
  const merged = { ...props, ...slotRest };
  const dataUi = [...new Set([marker, ...[props['data-ui'], slotRest['data-ui']].flatMap((value) => typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : [])])].join(' ');
  return (
    <WithSx className={slotClassName} styles={slotCss}>
      {(slotClasses) => (
        <WithSx className={className} styles={css} sx={sx}>
          {(consumerClasses) => (
            <WithSx styles={[]} className={[slotClasses, consumerClasses].filter(Boolean).join(' ')}>
              {(resolvedClassName) => (
                <Root {...merged} data-ui={dataUi} className={resolvedClassName} style={{ ...style, ...slotStyle }}>
                  {children}
                </Root>
              )}
            </WithSx>
          )}
        </WithSx>
      )}
    </WithSx>
  );
}
