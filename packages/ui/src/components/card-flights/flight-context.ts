'use client';

import { createContext, useContext } from 'react';
import type { FlightSpec } from './flight-engine';
import type { CardBox } from './geometry';
import type { FlightId, FlightOutcome } from '../flights/types';

export interface CardFlightsContextValue {
  reducedMotion: boolean;
  launch: (specs: readonly FlightSpec[], group?: { id: FlightId; settle: (id: FlightId, outcome: FlightOutcome) => void }) => void;
  reset: () => void;
  rememberPlayOrigin: (cardKey: string, elementOrBox: HTMLElement | CardBox) => void;
  takePlayOrigin: (cardKey: string) => CardBox | undefined;
  prune: () => void;
}

export const FlightContext = createContext<CardFlightsContextValue | null>(null);
export const BusyContext = createContext(false);
export const OriginContext = createContext<Pick<CardFlightsContextValue, 'rememberPlayOrigin' | 'takePlayOrigin'> | null>(null);

export const useOptionalCardFlights = () => useContext(OriginContext);

/** Read flight activity; outside CardFlights the board is idle. */
export function useCardFlightStatus(): { busy: boolean } { return { busy: useContext(BusyContext) }; }

/** Capture the rendered origin before accepting a dragged or custom hand card. */
export function useCardFlightOrigin() { return useContext(OriginContext)?.rememberPlayOrigin; }

export function useFlightActions() {
  const context = useContext(FlightContext);
  if (!context) throw new Error('Card flight actions require CardFlights');
  return context;
}
