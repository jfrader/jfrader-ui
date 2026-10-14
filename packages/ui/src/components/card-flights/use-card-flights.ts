'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { motionDurationMs } from '../../styling/motion-timings';
import { CARD_FRAME } from '../game-card/card-frame';
import type { GameCardProps } from '../game-card';
import type { PlayedCard } from '../game-card-stack';
import { useCardFlights, type CardFlightSpec } from './card-flights';
import { CARD_FLIGHT_ATTRIBUTES as attributes, FLIGHT_GEOMETRY, dealSequence, findMarker, flightTarget, measureCardBox, type CardBox } from './geometry';
import { useFlightRegistry, type FlightNode, type FlightRegistry, type FlightSeat } from './flight-registry';

export interface FlightCard extends Pick<PlayedCard, 'id' | 'label' | 'value'> {
  front?: ReactNode;
  back?: ReactNode;
  backPattern?: GameCardProps['backPattern'];
}
export interface DealFlightPlayer {
  key: string;
  idx: number;
  isOwn: boolean;
  cards: readonly FlightCard[];
}
export interface DealFlightsOptions {
  handIndex: string | number | null;
  /** True only once the new hand is ready and no card has been played. */
  dealt: boolean;
  forehandIdx: number;
  players: readonly DealFlightPlayer[];
  /** Change when applying a server resync; that snapshot becomes the baseline without flights. */
  resyncKey?: string | number;
}

function useMeasuredLaunch(resyncKey: string | number | undefined) {
  const { launch, resetEpoch } = useCardFlights();
  const generation = useRef(0);
  useLayoutEffect(() => {
    generation.current += 1;
    return () => { generation.current += 1; };
  }, [resetEpoch, resyncKey]);
  return (specs: readonly CardFlightSpec[]) => {
    if (!specs.length) return;
    const current = generation.current;
    // A measured host can commit a fitted scale from its layout effect. Finish that commit
    // before reading destinations; the microtask still hides them before the browser paints.
    queueMicrotask(() => {
      if (current !== generation.current) return;
      launch(specs.filter((spec) => spec.destination.isConnected)
        .map((spec) => ({ ...spec, to: measureCardBox(spec.destination) })));
    });
  };
}

/** Deal a changed hand in forehand order. Initial and resync snapshots appear in place. */
export function useDealFlights({ handIndex, dealt, forehandIdx, players, resyncKey }: DealFlightsOptions) {
  useDealFlightEngine({ handIndex, dealt, forehandIdx, resyncKey }, () => players);
}

function dealSurface(root: HTMLElement, registry?: FlightRegistry) {
  if (registry) return registry.tables.values().next().value?.node;
  return root.matches(`[${attributes.surface}="true"]`) ? root : root.querySelector(`[${attributes.surface}="true"]`);
}

function dealDestination(root: HTMLElement, player: DealFlightPlayer, card: FlightCard, index: number, registry?: FlightRegistry) {
  if (registry) return player.isOwn ? registry.hand.get(card.id)?.node : registry.hidden.get(player.key)?.get(index)?.node;
  if (player.isOwn) return findMarker(root, attributes.handCard, card.id);
  return [...root.querySelectorAll<HTMLElement>(`[${attributes.hiddenCard}]`)].find((node) =>
    node.getAttribute(attributes.hiddenCard) === player.key && node.getAttribute(attributes.hiddenCardIndex) === String(index));
}

function useDealFlightEngine({ handIndex, dealt, forehandIdx, resyncKey }: Omit<DealFlightsOptions, 'players'>,
  getPlayers: () => readonly DealFlightPlayer[], registry?: FlightRegistry) {
  const { scopeRef, reducedMotion, resetEpoch } = useCardFlights();
  const launch = useMeasuredLaunch(resyncKey);
  const previous = useRef<{ handIndex: typeof handIndex; resyncKey: typeof resyncKey; resetEpoch: number } | null>(null);
  useLayoutEffect(() => {
    const baseline = previous.current;
    if (!baseline || baseline.resyncKey !== resyncKey || baseline.resetEpoch !== resetEpoch) {
      previous.current = { handIndex, resyncKey, resetEpoch };
      return;
    }
    if (handIndex === null || handIndex === baseline.handIndex || !dealt) return;
    previous.current = { handIndex, resyncKey, resetEpoch };
    const root = scopeRef.current;
    if (reducedMotion || !root) return;
    const surface = dealSurface(root, registry);
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const width = rect.width * FLIGHT_GEOMETRY.deckWidthRatio;
    const from: CardBox = { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, width, height: width * CARD_FRAME.ratio, rotate: 0 };
    const players = getPlayers();
    const sequence = dealSequence(players.map((player) => ({ key: player.key, idx: player.idx, handSize: player.cards.length })), forehandIdx);
    launch(sequence.flatMap(({ playerKey, cardIdx }, order): CardFlightSpec[] => {
      const player = players.find((candidate) => candidate.key === playerKey)!;
      const card = player.cards[cardIdx];
      if (!card) return [];
      const destination = dealDestination(root, player, card, cardIdx, registry);
      return destination ? [{ card, target: player.isOwn ? flightTarget.hand(card.id) : flightTarget.seatCard(playerKey, cardIdx),
        destination, from, to: measureCardBox(destination), face: player.isOwn ? 'reveal' : 'down',
        durationMs: motionDurationMs.cardDeal, delayMs: order * motionDurationMs.cardDealStagger }] : [];
    }));
  });
}

