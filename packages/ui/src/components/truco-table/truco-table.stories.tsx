import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { styled } from '../../index';
import { vars } from '@jfrader/tokens/vars';
import { Button } from '../button';
import { FlightProvider, useFlights } from '../flights';
import { expectInside } from '../../testing/geometry-assertions';
import {
  TrucoTable,
  type TrucoTableCard,
  type TrucoTablePlay,
  type TrucoTablePlayer,
  type TrucoTableScore,
} from './index';

const DocsStage = styled.div({
  inlineSize: '100%',
  maxInlineSize: 640,
  blockSize: 720,
  marginInline: 'auto',
});
const Controls = styled.div({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: vars.space[2], padding: vars.space[3] });

const card = (id: string, label: string, suit: string, rank: string | number): TrucoTableCard => ({
  id,
  label,
  value: { suit, rank },
});

const HAND = [
  card('seven-swords', 'Seven of swords', 'espadas', 7),
  card('ace-golds', 'Ace of golds', 'oros', 1),
  card('three-cups', 'Three of cups', 'copas', 3),
];
const DREW_PLAY = card('drew-three-clubs', 'Three of clubs', 'bastos', 3);
const BLAIR_PLAY = card('blair-two-golds', 'Two of golds', 'oros', 2);

interface Seat extends TrucoTablePlayer {
  key: string;
}

const SEATS: readonly Seat[] = [
  { key: 'alex', name: 'Alex', teamIdx: 0 },
  { key: 'blair', name: 'Blair', teamIdx: 1 },
  { key: 'you', name: 'You', teamIdx: 0, isMe: true },
  { key: 'drew', name: 'Drew', teamIdx: 1 },
];

const SCORE: readonly TrucoTableScore[] = [
  { key: 'us', label: 'Us', value: 12 },
  { key: 'them', label: 'Them', value: 8 },
];

const TURN = { remainingMs: 45000, durationMs: 60000 };

type Phase = 'idle' | 'trick';

function TrucoGame() {
  const flights = useFlights();
  const [phase, setPhase] = useState<Phase>('idle');
  const [hand, setHand] = useState<readonly TrucoTableCard[]>([]);
  const [plays, setPlays] = useState<readonly TrucoTablePlay[]>([]);
  const [hidden, setHidden] = useState<Record<string, number>>({});
  const [active, setActive] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState('Two teams · First to 30');
  const [busy, setBusy] = useState(false);

  const dealHand = () => {
    setPhase('trick');
    setHand(HAND);
    setPlays([]);
    setHidden({ alex: 3, blair: 3, drew: 3 });
    setActive('you');
    flights.deal();
    setMessage('Your hand · Three cards');
  };

  const reset = () => {
    setPhase('idle');
    setHand([]);
    setPlays([]);
    setHidden({});
    setActive(undefined);
    setMessage('Two teams · First to 30');
    flights.resync();
  };

  const playCard = (played: TrucoTableCard) => {
    setHand((current) => current.filter((item) => item.id !== played.id));
    setPlays((current) => [
      ...current,
      { ...played, id: `you-${played.id}`, cardId: played.id, playerKey: 'you' },
      { ...DREW_PLAY, id: `drew-${DREW_PLAY.id}-${current.length}`, cardId: DREW_PLAY.id, playerKey: 'drew' },
    ]);
    setHidden((current) => ({ ...current, drew: Math.max(0, (current.drew ?? 0) - 1) }));
    setActive('drew');
    setMessage(`You play ${played.label} · Drew replies`);
  };

  const pass = () => {
    setPlays((current) => [...current, { ...BLAIR_PLAY, id: `blair-${BLAIR_PLAY.id}-${current.length}`, cardId: BLAIR_PLAY.id, playerKey: 'blair' }]);
    setHidden((current) => ({ ...current, blair: Math.max(0, (current.blair ?? 0) - 1) }));
    setActive('you');
    setMessage('Blair plays Two of golds · Your turn');
  };

  const call = () => setMessage('Truco! · The other team answers');

  const players: TrucoTablePlayer[] = SEATS.map((seat) => ({
    ...seat,
    hiddenCards: hidden[seat.key] ?? 0,
    turn: seat.key === active ? TURN : undefined,
    state: seat.key === active ? 'active' : 'idle',
  }));

  const actions = phase === 'idle'
    ? [{ key: 'deal', label: 'Deal hand', tone: 'accent' as const, disabled: busy, onSelect: dealHand }]
    : [
      { key: 'pass', label: 'Pass', variant: 'soft' as const, disabled: busy, onSelect: pass },
      { key: 'truco', label: 'Truco', tone: 'accent' as const, disabled: busy, onSelect: call },
      { key: 'new', label: 'New hand', variant: 'outline' as const, disabled: busy, onSelect: reset },
    ];

  return (
    <DocsStage>
      <TrucoTable
        players={players}
        title="Truco"
        subtitle={phase === 'idle' ? 'Waiting for a hand' : 'First trick'}
        hand={hand}
        onPlayIntent={playCard}
        plays={plays}
        score={SCORE}
        announcement={message}
        actions={actions}
        onBusyChange={setBusy}
      />
    </DocsStage>
  );
}

