'use client';

import type { ComponentPropsWithRef, ComponentType, ReactNode, Ref } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { WithSx, withoutSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { CardFlights } from '../card-flights';
import { DeckProvider } from '../deck';
import { GameActions, type GameActionItem, type GameActionsProps } from '../game-actions';
import { GameCard, type GameCardValue } from '../game-card';
import { GameCardStack, type PlayedCard } from '../game-card-stack';
import { GameHand } from '../game-hand';
import { GameSeat, type GameSeatProps } from '../game-seat';
import { GameTable, useGameTableSeat, type GameTableProps } from '../game-table';
import { PersonAvatar } from '../person-avatar';

export interface TrucoTableCard {
  /** Stable identity used by card flights. */
  id: string;
  /** Accessible name for the card. */
  label: string;
  /** Card face resolved by the deck. */
  value: GameCardValue;
}

export interface TrucoTablePlayer {
  /** Stable seat and flight identity. */
  key: string;
  /** Team index; defaults to the seat order alternating between two teams. */
  teamIdx?: number;
  /** Local player; the table rotates this seat to the front. */
  isMe?: boolean;
  /** Player name shown in the seat. */
  name: string;
  /** Replaces the generated person artwork. */
  avatar?: ReactNode;
  /** Face-down cards in the player's hand. */
  hiddenCards?: number;
  /** Extra seat line, such as a call or the local marker. */
  badges?: ReactNode;
  /** Seat state ring. */
  state?: GameSeatProps['state'];
  /** Turn ring and countdown, owned by the consumer. */
  turn?: GameSeatProps['turn'];
}

/** One card on a seat's play pile. */
export interface TrucoTablePlay extends PlayedCard {
  /** Seat that played the card. */
  playerKey: string;
}

export interface TrucoTableScore {
  /** Stable identity. */
  key: string;
  /** Team name. */
  label: string;
  /** Team score. */
  value: number;
}

export interface TrucoTableLabels {
  /** Names the table region. */
  table: string;
  /** Names the deck card. */
  deck: string;
  /** Names the local hand. */
  hand: string;
  /** Names the action toolbar. */
  actions: string;
  /** Text on the hand confirmation button. */
  playCard: string;
  /** Names the score line. */
  score: string;
  /** Names a hidden hand. */
  hiddenCards: (name: string, formatted: string) => string;
  /** Names a seat's played pile. */
  pile: (name: string) => string;
}

export interface TrucoTableRootProps extends ComponentPropsWithRef<'div'> {
  [attribute: `data-${string}`]: string | number | boolean | undefined;
}
export type TrucoTableRootSlotProps = Partial<TrucoTableRootProps> & SxProps;

export interface TrucoTableSlots {
  /** Replaces the outer wrapper. */
  root?: ComponentType<TrucoTableRootProps>;
  /** Replaces the seat plaque. */
  seat?: ComponentType<GameSeatProps>;
  /** Replaces the action toolbar. */
  actions?: ComponentType<GameActionsProps>;
}

export interface TrucoTableSlotProps {
  /** Props for the outer wrapper. Conflicts win except merged className and style. */
  root?: TrucoTableRootSlotProps;
  /** Props for every seat plaque. */
  seat?: Partial<GameSeatProps>;
  /** Props for the action toolbar. */
  actions?: Partial<GameActionsProps>;
}

export interface TrucoTableProps extends SxProps {
  /** Seats in player order. The local player is rotated to the front. */
  players: readonly TrucoTablePlayer[];
  /** Table name shown in the header. */
  title: string;
  /** Secondary header line, such as the round or the call. */
  subtitle?: ReactNode;
  /** The local player's hand. Omit before the deal. */
  hand?: readonly TrucoTableCard[];
  /** Receives the selected card when the confirmation button runs. */
  onPlayIntent?: (card: TrucoTableCard) => void;
  /** Cards on each seat's played pile, in play order. */
  plays?: readonly TrucoTablePlay[];
  /** Team scores in team order, shown in the header and on each seat. */
  score?: readonly TrucoTableScore[];
  /** Event line under the table. Announcements are polite live text. */
  announcement?: ReactNode;
  /** Action commands for the dock. Omit to hide the toolbar. */
  actions?: readonly GameActionItem[];
  /** Names the action toolbar. Defaults to `labels.actions`. */
  actionsLabel?: string;
  /** Overrides the default copy. */
  labels?: Partial<TrucoTableLabels>;
  /** Change to deal the hands. The first render appears in place.
   * @deprecated Call useFlights().deal() inside FlightProvider instead. Retained for one minor release. */
  deal?: string | number;
  /** Change to replace the card snapshot without animation.
   * @deprecated Call useFlights().resync() inside FlightProvider instead. Retained for one minor release. */
  revision?: string | number;
  /** Seat receiving the first dealt card. */
  forehand?: string;
  /** Formats scores and counts. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** Deck used by cards without an explicit deck. Defaults to `spanish`. */
  deck?: string;
  /** Replaces the default seat content. */
  renderSeat?: (player: TrucoTablePlayer, index: number) => ReactNode;
  /** Replaces the center content, including the deck. */
  center?: ReactNode;
  /** Replaces the action toolbar content. */
  dock?: ReactNode;
  /** Overlays the table, such as a result panel. */
  floating?: ReactNode;
  /** Reports flight activity so consumers can disable commands. */
  onBusyChange?: (busy: boolean) => void;
  /** Replaces the outer wrapper. Exactly sugar for `slots.root`. */
  component?: TrucoTableSlots['root'];
  /** Replaces the wrapper, seat plaque and action toolbar. */
  slots?: TrucoTableSlots;
  /** Passes props to the wrapper, seat plaques and action toolbar. */
  slotProps?: TrucoTableSlotProps;
  /** Table options forwarded to the GameTable root, without its seats, places, and region inputs. */
  tableProps?: Omit<GameTableProps, 'seats' | 'seatSlots' | 'places' | 'players' | 'teamCount' | 'surface' | 'children' | 'component' | 'slots' | 'slotProps' | 'sx' | 'className' | 'style'>;
  /** Reaches the outer wrapper element. */
  ref?: Ref<HTMLDivElement>;
  className?: string;
  style?: ComponentPropsWithRef<'div'>['style'];
}

const DEFAULT_LABELS: TrucoTableLabels = {
  table: 'Truco table',
  deck: 'Deck',
  hand: 'Your hand',
  actions: 'Actions',
  playCard: 'Play card',
  score: 'Score',
  hiddenCards: (name, formatted) => `${name}, ${formatted} hidden cards`,
  pile: (name) => `${name}: played cards`,
};

const rootStyle = css({
  label: 'truco-table',
  display: 'grid',
  inlineSize: '100%',
  blockSize: '100%',
  minBlockSize: 0,
  color: vars.color.text,
});

const headerTitleStyle = css({
  fontSize: vars.textSize.lg,
  fontWeight: vars.fontWeight.semibold,
  letterSpacing: vars.editorial.tracking.standard,
  color: vars.color.text,
  [FORCED_COLORS]: { color: 'CanvasText' },
});

const headerMetaStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  fontVariantNumeric: 'tabular-nums',
  [FORCED_COLORS]: { color: 'CanvasText' },
});

const scoreStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[3],
  fontSize: vars.textSize.sm,
  fontVariantNumeric: 'tabular-nums',
  color: vars.color.text,
  [FORCED_COLORS]: { color: 'CanvasText' },
});

const scoreItemStyle = css({ display: 'inline-flex', alignItems: 'baseline', gap: vars.space[1] });
const scoreLabelStyle = css({ color: vars.color.textMuted, [FORCED_COLORS]: { color: 'CanvasText' } });
const scoreValueStyle = css({ fontWeight: vars.fontWeight.semibold, [FORCED_COLORS]: { color: 'CanvasText' } });

const centerStyle = css({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const seatCoinStyle = css({
  fontSize: vars.textSize.sm,
  minInlineSize: vars.space[8],
  blockSize: vars.space[8],
  paddingInline: vars.space[1],
});

const announcementStyle = css({
  display: 'block',
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  [FORCED_COLORS]: { color: 'CanvasText' },
});

const dockStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  justifyContent: 'center',
  gap: vars.space[3],
  inlineSize: '100%',
});

const handGroupStyle = css({ display: 'grid', justifyItems: 'center', gap: vars.space[2], minInlineSize: 0 });

function mergeIdentity(...values: (string | number | boolean | undefined)[]) {
  return [...new Set(values.flatMap((value) => typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : []))].join(' ');
}

interface SeatContentProps {
  seat: ComponentType<GameSeatProps>;
  seatProps: Partial<GameSeatProps> | undefined;
  labels: TrucoTableLabels;
  locale: Intl.LocalesArgument | undefined;
  renderSeat: TrucoTableProps['renderSeat'];
  score: readonly TrucoTableScore[] | undefined;
}

function TrucoSeatContent({ seat: Seat, seatProps, labels, locale, renderSeat, score }: SeatContentProps) {
  const { player, index, slot } = useGameTableSeat<TrucoTablePlayer>();
  if (!player) return null;
  if (renderSeat) return <>{renderSeat(player, index)}</>;
  const formatter = new Intl.NumberFormat(locale);
  const name = player.name;
  const hidden = Math.max(0, Math.floor(player.hiddenCards ?? 0));
  const teamScore = score?.[slot.teamIdx];
  const badges = [player.badges].filter(isRenderable);
  const seatSlotProps = {
    ...seatProps?.slotProps,
    points: { ...seatProps?.slotProps?.points, sx: [seatCoinStyle, seatProps?.slotProps?.points?.sx] },
  };
  return <Seat
    {...seatProps}
    slotProps={seatSlotProps}
    name={name}
    avatar={player.avatar ?? <PersonAvatar seed={name} size="full" />}
    points={teamScore ? <span>{formatter.format(teamScore.value)}<span css={visuallyHiddenStyle}> {teamScore.label}</span></span> : undefined}
    handCount={hidden}
    hand={undefined}
    badges={hidden > 0 ? <>{badges}<span css={visuallyHiddenStyle}>{labels.hiddenCards(name, formatter.format(hidden))}</span></> : badges.length > 0 ? badges : undefined}
    state={player.state}
    turn={player.turn}
    data-truco-seat
  />;
}

