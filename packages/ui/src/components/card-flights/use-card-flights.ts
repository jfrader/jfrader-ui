'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { motionDurationMs } from '../../styling/motion-timings';
import { CARD_FRAME } from '../game-card/card-frame';
import { useCardFlights, type CardFlightSpec } from './card-flights';
import { CARD_FLIGHT_ATTRIBUTES as attributes, FLIGHT_GEOMETRY, dealSequence, findMarker, flightTarget, measureCardBox, type CardBox } from './geometry';

export interface FlightCard {
  key: string;
  front?: ReactNode;
  back: ReactNode;
}
export interface DealFlightPlayer {
  key: string;
  idx: number;
  isOwn: boolean;
  cards: readonly FlightCard[];
}
export interface DealFlightsOptions {
  handIndex: number | null;
  /** True only once the new hand is ready and no card has been played. */
  dealt: boolean;
  forehandIdx: number;
  players: readonly DealFlightPlayer[];
  /** Change when applying a server resync; that snapshot becomes the baseline without flights. */
  resyncKey?: string | number;
}

/** Deal a changed hand in forehand order. Initial and resync snapshots appear in place. */
export function useDealFlights({ handIndex, dealt, forehandIdx, players, resyncKey }: DealFlightsOptions) {
  const { scopeRef, reducedMotion, resetEpoch, launch } = useCardFlights();
  const previous = useRef<{ handIndex: number | null; resyncKey: typeof resyncKey; resetEpoch: number } | null>(null);
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
    const surface = root.matches(`[${attributes.surface}="true"]`) ? root : root.querySelector(`[${attributes.surface}="true"]`);
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const width = rect.width * FLIGHT_GEOMETRY.deckWidthRatio;
    const from: CardBox = { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, width, height: width * CARD_FRAME.ratio, rotate: 0 };
    const sequence = dealSequence(players.map((player) => ({ key: player.key, idx: player.idx, handSize: player.cards.length })), forehandIdx);
    launch(sequence.flatMap(({ playerKey, cardIdx }, order): CardFlightSpec[] => {
      const player = players.find((candidate) => candidate.key === playerKey)!;
      const card = player.cards[cardIdx];
      if (!card) return [];
      const destination = player.isOwn ? findMarker(root, attributes.handCard, card.key)
        : [...root.querySelectorAll<HTMLElement>(`[${attributes.hiddenCard}]`)].find((node) =>
          node.getAttribute(attributes.hiddenCard) === playerKey && node.getAttribute(attributes.hiddenCardIndex) === String(cardIdx));
      return destination ? [{ ...card, target: player.isOwn ? flightTarget.hand(card.key) : flightTarget.seatCard(playerKey, cardIdx),
        destination, from, to: measureCardBox(destination), face: player.isOwn ? 'reveal' : 'down',
        durationMs: motionDurationMs.cardDeal, delayMs: order * motionDurationMs.cardDealStagger }] : [];
    }));
  }, [handIndex, dealt, forehandIdx, players, resyncKey, reducedMotion, resetEpoch, launch, scopeRef]);
}

export interface PlayedFlightCard extends FlightCard {
  /** Exact data-trick-key value from TrickStacks. */
  playedKey: string;
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
  const { scopeRef, reducedMotion, resetEpoch, launch, takePlayOrigin } = useCardFlights();
  const previous = useRef<{ keys: Set<string>; resyncKey: typeof resyncKey; resetEpoch: number } | null>(null);
  const sources = useRef(new Map<string, CardBox>());
  useLayoutEffect(() => {
    const root = scopeRef.current;
    const baseline = previous.current;
    const keys = new Set(plays.map((play) => play.playedKey));
    const fresh = baseline && baseline.resyncKey === resyncKey && baseline.resetEpoch === resetEpoch
      ? plays.filter((play) => !baseline.keys.has(play.playedKey)) : [];
    previous.current = { keys, resyncKey, resetEpoch };
    // A burst larger than one round is a resync, not a sequence of newly accepted plays.
    const newPlays = fresh.length <= playerCount ? fresh : [];
    const specs = newPlays.flatMap((play): CardFlightSpec[] => {
      const captured = play.isOwn ? takePlayOrigin(play.key) : undefined;
      if (!root || reducedMotion) return [];
      const from = captured ?? sources.current.get(play.isOwn ? flightTarget.hand(play.key) : `seat:${play.playerKey}`);
      const destination = findMarker(root, attributes.trickCard, play.playedKey);
      return from && destination ? [{ ...play, from, to: measureCardBox(destination), destination,
        target: flightTarget.trick(play.playedKey), face: play.isOwn ? 'up' : 'reveal',
        durationMs: play.isOwn ? motionDurationMs.cardPlayOwn : motionDurationMs.cardPlay }] : [];
    });
    launch(specs);
    const nextSources = new Map<string, CardBox>();
    root?.querySelectorAll<HTMLElement>(`[${attributes.hiddenCard}]`).forEach((node) => {
      nextSources.set(`seat:${node.getAttribute(attributes.hiddenCard)}`, measureCardBox(node));
    });
    root?.querySelectorAll<HTMLElement>(`[${attributes.handCard}]`).forEach((node) => {
      nextSources.set(flightTarget.hand(node.getAttribute(attributes.handCard)!), measureCardBox(node));
    });
    sources.current = nextSources;
  });
}
