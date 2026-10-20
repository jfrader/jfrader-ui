'use client';

import { createContext, useContext, type RefObject } from 'react';
import type { CardFlightSpec } from './card-flights';
import type { CardBox } from './geometry';

interface CardFlightsContextValue {
  scopeRef: RefObject<HTMLElement | null>;
  reducedMotion: boolean;
  resetEpoch: number;
  landingTargets: ReadonlySet<string>;
  launch: (specs: readonly CardFlightSpec[]) => void;
  reset: () => void;
  synchronize: (key: string | number | undefined) => void;
  rememberPlayOrigin: (cardKey: string, elementOrBox: HTMLElement | CardBox) => void;
  takePlayOrigin: (cardKey: string) => CardBox | undefined;
  prune: () => void;
}

export const FlightContext = createContext<CardFlightsContextValue | null>(null);
export const TreeOwnedContext = createContext(false);
export const BusyContext = createContext(false);
export const OriginContext = createContext<Pick<CardFlightsContextValue, 'rememberPlayOrigin' | 'takePlayOrigin'> | null>(null);

export const useOptionalCardFlights = () => useContext(OriginContext);

/** Read flight activity; outside CardFlights the board is idle. */
export function useCardFlightStatus(): { busy: boolean } { return { busy: useContext(BusyContext) }; }

/** Capture the rendered origin before accepting a dragged or custom hand card. */
export function useCardFlightOrigin() { return useContext(OriginContext)?.rememberPlayOrigin; }

export function useFlightActions() {
  const context = useContext(FlightContext);
  if (!context) throw new Error('Card flight actions require CardFlights or CardFlightsProvider');
  return context;
}
