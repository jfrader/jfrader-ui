'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLatestCallback } from '../../utils/use-latest-callback';
import { useFlightQueue } from './use-flight-queue';
import type { FlightEvent, FlightEventInput, FlightHandle, FlightId, FlightOutcome, Flights } from './types';

declare const process: { env: { NODE_ENV?: string } };

type SurfaceKind = 'cards' | 'chips';
interface PendingRequest {
  remaining: Set<SurfaceKind>;
  outcome: FlightOutcome;
}
interface FlightScope {
  events: readonly FlightEvent[];
  settle: (id: FlightId, outcome: FlightOutcome, kind: SurfaceKind) => void;
  registerKind: (kind: SurfaceKind) => () => void;
}
const ScopeContext = createContext<FlightScope | null>(null);
const FlightsContext = createContext<Flights | null>(null);

export interface FlightProviderProps {
  /** Contains one flight surface and its controls. Nested providers isolate their surfaces. */
  children: ReactNode;
  /** Reports unsettled-request activity edges, including cancellation on unmount. */
  onBusyChange?: (busy: boolean) => void;
}

/** Owns client-only motion requests for one card or table surface. */
export function FlightProvider({ children, onBusyChange }: FlightProviderProps) {
  const queue = useFlightQueue();
  const pending = useRef(new Map<FlightId, PendingRequest>());
  const registrations = useRef(new Map<SurfaceKind, number>());
  const notify = useLatestCallback(onBusyChange);
  const finish = useCallback((id: FlightId, outcome: FlightOutcome) => {
    if (!pending.current.delete(id)) return;
    queue.props.onFlightSettled(id, outcome);
    if (!pending.current.size) notify(false);
  }, [queue.props.onFlightSettled, notify]);
  const settle = useCallback((id: FlightId, outcome: FlightOutcome, kind: SurfaceKind) => {
    const request = pending.current.get(id);
    if (!request?.remaining.delete(kind)) return;
    if (outcome.status === 'cancelled' || request.outcome.status === 'landed') request.outcome = outcome;
    if (!request.remaining.size) finish(id, request.outcome);
  }, [finish]);
  const registerKind = useCallback((kind: SurfaceKind) => {
    registrations.current.set(kind, (registrations.current.get(kind) ?? 0) + 1);
    return () => {
      const count = (registrations.current.get(kind) ?? 1) - 1;
      if (count) registrations.current.set(kind, count);
      else {
        registrations.current.delete(kind);
        for (const id of [...pending.current.keys()]) settle(id, { status: 'cancelled' }, kind);
      }
    };
  }, [settle]);
  const push = useCallback((event: FlightEventInput): FlightHandle => {
    const handle = queue.push(event);
    if (typeof window === 'undefined') return handle;
    const required = event.kind === 'transfer' ? 'chips' : 'cards';
    const remaining = new Set<SurfaceKind>(event.kind === 'resync' ? registrations.current.keys() : [required]);
    const wasBusy = pending.current.size > 0;
    pending.current.set(handle.id, { remaining, outcome: { status: 'landed' } });
    if (!wasBusy) notify(true);
    if (!registrations.current.has(required)) {
      const command = { deal: 'deal()', transfer: 'sendChips()', resync: 'resync()' }[event.kind];
      if (process.env.NODE_ENV !== 'production') console.warn(`FlightProvider: ${command} has no registered ${required} surface. Render its surface inside this FlightProvider before triggering motion.`);
      finish(handle.id, { status: 'skipped', reason: 'not-ready' });
    }
    return handle;
  }, [queue.push, notify, finish]);
  const cancel = useCallback((id?: FlightId) => {
    for (const key of id === undefined ? [...pending.current.keys()] : [id]) finish(key, { status: 'cancelled' });
  }, [finish]);
  useEffect(() => () => {
    if (pending.current.size) notify(false);
    pending.current.clear();
  }, [notify]);
  const scope = useMemo(() => ({ events: queue.events, settle, registerKind }), [queue.events, settle, registerKind]);
  const commands = useMemo<Flights>(() => ({
    deal: () => push({ kind: 'deal' }),
    sendChips: input => push({ ...input, kind: 'transfer' }),
    resync: () => push({ kind: 'resync' }),
    cancel, busy: queue.busy, last: queue.last,
  }), [push, cancel, queue.busy, queue.last]);
  return <ScopeContext value={scope}><FlightsContext value={commands}>{children}</FlightsContext></ScopeContext>;
}
FlightProvider.displayName = 'FlightProvider';

/** Triggers motion on the nearest FlightProvider's registered surface. */
export function useFlights(): Flights {
  const flights = useContext(FlightsContext);
  if (!flights) throw new Error('useFlights must be used inside FlightProvider.');
  return flights;
}

export function useFlightSurface(kind: SurfaceKind) {
  const scope = useFlightScope();
  const registerKind = scope?.registerKind;
  useLayoutEffect(() => registerKind?.(kind), [registerKind, kind]);
  const acknowledge = useCallback((id: FlightId, outcome: FlightOutcome) => scope?.settle(id, outcome, kind), [scope?.settle, kind]);
  return { events: scope?.events ?? [], settle: acknowledge };
}

export function useFlightScope() { return useContext(ScopeContext); }
