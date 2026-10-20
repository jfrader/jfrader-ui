import { withoutSx } from '../../styling/sx';
'use client';

import { useId, type ComponentPropsWithRef, type ComponentType, type Key, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { CardRoot, type GameCardRootProps, type GameCardRootCustomization, type GameCardRootSlotProps } from '../game-card/game-card-root';
import { cardPartIdentity } from '../game-card/card-parts';

export type GameRoundOutcome = 'won' | 'lost' | 'pending';
export interface GameRound { key: Key; label: ReactNode; outcome: GameRoundOutcome }
export type GameRoundsPartProps<T extends 'span' | 'ol' | 'li'> = ComponentPropsWithRef<T> & {
  'data-ui'?: string;
  sx?: Interpolation<Theme>;
};

export interface GameRoundsSlotProps {
  /** Group wrapping the label and the round list. */
  root?: GameCardRootSlotProps;
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
  root?: ComponentType<GameCardRootProps>;
  /** Text naming the round list. */
  label?: ComponentType<GameRoundsPartProps<'span'>>;
  /** Ordered list holding one entry per round. */
  list?: ComponentType<GameRoundsPartProps<'ol'>>;
  /** One round, carrying its own outcome state. */
  round?: ComponentType<GameRoundsPartProps<'li'>>;
  /** Result text shown beside the round label. */
  outcome?: ComponentType<GameRoundsPartProps<'span'>>;
}

export interface GameRoundsProps extends Omit<GameCardRootProps, 'children'>, Omit<GameCardRootCustomization, 'slots'>, SxProps {
  /** Shows the visible label that names the round group. */
  label: string;
  /** Defines round labels and outcomes in display order. */
  rounds: readonly GameRound[];
  /** Visible result names in your game's language. */
  outcomeLabels: Record<GameRoundOutcome, string>;
  /** Passes props and styles to the round group and its parts. */
  slotProps?: GameRoundsSlotProps;
  /** Replaces the round group and its parts. */
  slots?: GameRoundsSlots;
}
const rootStyle = css({ label: 'game-rounds', display: 'grid', gap: vars.space[2], color: vars.color.text, fontFamily: vars.font.sans,
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const listStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2], padding: 0, margin: 0, listStyle: 'none' });
const roundStyle = css({ display: 'grid', gap: vars.space[1], padding: vars.space[2], border: `1px solid ${vars.color.borderControl}`, borderRadius: vars.radius.sm,
  '&[data-outcome="won"]': { backgroundColor: vars.color.successSoft },
  '&[data-outcome="lost"]': { backgroundColor: vars.color.dangerSoft },
  '&[data-outcome="pending"]': { borderStyle: 'dashed' },
  [FORCED_COLORS]: { borderColor: 'CanvasText', backgroundColor: 'Canvas' },
});

export function GameRounds({ label, rounds, outcomeLabels, slotProps, slots, component, ...props }: GameRoundsProps) {
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

  return <CardRoot {...props} component={component} slots={slots} marker="game-rounds" structure={rootStyle} rootSlot={slotProps?.root}
    attributes={{ role: 'group', 'aria-labelledby': [labelId, externalLabel].filter(Boolean).join(' ') }}>
    <Label {...withoutSx(slotProps?.label)} id={labelId} data-ui={labelIdentity} className={slotProps?.label?.className} css={slotProps?.label?.sx}>{label}</Label>
    <List {...withoutSx(slotProps?.list)} role="list" data-ui={listIdentity} className={slotProps?.list?.className} css={[listStyle, slotProps?.list?.sx]}>
      {rounds.map((round) => (
        <Round
          {...withoutSx(slotProps?.round)}
          key={round.key}
          data-outcome={round.outcome}
          data-ui={roundIdentity}
          className={slotProps?.round?.className}
          css={[roundStyle, slotProps?.round?.sx]}
        >
          <span>{round.label}</span>
          <Outcome
            {...withoutSx(slotProps?.outcome)}
            data-ui={outcomeIdentity}
            className={slotProps?.outcome?.className}
            css={slotProps?.outcome?.sx}
          >
            {outcomeLabels[round.outcome]}
          </Outcome>
        </Round>
      ))}
    </List>
  </CardRoot>;
}
GameRounds.displayName = 'GameRounds';
