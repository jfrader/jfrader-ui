'use client';

import { createContext, useContext, useMemo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { motionDurationMs } from '../../styling/motion-timings';
import { useReducedMotion } from '../../utils/use-reduced-motion';
import { useLatestCallback } from '../../utils/use-latest-callback';
import { useThemeScope } from '../../styling/theme-scope';
import { GameChip, GAME_CHIP_SIZES, type GameChipSize } from '../game-chip/game-chip';
import type { GameChipStackChip } from './game-chip-stack';
import type { FlightOutcome } from '../flights';

export interface ChipFlightOptions {
  /** Measures the departure element in viewport coordinates. */
  from: HTMLElement;
  /** Measures the landing element in the same document. */
  to: HTMLElement;
  /** Supplies denominations and counts. At most six decorative chips fly. */
  chips: readonly GameChipStackChip[];
  /** Sets the flying chip diameter. Defaults to md. */
  size?: GameChipSize;
  /** Formats the printed denomination. */
  locale?: Intl.LocalesArgument;
  /** Formats denominations as an ISO 4217 currency. */
  currency?: string;
}
export type ChipFlightResult = FlightOutcome;
export interface ChipFlightsProps {
  /** Contains the departure and landing elements and controls. */
  children: ReactNode;
  /** Reports activity edges, including cancellation and unmount. */
  onBusyChange?: (busy: boolean) => void;
}
export interface ChipFlightsController {
  /** Sends decorative chips, cancelling the previous flight. Always resolves on completion or cancellation. */
  send: (options: ChipFlightOptions) => Promise<ChipFlightResult>;
  /** Cancels the active flight. */
  cancel: () => void;
  /** Reports whether chips are in flight. */
  busy: boolean;
}
interface ChipFlightController {
  /** Starts a flight, cancelling its predecessor. Resolves after landing or cancellation. Missing geometry and reduced motion resolve immediately. */
  fly: (options: ChipFlightOptions) => Promise<ChipFlightResult>;
  /** Stops the current flight, removes its layer, and resolves its promise. */
  cancel: () => void;
  /** Reports whether a flight is active. */
  busy: boolean;
  /** Renders the decorative portal. Place it once in the calling component's JSX. */
  layer: ReactNode;
}
interface Flight extends ChipFlightOptions {
  id: number;
  items: GameChipStackChip[];
  fromX: number; fromY: number; toX: number; toY: number;
  done: boolean;
  rendered: boolean;
  landed: Set<number>;
  stops: Set<() => void>;
  resolve: (result: ChipFlightResult) => void;
}
const MAX_CHIPS = 6;
const MAX_ARC_LIFT = 160;
const STAGGER_MS = Math.min(60, Math.max(40, motionDurationMs.cardDealStagger));
const SPRING = { type: 'spring', stiffness: 100, damping: 17, mass: 1 } as const;
const layerStyle = css({ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: vars.zIndex.cardFlight });
const spriteStyle = css({ position: 'absolute', insetInlineStart: 0, insetBlockStart: 0, borderRadius: '50%',
  boxShadow: vars.shadow.cardFlight, pointerEvents: 'none', lineHeight: 0 });

function FlightSprite({ flight, chip, index, complete, origin }: {
  flight: Flight; chip: GameChipStackChip; index: number; complete: (flight: Flight, index: number) => void;
  origin: { x: number; y: number; scaleX: number; scaleY: number };
}) {
  const size = flight.size ?? 'md';
  const diameter = GAME_CHIP_SIZES[size];
  const progress = useMotionValue(0);
  const squash = useMotionValue(1);
  const scaleY = useTransform(squash, value => value / origin.scaleY);
  const lift = Math.max(diameter * 1.5, Math.min(MAX_ARC_LIFT, Math.hypot(flight.toX - flight.fromX, flight.toY - flight.fromY) * 0.4));
  const distance = Math.hypot(flight.toX - flight.fromX, flight.toY - flight.fromY);
  const bend = distance ? (flight.toY - flight.fromY) / distance * lift * 0.45 : 0;
  const x = useTransform(progress, t => (flight.fromX + (flight.toX - flight.fromX) * t + Math.sin(Math.PI * t) * bend - origin.x) / origin.scaleX - diameter / 2 + (index - (flight.items.length - 1) / 2) * diameter * 0.16 * t);
  const y = useTransform(progress, t => (flight.fromY + (flight.toY - flight.fromY) * t - Math.sin(Math.PI * t) * lift - origin.y) / origin.scaleY - diameter / 2);
  const rotate = useTransform(progress, t => (1 - t) * (index % 2 ? 16 : -16));
  useEffect(() => {
    let live = true;
    progress.set(0);
    squash.set(1);
    const travel = animate(progress, 1, { ...SPRING, delay: index * STAGGER_MS / 1000 });
    let settle: ReturnType<typeof animate> | undefined;
    const stop = () => { travel.stop(); settle?.stop(); };
    flight.stops.add(stop);
    const done = () => { if (live && !flight.done) complete(flight, index); };
    void Promise.resolve(travel).then(() => {
      if (!live || flight.done) return;
      settle = animate(squash, [1, 0.82, 1], { duration: motionDurationMs.base / 1000 });
      void Promise.resolve(settle).then(done, done);
    }, done);
    return () => { live = false; stop(); flight.stops.delete(stop); };
  }, [flight, index, complete, progress, squash]);
  return <motion.span css={spriteStyle} data-ui="chip-flight" style={{ x, y, rotate, scaleX: 1 / origin.scaleX, scaleY }}>
    <GameChip value={chip.value} tone={chip.tone} size={size} locale={flight.locale} currency={flight.currency} aria-hidden="true" />
  </motion.span>;
}

function FlightLayer({ flight, complete, finish }: { flight: Flight; complete: (flight: Flight, index: number) => void; finish: (flight: Flight, result: ChipFlightResult) => void }) {
  const [origin, setOrigin] = useState<{ x: number; y: number; scaleX: number; scaleY: number } | null>(null);
  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    flight.rendered = true;
    const box = node.getBoundingClientRect();
    if (!box.width || !box.height) { finish(flight, { status: 'skipped', reason: 'missing-geometry' }); return; }
    setOrigin({ x: box.x, y: box.y, scaleX: box.width / (node.clientWidth || box.width), scaleY: box.height / (node.clientHeight || box.height) });
  }, [flight, finish]);
  return <div ref={measure} css={layerStyle} data-ui="chip-flight-layer" aria-hidden="true" dir="ltr">
    {origin && flight.items.map((chip, index) => <FlightSprite key={index} flight={flight} chip={chip} index={index}
      origin={origin} complete={complete} />)}
  </div>;
}