const meta = {
  title: 'Games/TrucoTable',
  component: TrucoTable,
  tags: ['autodocs'],
  args: { players: SEATS, title: 'Truco' },
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
    docs: {
      description: {
        component: 'Lay out a truco table with teams, hidden hands, the local hand, play piles, a score line, events, and calls.',
      },
      sections: [{ title: 'A trick', stories: ['TrucoTrick'] }, { title: 'Hooks', stories: ['FlightControls'] }],
      usage: `### When to use
Use TrucoTable for a two-team trick game with hidden hands, a local hand, one play pile per seat, a score line, and calls. The component is presentational: it renders the state you pass and reports the selected card through \`onPlayIntent\`. Turn order, trick resolution, scoring, card values, and legality belong to your application.

Wrap the table and controls in \`FlightProvider\` and call \`useFlights().deal()\`. Grow \`plays\` to land cards on the seats. New cards fly from the deck, the local hand, or the seat that played them. \`onBusyChange\` reports flight activity so you can disable calls. The table keeps seats on the felt edge on wide containers and moves them inside the felt on narrow ones so the surface uses the available width.

See the [Flights guide](https://ui.jfrader.com/#/components/flights) for deal completion, reactive plays, and resync requests.

### Values and constraints

Give the parent container an explicit inline and block size, exactly as for GameTable. \`players\` needs at least two seats with unique keys; teams alternate by seat order unless you set \`teamIdx\`. The local player is rotated to the front. The local hand is optional: omit it before the deal or when the consumer owns the hand surface. The dock keeps room for a hand above one action row from the first render, so the felt holds its size across deals and turns. Pass \`dock\` to size it yourself.

### Keyboard and accessibility

The table, score line, and local hand are labelled groups. The event line is a polite live region. Every card needs a label. Select a card with Enter or Space, then activate Play card. Piles are compact summaries of the cards each seat played.`,
    },
  },
  render: () => <FlightProvider><TrucoGame /></FlightProvider>,
} satisfies Meta<typeof TrucoTable>;
export default meta;
type Story = StoryObj<typeof meta>;

const flights = (document: Document) => document.querySelectorAll('[data-ui="card-flight"]');
const landed = async (document: Document) => waitFor(() => expect(flights(document)).toHaveLength(0), { timeout: 4000 });

