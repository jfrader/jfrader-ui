'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentPropsWithRef, type ComponentType, type ReactNode, type Ref } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import Decimal from 'decimal.js';
import { css } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { WithSx, withoutSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { useLatestCallback } from '../../utils/use-latest-callback';
import { CardFlights } from '../card-flights';
import { DeckProvider } from '../deck';
import { GameActions, type GameActionItem, type GameActionsProps } from '../game-actions';
import { GameCard, type GameCardValue } from '../game-card';
import { ChipFlights, GameChipStack, useChipFlights, type GameChipStackChip } from '../game-chip-stack';
import { CARD_FRAME } from '../game-card/card-frame';
import { GameSeat, type GameSeatProps } from '../game-seat';
import { GameTable, useGameTableSeat, type GameTableProps } from '../game-table';
import { PersonAvatar } from '../person-avatar';
import type { FlightOutcome, TableFlightEvent } from '../flights/types';
import { useFlightSurface } from '../flights/flight-provider';

declare const process: { env: { NODE_ENV?: string } };

/** One card on the community board. */
export interface PokerTableCard {
  /** Stable identity used by card flights. */
  id: string;
  /** Accessible name for the card. */
  label: string;
  /** Card face resolved by the deck. */
  value: GameCardValue;
}

export interface PokerTablePlayer {
  /** Stable seat and flight identity. */
  key: string;
  /** Local player; the table rotates this seat to the front. */
  isMe?: boolean;
  /** Player name shown in the seat. */
  name: string;
  /** Stack formatted into the seat coin. */
  chips: number;
  /** Replaces the generated person artwork. */
  avatar?: ReactNode;
  /** Face-up cards for this player, such as your hand or a showdown reveal. */
  cards?: readonly PokerTableCard[];
  /** Face-down cards for this player. */
  hiddenCards?: number;
  /** Extra seat line, such as "All in". */
  badges?: ReactNode;
  /** Show the dealer marker before the badges. */
  dealer?: boolean;
  /** Dim the seat for a folded player. */
  folded?: boolean;
  /** Seat state ring. */
  state?: GameSeatProps['state'];
  /** Turn ring and countdown, owned by the consumer. */
  turn?: GameSeatProps['turn'];
}

export interface PokerTableLabels {
  /** Names the table region. */
  table: string;
  /** Names the deck card. */
  deck: string;
  /** Names the community board. */
  board: string;
  /** Names the pot. */
  pot: string;
  /** Names the action toolbar. */
  actions: string;
  /** Names the dealer marker. */
  dealer: string;
  /** Names the folded state. */
  folded: string;
  /** Names the seat coin unit, such as "chips". */
  chips: string;
  /** Names a hidden hand. */
  hiddenCards: (name: string, formatted: string) => string;
}

export interface PokerTableRootProps extends ComponentPropsWithRef<'div'> {
  [attribute: `data-${string}`]: string | number | boolean | undefined;
}
export type PokerTableRootSlotProps = Partial<PokerTableRootProps> & SxProps;

export interface PokerTableSlots {
  /** Replaces the outer wrapper. */
  root?: ComponentType<PokerTableRootProps>;
  /** Replaces the seat plaque. */
  seat?: ComponentType<GameSeatProps>;
  /** Replaces the action toolbar. */
  actions?: ComponentType<GameActionsProps>;
}

export interface PokerTableSlotProps {
  /** Props for the outer wrapper. Conflicts win except merged className and style. */
  root?: PokerTableRootSlotProps;
  /** Props for every seat plaque. */
  seat?: Partial<GameSeatProps>;
  /** Props for the action toolbar. */
  actions?: Partial<GameActionsProps>;
}

export interface PokerTableProps extends SxProps {
  /** Seats in player order. The local player is rotated to the front. */
  players: readonly PokerTablePlayer[];
  /** Table name shown in the header. */
  title: string;
  /** Secondary header line, such as blinds or the current street. */
  subtitle?: ReactNode;
  /** Community cards in reveal order. New cards fly from the deck; at most five are shown. */
  board?: readonly PokerTableCard[];
  /** Chip total shown in the center. Omit to hide the pot. */
  pot?: number;
  /** Sets the positive, finite chip values used to depict the pot, largest first. Must not be empty. Defaults to [1000, 500, 100, 25, 5, 1]. Unrepresented remainders remain in the formatted total. */
  denominations?: readonly number[];
  /** Event line under the table. Announcements are polite live text. */
  announcement?: ReactNode;
  /** Action commands for the dock. Omit to hide the toolbar. */
  actions?: readonly GameActionItem[];
  /** Names the action toolbar. Defaults to `labels.actions`. */
  actionsLabel?: string;
  /** Overrides the default copy. */
  labels?: Partial<PokerTableLabels>;
  /** Seat receiving the first dealt card. */
  forehand?: string;
  /** Formats stacks and the pot. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** Deck used by cards without an explicit deck. Defaults to `french`. */
  deck?: string;
  /** Replaces the default seat content. */
  renderSeat?: (player: PokerTablePlayer, index: number) => ReactNode;
  /** Replaces the center content, including the deck and board flights. */
  center?: ReactNode;
  /** Replaces the action toolbar content. */
  dock?: ReactNode;
  /** Overlays the table, such as a result panel. */
  floating?: ReactNode;
  /** Reports flight activity so consumers can disable commands. */
  onBusyChange?: (busy: boolean) => void;
  /** Replaces the outer wrapper. Exactly sugar for `slots.root`. */
  component?: PokerTableSlots['root'];
  /** Replaces the wrapper, seat plaque and action toolbar. */
  slots?: PokerTableSlots;
  /** Passes props to the wrapper, seat plaques and action toolbar. */
  slotProps?: PokerTableSlotProps;
  /** Table options forwarded to the GameTable root, without its seats, places, and region inputs. */
  tableProps?: Omit<GameTableProps, 'seats' | 'seatSlots' | 'places' | 'players' | 'teamCount' | 'surface' | 'children' | 'component' | 'slots' | 'slotProps' | 'sx' | 'className' | 'style'>;
  /** Reaches the outer wrapper element. */
  ref?: Ref<HTMLDivElement>;
  className?: string;
  style?: ComponentPropsWithRef<'div'>['style'];
}

const DEFAULT_LABELS: PokerTableLabels = {
  table: 'Poker table',
  deck: 'Deck',
  board: 'Community cards',
  pot: 'Pot',
  actions: 'Actions',
  dealer: 'Dealer',
  folded: 'Folded',
  chips: 'chips',
  hiddenCards: (name, formatted) => `${name}, ${formatted} hidden cards`,
};

const BOARD_SLOTS = 5;
const DEFAULT_DENOMINATIONS = [1000, 500, 100, 25, 5, 1] as const;
const POT_MAX_VISIBLE = 3;
const Exact = Decimal.clone({ precision: 40 });
type TransferEvent = Extract<TableFlightEvent, { kind: 'transfer' }>;
interface ChipLane {
  pending: TransferEvent[];
  active: TransferEvent | null;
  generation: number;
}

function potChips(pot: number | undefined, denominations: readonly number[]): GameChipStackChip[] {
  const values = [...new Set(denominations)];
  if (!values.length || values.some(value => !Number.isFinite(value) || value <= 0)) {
    throw new RangeError('PokerTable denominations must contain at least one positive, finite value.');
  }
  if (pot === undefined || !Number.isFinite(pot) || pot <= 0) return [];
  let remaining = new Exact(pot);
  return values.sort((a, b) => b - a).flatMap(value => {
    const count = remaining.dividedToIntegerBy(value);
    remaining = remaining.mod(value);
    return count.isZero() ? [] : [{ value, count: Exact.min(count, Number.MAX_SAFE_INTEGER).toNumber() }];
  });
}

const rootStyle = css({
  label: 'poker-table',
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

const centerStyle = css({
  display: 'grid',
  justifyItems: 'center',
  gap: vars.space[2],
});

const potStackStyle = css({
  maxInlineSize: `calc(${vars.size.gameCardSm} * ${BOARD_SLOTS + 1} + ${vars.space[1]} * ${BOARD_SLOTS})`,
  gap: vars.space[1],
});

const potStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
  boxSizing: 'border-box',
  blockSize: vars.space[8],
  paddingInline: vars.space[3],
  borderRadius: vars.radius.full,
  border: `1px solid ${vars.color.borderSubtle}`,
  backgroundColor: vars.color.surfaceRaised,
  boxShadow: vars.shadow.raised,
  fontSize: vars.textSize.sm,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  [FORCED_COLORS]: { borderColor: 'CanvasText', backgroundColor: 'Canvas', boxShadow: 'none' },
});

const potLabelStyle = css({ color: vars.color.textMuted, [FORCED_COLORS]: { color: 'CanvasText' } });

const potValueStyle = css({
  fontWeight: vars.fontWeight.semibold,
  color: vars.color.text,
  [FORCED_COLORS]: { color: 'CanvasText' },
});

const boardRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[1],
});

