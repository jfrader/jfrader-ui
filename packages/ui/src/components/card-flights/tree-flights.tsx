'use client';

import { useLayoutEffect, useRef, type ComponentPropsWithRef, type ReactNode } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import type { SxProps } from '../../styling/sx';
import { CardRoot, type GameCardRootCustomization, type GameCardRootSlotProps } from '../game-card/game-card-root';
import { motionDurationMs } from '../../styling/motion-timings';
import { CARD_FRAME } from '../game-card/card-frame';
import { useOptionalGameTableSeat } from '../game-table/game-table';
import { CardFlightsProvider, type CardFlightSpec } from './card-flights';
import { TreeOwnedContext, useFlightActions, useCardFlightStatus } from './flight-context';
import { useFlightRegistry, warnFlight, type TreeFlightNode } from './flight-registry';
import { dealSequence, FLIGHT_GEOMETRY, measureCardBox, type CardBox } from './geometry';
import type { CardFlightEvent, FlightId, FlightOutcome } from '../flights/types';
import { useFlightSurface } from '../flights/flight-provider';

export interface CardFlightsProps {
  /** Change when a new deal is rendered. The initial tree appears in place.
   * @deprecated Call useFlights().deal() inside FlightProvider instead. Retained for one minor release. */
  deal?: string | number;
  /** Change to replace the board snapshot without animation and cancel active flights.
   * @deprecated Call useFlights().resync() inside FlightProvider instead. Retained for one minor release. */
  revision?: string | number;
  /** Seat key receiving the first card; defaults to the first registered table seat. */
  forehand?: string;
  /** Render the card tree whose committed changes drive flights. */
  children: ReactNode;
  /** Reports activity to state owners above this component, including cancellation on unmount. */
  onBusyChange?: (busy: boolean) => void;
}

type SnapshotNode = TreeFlightNode & { box: CardBox };

function deckOrigin(nodes: readonly SnapshotNode[], table?: { node: HTMLElement }) {
  const deck = nodes.find((entry) => entry.role === 'deck');
  if (deck) return deck.box;
  if (!table) return undefined;
  const box = measureCardBox(table.node);
  const width = box.width * FLIGHT_GEOMETRY.deckWidthRatio;
  return { ...box, width, height: width * CARD_FRAME.ratio, rotate: 0 };
}

