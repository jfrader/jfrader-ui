'use client';

import { WithSx, withoutSx } from '../../styling/sx';

import { useId, type ComponentPropsWithRef, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { FORCED_COLORS } from '../../styling/media';
import { GamePanel, type GamePanelProps, type GamePanelCustomization, type GamePanelSlotProps } from '../game-panel/game-panel';
import { cardPartIdentity } from '../game-card/card-parts';
import { CARD_FRAME } from '../game-card/card-frame';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';

export type GameMarksPartProps = ComponentPropsWithRef<'span'> & {
  'data-ui'?: string;
  sx?: Interpolation<Theme>;
};

export interface GameMarksSlotProps {
  /** Group wrapping the label, the count and the marks. */
  root?: GamePanelSlotProps;
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
  /** Neutral container wrapping the marks widget. */
  root?: ComponentType<GamePanelProps>;
  /** Text naming what the marks count. */
  label?: ComponentType<GameMarksPartProps>;
  /** Formatted number of marks. */
  count?: ComponentType<GameMarksPartProps>;
  /** Row or pile holding the individual marks. */
  marks?: ComponentType<GameMarksPartProps>;
  /** One mark in the row. */
  mark?: ComponentType<GameMarksPartProps>;
}

export interface GameMarksProps extends Omit<GamePanelProps, 'children'>, Omit<GamePanelCustomization, 'slots'>, SxProps {
  /** Shows the visible label that names the mark count. */
  label: string;
  /** Nonnegative safe integer. */
  count: number;
  /** Decorative, noninteractive art. Do not include element IDs in repeated art. */
  mark?: ReactNode;
  /** Number of slots in the track. Defaults to 5. */
  max?: number;
  /** Positive safe integer; defaults to 5. */
  maxPerRow?: number;
  /** Rows keep marks separate; pile overlaps adjacent marks. Defaults to rows. */
  layout?: 'rows' | 'pile';
  /** Formats the visible count. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** Passes props and styles to the mark group and its parts. */
  slotProps?: GameMarksSlotProps;
  /** Replaces the mark group and its parts. */
  slots?: GameMarksSlots;
}
const DEFAULT_MAX_PER_ROW = 5;
// A trick counter: five card-ratio pips that are the count. Taken tricks are card stock carrying
// the consumer's mark; open slots are inset. The localized number stays for assistive tech only.
const PIP = `calc(${vars.size.gameCardSm} * 0.5625)`;
const rootStyle = css({ label: 'game-marks', display: 'grid', justifyItems: 'start', gap: vars.space[2], inlineSize: 'fit-content',
  color: vars.color.text, fontFamily: vars.font.sans, lineHeight: vars.lineHeight.tight,
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const labelStyle = css({ fontSize: vars.textSize.xs, fontWeight: vars.fontWeight.semibold, color: vars.color.textMuted,
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const marksStyle = css({
  display: 'grid', gridTemplateColumns: 'repeat(var(--game-marks-columns), max-content)', alignItems: 'center', gap: vars.space[1],
  '&[data-layout="pile"]': { columnGap: 0 },
});
const markStyle = css({ display: 'inline-grid', placeItems: 'center', boxSizing: 'border-box', inlineSize: PIP, blockSize: `calc(${PIP} * ${CARD_FRAME.ratio})`,
  borderRadius: `calc(${PIP} / ${CARD_FRAME.cornerDivisor})`, border: `1px solid ${vars.color.borderSubtle}`, backgroundColor: vars.color.surfaceInset,
  fontSize: vars.textSize.xs, lineHeight: 1,
  '&[data-filled="true"]': { borderColor: vars.color.borderControl, backgroundColor: vars.color.cardFace, color: vars.color.cardInk,
    boxShadow: `inset 0 -1px 0 ${vars.color.borderControl}, ${vars.shadow.raised}` },
  '[data-layout="pile"] > &': { marginInlineEnd: `calc(-1 * ${vars.space[2]})` },
  [FORCED_COLORS]: { borderColor: 'CanvasText', backgroundColor: 'Canvas', '&[data-filled="true"]': { borderColor: 'CanvasText', backgroundColor: 'CanvasText', color: 'Canvas', boxShadow: 'none' } },
});
const overflowStyle = css({ marginInlineStart: vars.space[1], paddingInline: vars.space[1], borderRadius: vars.radius.sm, backgroundColor: vars.color.surfaceInset,
  fontSize: vars.textSize.xs, fontWeight: vars.fontWeight.semibold, fontVariantNumeric: 'tabular-nums', lineHeight: vars.lineHeight.base, color: vars.color.textMuted,
  '[data-layout="pile"] > &': { marginInlineStart: vars.space[3] },
  [FORCED_COLORS]: { color: 'CanvasText', border: '1px solid CanvasText' },
});

export function GameMarks({ label, count, mark = '●', max = DEFAULT_MAX_PER_ROW, maxPerRow = DEFAULT_MAX_PER_ROW, layout = 'rows', locale, slotProps, slots, component, ...props }: GameMarksProps) {
  const id = useId();
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('GameMarks count must be a nonnegative safe integer');
  if (!Number.isSafeInteger(max) || max < 1) throw new RangeError('GameMarks max must be a positive safe integer');
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

  return <GamePanel {...props} component={component} slots={slots} marker="game-marks" structure={rootStyle} rootSlot={slotProps?.root}
    attributes={{ role: 'group', 'aria-labelledby': [labelId, externalLabel].filter(Boolean).join(' '), 'data-layout': layout }}>
    <WithSx styles={[labelStyle, slotProps?.label?.sx]} className={slotProps?.label?.className}>{(classes) =>
      <Label {...withoutSx(slotProps?.label)} id={labelId} data-ui={labelIdentity} className={classes}>{label}</Label>}
    </WithSx>
    <WithSx styles={[visuallyHiddenStyle, slotProps?.count?.sx]} className={slotProps?.count?.className}>{(classes) =>
      <Count {...withoutSx(slotProps?.count)} data-ui={countIdentity} className={classes}>{new Intl.NumberFormat(locale).format(count)}</Count>}
    </WithSx>
    <WithSx styles={[marksStyle, slotProps?.marks?.sx]} className={slotProps?.marks?.className}>{(classes) =>
    <Marks {...withoutSx(slotProps?.marks)} aria-hidden="true" data-layout={layout} data-ui={marksIdentity}
      style={{ ...slotProps?.marks?.style, '--game-marks-columns': Math.min(max, maxPerRow) } as CSSProperties}
      className={classes}>
      {Array.from({ length: max }, (_, index) => <WithSx key={index} styles={[markStyle, slotProps?.mark?.sx]} className={slotProps?.mark?.className}>{(classes) =>
        <Mark {...withoutSx(slotProps?.mark)} data-filled={index < count ? 'true' : 'false'} data-ui={markIdentity} className={classes}>{index < count ? mark : null}</Mark>}
      </WithSx>)}
      {count > max && <bdi dir="auto" data-ui="game-marks-overflow" css={overflowStyle}>{new Intl.NumberFormat(locale, { signDisplay: 'always' }).format(count - max)}</bdi>}
    </Marks>}
    </WithSx>
  </GamePanel>;
}
GameMarks.displayName = 'GameMarks';
