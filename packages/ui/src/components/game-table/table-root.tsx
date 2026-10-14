'use client';

import type { ComponentPropsWithRef, ComponentType } from 'react';
import type { Interpolation, Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';

export interface GameTableRootProps extends ComponentPropsWithRef<'div'> {
  css?: Interpolation<Theme>;
  [attribute: `data-${string}`]: string | number | boolean | undefined;
}
export type GameTableRootSlotProps = Partial<GameTableRootProps>;
export interface GameTableRootCustomization {
  /** Replace the root. Exactly sugar for `slots.root`; forward all props/ref to one div. */
  component?: ComponentType<GameTableRootProps>;
  /** Replace root structure; declare replacements outside render. */
  slots?: { root?: ComponentType<GameTableRootProps> };
  /** Root props; conflicts win except merged className/style and table-owned geometry/markers. */
  slotProps?: { root?: GameTableRootSlotProps };
}

export function TableRoot({ marker, structure, attributes, component, slots, slotProps,
  css: consumerCss, sx, className, style, children, ...host
}: GameTableRootProps & GameTableRootCustomization & SxProps & {
  marker: string; structure: Interpolation<Theme>; attributes?: GameTableRootProps;
}) {
  const Root = slots?.root ?? component ?? 'div';
  const { css: slotCss, className: slotClassName, style: slotStyle, ...slotRest } = slotProps?.root ?? {};
  const identity = [...new Set([marker, host['data-ui'], slotRest['data-ui']]
    .flatMap((value) => typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : []))].join(' ');
  return <WithSx styles={[structure, slotCss]} className={slotClassName}>
    {(slotClasses) => <WithSx styles={consumerCss} className={className} sx={sx}>
      {(consumerClasses) => <WithSx styles={[]} className={[slotClasses, consumerClasses].filter(Boolean).join(' ')}>
        {(classes) => <Root {...host} {...slotRest} {...attributes} data-ui={identity} className={classes}
          style={{ ...style, ...slotStyle, ...attributes?.style }}>{children}</Root>}
      </WithSx>}
    </WithSx>}
  </WithSx>;
}