function useChipFlight({ onBusyChange }: Pick<ChipFlightsProps, 'onBusyChange'> = {}): ChipFlightController {
  const reduced = useReducedMotion();
  const scope = useThemeScope();
  const portalReady = useRef(scope?.portalContainer !== null);
  const notify = useLatestCallback(onBusyChange);
  const mounted = useRef(false);
  const active = useRef<Flight | null>(null);
  const sequence = useRef(0);
  const [flight, setFlight] = useState<Flight | null>(null);
  const finish = useCallback((job: Flight, result: ChipFlightResult) => {
    if (active.current !== job || job.done) return;
    job.done = true;
    for (const stop of job.stops) stop();
    job.stops.clear();
    active.current = null;
    if (mounted.current) setFlight(null);
    notify(false);
    job.resolve(result);
  }, [notify]);
  const cancel = useCallback(() => { if (active.current) finish(active.current, { status: 'cancelled' }); }, [finish]);
  const complete = useCallback((job: Flight, index: number) => {
    job.landed.add(index);
    if (job.landed.size === job.items.length) finish(job, { status: 'landed' });
  }, [finish]);
  useEffect(() => { portalReady.current = scope?.portalContainer !== null; cancel(); }, [scope?.portalContainer, cancel]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancel(); };
  }, [cancel]);
  useEffect(() => {
    if (!flight) return;
    const frame = requestAnimationFrame(() => {
      if (!flight.rendered) finish(flight, { status: 'skipped', reason: 'missing-geometry' });
    });
    return () => cancelAnimationFrame(frame);
  }, [flight, finish]);
  useEffect(() => { if (reduced && active.current) finish(active.current, { status: 'skipped', reason: 'reduced-motion' }); }, [reduced, finish]);
  const fly = useCallback((options: ChipFlightOptions): Promise<ChipFlightResult> => {
    cancel();
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve({ status: 'skipped', reason: 'reduced-motion' });
    if (!mounted.current || !portalReady.current || !options.from.isConnected || !options.to.isConnected || options.from.ownerDocument !== options.to.ownerDocument) return Promise.resolve({ status: 'skipped', reason: 'missing-geometry' });
    const from = options.from.getBoundingClientRect(), to = options.to.getBoundingClientRect();
    if (!from.width || !from.height || !to.width || !to.height) return Promise.resolve({ status: 'skipped', reason: 'missing-geometry' });
    const items: GameChipStackChip[] = [];
    for (const chip of options.chips) {
      if (!Number.isSafeInteger(chip.count) || chip.count < 0 || !Number.isFinite(chip.value) || chip.value < 0) throw new RangeError('Chip flight values and counts must be valid chip entries.');
      for (let count = 0; count < chip.count && items.length < MAX_CHIPS; count++) items.push({ ...chip, count: 1 });
    }
    if (!items.length) return Promise.resolve({ status: 'skipped', reason: 'missing-geometry' });
    return new Promise(resolve => {
      const job: Flight = { ...options, id: ++sequence.current, items, fromX: from.x + from.width / 2, fromY: from.y + from.height / 2,
        toX: to.x + to.width / 2, toY: to.y + to.height / 2, done: false, rendered: false, landed: new Set(), stops: new Set(), resolve };
      active.current = job;
      setFlight(job);
      notify(true);
    });
  }, [cancel, notify]);
  return { fly, cancel, busy: flight !== null && !flight.done,
    layer: flight && !flight.done ? <OverlayPortal><FlightLayer key={flight.id} flight={flight} complete={complete} finish={finish} /></OverlayPortal> : null };
}

const ChipFlightsContext = createContext<ChipFlightsController | null>(null);

/** Owns chip motion and its decorative portal layer. */
export function ChipFlights({ children, onBusyChange }: ChipFlightsProps) {
  const { fly: send, cancel, busy, layer } = useChipFlight({ onBusyChange });
  const value = useMemo(() => ({ send, cancel, busy }), [send, cancel, busy]);
  return <ChipFlightsContext value={value}>{children}{layer}</ChipFlightsContext>;
}
ChipFlights.displayName = 'ChipFlights';

/** Sends chips from inside a `ChipFlights` provider. */
export function useChipFlights(): ChipFlightsController {
  const context = useContext(ChipFlightsContext);
  if (!context) throw new Error('useChipFlights must be used inside ChipFlights.');
  return context;
}
