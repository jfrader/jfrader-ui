# Flights

Wrap one surface and its controls in `FlightProvider`. Call `useFlights()` from those controls to deal cards, send chips, or resynchronize a snapshot. The provider supports `CardFlights`, `PokerTable`, and `TrucoTable`; keep game state in your app.

Each provider owns its surface's client-only motion requests. Nested providers isolate their controls and surfaces. Requests are not persisted or emitted during server rendering.

## Triggered, reactive, and resync motion

Call `deal()` in the interaction that renders a new hand. Call `sendChips({ from, amount })` to send chips from a player's plaque to the pot. `from` is the value of `players[].key`, not a name or seat index. `amount` is the positive, finite number of chips to depict; it does not change balances or the pot.

Card plays and new board cards are reactive: update the rendered hand, piles, or board, and keep card identities stable. They do not need a trigger and do not settle a deal's handle.

Call `resync()` when applying a server snapshot. It cancels active and pending motion and places the rendered cards immediately. Its handle resolves as `{ status: 'skipped', reason: 'resync' }` after every present lane acknowledges the snapshot.

```tsx filename="poker.tsx"
import { useState } from 'react';
import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { Button } from '@jfrader/ui/button';
import { FlightProvider, useFlights } from '@jfrader/ui/flights';
import { PokerTable, type PokerTablePlayer } from '@jfrader/ui/poker-table';

const Stage = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 640, marginInline: 'auto' });
const Controls = styled.div({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: vars.space[2], padding: vars.space[3] });

function PokerSurface({ players }: { players: readonly PokerTablePlayer[] }) {
  const flights = useFlights();
  const [pot, setPot] = useState(100);
  return <>
    <Stage><PokerTable title="Poker" players={players} pot={pot} /></Stage>
    <Controls>
      <Button onClick={() => flights.deal()}>Deal</Button>
      <Button onClick={() => {
        const from = players[0]?.key;
        if (from === undefined) return;
        setPot(current => current + 25);
        const transfer = flights.sendChips({ from, amount: 25 });
        void transfer.result.then(outcome => console.log(outcome.status));
      }}>Bet 25</Button>
      <Button onClick={() => flights.resync()}>Resync</Button>
    </Controls>
  </>;
}
export function Poker({ players }: { players: readonly PokerTablePlayer[] }) {
  return <FlightProvider><PokerSurface players={players} /></FlightProvider>;
}
```

## Provider and hook

`FlightProvider` takes `children` and an optional `onBusyChange` callback. Put the surface and controls below the same provider. `useFlights()` reads the nearest provider and throws outside one.

The hook returns `deal()`, `sendChips(input)`, `resync()`, `cancel(id?)`, `busy`, and `last`. Each trigger returns a `FlightHandle` with a library-generated `id` and a `result` promise. Two calls in one handler create two distinct requests. Await `result` for that request's outcome; no consumer counter is needed.

`busy` means at least one request is unsettled. `last` is the most recent outcome, or `null` before settlement. `cancel(id)` cancels one request; `cancel()` cancels all requests. Unmounting the provider cancels outstanding handles.

`deal()` and `resync()` require a registered card surface. `sendChips()` requires a registered chip surface. `CardFlights` and `TrucoTable` register cards; `PokerTable` registers cards and chips. Calling a trigger before its surface is ready resolves as skipped with `not-ready` and logs a development warning. A resync waits for every present lane and does not wait for an absent chip lane.

## Lane policies

| Call | Policy |
| --- | --- |
| `deal()` | Latest wins. A newer deal cancels the preceding deal group. The handle resolves after every card it launched lands, is cancelled, or is pruned. |
| `sendChips()` | Serial chip lane. Each transfer finishes before the next starts. It runs even when the `pot` prop is unchanged. |
| `resync()` | Cancels both lanes and all earlier pending requests. Later calls can start against the new snapshot. |

A deal does not cancel a transfer, and a transfer does not cancel a deal. Call order matters at resync boundaries; the two lanes otherwise run independently.

The displayed pot holds the value from before the first pending transfer until the chip lane drains. The `pot` prop stays authoritative throughout. Update it when your game state changes, without waiting for a handle.

## Outcomes and reduced motion

| Status | Meaning |
| --- | --- |
| `landed` | The request's motion completed. |
| `cancelled` | Cancellation, replacement, pruning, resync, or unmount stopped the request. |
| `skipped` | Motion did not run. `reason` is `reduced-motion`, `missing-geometry`, `resync`, or `not-ready`. |

Reduced motion completes deals and transfers without travel and resolves them as skipped with `reduced-motion`. Missing or unsupported endpoints resolve as skipped with `missing-geometry`. An unknown transfer player key also logs a development warning.

## Custom chip surfaces

Use `ChipFlights` and `useChipFlights().send` for custom measured departure and landing elements outside the table surfaces. `send` returns `Promise<FlightOutcome>`, owns one active chip flight, and cancels its predecessor. Supply `from`, `to`, and denomination `chips`; the primitive does not provide the table's serial lane or pot hold. See the GameChipStack Hooks example.
