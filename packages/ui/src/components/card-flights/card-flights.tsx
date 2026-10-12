'use client';

import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { MotionConfig, useReducedMotion } from 'motion/react';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { CardFlight } from './card-flight';
import { FLIGHT_GEOMETRY, measureCardBox, type CardBox } from './geometry';

export interface CardFlightSpec {
  target: string;
  /** Mounted destination. Its visibility is restored on landing, reset or replacement. */
  destination: HTMLElement;
  from: CardBox;
  to: CardBox;
  face: 'up' | 'down' | 'reveal';
  front?: ReactNode;
  back: ReactNode;
  /** Duration in milliseconds. Prefer the deal/play hooks' token timings. */
  durationMs: number;
  delayMs?: number;
}

interface FlightRecord {
  id: number;
  spec: CardFlightSpec;
  visibility: string;
  priority: string;
  timer: ReturnType<typeof setTimeout> | null;
  finish: () => void;
}

interface CardFlightsContextValue {
  scopeRef: RefObject<HTMLElement | null>;
  reducedMotion: boolean;
  resetEpoch: number;
  landingTargets: ReadonlySet<string>;
  launch: (specs: readonly CardFlightSpec[]) => void;
  /** Cancels flights, shows their destinations and forgets captured origins/snapshot baselines. */
  reset: () => void;
  /** Capture before removing a hand card, on click or after a drag. */
  rememberPlayOrigin: (cardKey: string, elementOrBox: HTMLElement | CardBox) => void;
  takePlayOrigin: (cardKey: string) => CardBox | undefined;
}

const Context = createContext<CardFlightsContextValue | null>(null);

/** Launch cards and read destinations still in flight. Must be inside CardFlightsProvider. */
export function useCardFlights() {
  const context = useContext(Context);
  if (!context) throw new Error('useCardFlights requires CardFlightsProvider');
  return context;
}

export interface CardFlightsProviderProps {
  children: ReactNode;
  /** Board wrapper ref. Measurements and markers are scoped to this board, not the document. */
  scopeRef: RefObject<HTMLElement | null>;
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

/** Own card flights for one board. Remount or call reset() when replacing a match. */
export function CardFlightsProvider({ children, scopeRef }: CardFlightsProviderProps) {
  const reducedMotion = useFlightReducedMotion();
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const records = useRef(new Map<string, FlightRecord>());
  const origins = useRef(new Map<string, { box: CardBox; at: number }>());
  const nextId = useRef(0);
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [resetEpoch, setResetEpoch] = useState(0);

  const actions = useMemo(() => {
    const restore = (record: FlightRecord) => {
      if (record.timer !== null) clearTimeout(record.timer);
      record.spec.destination.style.setProperty('visibility', record.visibility, record.priority);
    };
    const clear = () => {
      records.current.forEach(restore);
      records.current.clear();
      origins.current.clear();
    };
    return {
      clear,
      reset: () => { clear(); setFlights([]); setResetEpoch((epoch) => epoch + 1); },
      launch: (specs: readonly CardFlightSpec[]) => {
        if (!specs.length) return;
        for (const spec of specs) {
          const previous = records.current.get(spec.target);
          if (previous) { restore(previous); records.current.delete(spec.target); }
          if (reducedRef.current || spec.durationMs <= 0 || spec.to.width <= 0 || spec.to.height <= 0) continue;
          const record: FlightRecord = {
            id: ++nextId.current, spec,
            visibility: spec.destination.style.getPropertyValue('visibility'),
            priority: spec.destination.style.getPropertyPriority('visibility'),
            timer: null,
            finish: () => {
              if (records.current.get(spec.target) !== record) return;
              restore(record);
              records.current.delete(spec.target);
              setFlights([...records.current.values()]);
            },
          };
          spec.destination.style.setProperty('visibility', 'hidden');
          records.current.set(spec.target, record);
          // The provider owns landing even if the portal is waiting for its container.
          record.timer = setTimeout(record.finish, spec.durationMs + (spec.delayMs ?? 0));
        }
        setFlights([...records.current.values()]);
      },
      rememberPlayOrigin: (key: string, elementOrBox: HTMLElement | CardBox) => {
        const now = Date.now();
        origins.current.forEach((origin, cardKey) => {
          if (now - origin.at > FLIGHT_GEOMETRY.originTtlMs) origins.current.delete(cardKey);
        });
        origins.current.set(key, { box: 'cx' in elementOrBox ? elementOrBox : measureCardBox(elementOrBox), at: now });
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
  const value = useMemo(() => ({ scopeRef, reducedMotion, resetEpoch,
    landingTargets: new Set(flights.map((flight) => flight.spec.target)), ...actions,
  }), [scopeRef, reducedMotion, resetEpoch, flights, actions]);
  return <MotionConfig reducedMotion="user"><Context.Provider value={value}>
    {children}
    {flights.length > 0 && <OverlayPortal>{flights.map((flight) =>
      <CardFlight key={flight.id} flightId={flight.id} spec={flight.spec} onFinish={flight.finish} />)}</OverlayPortal>}
  </Context.Provider></MotionConfig>;
}
CardFlightsProvider.displayName = 'CardFlightsProvider';