function FlightControlsExample() {
  const flights = useFlights();
  return <>
    <DocsStage data-flight-stage><TrucoTable players={SEATS.map(player => ({ ...player, hiddenCards: player.isMe ? 0 : 3 }))} title="Truco" hand={HAND}
      /></DocsStage>
    <Controls><Button onClick={() => flights.deal()}>Deal hand</Button></Controls>
  </>;
}
export const TrucoTrick: Story = {
  name: 'Truco trick',
  parameters: {
    docs: {
      description: {
        story: 'Deal a hand, select a card, play it, pass, and call Truco. The script lives in this example; the component only renders state and reports intent.',
      },
      source: { language: 'tsx', code: `import { useState } from 'react';
import { styled } from '@jfrader/ui';
import { FlightProvider, useFlights } from '@jfrader/ui/flights';
import {
  TrucoTable,
  type TrucoTableCard,
  type TrucoTablePlay,
  type TrucoTablePlayer,
  type TrucoTableScore,
} from '@jfrader/ui/truco-table';

const Stage = styled.div({
  inlineSize: '100%',
  maxInlineSize: 640,
  blockSize: 720,
  marginInline: 'auto',
});

const card = (id: string, label: string, suit: string, rank: string | number): TrucoTableCard => ({
  id,
  label,
  value: { suit, rank },
});

const hand = [
  card('seven-swords', 'Seven of swords', 'espadas', 7),
  card('ace-golds', 'Ace of golds', 'oros', 1),
  card('three-cups', 'Three of cups', 'copas', 3),
];
const drewPlay = card('drew-three-clubs', 'Three of clubs', 'bastos', 3);
const blairPlay = card('blair-two-golds', 'Two of golds', 'oros', 2);

const seats = [
  { key: 'alex', name: 'Alex', teamIdx: 0 },
  { key: 'blair', name: 'Blair', teamIdx: 1 },
  { key: 'you', name: 'You', teamIdx: 0, isMe: true },
  { key: 'drew', name: 'Drew', teamIdx: 1 },
] satisfies readonly TrucoTablePlayer[];

const score: readonly TrucoTableScore[] = [
  { key: 'us', label: 'Us', value: 12 },
  { key: 'them', label: 'Them', value: 8 },
];

const turn = { remainingMs: 45000, durationMs: 60000 };

function TrucoSurface() {
  const flights = useFlights();
  const [dealt, setDealt] = useState(false);
  const [yourHand, setYourHand] = useState<readonly TrucoTableCard[]>([]);
  const [plays, setPlays] = useState<readonly TrucoTablePlay[]>([]);
  const [hidden, setHidden] = useState<Record<string, number>>({});
  const [active, setActive] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState('Two teams · First to 30');
  const [busy, setBusy] = useState(false);

  const dealHand = () => {
    setDealt(true);
    setYourHand(hand);
    setPlays([]);
    setHidden({ alex: 3, blair: 3, drew: 3 });
    setActive('you');
    flights.deal();
    setMessage('Your hand · Three cards');
  };

  const reset = () => {
    setDealt(false);
    setYourHand([]);
    setPlays([]);
    setHidden({});
    setActive(undefined);
    setMessage('Two teams · First to 30');
    flights.resync();
  };

  const playCard = (played: TrucoTableCard) => {
    setYourHand((current) => current.filter((item) => item.id !== played.id));
    setPlays((current) => [
      ...current,
      { ...played, id: 'you-' + played.id, cardId: played.id, playerKey: 'you' },
      { ...drewPlay, id: 'drew-' + drewPlay.id + '-' + current.length, cardId: drewPlay.id, playerKey: 'drew' },
    ]);
    setHidden((current) => ({ ...current, drew: Math.max(0, (current.drew ?? 0) - 1) }));
    setActive('drew');
    setMessage('You play ' + played.label + ' · Drew replies');
  };

  const pass = () => {
    setPlays((current) => [...current, { ...blairPlay, id: 'blair-' + blairPlay.id + '-' + current.length, cardId: blairPlay.id, playerKey: 'blair' }]);
    setHidden((current) => ({ ...current, blair: Math.max(0, (current.blair ?? 0) - 1) }));
    setActive('you');
    setMessage('Blair plays Two of golds · Your turn');
  };

  const players: TrucoTablePlayer[] = seats.map((seat) => ({
    ...seat,
    hiddenCards: hidden[seat.key] ?? 0,
    turn: seat.key === active ? turn : undefined,
    state: seat.key === active ? 'active' : 'idle',
  }));

  const actions = dealt
    ? [
      { key: 'pass', label: 'Pass', variant: 'soft' as const, disabled: busy, onSelect: pass },
      { key: 'truco', label: 'Truco', tone: 'accent' as const, disabled: busy, onSelect: () => setMessage('Truco! · The other team answers') },
      { key: 'new', label: 'New hand', variant: 'outline' as const, disabled: busy, onSelect: reset },
    ]
    : [{ key: 'deal', label: 'Deal hand', tone: 'accent' as const, disabled: busy, onSelect: dealHand }];

  return (
    <Stage>
      <TrucoTable
        players={players}
        title="Truco"
        subtitle={dealt ? 'First trick' : 'Waiting for a hand'}
        hand={yourHand}
        onPlayIntent={playCard}
        plays={plays}
        score={score}
        announcement={message}
        actions={actions}
        onBusyChange={setBusy}
      />
    </Stage>
  );
}
export default function Example() {
  return <FlightProvider><TrucoSurface /></FlightProvider>;
}` },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const table = canvasElement.querySelector<HTMLElement>('[data-ui="truco-table"]');
    await expect(table).not.toBeNull();
    const canvas = within(table!);
    const seats = table!.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]');
    await expect(seats).toHaveLength(4);
    await expect(table!.querySelectorAll('[data-ui="game-hand-hidden-card"]')).toHaveLength(0);
    await expect(canvas.getByRole('status')).toHaveTextContent('First to 30');
    await expect(canvas.getByRole('group', { name: 'Score' })).toHaveTextContent('Us12Them8');

    await userEvent.click(canvas.getByRole('button', { name: 'Deal hand' }));
    await landed(canvasElement.ownerDocument);
    await expect(table!.querySelectorAll('[data-ui="game-hand-hidden-card"]')).toHaveLength(9);
    await expect(table!.querySelectorAll('[data-ui="game-hand"] [data-ui~="game-card"]')).toHaveLength(3);
    await expect(canvas.getByRole('button', { name: 'Play card' })).toHaveAttribute('aria-disabled', 'true');
    await expect(table!.querySelector('[data-slot-player="you"] [data-ui="game-seat-points"]')).toHaveTextContent('12');
    await expect(table!.querySelector('[data-slot-player="drew"] [data-ui="game-seat-points"]')).toHaveTextContent('8');

    await userEvent.click(canvas.getByRole('button', { name: 'Seven of swords' }));
    await expect(canvas.getByRole('button', { name: 'Play card' })).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Play card' }));
    await waitFor(() => expect(canvasElement.ownerDocument.querySelectorAll('[data-ui="card-flight"][data-flight-target="played:you-seven-swords"]')).toHaveLength(1));
    await landed(canvasElement.ownerDocument);
    await expect(table!.querySelectorAll('[data-played-key]')).toHaveLength(2);
    await expect(table!.querySelectorAll('[data-ui="game-hand"] [data-ui~="game-card"]')).toHaveLength(2);
    await expect(canvas.getByRole('status')).toHaveTextContent('Drew replies');

    await userEvent.click(canvas.getByRole('button', { name: 'Pass' }));
    await landed(canvasElement.ownerDocument);
    await expect(table!.querySelectorAll('[data-played-key]')).toHaveLength(3);
    await expect(canvas.getByRole('status')).toHaveTextContent('Blair plays');

    await userEvent.click(canvas.getByRole('button', { name: 'Truco' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('Truco!');

    const surface = table!.querySelector<HTMLElement>('[data-game-surface]');
    if (!surface) throw new Error('Missing surface');
    for (const seat of seats) await expectInside(seat, table!);
    await expectInside(table!.querySelector<HTMLElement>('[data-ui="game-table-center"]')!, surface);

    await userEvent.click(canvas.getByRole('button', { name: 'New hand' }));
    await expect(table!.querySelectorAll('[data-played-key]')).toHaveLength(0);
    await expect(table!.querySelectorAll('[data-ui="game-hand"]')).toHaveLength(0);
    await expect(canvas.getByRole('button', { name: 'Deal hand' })).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: 'Deal hand' }));
    await landed(canvasElement.ownerDocument);
    await expect(table!.querySelectorAll('[data-ui="game-hand"] [data-ui~="game-card"]')).toHaveLength(3);
  },
};

