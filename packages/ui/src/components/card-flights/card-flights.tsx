'use client';

import { useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentPropsWithRef, type ComponentType, type ReactNode, type RefObject } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { WithSx, type SxProps } from '../../styling/sx';
import type { Interpolation, Theme } from '../../styling/css';
import { MotionConfig, useReducedMotion } from 'motion/react';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { CardFlight } from './card-flight';
import { FLIGHT_GEOMETRY, measureCardBox, type CardBox } from './geometry';
import type { FlightCard } from './use-card-flights';
import { assertLegacyFlightEngine, createFlightRegistry, FlightRegistryContext } from './flight-registry';
import { BusyContext, FlightContext as Context, OriginContext, TreeOwnedContext, useFlightActions } from './flight-context';

/** @deprecated Render CardFlights.Target instead. Removed in the next major release. */
export type CardFlightSpec = {
  target: string;
  /** Mounted destination. Its visibility is restored on landing, reset or replacement. */
  destination: HTMLElement;
  from: CardBox;
  to: CardBox;
  face: 'up' | 'down' | 'reveal';
  /** Duration in milliseconds. Prefer the deal/play hooks' token timings. */
  durationMs: number;
  delayMs?: number;
} & ({ card: FlightCard; front?: ReactNode; back?: ReactNode } | { card?: never; front?: ReactNode; back: ReactNode });

interface FlightRecord {
  id: number;
  spec: CardFlightSpec;
  visibility: string;
  priority: string;
  timer: ReturnType<typeof setTimeout> | null;
  cancel?: () => void;
  start: (cancel: () => void) => void;
  finish: () => void;
}

/** @deprecated Use CardFlights and useCardFlightStatus(). Removed in the next major release. */
export function useCardFlights() {
  assertLegacyFlightEngine(useContext(TreeOwnedContext));
  return useFlightActions();
}

type ScopeRootProps = ComponentPropsWithRef<'div'> & { [attribute: `data-${string}`]: string | number | boolean | undefined };

/** @deprecated Use DOM-less CardFlights and a native wrapper. Removed in the next major release. */
export interface CardFlightsSlots {
  /** Replaces the root div. Exactly sugar for `slots.root`. */
  root?: ComponentType<ScopeRootProps>;
}

/** @deprecated Use DOM-less CardFlights and a native wrapper. Removed in the next major release. */
export interface CardFlightsSlotProps {
  /** Root slot props win conflicts; className and style merge. */
  root?: ScopeRootProps & { sx?: Interpolation<Theme> };
}

/** @deprecated Use CardFlightsProps instead. Removed in the next major release. */
export interface CardFlightsProviderProps extends ScopeRootProps, SxProps {
  /** Use a consumer-owned scope instead of rendering a root div. Root customization is ignored in this mode. */
  scopeRef?: RefObject<HTMLElement | null>;
  /** Internal: render children without a scope root for CardFlights. */
  headless?: boolean;
  /** Replace the root div. Exactly sugar for `slots.root`; declare replacements outside render. */
  component?: ComponentType<ScopeRootProps>;
  /** Every part that takes props is also replaceable; keys match `slotProps`. */
  slots?: CardFlightsSlots;
  /** Every part that takes props is also replaceable; keys match `slots`. */
  slotProps?: CardFlightsSlotProps;
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

/** @deprecated Use <CardFlights revision={snapshot}> instead. Removed in the next major release. */
export function CardFlightsProvider({ children, scopeRef: externalScopeRef, headless = false, component, slots, slotProps, className, style, sx, ...rest }: CardFlightsProviderProps) {
  const internalScopeRef = useRef<HTMLDivElement>(null);
  const scopeRef = externalScopeRef ?? internalScopeRef;
  const rootless = headless || Boolean(externalScopeRef);
  const { sx: slotCss, className: slotClassName, style: slotStyle, ...slotRest } = slotProps?.root ?? {};
  const rootProps = { ...rest, children, ...slotRest };
  const rootRef = useMergeRefs([internalScopeRef, rootProps.ref]);
  const Root = slots?.root ?? component ?? 'div';
  const reducedMotion = useFlightReducedMotion();
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const records = useRef(new Map<string, FlightRecord>());
  const origins = useRef(new Map<string, { box: CardBox; at: number }>());
  const nextId = useRef(0);
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [resetEpoch, setResetEpoch] = useState(0);
  const [registry] = useState(createFlightRegistry);
  registry.treeOwned = useContext(TreeOwnedContext);

  const actions = useMemo(() => {
    let snapshot: { key: string | number | undefined } | undefined;
    const restore = (record: FlightRecord) => {
      if (record.timer !== null) clearTimeout(record.timer);
      record.cancel?.();
      record.spec.destination.style.setProperty('visibility', record.visibility, record.priority);
    };
    const clear = () => {
      records.current.forEach(restore);
      records.current.clear();
      origins.current.clear();
    };
    return {
      clear,
      prune: () => { records.current.forEach((record) => { if (!record.spec.destination.isConnected) record.finish(); }); },
      reset: () => { clear(); setFlights([]); setResetEpoch((epoch) => epoch + 1); },
      synchronize: (key: string | number | undefined) => {
        if (snapshot && snapshot.key !== key) {
          clear();
          setFlights([]);
          setResetEpoch((epoch) => epoch + 1);
        }
        snapshot = { key };
      },
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
            start: (cancel) => {
              if (record.timer !== null) clearTimeout(record.timer);
              record.timer = null;
              record.cancel = cancel;
            },
            finish: () => {
              if (records.current.get(spec.target) !== record) return;
              restore(record);
              records.current.delete(spec.target);
              setFlights([...records.current.values()]);
            },
          };
          spec.destination.style.setProperty('visibility', 'hidden');
          records.current.set(spec.target, record);
          // Only an unmounted portal has a deadline; mounted flights own their actual landing.
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
  return <MotionConfig reducedMotion="user"><Context.Provider value={value}><OriginContext value={actions}><BusyContext value={!reducedMotion && flights.length > 0}><FlightRegistryContext value={registry}>
    {rootless ? children : <WithSx styles={slotCss} className={slotClassName}>
      {(slotClasses) => <WithSx className={className} sx={sx}>
        {(consumerClasses) => <WithSx styles={[]} className={[slotClasses, consumerClasses].filter(Boolean).join(' ')}>
          {(classes) => <Root {...rootProps} ref={rootRef}
            data-ui={[...new Set(['card-flights', rest['data-ui'], slotRest['data-ui']].flatMap((value) => String(value ?? '').split(/\s+/).filter(Boolean)))].join(' ')}
            className={classes} style={{ ...style, ...slotStyle }}>{rootProps.children}</Root>}
        </WithSx>}
      </WithSx>}
    </WithSx>}
    {flights.length > 0 && <OverlayPortal>{flights.map((flight) =>
      <CardFlight key={flight.id} flightId={flight.id} spec={flight.spec} onStart={flight.start} onFinish={flight.finish} />)}</OverlayPortal>}
  </FlightRegistryContext></BusyContext></OriginContext></Context.Provider></MotionConfig>;
}
CardFlightsProvider.displayName = 'CardFlightsProvider';