export interface PlayedFlightCard extends FlightCard, PlayedCard {
  /** Source hand-card id when it differs from the play id. Defaults to `id`. */
  cardId?: string;
  playerKey: string;
  isOwn: boolean;
}
export interface PlayedCardFlightsOptions {
  plays: readonly PlayedFlightCard[];
  playerCount: number;
  resyncKey?: string | number;
}

/** Fly new plays from a captured click/drag origin or the preceding render's hand/seat box. */
export function usePlayedCardFlights({ plays, playerCount, resyncKey }: PlayedCardFlightsOptions) {
  usePlayedFlightEngine({ plays, resyncKey }, () => playerCount);
}

function usePlayedFlightEngine({ plays, resyncKey }: Omit<PlayedCardFlightsOptions, 'playerCount'>,
  getPlayerCount: () => number, registry?: FlightRegistry) {
  const { scopeRef, reducedMotion, resetEpoch, takePlayOrigin } = useCardFlights();
  const launch = useMeasuredLaunch(resyncKey);
  const previous = useRef<{ keys: Set<string>; resyncKey: typeof resyncKey; resetEpoch: number } | null>(null);
  const sources = useRef(new Map<string, CardBox>());
  const registeredSources = useRef(new Map<string, FlightNode>());
  // Capture hand/seat positions after every render for the next accepted play's origin.
  useLayoutEffect(() => {
    const root = scopeRef.current;
    const baseline = previous.current;
    const keys = new Set(plays.map((play) => play.id));
    const fresh = baseline && baseline.resyncKey === resyncKey && baseline.resetEpoch === resetEpoch
      ? plays.filter((play) => !baseline.keys.has(play.id)) : [];
    previous.current = { keys, resyncKey, resetEpoch };
    // A burst larger than one round is a resync, not a sequence of newly accepted plays.
    const newPlays = fresh.length <= getPlayerCount() ? fresh : [];
    const specs = newPlays.flatMap((play): CardFlightSpec[] => {
      const cardId = play.cardId ?? play.id;
      const captured = play.isOwn ? takePlayOrigin(cardId) : undefined;
      if (!root || reducedMotion) return [];
      const sourceKey = play.isOwn ? flightTarget.hand(cardId) : `seat:${play.playerKey}`;
      const registered = registeredSources.current.get(sourceKey);
      const from = captured ?? registered?.box ?? sources.current.get(sourceKey);
      const destination = registry ? registry.played.get(play.id)?.node : findMarker(root, attributes.playedCard, play.id);
      return from && destination ? [{ card: play, from, to: measureCardBox(destination), destination,
        target: flightTarget.played(play.id), face: play.isOwn ? 'up' : 'reveal',
        durationMs: play.isOwn ? motionDurationMs.cardPlayOwn : motionDurationMs.cardPlay }] : [];
    });
    launch(specs);
    const nextSources = new Map<string, CardBox>();
    if (registry) {
      const nextRegistered = new Map<string, FlightNode>();
      registry.hidden.forEach((nodes, key) => {
        const last = [...nodes.entries()].sort(([a], [b]) => a - b).at(-1)?.[1];
        if (last) nextRegistered.set(`seat:${key}`, last);
      });
      registry.hand.forEach((entry, key) => nextRegistered.set(flightTarget.hand(key), entry));
      nextRegistered.forEach((entry, key) => nextSources.set(key, measureCardBox(entry.node)));
      registeredSources.current = nextRegistered;
      sources.current = nextSources;
      return;
    }
    root?.querySelectorAll<HTMLElement>(`[${attributes.hiddenCard}]`).forEach((node) => {
      nextSources.set(`seat:${node.getAttribute(attributes.hiddenCard)}`, measureCardBox(node));
    });
    root?.querySelectorAll<HTMLElement>(`[${attributes.handCard}]`).forEach((node) => {
      nextSources.set(flightTarget.hand(node.getAttribute(attributes.handCard)!), measureCardBox(node));
    });
    sources.current = nextSources;
  });
}

export interface BoardFlightsOptions {
  hand: readonly FlightCard[];
  /** Change when a new hand is ready. Initial and resync snapshots appear in place. */
  handKey: string | number | null;
  plays: readonly PlayedFlightCard[];
  /** Index of the first seat to receive a card. Defaults to zero. */
  foregroundIdx?: number;
  resyncKey?: string | number;
  /** Override GameTable's registered seat order, for custom board compositions. */
  seats?: readonly FlightSeat[];
}

export interface BoardFlightsResult {
  landing: ReadonlySet<string>;
  reset: () => void;
}

/** Animate the same hand and play records rendered by GameHand and GameCardStack.Pile. */
export function useBoardFlights({ hand, handKey, plays, foregroundIdx = 0, resyncKey, seats }: BoardFlightsOptions): BoardFlightsResult {
  const { landingTargets, reset } = useCardFlights();
  const registry = useFlightRegistry()!;
  const getSeats = () => seats ?? registry.tables.values().next().value?.seats ?? [];
  const getPlayers = (): DealFlightPlayer[] => getSeats().map((seat, idx) => ({
    key: seat.key, idx, isOwn: !!seat.isMe,
    cards: seat.isMe ? hand : [...(registry.hidden.get(seat.key)?.keys() ?? [])].sort((a, b) => a - b)
      .map((index) => ({ id: flightTarget.seatCard(seat.key, index), label: '' })),
  }));
  useDealFlightEngine({ handIndex: handKey, dealt: plays.length === 0, forehandIdx: foregroundIdx, resyncKey }, getPlayers, registry);
  usePlayedFlightEngine({ plays, resyncKey }, () => getSeats().length, registry);
  return { landing: landingTargets, reset };
}
