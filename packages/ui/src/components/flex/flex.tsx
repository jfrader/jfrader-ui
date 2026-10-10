// Configurable flex layout. Layout only: a plain div with no role, so it adds nothing to the
// accessibility tree. Defaults mirror CSS (row, stretch, start, no wrap) with no gap; start/end
// follow the writing direction.
import type { ComponentPropsWithRef } from 'react';
import { flexLayoutStyles, type LayoutProps } from '../../styling/layout-style';

export type FlexProps = ComponentPropsWithRef<'div'> & LayoutProps;

export function Flex({ ref, direction, wrap, inline, align, justify, gap, ...rest }: FlexProps) {
  return (
    <div
      {...rest}
      ref={ref}
      data-ui="flex"
      css={flexLayoutStyles({ direction, wrap, inline, align, justify, gap })}
    />
  );
}

Flex.displayName = 'Flex';
