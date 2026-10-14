import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { CardFlightsProvider } from './index';
import { CardFlightsFixture } from './card-flights-fixture';
import { measureCardBox } from './geometry';

const meta = {
  title: 'Games/CardFlights', component: CardFlightsProvider, tags: ['autodocs'],
  args: { children: null, scopeRef: { current: null } },
  render: () => <CardFlightsFixture />,
  parameters: { a11y: { test: 'error' }, docs: {
    description: { component: 'Deal cards to a hand and move played cards to their table piles.' },
    source: { language: 'tsx', code: `import { useRef, useState } from 'react';
import {
  CardFlightsProvider,
  useCardFlights,
  useDealFlights,
  usePlayedCardFlights,
  type PlayedFlightCard,
} from '@jfrader/ui/card-flights';
import { GameCardStack } from '@jfrader/ui/game-card-stack';
import { GameHand, type GameHandCard } from '@jfrader/ui/game-hand';
import { GameTable } from '@jfrader/ui/game-table';

const seats = [{ key: 'own', teamIdx: 0, isMe: true }, { key: 'rival', teamIdx: 1 }];
const cards: GameHandCard[] = [
  { id: 'ace', label: 'Ace of spades', value: { suit: 'spades', rank: 'A' } },
  { id: 'queen', label: 'Queen of hearts', value: { suit: 'hearts', rank: 'Q' } },
];

function Match() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const [hand, setHand] = useState(cards);
  const [plays, setPlays] = useState<PlayedFlightCard[]>([]);
  const [handIndex, setHandIndex] = useState(1);
  const { rememberPlayOrigin, landingTargets } = useCardFlights();
  useDealFlights({
    handIndex, dealt: plays.length === 0, forehandIdx: 0,
    players: [{ key: 'own', idx: 0, isOwn: true, cards: hand }],
  });
  usePlayedCardFlights({ plays, playerCount: seats.length });

  const play = (card: GameHandCard) => {
    const source = scopeRef.current?.querySelector<HTMLElement>(
      '[data-hand-card="' + CSS.escape(card.id) + '"]',
    );
    if (source) rememberPlayOrigin(card.id, source);
    setPlays((current) => [...current, {
      ...card, cardId: card.id, id: crypto.randomUUID(), playerKey: 'own', isOwn: true,
    }]);
    setHand((current) => current.filter((entry) => entry.id !== card.id));
  };

  return (
    <div ref={scopeRef}>
      <CardFlightsProvider scopeRef={scopeRef}>
        <GameTable players={2} seats={seats} viewport={{ width: 1000, height: 800 }}>
          <GameTable.Seat slotKey="rival">
            <GameHand.Hidden playerKey="rival" count={2} label="Rival hand" />
          </GameTable.Seat>
          <GameTable.Dock>
            <GameHand cards={hand} playLabel="Play selected" disabled={landingTargets.size > 0}
              onPlayIntent={play} />
          </GameTable.Dock>
          {seats.map((seat) => (
            <GameTable.Play key={seat.key} slotKey={seat.key}>
              <GameCardStack.Pile playerKey={seat.key} label={seat.key + ' pile'}
                cards={plays.filter((entry) => entry.playerKey === seat.key)} />
            </GameTable.Play>
          ))}
        </GameTable>
      </CardFlightsProvider>
    </div>
  );
}` },
    usage: `### Setup
- Import from \`@jfrader/ui/card-flights\`. Card flights are an opt-in subpath and are not re-exported by the package root.

### Card records
- Pass the same labeled records to GameHand and useDealFlights: each has an id, label and value. No face nodes are needed. Optional front, back and backPattern customize flight artwork.
- Give each accepted play a unique id. Pass that record to both GameCardStack.Pile and usePlayedCardFlights. Set cardId to its source hand id when the play id differs. Labels come from your app, never from a suit or rank formatter in the library.
- The pile's data-played-key is the play id. GameHand's data-hand-card is the hand id. Hidden hands keep playerKey and zero-based card-index markers; no opponent value is exposed.

### Match state
- Wrap one board in CardFlightsProvider and pass its wrapper scopeRef. Initial and resync snapshots appear in place. Change resyncKey when applying a server snapshot; bursts larger than playerCount also appear in place.
- Deal order starts at forehandIdx, sorts player idx and deals at most three cards per player. Deal duration is 380ms with 70ms stagger; own plays take 400ms and rival plays 520ms.
- Capture the hand origin with rememberPlayOrigin(card.id, element) before accepting onPlayIntent. Captures expire after 4000ms; otherwise the preceding render supplies the origin. Mount measurable destinations in the same commit as the new plays. Missing endpoints appear in place.
- landingTargets contains destinations still in flight. Disable play while necessary for your rules. reset() cancels flights and forgets origins and snapshot baselines; remount for a new match.
- Destinations stay hidden until the tracks finish. Replacements cancel old tracks. A waiting portal completes at the duration deadline. Reduced motion completes without a flight, including preference changes during animation.

### Accessibility and artwork
- Flights are decorative and aria-hidden. Name final cards and controls. GameHand uses native selection buttons and an explicit play button; selecting a card does not play it.
- Portals inherit ThemeRoot tokens, appearance and portalContainer. Custom front/back content must fit the measured frame. Down flights never mount front content; reveal flights do, so do not pass secret values.
- See the separate Regressions stories for interruption, resync, portal and identity cases.`,
  } },
} satisfies Meta<typeof CardFlightsProvider>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DealAndPlay: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    await waitFor(() => expect(canvasElement.querySelector('[data-ui="game-table"]')).not.toHaveAttribute('data-layout-fit', 'measuring'));
    await userEvent.click(canvas.getByRole('button', { name: 'Ace of spades' }));
    const source = canvasElement.querySelector<HTMLElement>('[data-hand-card="own-ace"]');
    if (!source) throw new Error('Missing own hand card');
    const origin = measureCardBox(source);
    await userEvent.click(canvas.getByRole('button', { name: 'Play selected' }));
    const flights = [...canvasElement.querySelectorAll<HTMLElement>('[data-ui="card-flight"]')];
    await expect(flights).toHaveLength(2);
    const destinations = [...canvasElement.querySelectorAll<HTMLElement>('[data-played-key]')];
    await expect(destinations).toHaveLength(2);
    await expect(new Set(destinations.map((node) => node.dataset.playedKey)).size).toBe(2);
    for (const destination of destinations) {
      const flight = flights.find((node) => node.dataset.flightTarget === `played:${destination.dataset.playedKey}`);
      await expect(flight).toBeDefined();
      await expect(getComputedStyle(destination).visibility).toBe('hidden');
    }
    const ownDestination = destinations.find((node) => node.closest('[data-player-key="own"]'));
    if (!ownDestination) throw new Error('Missing own play destination');
    const ownFlight = flights.find((node) => node.dataset.flightTarget === `played:${ownDestination.dataset.playedKey}`);
    const effect = ownFlight?.getAnimations()[0]?.effect;
    if (!(effect instanceof KeyframeEffect)) throw new Error('Missing travel track');
    const pose = new DOMMatrixReadOnly(String(effect.getKeyframes()[0]?.transform));
    const to = measureCardBox(ownDestination);
    await expect(pose.e).toBeCloseTo(origin.cx - to.width / 2, 2);
    await expect(pose.f).toBeCloseTo(origin.cy - to.height / 2, 2);
    await expect(canvasElement.querySelector('[data-hand-card="own-ace"]')).toBeNull();
    await waitFor(() => expect(canvasElement.querySelectorAll('[data-ui="card-flight"]')).toHaveLength(0));
    await expect(canvas.getByRole('img', { name: 'Ace of spades' })).toBeVisible();
    await expect(canvas.getByRole('img', { name: 'Four of hearts' })).toBeVisible();
    for (const destination of destinations) await expect(destination.style.visibility).toBe('');
    console.info('CARD_FLIGHT_RECORD_MEASUREMENTS', JSON.stringify({ origin, destination: to, playIds: destinations.map((node) => node.dataset.playedKey) }));
    await userEvent.click(canvas.getByRole('button', { name: 'Deal hand' }));
    await expect(canvasElement.querySelectorAll('[data-ui="card-flight"]')).toHaveLength(6);
    await expect(canvasElement.querySelectorAll('[data-played-key]')).toHaveLength(0);
    await waitFor(() => expect(canvasElement.querySelectorAll('[data-ui="card-flight"]')).toHaveLength(0));
    await expect(canvas.getByRole('button', { name: 'Ace of spades' })).toBeEnabled();
  },
};
export const Light: Story = { render: () => <CardFlightsFixture theme="light" /> };
