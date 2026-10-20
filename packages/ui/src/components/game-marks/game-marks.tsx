import { withoutSx } from '../../styling/sx';
'use client';

import { useId, type ComponentPropsWithRef, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { FORCED_COLORS } from '../../styling/media';
import { CardRoot, type GameCardRootProps, type GameCardRootCustomization, type GameCardRootSlotProps } from '../game-card/game-card-root';
import { cardPartIdentity } from '../game-card/card-parts';

export type GameMarksPartProps = ComponentPropsWithRef<'span'> & {
  'data-ui'?: string;
  sx?: Interpolation<Theme>;
};

export interface GameMarksSlotProps {
  /** Group wrapping the label, the count and the marks. */
  root?: GameCardRootSlotProps;
  /** Text naming what the marks count. */
  label?: GameMarksPartProps;
  /** Formatted number of marks. */
  count?: GameMarksPartProps;
  /** Row or pile holding the individual marks. */
  marks?: GameMarksPartProps;
  /** One mark in the row. */
  mark?: GameMarksPartProps;
}

export interface GameMarksSlots {
  /** Outer card container wrapping the marks widget. */
  root?: ComponentType<GameCardRootProps>;
  /** Text naming what the marks count. */
  label?: ComponentType<GameMarksPartProps>;
  /** Formatted number of marks. */
  count?: ComponentType<GameMarksPartProps>;
  /** Row or pile holding the individual marks. */
  marks?: ComponentType<GameMarksPartProps>;
  /** One mark in the row. */
  mark?: ComponentType<GameMarksPartProps>;
}

export interface GameMarksProps extends Omit<GameCardRootProps, 'children'>, Omit<GameCardRootCustomization, 'slots'>, SxProps {
  label: string;
  /** Nonnegative safe integer. */
  count: number;
  /** Decorative, noninteractive art. Do not include element IDs in repeated art. */
  mark: ReactNode;
  /** Positive safe integer; defaults to 5. */
  maxPerRow?: number;
  /** Rows keep marks separate; pile overlaps adjacent marks. Defaults to rows. */
  layout?: 'rows' | 'pile';
  locale?: Intl.LocalesArgument;
  slotProps?: GameMarksSlotProps;
  slots?: GameMarksSlots;
}
const DEFAULT_MAX_PER_ROW = 5;
const rootStyle = css({ label: 'game-marks', display: 'grid', justifyItems: 'start', gap: vars.space[2], color: vars.color.text, fontFamily: vars.font.sans,
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const marksStyle = css({
  display: 'grid', gridTemplateColumns: 'repeat(var(--game-marks-columns), max-content)', gap: vars.space[1],
  '&[data-layout="pile"]': { columnGap: 0 },
});
const markStyle = css({ display: 'inline-flex', '[data-layout="pile"] > &': { marginInlineEnd: `calc(-1 * ${vars.space[1]})` } });

export function GameMarks({ label, count, mark, maxPerRow = DEFAULT_MAX_PER_ROW, layout = 'rows', locale, slotProps, slots, component, ...props }: GameMarksProps) {
  const id = useId();
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('GameMarks count must be a nonnegative safe integer');
  if (!Number.isSafeInteger(maxPerRow) || maxPerRow < 1) throw new RangeError('GameMarks maxPerRow must be a positive safe integer');
  const labelId = slotProps?.label?.id ?? id;
  const externalLabel = slotProps?.root?.['aria-labelledby'] ?? props['aria-labelledby'];

  const Label = slots?.label ?? 'span';
  const Count = slots?.count ?? 'span';
  const Marks = slots?.marks ?? 'span';
  const Mark = slots?.mark ?? 'span';

  const labelIdentity = cardPartIdentity('game-marks-label', slotProps?.label?.['data-ui']);
  const countIdentity = cardPartIdentity('game-marks-count', slotProps?.count?.['data-ui']);
  const marksIdentity = cardPartIdentity('game-marks-marks', slotProps?.marks?.['data-ui']);
  const markIdentity = cardPartIdentity('game-marks-mark', slotProps?.mark?.['data-ui']);

  return <CardRoot {...props} component={component} slots={slots} marker="game-marks" structure={rootStyle} rootSlot={slotProps?.root}
    attributes={{ role: 'group', 'aria-labelledby': [labelId, externalLabel].filter(Boolean).join(' '), 'data-layout': layout }}>
    <Label {...withoutSx(slotProps?.label)} id={labelId} data-ui={labelIdentity} className={slotProps?.label?.className} css={slotProps?.label?.sx}>{label}</Label>
    <Count {...withoutSx(slotProps?.count)} data-ui={countIdentity} className={slotProps?.count?.className} css={slotProps?.count?.sx}>{new Intl.NumberFormat(locale).format(count)}</Count>
    <Marks {...withoutSx(slotProps?.marks)} aria-hidden="true" data-layout={layout} data-ui={marksIdentity}
      style={{ ...slotProps?.marks?.style, '--game-marks-columns': Math.max(1, Math.min(count, maxPerRow)) } as CSSProperties}
      className={slotProps?.marks?.className}
      css={[marksStyle, slotProps?.marks?.sx]}>
      {Array.from({ length: count }, (_, index) => <Mark {...withoutSx(slotProps?.mark)} key={index} data-ui={markIdentity} className={slotProps?.mark?.className} css={[markStyle, slotProps?.mark?.sx]}>{mark}</Mark>)}
    </Marks>
  </CardRoot>;
}
GameMarks.displayName = 'GameMarks';
