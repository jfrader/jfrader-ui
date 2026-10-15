'use client';

import type { ComponentPropsWithRef, ComponentType } from 'react';
import type { Interpolation, Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';

export interface GameCardRootProps extends ComponentPropsWithRef<'div'> {
  css?: Interpolation<Theme>;
  [attribute: `data-${string}`]: string | number | boolean | undefined;
}

export type GameCardRootSlotProps = Partial<GameCardRootProps> & { css?: Interpolation<Theme> };

export interface GameCardRootCustomization {
  /** Replace the root. Exactly sugar for `slots.root`; declare replacements outside render. */
  component?: ComponentType<GameCardRootProps>;
  /** Replace the root structure; `front` and `back` remain content. */
  slots?: {
    /** Replaces the outer card container; renders a `div` by default. */
    root?: ComponentType<GameCardRootProps>;
  };
}

interface CardRootProps extends GameCardRootProps, GameCardRootCustomization, SxProps {
  marker: string;
  structure: Interpolation<Theme>;
  material?: Interpolation<Theme>;
  attributes?: GameCardRootProps;
  rootSlot?: GameCardRootSlotProps;
  css?: Interpolation<Theme>;
}

export function CardRoot({
  marker, structure, material, attributes, component, slots, rootSlot,
  css: consumerCss, sx, className, style, children, ...host
}: CardRootProps) {
  const Root = slots?.root ?? component ?? 'div';
  const { css: slotCss, className: slotClassName, style: slotStyle, ...slotRest } = rootSlot ?? {};
  const identity = [...new Set([marker, host['data-ui'], slotRest['data-ui']]
    .flatMap((value) => typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : []))].join(' ');

  return (
    <WithSx styles={[Root === 'div' && material, structure, slotCss]} className={slotClassName}>
      {(slotClasses) => (
        <WithSx styles={consumerCss} className={className} sx={sx}>
          {(consumerClasses) => (
            <WithSx styles={[]} className={[slotClasses, consumerClasses].filter(Boolean).join(' ')}>
              {(classes) => (
                <Root {...host} {...slotRest} {...attributes} data-ui={identity}
                  className={classes} style={{ ...style, ...slotStyle }}>
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
