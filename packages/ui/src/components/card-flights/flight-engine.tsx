'use client';

import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { MotionConfig, useReducedMotion } from 'motion/react';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { CardFlight } from './card-flight';
import { FLIGHT_GEOMETRY, measureFlightBox, type CardBox } from './geometry';
import { createFlightRegistry, FlightRegistryContext, type PlayingCard } from './flight-registry';
import { BusyContext, FlightContext as Context, OriginContext } from './flight-context';
import type { FlightId, FlightOutcome } from '../flights/types';

export type FlightSpec = {
  target: string;
  /** Mounted destination. Its visibility is restored on landing, reset or replacement. */
  destination: HTMLElement;
  from: CardBox;
  to: CardBox;
  face: 'up' | 'down' | 'reveal';
  /** Duration in milliseconds. */
  durationMs: number;
  delayMs?: number;
  card: PlayingCard;
  front?: ReactNode;
  back?: ReactNode;
};

interface FlightRecord {
  id: number;
  spec: FlightSpec;
  visibility: string;
  priority: string;
  timer: ReturnType<typeof setTimeout> | null;
  cancel?: () => void;
  start: (cancel: () => void) => void;
  finish: (outcome?: FlightOutcome) => void;
  complete?: (outcome: FlightOutcome) => void;
}

function useFlightReducedMotion() {
  const preference = useReducedMotion();
  const store = useMemo(() => {
    const media = typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)');
    return {
      subscribe: (notify: () => void) => {
        media?.addEventListener('change', notify);
        return () => media?.removeEventListener('change', notify);
      },
      snapshot: () => media?.matches ?? !!preference,
    };
  }, [preference]);
  // Motion 14's hook snapshots only at mount; subscribe for preference changes during a flight.
  return useSyncExternalStore(store.subscribe, store.snapshot, () => false);
}

export function FlightEngine({ children }: { children: ReactNode }) {
  const reducedMotion = useFlightReducedMotion();
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const records = useRef(new Map<string, FlightRecord>());
  const origins = useRef(new Map<string, { box: CardBox; at: number }>());
  const nextId = useRef(0);
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [registry] = useState(createFlightRegistry);

  const actions = useMemo(() => {
    const restore = (record: FlightRecord) => {
      if (record.timer !== null) clearTimeout(record.timer);
      record.cancel?.();
      record.spec.destination.style.setProperty('visibility', record.visibility, record.priority);
    };
    const clear = () => {
      records.current.forEach(record => { restore(record); record.complete?.({ status: 'cancelled' }); });
      records.current.clear();
      origins.current.clear();
    };
    return {
      clear,
      prune: () => {
        let changed = false;
        records.current.forEach((record, key) => { if (!record.spec.destination.isConnected) { restore(record); records.current.delete(key); record.complete?.({ status: 'cancelled' }); changed = true; } });
        if (changed) setFlights([...records.current.values()]);
      },
      reset: () => { clear(); setFlights([]); },
      launch: (specs: readonly FlightSpec[], group?: { id: FlightId; settle: (id: FlightId, outcome: FlightOutcome) => void }) => {
        const reduced = reducedRef.current || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        let remaining = specs.length;
        let outcome: FlightOutcome = { status: 'landed' };
        const complete = group ? (result: FlightOutcome) => {
          if (result.status === 'cancelled' || outcome.status === 'landed') outcome = result;
          if (--remaining === 0) group.settle(group.id, outcome);
        } : undefined;
        if (!specs.length) { group?.settle(group.id, { status: 'skipped', reason: 'missing-geometry' }); return; }
        for (const spec of specs) {
          const previous = records.current.get(spec.target);
          if (previous) { restore(previous); records.current.delete(spec.target); previous.complete?.({ status: 'cancelled' }); }
          if (reduced || spec.durationMs <= 0 || spec.from.width <= 0 || spec.from.height <= 0 || spec.to.width <= 0 || spec.to.height <= 0) {
            complete?.({ status: 'skipped', reason: reduced ? 'reduced-motion' : 'missing-geometry' });
            continue;
          }
          const record: FlightRecord = {
            id: ++nextId.current, spec,
            visibility: spec.destination.style.getPropertyValue('visibility'),
            priority: spec.destination.style.getPropertyPriority('visibility'),
            timer: null,
            complete,
            start: (cancel) => {
              if (record.timer !== null) clearTimeout(record.timer);
              record.timer = null;
              record.cancel = cancel;
            },
            finish: (outcome) => {
              if (records.current.get(spec.target) !== record) return;
              restore(record);
              records.current.delete(spec.target);
              complete?.(outcome ?? (reducedRef.current ? { status: 'skipped', reason: 'reduced-motion' } : { status: 'landed' }));
              setFlights([...records.current.values()]);
            },
          };
          spec.destination.style.setProperty('visibility', 'hidden');
          records.current.set(spec.target, record);
          // Only an unmounted portal has a deadline; mounted flights own their actual landing.
          record.timer = setTimeout(() => record.finish({ status: 'skipped', reason: 'missing-geometry' }), spec.durationMs + (spec.delayMs ?? 0));
        }
        setFlights([...records.current.values()]);
      },
      rememberPlayOrigin: (key: string, elementOrBox: HTMLElement | CardBox) => {
        const now = Date.now();
        origins.current.forEach((origin, cardKey) => {
          if (now - origin.at > FLIGHT_GEOMETRY.originTtlMs) origins.current.delete(cardKey);
        });
        origins.current.set(key, { box: 'cx' in elementOrBox ? elementOrBox : measureFlightBox(elementOrBox), at: now });
      },
      takePlayOrigin: (key: string) => {
        const origin = origins.current.get(key);
        origins.current.delete(key);
        return origin && Date.now() - origin.at <= FLIGHT_GEOMETRY.originTtlMs ? origin.box : undefined;
      },
    };
  }, []);

  useLayoutEffect(() => () => actions.clear(), [actions]);
  useLayoutEffect(() => {
    if (reducedMotion) {
      records.current.forEach((record) => record.finish());
      origins.current.clear();
    }
  }, [reducedMotion]);
  const value = useMemo(() => ({ reducedMotion, ...actions }), [reducedMotion, actions]);
  return <MotionConfig reducedMotion="user"><Context.Provider value={value}><OriginContext value={actions}><BusyContext value={!reducedMotion && flights.length > 0}><FlightRegistryContext value={registry}>
    {children}
    {flights.length > 0 && <OverlayPortal>{flights.map((flight) =>
      <CardFlight key={flight.id} flightId={flight.id} spec={flight.spec} onStart={flight.start} onFinish={flight.finish} />)}</OverlayPortal>}
  </FlightRegistryContext></BusyContext></OriginContext></Context.Provider></MotionConfig>;
}
FlightEngine.displayName = 'FlightEngine';
