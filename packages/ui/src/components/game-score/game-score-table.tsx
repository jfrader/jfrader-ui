'use client';

import type { ComponentPropsWithRef, ComponentType, Key, ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { WithSx, withoutSx, type SxProps } from '../../styling/sx';
import { GamePanel, type GamePanelProps, type GamePanelCustomization, type GamePanelSlotProps } from '../game-panel/game-panel';
import { cardPartIdentity } from '../game-card/card-parts';

export interface GameScoreTableRound {
  key: string;
  label: ReactNode;
  state?: 'complete' | 'current' | 'upcoming';
}
export interface GameScoreTablePlayer {
  key: Key;
  label: ReactNode;
  /** Scores by round key; absent entries show the pending label. */
  scores: Readonly<Record<string, number | undefined>>;
  total: number;
  isMe?: boolean;
  leader?: boolean;
}
type TablePart<T extends 'table' | 'th' | 'td' | 'span'> = ComponentPropsWithRef<T> & SxProps & { 'data-ui'?: string };
export interface GameScoreTableSlotProps {
  root?: GamePanelSlotProps;
  table?: TablePart<'table'>;
  round?: TablePart<'th'>;
  cell?: TablePart<'td'>;
  total?: TablePart<'td'>;
  leader?: TablePart<'span'>;
}
export interface GameScoreTableSlots {
  root?: ComponentType<GamePanelProps>;
  table?: ComponentType<TablePart<'table'>>;
  round?: ComponentType<TablePart<'th'>>;
  cell?: ComponentType<TablePart<'td'>>;
  total?: ComponentType<TablePart<'td'>>;
  leader?: ComponentType<TablePart<'span'>>;
}
export interface GameScoreTableProps extends Omit<GamePanelProps, 'children'>, Omit<GamePanelCustomization, 'slots'>, SxProps {
  /** Accessible table caption, also displayed above the scores. */
  caption: string;
  players: readonly GameScoreTablePlayer[];
  rounds: readonly GameScoreTableRound[];
  /** Localized column and state names. */
  labels: { player: string; total: string; me: string; leader: string; current: string; upcoming: string; pending: string };
  locale?: Intl.LocalesArgument;
  slots?: GameScoreTableSlots;
  slotProps?: GameScoreTableSlotProps;
}
const rootStyle = css({ minInlineSize: 0, maxInlineSize: '100%', overflowX: 'auto', fontFamily: vars.font.sans, color: vars.color.text });
const tableStyle = css({ inlineSize: '100%', borderCollapse: 'collapse', fontSize: vars.textSize.sm,
  '& > caption': { textAlign: 'start', fontWeight: vars.fontWeight.semibold, paddingBlockEnd: vars.space[3] },
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const cellStyle = css({ paddingBlock: vars.space[2], paddingInline: vars.space[1], textAlign: 'end', fontVariantNumeric: 'tabular-nums', borderBlockEnd: `1px solid ${vars.color.borderControl}`,
  '&[data-state="current"]': { backgroundColor: vars.color.accentSoft },
  '&[data-state="upcoming"]': { color: vars.color.textMuted },
  '[data-me="true"] > &': { fontWeight: vars.fontWeight.bold },
  [FORCED_COLORS]: {
    borderColor: 'CanvasText',
    '&[data-state="current"], &[data-state="upcoming"]': { color: 'CanvasText', backgroundColor: 'Canvas' },
  },
});
const nameStyle = css({ paddingBlock: vars.space[2], paddingInline: vars.space[1], textAlign: 'start', borderBlockEnd: `1px solid ${vars.color.borderControl}`, whiteSpace: 'nowrap' });
const totalStyle = css({ fontWeight: vars.fontWeight.bold, borderInlineStart: `1px solid ${vars.color.borderControl}` });
const badgeStyle = css({ display: 'inline-block', marginInlineStart: vars.space[1], fontSize: vars.textSize.xs, whiteSpace: 'nowrap' });

export function GameScoreTable({ caption, players, rounds, labels, locale, slots, slotProps, component, ...props }: GameScoreTableProps) {
  const formatter = new Intl.NumberFormat(locale);
  const Table = slots?.table ?? 'table';
  const Round = slots?.round ?? 'th';
  const Cell = slots?.cell ?? 'td';
  const Total = slots?.total ?? 'td';
  const Leader = slots?.leader ?? 'span';
  return <GamePanel {...props} component={component} slots={slots} marker="game-score-table" structure={rootStyle} rootSlot={slotProps?.root}>
    <WithSx styles={[tableStyle, slotProps?.table?.sx]} className={slotProps?.table?.className}>{(tableClass) =>
      <Table {...withoutSx(slotProps?.table)} data-ui={cardPartIdentity('game-score-table-table', slotProps?.table?.['data-ui'])} className={tableClass}>
        <caption>{caption}</caption>
        <thead><tr><th scope="col" css={nameStyle}>{labels.player}</th>
          {rounds.map((round) => <WithSx key={round.key} styles={[cellStyle, slotProps?.round?.sx]} className={slotProps?.round?.className}>{(classes) =>
            <Round {...withoutSx(slotProps?.round)} scope="col" data-state={round.state} data-ui={cardPartIdentity('game-score-table-round', slotProps?.round?.['data-ui'])} className={classes}>
              {round.label}{round.state === 'current' && <span css={badgeStyle}>{labels.current}</span>}{round.state === 'upcoming' && <span css={badgeStyle}>{labels.upcoming}</span>}
            </Round>}
          </WithSx>)}
          <th scope="col" css={[cellStyle, totalStyle]}>{labels.total}</th>
        </tr></thead>
        <tbody>{players.map((player) => <tr key={player.key} data-me={String(Boolean(player.isMe))} data-leader={String(Boolean(player.leader))}>
          <th scope="row" css={nameStyle}>{player.label}{player.isMe && <span css={visuallyHiddenStyle}>{labels.me}</span>}
            {player.leader && <WithSx styles={[badgeStyle, slotProps?.leader?.sx]} className={slotProps?.leader?.className}>{(classes) =>
              <Leader {...withoutSx(slotProps?.leader)} data-ui={cardPartIdentity('game-score-table-leader', slotProps?.leader?.['data-ui'])} className={classes}><span aria-hidden="true">♛</span><span css={visuallyHiddenStyle}>{labels.leader}</span></Leader>}
            </WithSx>}
          </th>
          {rounds.map((round) => <WithSx key={round.key} styles={[cellStyle, slotProps?.cell?.sx]} className={slotProps?.cell?.className}>{(classes) =>
            <Cell {...withoutSx(slotProps?.cell)} data-state={round.state} data-ui={cardPartIdentity('game-score-table-cell', slotProps?.cell?.['data-ui'])} className={classes}>
              {player.scores[round.key] === undefined ? labels.pending : formatter.format(player.scores[round.key]!)}
            </Cell>}
          </WithSx>)}
          <WithSx styles={[cellStyle, totalStyle, slotProps?.total?.sx]} className={slotProps?.total?.className}>{(classes) =>
            <Total {...withoutSx(slotProps?.total)} data-ui={cardPartIdentity('game-score-table-total', slotProps?.total?.['data-ui'])} className={classes}>{formatter.format(player.total)}</Total>}
          </WithSx>
        </tr>)}</tbody>
      </Table>}
    </WithSx>
  </GamePanel>;
}
GameScoreTable.displayName = 'GameScore.Table';