function TreeEngine({ deal, revision, forehand }: Omit<CardFlightsProps, 'children'>) {
  const surface = useFlightSurface('cards');
  const flights = surface.events.filter((event): event is CardFlightEvent => event.kind !== 'transfer');
  const onFlightSettled = surface.settle;
  const registry = useFlightRegistry()!;
  const actions = useFlightActions();
  const latest = useRef({ deal, revision, forehand, actions, flights, onFlightSettled });
  latest.current = { deal, revision, forehand, actions, flights, onFlightSettled };
  const seen = useRef(new Set<FlightId>());
  const active = useRef<FlightId | null>(null);
  const warned = useRef(new Set<string>());
  const legacySequence = useRef(0);
  const present = useRef(new Set<FlightId>());
  const settle = (id: FlightId, outcome: FlightOutcome) => {
    if (active.current === id) active.current = null;
    latest.current.onFlightSettled?.(id, outcome);
  };
  const previous = useRef<{ deal: typeof deal; revision: typeof revision; nodes: SnapshotNode[] } | null>(null);
  const measuredNodes = useRef<readonly HTMLElement[]>([]);
  const identities = useRef(new Map<HTMLElement, string>());
  const pending = useRef(false);
  const mounted = useRef(false);
  const reconcile = () => {
    if (pending.current) return;
    pending.current = true;
    queueMicrotask(() => {
      pending.current = false;
      if (!mounted.current) return;
      const { deal, revision, forehand, actions, flights } = latest.current;
      for (const [name, value] of [['deal', deal], ['revision', revision]] as const) {
        if (value !== undefined && !warned.current.has(name)) { warned.current.add(name); warnFlight(`CardFlights: ${name} is deprecated. Use useFlights() inside FlightProvider instead.`); }
      }
      if (active.current && !flights.some(event => event.id === active.current)) actions.reset();
      flights.forEach(event => {
        if (seen.current.has(event.id) && !present.current.has(event.id)) warnFlight(`CardFlights: stale flight id "${event.id}". Trigger a new request with useFlights() instead.`);
      });
      present.current = new Set(flights.map(event => event.id));
      const unseen: CardFlightEvent[] = flights.filter(event => !seen.current.has(event.id));
      unseen.forEach(event => seen.current.add(event.id));
      if (previous.current) {
        if (previous.current.revision !== revision) unseen.push({ id: `legacy-resync-${++legacySequence.current}`, kind: 'resync' });
        else if (previous.current.deal !== deal) unseen.push({ id: `legacy-deal-${++legacySequence.current}`, kind: 'deal' });
      }
      let requestedDeal: CardFlightEvent | undefined;
      let resync = false;
      for (const event of unseen) {
        if (event.kind === 'resync') {
          actions.reset();
          if (requestedDeal) settle(requestedDeal.id, { status: 'cancelled' });
          requestedDeal = undefined;
          resync = true;
          settle(event.id, { status: 'skipped', reason: 'resync' });
        } else {
          if (requestedDeal) settle(requestedDeal.id, { status: 'cancelled' });
          requestedDeal = event;
        }
      }
      actions.prune();
      const live = [...registry.tree.values()].filter(({ node }) => node.isConnected);
      const previousNodes = measuredNodes.current;
      const identityOf = (entry: TreeFlightNode) => `${entry.role}|${entry.cardId}|${entry.seatKey ?? ''}|${entry.card.id}`;
      const identityChanged = live.some((entry) => identities.current.get(entry.node) !== identityOf(entry));
      identities.current = new Map(live.map((entry) => [entry.node, identityOf(entry)]));
      const nodeSetChanged = identityChanged || live.length !== previousNodes.length ||
        live.some((entry, index) => entry.node !== previousNodes[index]);
      const triggerChanged = !previous.current || previous.current.deal !== deal || previous.current.revision !== revision;
      if (previous.current && !nodeSetChanged && !triggerChanged && !unseen.length) return;
      measuredNodes.current = live.map((entry) => entry.node);
      const nodes = live.map((entry) => ({ ...entry, box: measureCardBox(entry.node) }));
      const baseline = previous.current;
      previous.current = { deal, revision, nodes };
      if ((!baseline || resync) && !requestedDeal) return;
      if (actions.reducedMotion) {
        if (requestedDeal) settle(requestedDeal.id, { status: 'skipped', reason: 'reduced-motion' });
        return;
      }
      const table = registry.tables.values().next().value;
      const ownSeat = table?.seats.find((seat) => seat.isMe)?.key;
      const seatKey = (entry: TreeFlightNode) => entry.seatKey ?? ownSeat ?? '';
      const specs: CardFlightSpec[] = [];
      if (requestedDeal) {
        actions.reset();
        const from = deckOrigin(nodes, table);
        if (from) {
          const destinations = nodes.filter((entry) => entry.role === 'hand' || entry.role === 'seat');
          const keys = [...new Set([...(table?.seats.map((seat) => seat.key) ?? []), ...destinations.map(seatKey)])];
          if (forehand && !keys.includes(forehand)) warnFlight(`CardFlights forehand "${forehand}" is not a registered seat.`);
          const groups = new Map(keys.map((key) => [key, destinations.filter((entry) => seatKey(entry) === key)]));
          const sequence = dealSequence(keys.map((key, idx) => ({ key, idx, handSize: groups.get(key)!.length })), Math.max(0, keys.indexOf(forehand ?? keys[0] ?? '')));
          sequence.forEach(({ playerKey, cardIdx }, order) => {
            const entry = groups.get(playerKey)![cardIdx]!;
            specs.push({ card: entry.card, front: entry.front, back: entry.back, destination: entry.node, target: targetKey(entry), from: from!, to: entry.box,
              face: entry.faceOverride ?? (entry.role === 'hand' ? 'reveal' : entry.face), durationMs: motionDurationMs.cardDeal,
              delayMs: order * motionDurationMs.cardDealStagger });
          });
        } else warnFlight('CardFlights deal needs a Deck or GameTable surface.');
      } else if (baseline) {
        const played = new Set(baseline.nodes.filter((entry) => entry.role === 'play').map((entry) => entry.card.id));
        nodes.filter((entry) => entry.role === 'play' && !played.has(entry.card.id)).forEach((entry) => {
          const hand = baseline.nodes.find((source) => source.role === 'hand' && source.cardId === entry.cardId);
          const seat = baseline.nodes.filter((source) => source.role === 'seat' && source.seatKey === entry.seatKey).at(-1);
          const captured = actions.takePlayOrigin(entry.cardId);
          const from = captured ?? hand?.box ?? seat?.box;
          if (!from) warnFlight(`CardFlights has no previous origin for ${entry.cardId}; showing it in place.`);
          if (from) specs.push({ card: entry.card.label ? entry.card : hand?.card ?? entry.card, front: entry.front, back: entry.back, destination: entry.node, target: targetKey(entry), from, to: entry.box,
            face: entry.faceOverride ?? (entry.face === 'down' ? 'down' : hand || captured ? entry.face : 'reveal'),
            durationMs: hand || captured ? motionDurationMs.cardPlayOwn : motionDurationMs.cardPlay });
        });
      }
      const boarded = new Set(baseline?.nodes.filter((entry) => entry.role === 'board').map((entry) => entry.card.id) ?? []);
      const board = nodes.filter((entry) => entry.role === 'board' && !boarded.has(entry.card.id));
      if (board.length) {
        const from = deckOrigin(nodes, table);
        if (!from) warnFlight('CardFlights board cards need a Deck or GameTable surface.');
        else board.forEach((entry, index) => specs.push({ card: entry.card, front: entry.front, back: entry.back, destination: entry.node,
          target: targetKey(entry), from, to: entry.box, face: entry.faceOverride ?? entry.face, durationMs: motionDurationMs.cardDeal,
          delayMs: index * motionDurationMs.cardDealStagger }));
      }
      if (requestedDeal && flights.includes(requestedDeal)) active.current = requestedDeal.id;
      actions.launch(specs, requestedDeal ? { id: requestedDeal.id, settle } : undefined);
    });
  };
  useLayoutEffect(() => {
    mounted.current = true;
    const unsubscribe = registry.subscribe(reconcile);
    reconcile();
    return () => { mounted.current = false; unsubscribe(); };
  }, [registry]);
  useLayoutEffect(reconcile);
  return null;
}

