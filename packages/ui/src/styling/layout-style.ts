import type { Tokens } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from './css';

// Shared flex recipe for Flex and Stack (Stack is a column preset of it) and the layout space
// scale Container reuses for its inline padding. Alignment keys use flex-start/flex-end, which
// follow the writing direction, so every layout mirrors under dir="rtl".

export const LAYOUT_SPACES = ['none', 'xs', 'sm', 'md', 'lg', 'xl'] as const;

export type LayoutSpace = (typeof LAYOUT_SPACES)[number];

export type FlexDirection = 'row' | 'column';

export type FlexAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch';

export type FlexJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

export interface LayoutProps {
  direction?: FlexDirection;
  wrap?: boolean;
  inline?: boolean;
  align?: FlexAlign;
  justify?: FlexJustify;
  gap?: LayoutSpace;
}

/** Layout space step → `vars.space` key (xs 4px, sm 8px, md 16px, lg 24px, xl 32px); `none` is 0. */
export const LAYOUT_SPACE_TOKEN = { xs: 1, sm: 2, md: 4, lg: 6, xl: 8 } as const satisfies Record<
  Exclude<LayoutSpace, 'none'>,
  keyof Tokens['space']
>;

function spaceValue(space: LayoutSpace) {
  return space === 'none' ? '0' : vars.space[LAYOUT_SPACE_TOKEN[space]];
}

/** One precomputed style per space step for `property`. Call at module scope. */
export function spaceStyles(property: 'gap' | 'paddingInline') {
  return Object.fromEntries(
    LAYOUT_SPACES.map((space) => [space, css({ [property]: spaceValue(space) })]),
  ) as Record<LayoutSpace, SerializedStyles>;
}

const flexStyle = css({
  boxSizing: 'border-box',
  display: 'flex',
});

const inlineFlexStyle = css({ display: 'inline-flex' });

const wrapStyle = css({ flexWrap: 'wrap' });

const directionStyles: Record<FlexDirection, SerializedStyles> = {
  row: css({ flexDirection: 'row' }),
  column: css({ flexDirection: 'column' }),
};

const alignStyles: Record<FlexAlign, SerializedStyles> = {
  start: css({ alignItems: 'flex-start' }),
  center: css({ alignItems: 'center' }),
  end: css({ alignItems: 'flex-end' }),
  baseline: css({ alignItems: 'baseline' }),
  stretch: css({ alignItems: 'stretch' }),
};

const justifyStyles: Record<FlexJustify, SerializedStyles> = {
  start: css({ justifyContent: 'flex-start' }),
  center: css({ justifyContent: 'center' }),
  end: css({ justifyContent: 'flex-end' }),
  between: css({ justifyContent: 'space-between' }),
  around: css({ justifyContent: 'space-around' }),
  evenly: css({ justifyContent: 'space-evenly' }),
};

const gapStyles = spaceStyles('gap');

/** The flex recipe with its defaults; components pass only the options they own. */
export function flexLayoutStyles({
  direction = 'row',
  wrap = false,
  inline = false,
  align = 'stretch',
  justify = 'start',
  gap = 'none',
}: LayoutProps) {
  return [
    flexStyle,
    inline && inlineFlexStyle,
    wrap && wrapStyle,
    directionStyles[direction],
    alignStyles[align],
    justifyStyles[justify],
    gapStyles[gap],
  ];
}
