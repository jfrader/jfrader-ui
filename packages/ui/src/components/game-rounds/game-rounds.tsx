'use client';

import { WithSx, withoutSx } from '../../styling/sx';

import { useId, type ComponentPropsWithRef, type ComponentType, type Key, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { GamePanel, type GamePanelProps, type GamePanelCustomization, type GamePanelSlotProps } from '../game-panel/game-panel';
import { cardPartIdentity } from '../game-card/card-parts';
import { CARD_FRAME } from '../game-card/card-frame';

export type GameRoundOutcome = 'won' | 'lost' | 'pending';
export interface GameRound { key: Key; label: ReactNode; outcome: GameRoundOutcome; number?: number; detail?: ReactNode; trump?: ReactNode; current?: boolean }
export type GameRoundsPartProps<T extends 'span' | 'ol' | 'li'> = ComponentPropsWithRef<T> & {
  'data-ui'?: string;
  sx?: Interpolation<Theme>;
};

export interface GameRoundsSlotProps {
  /** Group wrapping the label and the round list. */
  root?: GamePanelSlotProps;
  /** Text naming the round list. */
  label?: GameRoundsPartProps<'span'>;
  /** Ordered list holding one entry per round. */
  list?: GameRoundsPartProps<'ol'>;
  /** One round, carrying its own outcome state. */
  round?: GameRoundsPartProps<'li'>;
  /** Result text shown beside the round label. */
  outcome?: GameRoundsPartProps<'span'>;
}

export interface GameRoundsSlots {
  /** Group wrapping the label and the round list. */
  root?: ComponentType<GamePanelProps>;
  /** Text naming the round list. */
  label?: ComponentType<GameRoundsPartProps<'span'>>;
  /** Ordered list holding one entry per round. */
  list?: ComponentType<GameRoundsPartProps<'ol'>>;
  /** One round, carrying its own outcome state. */
  round?: ComponentType<GameRoundsPartProps<'li'>>;
  /** Result text shown beside the round label. */
  outcome?: ComponentType<GameRoundsPartProps<'span'>>;
}

export interface GameRoundsProps extends Omit<GamePanelProps, 'children'>, Omit<GamePanelCustomization, 'slots'>, SxProps {
  /** Shows the visible label that names the round group. */
  label: string;
  /** Defines round labels and outcomes in display order. */
  rounds: readonly GameRound[];
  /** Visible result names in your game's language. */
  outcomeLabels: Record<GameRoundOutcome, string>;
  /** Strip keeps the rounds in one ordered lane; boxes wraps individual results. Defaults to strip. */
  variant?: 'strip' | 'boxes';
  locale?: Intl.LocalesArgument;
  /** Passes props and styles to the round group and its parts. */
  slotProps?: GameRoundsSlotProps;
  /** Replaces the round group and its parts. */
  slots?: GameRoundsSlots;
}
// A round ribbon: one baseline through five nodes. Each round stacks its number and label, an
// optional trump or detail picture, and an outcome node on the baseline with its word under it.
// Outcome reads by shape (filled disc won, open diamond lost, thin ring pending); the current
// round is underlined. Rows are a shared subgrid so nodes stay on one line at any width.
const PIP = `calc(${vars.space[2]} + 2px)`;
const PICTURE = `calc(${vars.size.gameCardSm} * 0.625)`;
const rootStyle = css({ label: 'game-rounds', display: 'grid', gap: vars.space[3], color: vars.color.text, fontFamily: vars.font.sans, fontSize: vars.textSize.sm, lineHeight: vars.lineHeight.tight,
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const labelStyle = css({ fontSize: vars.textSize.xs, fontWeight: vars.fontWeight.semibold, color: vars.color.textMuted,
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const listStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2], padding: 0, margin: 0,
  '[data-variant="strip"] > &': { display: 'grid', gridTemplateColumns: 'repeat(var(--game-rounds-count), minmax(0, 1fr))', gridTemplateRows: 'repeat(3, auto)', gap: 0 },
});
const roundStyle = css({ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: vars.space[2], minInlineSize: 0, overflowWrap: 'break-word',
  paddingBlock: vars.space[1], paddingInline: vars.space[2], borderRadius: vars.radius.sm, backgroundColor: vars.color.surfaceInset,
  '[data-variant="strip"] &': { display: 'grid', gridRow: 'span 3', gridTemplateRows: 'subgrid', justifyItems: 'center', rowGap: vars.space[2],
    padding: 0, paddingInline: vars.space[1], borderRadius: 0, backgroundColor: 'transparent', textAlign: 'center',
    '&::before': { content: '""', gridRow: 3, gridColumn: 1, alignSelf: 'start', justifySelf: 'stretch', blockSize: '1px', marginBlockStart: `calc(${PIP} / 2)`,
      marginInline: `calc(-1 * ${vars.space[1]})`, backgroundColor: vars.color.border },
    '&:first-of-type::before': { marginInlineStart: '50%' },
    '&:last-of-type::before': { marginInlineEnd: '50%' },
  },
  [FORCED_COLORS]: { backgroundColor: 'Canvas', '[data-variant="strip"] &::before': { backgroundColor: 'CanvasText' } },
});
const headStyle = css({ display: 'inline-flex', alignItems: 'baseline', justifyContent: 'center', gap: vars.space[1], maxInlineSize: '100%', paddingBlockEnd: vars.space[1],
  borderBlockEnd: '2px solid transparent', fontSize: vars.textSize.xs,
  '[aria-current="step"] > &': { borderBlockEndColor: vars.color.accent, color: vars.color.accentText },
  [FORCED_COLORS]: { borderBlockEndColor: 'Canvas', '[aria-current="step"] > &': { color: 'CanvasText', borderBlockEndColor: 'Highlight' } },
});
const numberStyle = css({ color: vars.color.textSubtle, fontWeight: vars.fontWeight.semibold, fontVariantNumeric: 'tabular-nums',
  '[aria-current="step"] > * > &': { color: 'inherit' },
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const roundLabelStyle = css({ fontWeight: vars.fontWeight.semibold, minInlineSize: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  '[data-variant="boxes"] &': { fontSize: vars.textSize.sm },
});
const detailStyle = css({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: vars.space[1],
  '&:not(:empty)': { boxSizing: 'border-box', minInlineSize: PICTURE, blockSize: `calc(${PICTURE} * ${CARD_FRAME.ratio})`, paddingInline: '2px',
    borderRadius: `calc(${PICTURE} / ${CARD_FRAME.cornerDivisor})`, backgroundColor: vars.color.cardFace, color: vars.color.cardInk,
    boxShadow: `inset 0 -1px 0 ${vars.color.borderControl}, ${vars.shadow.raised}`, fontSize: vars.textSize.sm, lineHeight: 1 },
  [FORCED_COLORS]: { '&:not(:empty)': { border: '1px solid CanvasText', backgroundColor: 'Canvas', color: 'CanvasText', boxShadow: 'none' } },
});
const outcomeStyle = css({ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: vars.space[1], fontSize: vars.textSize.xs, color: vars.color.textMuted,
  '[data-variant="strip"] &': { flexDirection: 'column' },
  '&::before': { content: '""', flex: 'none', boxSizing: 'border-box', inlineSize: PIP, blockSize: PIP, borderRadius: '50%',
    border: `1px solid ${vars.color.textSubtle}`, backgroundColor: vars.color.surface },
  '[data-outcome="won"] > &': { color: vars.color.text, '&::before': { borderColor: vars.color.success, backgroundColor: vars.color.success } },
  '[data-outcome="lost"] > &::before': { borderRadius: '1px', borderWidth: '2px', borderColor: vars.color.textMuted, transform: 'rotate(45deg) scale(0.8)' },
  [FORCED_COLORS]: { color: 'CanvasText', '[data-outcome] > &': { color: 'CanvasText' }, '&::before': { borderColor: 'CanvasText', backgroundColor: 'Canvas' },
    '[data-outcome="won"] > &::before': { borderColor: 'CanvasText', backgroundColor: 'CanvasText' }, '[data-outcome="lost"] > &::before': { borderColor: 'CanvasText' } },
});

export function GameRounds({ label, rounds, outcomeLabels, variant = 'strip', locale, slotProps, slots, component, ...props }: GameRoundsProps) {
  const id = useId();
  const labelId = slotProps?.label?.id ?? id;
  const externalLabel = slotProps?.root?.['aria-labelledby'] ?? props['aria-labelledby'];

  const Label = slots?.label ?? 'span';
  const List = slots?.list ?? 'ol';
  const Round = slots?.round ?? 'li';
  const Outcome = slots?.outcome ?? 'span';

  const labelIdentity = cardPartIdentity('game-rounds-label', slotProps?.label?.['data-ui']);
  const listIdentity = cardPartIdentity('game-rounds-list', slotProps?.list?.['data-ui']);
  const roundIdentity = cardPartIdentity('game-rounds-round', slotProps?.round?.['data-ui']);
  const outcomeIdentity = cardPartIdentity('game-rounds-outcome', slotProps?.outcome?.['data-ui']);

  return <GamePanel {...props} component={component} slots={slots} marker="game-rounds" structure={rootStyle} rootSlot={slotProps?.root}
    attributes={{ role: 'group', 'data-variant': variant, 'aria-labelledby': [labelId, externalLabel].filter(Boolean).join(' ') }}>
    <WithSx styles={[labelStyle, slotProps?.label?.sx]} className={slotProps?.label?.className}>{(classes) =>
      <Label {...withoutSx(slotProps?.label)} id={labelId} data-ui={labelIdentity} className={classes}>{label}</Label>}
    </WithSx>
    <WithSx styles={[listStyle, slotProps?.list?.sx]} className={slotProps?.list?.className}>{(classes) =>
    <List {...withoutSx(slotProps?.list)} data-ui={listIdentity} style={{ ...slotProps?.list?.style, '--game-rounds-count': Math.max(1, rounds.length) } as import('react').CSSProperties} className={classes}>
      {rounds.map((round, index) => (
        <WithSx key={round.key} styles={[roundStyle, slotProps?.round?.sx]} className={slotProps?.round?.className}>{(classes) => <Round
          {...withoutSx(slotProps?.round)}
          data-outcome={round.outcome}
          aria-current={round.current ? 'step' : undefined}
          data-ui={roundIdentity}
          className={classes}
        >
          {variant === 'strip' ? <span data-ui="game-rounds-head" css={headStyle}>
            <span data-ui="game-rounds-number" css={numberStyle}>{new Intl.NumberFormat(locale).format(round.number ?? index + 1)}</span>
            <span data-ui="game-rounds-round-label" css={roundLabelStyle}>{round.label}</span>
          </span> : <span data-ui="game-rounds-round-label" css={roundLabelStyle}>{round.label}</span>}
          {variant === 'strip' ? <div data-ui="game-rounds-detail" css={detailStyle}>{round.trump}{round.detail}</div> : <>{round.trump}{round.detail}</>}
          <WithSx styles={[outcomeStyle, slotProps?.outcome?.sx]} className={slotProps?.outcome?.className}>{(classes) => <Outcome
            {...withoutSx(slotProps?.outcome)}
            data-ui={outcomeIdentity}
            className={classes}
          >
            {outcomeLabels[round.outcome]}
          </Outcome>}</WithSx>
        </Round>}</WithSx>
      ))}
    </List>}
    </WithSx>
  </GamePanel>;
}
GameRounds.displayName = 'GameRounds';