const boardMatStyle = css({
  boxSizing: 'border-box',
  inlineSize: vars.size.gameCardSm,
  blockSize: `calc(${vars.size.gameCardSm} * ${CARD_FRAME.ratio})`,
  borderRadius: `calc(${vars.size.gameCardSm} / ${CARD_FRAME.cornerDivisor})`,
  border: `1px dashed ${vars.color.borderControl}`,
  backgroundColor: vars.color.surfaceInset,
  opacity: 0.6,
  [FORCED_COLORS]: { borderColor: 'CanvasText', opacity: 1 },
});

const seatCardsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[1],
});

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
  justifyContent: 'center',
  inlineSize: '100%',
});

function mergeIdentity(...values: (string | number | boolean | undefined)[]) {
  return [...new Set(values.flatMap((value) => typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : []))].join(' ');
}

interface SeatContentProps {
  seat: ComponentType<GameSeatProps>;
  seatProps: Partial<GameSeatProps> | undefined;
  labels: PokerTableLabels;
  locale: Intl.LocalesArgument | undefined;
  renderSeat: PokerTableProps['renderSeat'];
}

function PokerSeatContent({ seat: Seat, seatProps, labels, locale, renderSeat }: SeatContentProps) {
  const { player, index } = useGameTableSeat<PokerTablePlayer>();
  if (!player) return null;
  if (renderSeat) return <>{renderSeat(player, index)}</>;
  const formatter = new Intl.NumberFormat(locale);
  const name = player.name;
  const chips = formatter.format(player.chips);
  const hidden = Math.max(0, Math.floor(player.hiddenCards ?? 0));
  const cards = player.cards ?? [];
  const badges = [player.dealer ? labels.dealer : undefined, player.folded ? labels.folded : undefined, player.badges].filter(isRenderable);
  const seatSlotProps = {
    ...seatProps?.slotProps,
    points: { ...seatProps?.slotProps?.points, sx: [seatCoinStyle, seatProps?.slotProps?.points?.sx] },
  };
  return <Seat
    {...seatProps}
    slotProps={seatSlotProps}
    name={player.name}
    avatar={player.avatar ?? <PersonAvatar seed={name} size="full" />}
    points={<span>{chips}<span css={visuallyHiddenStyle}> {labels.chips}</span></span>}
    handCount={hidden}
    hand={cards.length > 0 ? <div css={seatCardsStyle}>{cards.map((card) => (
      <CardFlights.Target key={card.id} kind="hand" cardId={card.id}>
        <GameCard size="sm" value={card.value} label={card.label} />
      </CardFlights.Target>
    ))}</div> : undefined}
    badges={hidden > 0 ? <>{badges}<span css={visuallyHiddenStyle}>{labels.hiddenCards(name, formatter.format(hidden))}</span></> : badges.length > 0 ? badges : undefined}
    state={player.state}
    turn={player.turn}
    dimmed={player.folded || seatProps?.dimmed}
    data-poker-seat
  />;
}