export const FlightControls: Story = {
  name: 'Flight controls', render: () => <FlightProvider><FlightControlsExample /></FlightProvider>,
  parameters: { docs: { source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { Button } from '@jfrader/ui/button';
import { FlightProvider, useFlights } from '@jfrader/ui/flights';
import { TrucoTable, type TrucoTableCard } from '@jfrader/ui/truco-table';

const Stage = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 720, marginInline: 'auto' });
const Controls = styled.div({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: vars.space[2], padding: vars.space[3] });
const players = [
  { key: 'alex', name: 'Alex', teamIdx: 0, hiddenCards: 3 },
  { key: 'blair', name: 'Blair', teamIdx: 1, hiddenCards: 3 },
  { key: 'you', name: 'You', teamIdx: 0, isMe: true },
  { key: 'drew', name: 'Drew', teamIdx: 1, hiddenCards: 3 },
];
const hand: TrucoTableCard[] = [
  { id: 'seven-swords', label: 'Seven of swords', value: { suit: 'espadas', rank: 7 } },
  { id: 'ace-golds', label: 'Ace of golds', value: { suit: 'oros', rank: 1 } },
  { id: 'three-cups', label: 'Three of cups', value: { suit: 'copas', rank: 3 } },
];
function TrucoSurface() {
  const flights = useFlights();
  return <>
    <Stage><TrucoTable players={players} title="Truco" hand={hand} /></Stage>
    <Controls><Button onClick={() => flights.deal()}>Deal hand</Button></Controls>
  </>;
}
export function Truco() {
  return <FlightProvider><TrucoSurface /></FlightProvider>;
}` } } },
  play: async ({ canvas, canvasElement }) => {
    const stage = canvasElement.querySelector('[data-flight-stage]')!;
    await expect(canvas.getByRole('button', { name: 'Deal hand' }).getBoundingClientRect().top)
      .toBeGreaterThanOrEqual(stage.getBoundingClientRect().bottom);
  },
};

function StableSurfaceExample() {
  const [dealt, setDealt] = useState(false);
  return <>
    {[640, 320].map((width) => (
      <DocsStage key={width} style={{ maxInlineSize: width }}>
        <TrucoTable players={SEATS} title="Truco" hand={dealt ? HAND : undefined} onPlayIntent={() => undefined}
          actions={dealt ? [{ key: 'pass', label: 'Pass' }, { key: 'truco', label: 'Truco' }] : undefined} />
      </DocsStage>
    ))}
    <Controls><Button onClick={() => setDealt((current) => !current)}>{dealt ? 'Clear hand' : 'Deal hand'}</Button></Controls>
  </>;
}

const surfaceBoxes = async (canvasElement: HTMLElement) => {
  for (let frame = 0; frame < 12; frame++) await new Promise(requestAnimationFrame);
  return Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="truco-table"]'), (table) => {
    const origin = table.getBoundingClientRect();
    const { x, y, width, height } = table.querySelector('[data-game-surface]')!.getBoundingClientRect();
    return { x: x - origin.x, y: y - origin.y, width, height };
  });
};
const handCards = (canvasElement: HTMLElement) => canvasElement.querySelectorAll('[data-ui="game-hand"] [data-ui~="game-card"]');

export const StableSurface: Story = {
  name: 'Stable surface',
  tags: ['!autodocs'],
  render: () => <StableSurfaceExample />,
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelectorAll('[data-game-surface]:not([data-layout-fit="measuring"])')).toHaveLength(2));
    const empty = await surfaceBoxes(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Deal hand' }));
    await expect(handCards(canvasElement)).toHaveLength(6);
    await expect(await surfaceBoxes(canvasElement)).toEqual(empty);
    const narrow = canvasElement.querySelectorAll<HTMLElement>('[data-ui="truco-table"]')[1]!;
    await expect(narrow.querySelector('[data-ui~="game-actions"]')!.getBoundingClientRect().top)
      .toBeGreaterThanOrEqual(narrow.querySelector('[data-ui~="game-hand"]')!.getBoundingClientRect().bottom);
    await userEvent.click(canvas.getByRole('button', { name: 'Clear hand' }));
    await expect(handCards(canvasElement)).toHaveLength(0);
    await expect(await surfaceBoxes(canvasElement)).toEqual(empty);
  },
};

export const EmptyCommands: Story = {
  name: 'Empty commands',
  tags: ['!autodocs'],
  render: () => <DocsStage>
    <TrucoTable players={SEATS.slice(0, 2)} title="Truco" dock={0} actions={[{ key: 'pass', label: 'Pass' }]} />
  </DocsStage>,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<HTMLElement>('[data-ui="truco-table"]');
    await expect(table).not.toBeNull();
    await expect(within(table!).getByRole('button', { name: 'Pass' })).toBeVisible();
  },
};

export const EmptyTable: Story = {
  name: 'Empty table',
  tags: ['!autodocs'],
  render: () => <DocsStage><TrucoTable players={[]} title="Truco" /></DocsStage>,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<HTMLElement>('[data-ui="truco-table"]');
    await expect(table).not.toBeNull();
    await expect(table!.querySelectorAll('[data-ui="game-table-seat"]')).toHaveLength(2);
    await expect(table!.querySelectorAll('[data-truco-seat]')).toHaveLength(0);
  },
};
