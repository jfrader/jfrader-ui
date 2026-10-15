'use client';

import { useId, type ComponentPropsWithRef, type CSSProperties, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { FORCED_COLORS } from '../../styling/media';
import { CardRoot, type GameCardRootProps, type GameCardRootCustomization, type GameCardRootSlotProps } from '../game-card/game-card-root';

type PartProps = ComponentPropsWithRef<'span'> & { css?: Interpolation<Theme> };
export interface GameMarksProps extends Omit<GameCardRootProps, 'children'>, GameCardRootCustomization, SxProps {
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
  slotProps?: { root?: GameCardRootSlotProps; label?: PartProps; count?: PartProps; marks?: PartProps; mark?: PartProps };
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

export function GameMarks({ label, count, mark, maxPerRow = DEFAULT_MAX_PER_ROW, layout = 'rows', locale, slotProps, ...props }: GameMarksProps) {
  const id = useId();
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('GameMarks count must be a nonnegative safe integer');
  if (!Number.isSafeInteger(maxPerRow) || maxPerRow < 1) throw new RangeError('GameMarks maxPerRow must be a positive safe integer');
  const labelId = slotProps?.label?.id ?? id;
  const externalLabel = slotProps?.root?.['aria-labelledby'] ?? props['aria-labelledby'];
  return <CardRoot {...props} marker="game-marks" structure={rootStyle} rootSlot={slotProps?.root}
    attributes={{ role: 'group', 'aria-labelledby': [labelId, externalLabel].filter(Boolean).join(' '), 'data-layout': layout }}>
    <span {...slotProps?.label} id={labelId}>{label}</span>
    <span {...slotProps?.count}>{new Intl.NumberFormat(locale).format(count)}</span>
    <span {...slotProps?.marks} aria-hidden="true" data-layout={layout} data-ui="game-marks-marks"
      style={{ ...slotProps?.marks?.style, '--game-marks-columns': Math.max(1, Math.min(count, maxPerRow)) } as CSSProperties}
      css={[marksStyle, slotProps?.marks?.css]}>
      {Array.from({ length: count }, (_, index) => <span {...slotProps?.mark} key={index} data-ui="game-marks-mark" css={[markStyle, slotProps?.mark?.css]}>{mark}</span>)}
    </span>
  </CardRoot>;
}
GameMarks.displayName = 'GameMarks';
