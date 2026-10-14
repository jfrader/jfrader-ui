'use client';

import { useId, type ComponentPropsWithRef, type Key, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { CardRoot, type GameCardRootProps, type GameCardRootCustomization, type GameCardRootSlotProps } from '../game-card/game-card-root';

export type GameRoundOutcome = 'won' | 'lost' | 'pending';
export interface GameRound { key: Key; label: ReactNode; outcome: GameRoundOutcome }
type PartProps<T extends 'span' | 'ol' | 'li'> = ComponentPropsWithRef<T> & { css?: Interpolation<Theme> };
export interface GameRoundsProps extends Omit<GameCardRootProps, 'children'>, GameCardRootCustomization, SxProps {
  label: string;
  rounds: readonly GameRound[];
  /** Visible result names in your game's language. */
  outcomeLabels: Record<GameRoundOutcome, string>;
  slotProps?: { root?: GameCardRootSlotProps; label?: PartProps<'span'>; list?: PartProps<'ol'>; round?: PartProps<'li'>; outcome?: PartProps<'span'> };
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

export function GameRounds({ label, rounds, outcomeLabels, slotProps, ...props }: GameRoundsProps) {
  const id = useId();
  const labelId = slotProps?.label?.id ?? id;
  const externalLabel = slotProps?.root?.['aria-labelledby'] ?? props['aria-labelledby'];
  return <CardRoot {...props} marker="game-rounds" structure={rootStyle} rootSlot={slotProps?.root}
    attributes={{ role: 'group', 'aria-labelledby': [labelId, externalLabel].filter(Boolean).join(' ') }}>
    <span {...slotProps?.label} id={labelId}>{label}</span>
    <ol {...slotProps?.list} role="list" css={[listStyle, slotProps?.list?.css]}>
      {rounds.map((round) => <li {...slotProps?.round} key={round.key} data-outcome={round.outcome} css={[roundStyle, slotProps?.round?.css]}>
        <span>{round.label}</span><span {...slotProps?.outcome}>{outcomeLabels[round.outcome]}</span>
      </li>)}
    </ol>
  </CardRoot>;
}
GameRounds.displayName = 'GameRounds';