export function TrucoTable({
  players,
  title,
  subtitle,
  hand,
  onPlayIntent,
  plays = [],
  score,
  announcement,
  actions,
  actionsLabel,
  labels: labelOverrides,
  deal,
  revision,
  forehand,
  locale,
  deck = 'spanish',
  renderSeat,
  center,
  dock,
  floating,
  onBusyChange,
  component,
  slots,
  slotProps,
  tableProps,
  ref,
  className,
  style,
  sx,
}: TrucoTableProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const Root = slots?.root ?? component ?? 'div';
  const Seat = slots?.seat ?? GameSeat;
  const Actions = slots?.actions ?? GameActions;
  const rootSlot = withoutSx(slotProps?.root);
  const mergedRef = useMergeRefs([ref, rootSlot?.ref]);
  const rootClasses = [className, rootSlot?.className].filter(Boolean).join(' ') || undefined;
  const formatter = new Intl.NumberFormat(locale);
  const hasDock = dock !== undefined && dock !== null && dock !== false && dock !== 0 && dock !== '';
  const showActions = !hasDock && actions !== undefined && actions.length > 0;
  const handGroup = hand !== undefined && hand.length > 0;
  return (
    <WithSx styles={[rootStyle, slotProps?.root?.sx]} sx={sx}>
      {(classes) => (
        <Root
          {...rootSlot}
          ref={mergedRef}
          role={rootSlot?.role ?? 'group'}
          aria-label={rootSlot?.['aria-label'] ?? labels.table}
          data-ui={mergeIdentity('truco-table', rootSlot?.['data-ui'])}
          className={[classes, rootClasses].filter(Boolean).join(' ') || undefined}
          style={{ ...style, ...rootSlot?.style }}
        >
          <DeckProvider default={deck}>
            <CardFlights deal={deal} revision={revision} forehand={forehand} onBusyChange={onBusyChange}>
              <GameTable
                {...tableProps}
                places={Math.max(players.length, 2)}
                seats={players}
                seatPlacement={tableProps?.seatPlacement ?? 'auto'}
                teamCount={2}
              >
                <GameTable.Header>
                  <span css={headerTitleStyle}>{title}</span>
                  {isRenderable(subtitle) && <div css={headerMetaStyle}>{subtitle}</div>}
                  {score && score.length > 0 && (
                    <span css={scoreStyle} role="group" aria-label={labels.score}>
                      {score.map((team) => (
                        <span key={team.key} css={scoreItemStyle}>
                          <span css={scoreLabelStyle}>{team.label}</span>
                          <span css={scoreValueStyle}>{formatter.format(team.value)}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </GameTable.Header>
                <GameTable.Seat>
                  <TrucoSeatContent seat={Seat} seatProps={slotProps?.seat} labels={labels} locale={locale} renderSeat={renderSeat} score={score} />
                </GameTable.Seat>
                <GameTable.Play>
                  <TrucoPlayContent plays={plays} labels={labels} />
                </GameTable.Play>
                <GameTable.Center>
                  {center ?? (
                    <div css={centerStyle}>
                      <CardFlights.Deck>
                        <GameCard size="sm" label={labels.deck} />
                      </CardFlights.Deck>
                    </div>
                  )}
                </GameTable.Center>
                {isRenderable(announcement) && (
                  <GameTable.Footer>
                    <div role="status" css={announcementStyle}>{announcement}</div>
                  </GameTable.Footer>
                )}
                {(hasDock || showActions || handGroup) && (
                  <GameTable.Dock>
                    {hasDock ? dock : (
                      <div css={dockStyle}>
                        {handGroup && (
                          <div css={handGroupStyle} role="group" aria-label={labels.hand}>
                            <GameHand cards={hand ?? []} size="md">
                              {onPlayIntent && <GameHand.Confirm onPlay={(card) => onPlayIntent(card)}>{labels.playCard}</GameHand.Confirm>}
                            </GameHand>
                          </div>
                        )}
                        {showActions && (
                          <Actions
                            {...slotProps?.actions}
                            actions={actions ?? []}
                            label={actionsLabel ?? labels.actions}
                          />
                        )}
                      </div>
                    )}
                  </GameTable.Dock>
                )}
                {isRenderable(floating) && <GameTable.Floating>{floating}</GameTable.Floating>}
              </GameTable>
            </CardFlights>
          </DeckProvider>
        </Root>
      )}
    </WithSx>
  );
}
TrucoTable.displayName = 'TrucoTable';

function TrucoPlayContent({ plays, labels }: { plays: readonly TrucoTablePlay[]; labels: TrucoTableLabels }) {
  const { player } = useGameTableSeat<TrucoTablePlayer>();
  if (!player) return null;
  const cards = plays.filter((play) => play.playerKey === player.key);
  if (cards.length === 0) return null;
  return <GameCardStack.Pile playerKey={player.key} label={labels.pile(player.name)} cards={cards} cardWidth={vars.size.gameCardSm} />;
}