function PokerTableContent({
  players,
  title,
  subtitle,
  board = [],
  pot,
  denominations = DEFAULT_DENOMINATIONS,
  announcement,
  actions,
  actionsLabel,
  labels: labelOverrides,
  forehand,
  locale,
  deck = 'french',
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
}: PokerTableProps) {
  const surface = useFlightSurface('chips');
  const flights = surface.events;
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const Root = slots?.root ?? component ?? 'div';
  const Seat = slots?.seat ?? GameSeat;
  const Actions = slots?.actions ?? GameActions;
  const rootSlot = withoutSx(slotProps?.root);
  const tableRef = useRef<HTMLDivElement>(null);
  const potRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergeRefs([ref, rootSlot?.ref, tableRef]);
  const [shownPot, setShownPot] = useState(pot);
  const previousPot = useRef(pot);
  const seenTransfers = useRef(new Set<string>());
  const lane = useRef<ChipLane>({ pending: [], active: null, generation: 0 });
  const activity = useRef<{ card: boolean; chip: boolean; last: boolean | undefined }>({ card: false, chip: false, last: undefined });
  const notify = useLatestCallback(onBusyChange);
  const report = useCallback((kind: 'card' | 'chip', value: boolean) => {
    activity.current[kind] = value;
    const busy = activity.current.card || activity.current.chip;
    if (busy !== activity.current.last) { activity.current.last = busy; notify(busy); }
  }, [notify]);
  const cardActivity = useCallback((busy: boolean) => report('card', busy), [report]);
  const { send, cancel } = useChipFlights();
  const settle = surface.settle;
  const clearLane = useCallback(() => {
    const state = lane.current;
    state.generation++;
    cancel();
    if (state.active) settle(state.active.id, { status: 'cancelled' });
    state.pending.forEach(event => settle(event.id, { status: 'cancelled' }));
    state.active = null;
    state.pending = [];
  }, [cancel, settle]);
  const drain = useLatestCallback(() => {
    const state = lane.current;
    if (state.active) return;
    const event = state.pending.shift();
    if (!event) { setShownPot(previousPot.current); report('chip', false); return; }
    state.active = event;
    const generation = state.generation;
    const seat = Array.from(tableRef.current?.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]') ?? [])
      .find(node => node.dataset.slotPlayer === event.from);
    const from = seat?.querySelector<HTMLElement>('[data-ui~="game-seat"]');
    const to = potRef.current?.querySelector<HTMLElement>('[data-ui="game-chip-stack"]') ?? potRef.current;
    if (!players.some(player => player.key === event.from) && process.env.NODE_ENV !== 'production') console.warn(`PokerTable: unknown player key "${event.from}".`);
    const supported = event.to === undefined || event.to === 'pot';
    const result = supported && from && to && Number.isFinite(event.amount) && event.amount > 0
      ? send({ from, to, chips: potChips(event.amount, denominations), size: 'sm', locale })
      : Promise.resolve<FlightOutcome>({ status: 'skipped', reason: 'missing-geometry' });
    if (supported && from?.isConnected && to?.isConnected && from.getBoundingClientRect().width > 0 && to.getBoundingClientRect().width > 0 &&
      Number.isFinite(event.amount) && event.amount > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) report('chip', true);
    void result.then(outcome => {
      if (state.generation !== generation || state.active !== event) return;
      state.active = null;
      settle(event.id, outcome);
      drain();
    });
  });
  useLayoutEffect(() => {
    const incoming = flights.filter(event => event.kind !== 'deal' && !seenTransfers.current.has(event.id));
    incoming.forEach(event => seenTransfers.current.add(event.id));
    const state = lane.current;
    const resynced = incoming.some(event => event.kind === 'resync');
    if (state.active && !flights.some(event => event.id === state.active?.id)) {
      state.generation++;
      cancel();
      state.active = null;
    }
    state.pending = state.pending.filter(event => flights.some(input => input.id === event.id));
    const wasBusy = Boolean(state.active || state.pending.length);
    for (const event of incoming) {
      if (event.kind === 'resync') { clearLane(); settle(event.id, { status: 'skipped', reason: 'resync' }); }
      else if (event.kind === 'transfer') state.pending.push(event);
    }
    if (resynced) setShownPot(pot);
    else if (!wasBusy && state.pending.length) setShownPot(previousPot.current);
    previousPot.current = pot;
    if (!state.active && !state.pending.length) setShownPot(pot);
    drain();
  });
  useEffect(() => () => { clearLane(); report('chip', false); }, [clearLane, report]);
  const rootClasses = [className, rootSlot?.className].filter(Boolean).join(' ') || undefined;
  const formatter = new Intl.NumberFormat(locale);
  const visiblePot = shownPot;
  const chips = potChips(visiblePot, denominations);
  const filled = board.slice(0, BOARD_SLOTS);
  const empty = Math.max(0, BOARD_SLOTS - filled.length);
  const hasDock = dock !== undefined && dock !== null && dock !== false && dock !== 0 && dock !== '';
  const showActions = !hasDock && actions !== undefined && actions.length > 0;
  return (
    <WithSx styles={[rootStyle, slotProps?.root?.sx]} sx={sx}>
      {(classes) => (
        <Root
          {...rootSlot}
          ref={mergedRef}
          role={rootSlot?.role ?? 'group'}
          aria-label={rootSlot?.['aria-label'] ?? labels.table}
          data-ui={mergeIdentity('poker-table', rootSlot?.['data-ui'])}
          className={[classes, rootClasses].filter(Boolean).join(' ') || undefined}
          style={{ ...style, ...rootSlot?.style }}
        >
          <DeckProvider default={deck}>
            <CardFlights forehand={forehand} onBusyChange={cardActivity}>
              <GameTable
                {...tableProps}
                places={Math.max(players.length, 2)}
                seats={players}
                seatPlacement={tableProps?.seatPlacement ?? 'auto'}
                teamCount={1}
              >
                <GameTable.Header>
                  <span css={headerTitleStyle}>{title}</span>
                  {isRenderable(subtitle) && <div css={headerMetaStyle}>{subtitle}</div>}
                </GameTable.Header>
                <GameTable.Seat>
                  <PokerSeatContent seat={Seat} seatProps={slotProps?.seat} labels={labels} locale={locale} renderSeat={renderSeat} />
                </GameTable.Seat>
                <GameTable.Center>
                  {center ?? (
                    <div css={centerStyle}>
                      {pot !== undefined && (
                        <div ref={potRef} css={centerStyle} data-poker-pot-group>
                          <GameChipStack chips={chips} size="sm" maxVisible={POT_MAX_VISIBLE} locale={locale} sx={potStackStyle} />
                          <span css={potStyle} data-poker-pot>
                            <span css={potLabelStyle}>{labels.pot}</span>
                            <span css={potValueStyle}>{formatter.format(visiblePot ?? 0)}</span>
                          </span>
                        </div>
                      )}
                      <div css={boardRowStyle} role="group" aria-label={labels.board}>
                        <CardFlights.Deck>
                          <GameCard size="sm" label={labels.deck} />
                        </CardFlights.Deck>
                        {filled.map((card) => (
                          <CardFlights.Target key={card.id} kind="board" cardId={card.id}>
                            <GameCard size="sm" value={card.value} label={card.label} />
                          </CardFlights.Target>
                        ))}
                        {Array.from({ length: empty }, (_, index) => (
                          <span key={`empty-${index}`} css={boardMatStyle} aria-hidden="true" data-board-placeholder />
                        ))}
                      </div>
                    </div>
                  )}
                </GameTable.Center>
                {isRenderable(announcement) && (
                  <GameTable.Footer>
                    <div role="status" css={announcementStyle}>{announcement}</div>
                  </GameTable.Footer>
                )}
                {(hasDock || showActions) && (
                  <GameTable.Dock>
                    {hasDock ? dock : (
                      <div css={dockStyle}>
                        <Actions
                          {...slotProps?.actions}
                          actions={actions ?? []}
                          label={actionsLabel ?? labels.actions}
                        />
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
export function PokerTable(props: PokerTableProps) {
  return <ChipFlights><PokerTableContent {...props} /></ChipFlights>;
}
PokerTable.displayName = 'PokerTable';
