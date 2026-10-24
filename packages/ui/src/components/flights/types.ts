/** The value of `players[].key`, not a player name or seat index. */
export type PlayerKey = string;
/** Library-generated identity of one queued event. */
export type FlightId = string;
/** Completion of one event, including motion that could not run. */
export type FlightOutcome = {
  status: 'landed' | 'cancelled' | 'skipped';
  reason?: 'reduced-motion' | 'missing-geometry' | 'resync' | 'not-ready';
};
/** Requests motion against the current rendered snapshot. */
export type FlightEvent =
  | { id: FlightId; kind: 'deal' }
  | { id: FlightId; kind: 'transfer'; from: PlayerKey; amount: number; to?: 'pot' }
  | { id: FlightId; kind: 'resync' };
export type CardFlightEvent = Extract<FlightEvent, { kind: 'deal' | 'resync' }>;
export type TableFlightEvent = FlightEvent;
export type FlightEventInput = FlightEvent extends infer Event ? Event extends FlightEvent ? Omit<Event, 'id'> : never : never;
export interface FlightHandle {
  /** Identifies this request. */
  id: FlightId;
  /** Resolves once on landing, cancellation, or skipping. */
  result: Promise<FlightOutcome>;
}
/** Commands for the nearest FlightProvider's surface. */
export interface Flights {
  /** Deals the rendered card snapshot. A newer deal cancels its predecessor. */
  deal(): FlightHandle;
  /** Sends the explicit amount from `players[].key` to the pot on the serial chip lane. */
  sendChips(input: { from: PlayerKey; amount: number; to?: 'pot' }): FlightHandle;
  /** Places the current snapshot and cancels motion on every registered lane. */
  resync(): FlightHandle;
  /** Cancels one request, or all requests when omitted. */
  cancel(id?: FlightId): void;
  /** Reports whether a request remains unsettled. */
  busy: boolean;
  /** Most recently settled outcome, or null before the first settlement. */
  last: FlightOutcome | null;
}
export interface FlightQueue {
  /** Unsettled, client-only events. Settled events are pruned. */
  events: readonly FlightEvent[];
  /** Internal completion adapter used by FlightProvider. */
  props: { flights: readonly FlightEvent[]; onFlightSettled: (id: FlightId, outcome: FlightOutcome) => void };
  /** Appends a distinct event. Call from an interaction, never during render. */
  push(event: FlightEventInput): FlightHandle;
  /** Cancels one event, or all unsettled events when omitted. */
  cancel(id?: FlightId): void;
  /** Reports whether any request remains unsettled. */
  busy: boolean;
  /** Most recently settled outcome, or null before the first settlement. */
  last: FlightOutcome | null;
}