function targetKey(entry: TreeFlightNode) {
  if (entry.role === 'play') return `played:${entry.card.id}`;
  if (entry.role === 'board') return `board:${entry.card.id}`;
  return entry.role === 'hand' ? `hand:${entry.cardId}` : `seat:${entry.seatKey}:${entry.cardId}`;
}

type TargetIdentity = {
  /** Match this card's hand, board and played destinations by stable identity. */
  cardId: string;
  /** Register a hand, board or played-card destination. */
  kind: 'hand' | 'play' | 'board';
  /** Associate the card with a seat. Defaults to the surrounding GameTable seat when present. */
  seatKey?: string;
} | {
  /** Register a hidden-card destination for a seat. */
  kind: 'seat';
  /** Identify the seat receiving this hidden card. */
  seatKey: string;
  /** Identify the hidden-card position within this seat. */
  index: number;
  cardId?: never;
};
interface FlightNodeCustomization extends GameCardRootCustomization {
  /** Pass props and `sx` to the target or deck wrapper. */
  slotProps?: { root?: GameCardRootSlotProps };
}
export type CardFlightsTargetProps = Omit<ComponentPropsWithRef<'div'>, 'role'> & SxProps & FlightNodeCustomization & TargetIdentity & {
  /** Override automatic flight faces: `up` shows the front, `down` the back, `reveal` flips back to front. */
  face?: 'up' | 'down' | 'reveal';
  /** Supply the face-up flight artwork. Defaults to the target's children. */
  front?: ReactNode;
  /** Supply the face-down flight artwork. */
  back?: ReactNode;
};

