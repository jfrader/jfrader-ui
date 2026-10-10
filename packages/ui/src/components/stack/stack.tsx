// Vertical stack: the shared flex recipe fixed to a block-level column with an md gap. Layout
// only: a plain div with no role. Children stretch to the stack's inline size by default.
import { flexLayoutStyles, type FlexAlign } from '../../styling/layout-style';
import type { FlexProps } from '../flex';

export type StackAlign = Exclude<FlexAlign, 'baseline'>;

export interface StackProps extends Omit<FlexProps, 'direction' | 'inline' | 'align'> {
  align?: StackAlign;
}

export function Stack({ ref, gap = 'md', align, justify, wrap, ...rest }: StackProps) {
  return (
    <div
      {...rest}
      ref={ref}
      data-ui="stack"
      css={flexLayoutStyles({ direction: 'column', gap, align, justify, wrap })}
    />
  );
}

Stack.displayName = 'Stack';
