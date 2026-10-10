// Configurable flex layout. Layout only: a plain div with no role, so it adds nothing to the
// accessibility tree. Defaults mirror CSS (row, stretch, start, no wrap) with no gap; start/end
// follow the writing direction.
import type { ComponentPropsWithRef } from 'react';
import { flexLayoutStyles, type LayoutProps } from '../../styling/layout-style';
import { WithSx, type SxProps } from '../../styling/sx';

export type FlexProps = ComponentPropsWithRef<'div'> & LayoutProps & SxProps;

export function Flex({ ref, direction, wrap, inline, align, justify, gap, className, sx, ...rest }: FlexProps) {
  return (
    <WithSx className={className} styles={flexLayoutStyles({ direction, wrap, inline, align, justify, gap })} sx={sx}>
      {(className) => <div {...rest} ref={ref} data-ui="flex" className={className} />}
    </WithSx>
  );
}

Flex.displayName = 'Flex';
