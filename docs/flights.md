# Flights

Use `useFlightQueue` for deals, chip transfers, and snapshot resynchronization on `CardFlights`, `PokerTable`, and `TrucoTable`. Keep the game state in your app. The queue holds client-only motion requests, not game commands, and does not persist them or emit events during server rendering.

## Triggered, reactive, and resync motion

Push `deal` in the interaction that renders a new hand. Push `transfer` to send chips from a player's plaque to the pot. A transfer's `from` is the value of `players[].key`, not a name or seat index. `amount` is the positive, finite number of chips to depict; it does not change balances or the pot.

Card plays and new board cards are reactive: update the rendered hand, piles, or board, and keep card identities stable. They do not need queue events and do not settle a deal's handle.

Push `resync` when applying a server snapshot. It cancels active and pending motion and places the rendered cards immediately. The resync event resolves as `{ status: 'skipped', reason: 'resync' }`.

```tsx filename="poker.tsx"
import { useState } from 'react';
import { Button } from '@jfrader/ui/button';
import { useFlightQueue } from '@jfrader/ui/flights';
import { PokerTable, type PokerTablePlayer } from '@jfrader/ui/poker-table';

export function Poker({ players }: { players: readonly PokerTablePlayer[] }) {
  const queue = useFlightQueue();
  const [pot, setPot] = useState(100);
  return <>
    <Button onClick={() => {
      const from = players[0]?.key;
      if (from === undefined) return;
      setPot(current => current + 25);
      const transfer = queue.push({ kind: 'transfer', from, amount: 25 });
      void transfer.result.then(outcome => console.log(outcome.status));
    }}>Bet 25</Button>
    <PokerTable {...queue.props} title="Poker" players={players} pot={pot} />
  </>;
}
```

## Queue API

`push(event)` appends an event, generates its `id`, and returns `{ id, result }`. Each push is distinct, including two pushes in one handler. Await `result` for that event's outcome. Do not keep a consumer counter or reuse settled event ids.

Spread `queue.props` onto `PokerTable`. For card-only surfaces, pass `queue.events.filter(event => event.kind !== 'transfer')` as `flights`, and `queue.props.onFlightSettled` as `onFlightSettled`. `CardFlights` and `TrucoTable` accept only deal and resync events.

`events` contains unsettled requests and prunes each settled request. `busy` means at least one event is unsettled. `last` is the most recent outcome, or `null` before settlement. `cancel(id)` cancels one request; `cancel()` cancels all requests. Unmounting the queue cancels outstanding handles.

## Lane policies

| Kind | Policy |
| --- | --- |
| `deal` | Latest wins. A newer deal cancels the preceding deal group. The handle resolves after every card it launched lands, is cancelled, or is pruned. |
| `transfer` | Serial chip lane. Each transfer finishes before the next starts. It runs even when the `pot` prop is unchanged. |
| `resync` | Cancels both lanes and all earlier pending requests. Later events can start against the new snapshot. |

A deal does not cancel a transfer, and a transfer does not cancel a deal. Queue order matters at resync boundaries; the two lanes otherwise run independently.

The displayed pot holds the value from before the first pending transfer until the chip lane drains. The `pot` prop stays authoritative throughout. Update it when your game state changes, without waiting for a handle.

## Outcomes and reduced motion

| Status | Meaning |
| --- | --- |
| `landed` | The event's motion completed. |
| `cancelled` | Cancellation, replacement, pruning, resync, or unmount stopped the event. |
| `skipped` | Motion did not run. `reason` is `reduced-motion`, `missing-geometry`, or `resync`. |

Reduced motion completes deals and transfers without travel and resolves them as skipped with `reduced-motion`. Missing or unsupported endpoints resolve as skipped with `missing-geometry`. An unknown transfer player key also logs a development warning.

## Custom chip surfaces

Use `ChipFlights` and `useChipFlights().send` for custom measured departure and landing elements outside the table surfaces. `send` returns `Promise<FlightOutcome>`, owns one active chip flight, and cancels its predecessor. Supply `from`, `to`, and denomination `chips`; the primitive does not provide the table's serial lane or pot hold. See the GameChipStack Hooks example.

## Deprecated triggers

`deal` and `revision` on the card and table surfaces, plus `PokerTable.chipTransfer` and `PokerTable.potFrom`, remain for one minor release and warn once per prop in development. Replace them with queue events. Legacy chip triggers still require a pot increase; explicit queue transfers do not.
