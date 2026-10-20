// Vertical stack: the shared flex recipe fixed to a block-level column with an md gap. Layout
// only: a plain div with no role. Children stretch to the stack's inline size by default.
import { flexLayoutStyles, type FlexAlign } from '../../styling/layout-style';
import { WithSx } from '../../styling/sx';
import type { FlexProps } from '../flex';

export type StackAlign = Exclude<FlexAlign, 'baseline'>;

export interface StackProps extends Omit<FlexProps, 'direction' | 'inline' | 'align'> {
  /** Align children across the inline axis. Defaults to stretching them to the stack's width. */
  align?: StackAlign;
}

/** Arrange content vertically with shared spacing and alignment. */
export function Stack({ ref, gap = 'md', align, justify, wrap, className, sx, ...rest }: StackProps) {
  return (
    <WithSx
      className={className}
      styles={flexLayoutStyles({ direction: 'column', gap, align, justify, wrap })}
      sx={sx}
    >
      {(className) => <div {...rest} ref={ref} data-ui="stack" className={className} />}
    </WithSx>
  );
}

Stack.displayName = 'Stack';
