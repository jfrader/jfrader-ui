'use client';

import { withoutSx } from '../../styling/sx';

import { useId, type ComponentPropsWithRef, type ComponentType, type Key, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { GamePanel, type GamePanelProps, type GamePanelCustomization, type GamePanelSlotProps } from '../game-panel/game-panel';
import { cardPartIdentity } from '../game-card/card-parts';

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
const rootStyle = css({ label: 'game-rounds', display: 'grid', gap: vars.space[2], color: vars.color.text, fontFamily: vars.font.sans, fontSize: vars.textSize.sm,
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const listStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2], padding: 0, margin: 0, listStyle: 'decimal',
  '[data-variant="strip"] > &': { display: 'grid', gridTemplateColumns: 'repeat(var(--game-rounds-count), minmax(0, 1fr))', gap: 0 },
});
const roundStyle = css({ display: 'grid', gap: vars.space[1], padding: vars.space[2], border: `1px solid ${vars.color.borderControl}`, borderRadius: vars.radius.sm,
  '&[data-outcome="won"]': { backgroundColor: vars.color.successSoft },
  '&[data-outcome="lost"]': { backgroundColor: vars.color.dangerSoft },
  '&[data-outcome="pending"]': { borderStyle: 'dashed' },
  minInlineSize: 0, overflowWrap: 'anywhere',
  '[data-variant="strip"] &': { borderRadius: 0, borderInlineEndWidth: 0, paddingInline: vars.space[1], '&:last-child': { borderInlineEndWidth: '1px' } },
  '&[aria-current="step"]': { outline: `2px solid ${vars.color.accent}`, outlineOffset: '-2px' },
  [FORCED_COLORS]: { borderColor: 'CanvasText', backgroundColor: 'Canvas' },
});
const outcomeStyle = css({ fontSize: vars.textSize.xs });

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
    <Label {...withoutSx(slotProps?.label)} id={labelId} data-ui={labelIdentity} className={slotProps?.label?.className} css={slotProps?.label?.sx}>{label}</Label>
    <List {...withoutSx(slotProps?.list)} data-ui={listIdentity} style={{ ...slotProps?.list?.style, '--game-rounds-count': Math.max(1, rounds.length) } as import('react').CSSProperties} className={slotProps?.list?.className} css={[listStyle, slotProps?.list?.sx]}>
      {rounds.map((round, index) => (
        <Round
          {...withoutSx(slotProps?.round)}
          key={round.key}
          data-outcome={round.outcome}
          aria-current={round.current ? 'step' : undefined}
          data-ui={roundIdentity}
          className={slotProps?.round?.className}
          css={[roundStyle, slotProps?.round?.sx]}
        >
          {variant === 'strip' && <span data-ui="game-rounds-number">{new Intl.NumberFormat(locale).format(round.number ?? index + 1)}</span>}
          <span>{round.label}</span>
          {round.trump}
          {round.detail}
          <Outcome
            {...withoutSx(slotProps?.outcome)}
            data-ui={outcomeIdentity}
            className={slotProps?.outcome?.className}
            css={[outcomeStyle, slotProps?.outcome?.sx]}
          >
            {outcomeLabels[round.outcome]}
          </Outcome>
        </Round>
      ))}
    </List>
  </GamePanel>;
}
GameRounds.displayName = 'GameRounds';
