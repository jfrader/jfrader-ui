'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { FlightEvent, FlightEventInput, FlightHandle, FlightId, FlightOutcome, FlightQueue } from './types';

/** Owns client-only motion requests. Push from the interaction that commits your next snapshot. */
export function useFlightQueue(): FlightQueue {
  const prefix = useId();
  const sequence = useRef(0);
  const pending = useRef(new Map<FlightId, { event: FlightEvent; resolve: (outcome: FlightOutcome) => void }>());
  const [events, setEvents] = useState<readonly FlightEvent[]>([]);
  const [last, setLast] = useState<FlightOutcome | null>(null);
  const settle = useCallback((id: FlightId, outcome: FlightOutcome) => {
    const entry = pending.current.get(id);
    if (!entry) return;
    pending.current.delete(id);
    entry.resolve(outcome);
    setEvents([...pending.current.values()].map(value => value.event));
    setLast(outcome);
  }, []);
  const cancel = useCallback((id?: FlightId) => {
    for (const key of id === undefined ? [...pending.current.keys()] : [id]) settle(key, { status: 'cancelled' });
  }, [settle]);
  const push = useCallback((input: FlightEventInput): FlightHandle => {
    const id = `${prefix}-flight-${++sequence.current}`;
    if (typeof window === 'undefined') return { id, result: Promise.resolve({ status: 'skipped', reason: 'missing-geometry' }) };
    const event: FlightEvent = { ...input, id };
    const result = new Promise<FlightOutcome>(resolve => { pending.current.set(id, { event, resolve }); });
    setEvents([...pending.current.values()].map(value => value.event));
    return { id, result };
  }, [prefix]);
  useEffect(() => () => {
    for (const entry of pending.current.values()) entry.resolve({ status: 'cancelled' });
    pending.current.clear();
  }, []);
  return { events, props: { flights: events, onFlightSettled: settle }, push, cancel, busy: events.length > 0, last };
}