function FlightNode({ cardId, role, nativeRole, seatKey, face: requestedFace, front, back, ref, className, sx, component, slots, slotProps, ...rest }:
  Omit<ComponentPropsWithRef<'div'>, 'role'> & SxProps & FlightNodeCustomization & { cardId: string; role: TreeFlightNode['role']; nativeRole?: ComponentPropsWithRef<'div'>['role']; seatKey?: string; face?: TreeFlightNode['face']; front?: ReactNode; back?: ReactNode }) {
  const registry = useFlightRegistry();
  const face = requestedFace ?? (role === 'seat' ? 'down' : role === 'board' ? 'reveal' : 'up');
  const seat = useOptionalGameTableSeat();
  const nodeRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergeRefs([nodeRef, ref, slotProps?.root?.ref]);
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!registry || !node) return;
    registry.tree.set(node, { node, role, cardId, card: { id: cardId, label: '' }, front: front ?? rest.children, back,
      seatKey: seatKey ?? seat?.player?.key, face, faceOverride: requestedFace });
    registry.notify();
    return () => { registry.tree.delete(node); registry.notify(); };
  });
  return <CardRoot {...rest} component={component} slots={slots} rootSlot={slotProps?.root} attributes={{ ref: mergedRef, ...(nativeRole && { role: nativeRole }),
    'data-hand-card': role === 'hand' ? cardId : undefined, 'data-played-key': role === 'play' ? cardId : undefined,
    'data-board-card': role === 'board' ? cardId : undefined,
    'data-seat-hidden-card': role === 'seat' ? seatKey : undefined, 'data-seat-hidden-card-index': role === 'seat' ? cardId : undefined,
  }} className={className} sx={sx} structure={[]} marker={role === 'deck' ? 'card-flights-deck' : 'card-flights-target'} />;
}

/** Register a custom hand, seat, board or play destination. The wrapper supplies its flight artwork. */
function CardFlightsTarget(props: CardFlightsTargetProps) {
  if (props.kind === 'seat') {
    const { kind: _kind, index, ...rest } = props;
    return <FlightNode {...rest} role="seat" cardId={String(index)} />;
  }
  const { kind, ...rest } = props;
  return <FlightNode {...rest} role={kind} />;
}
CardFlightsTarget.displayName = 'CardFlights.Target';

/** Use this rendered node as the deal origin instead of the GameTable surface centre. */
function CardFlightsDeck({ role, ...props }: ComponentPropsWithRef<'div'> & SxProps & FlightNodeCustomization) {
  return <FlightNode {...props} nativeRole={role} cardId="deck" role="deck" face="down" />;
}
CardFlightsDeck.displayName = 'CardFlights.Deck';

function BusyReporter({ onBusyChange }: Pick<CardFlightsProps, 'onBusyChange'>) {
  const { busy } = useCardFlightStatus();
  const callback = useRef(onBusyChange);
  callback.current = onBusyChange;
  useLayoutEffect(() => { callback.current?.(busy); }, [busy]);
  useLayoutEffect(() => () => { callback.current?.(false); }, []);
  return null;
}

/** Animate the committed card tree. First render and resync snapshots appear in place. */
export function CardFlights({ children, deal, revision, forehand, onBusyChange }: CardFlightsProps) {
  return <TreeOwnedContext value><CardFlightsProvider headless>{children}
    <TreeEngine deal={deal} revision={revision} forehand={forehand} /><BusyReporter onBusyChange={onBusyChange} />
  </CardFlightsProvider></TreeOwnedContext>;
}
CardFlights.displayName = 'CardFlights';
CardFlights.Deck = CardFlightsDeck;
CardFlights.Target = CardFlightsTarget;
