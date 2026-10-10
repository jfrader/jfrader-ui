// Configurable flex layout. Layout only: a plain div with no role, so it adds nothing to the
// accessibility tree. Defaults mirror CSS (row, stretch, start, no wrap) with no gap; start/end
// follow the writing direction.
import { forwardRef, type HTMLAttributes } from 'react';
import { flexLayoutStyles, type LayoutProps } from '../../styling/layout-style';

export type FlexProps = HTMLAttributes<HTMLDivElement> & LayoutProps;

export const Flex = forwardRef<HTMLDivElement, FlexProps>(function Flex(
  { direction, wrap, inline, align, justify, gap, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      data-ui="flex"
      css={flexLayoutStyles({ direction, wrap, inline, align, justify, gap })}
    />
  );
});
