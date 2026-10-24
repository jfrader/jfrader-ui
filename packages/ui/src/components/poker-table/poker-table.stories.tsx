import { useState } from 'react';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '@jfrader/ui';
import { Button } from '@jfrader/ui/button';
import { useFlightQueue } from '@jfrader/ui/flights';
import { expectInside } from '../../testing/geometry-assertions';
import {
  PokerTable,
  type PokerTableCard,
  type PokerTablePlayer,
  type PokerTableProps,
} from '@jfrader/ui/poker-table';

const DocsStage = styled.div({
  inlineSize: '100%',
  maxInlineSize: 640,
  blockSize: 640,
  marginInline: 'auto',
});
const NarrowStage = styled(DocsStage)({ inlineSize: 390, blockSize: 844 });

const pokerCard = (id: string, label: string, suit: string, rank: string | number): PokerTableCard => ({
  id,
  label,
  value: { suit, rank },
});

const ACE_SPADES = pokerCard('ace-spades', 'Ace of spades', 'spades', 'A');
const KING_SPADES = pokerCard('king-spades', 'King of spades', 'spades', 'K');
const QUEEN_SPADES = pokerCard('queen-spades', 'Queen of spades', 'spades', 'Q');
const JACK_SPADES = pokerCard('jack-spades', 'Jack of spades', 'spades', 'J');
const TEN_SPADES = pokerCard('ten-spades', 'Ten of spades', 'spades', 10);
const TWO_HEARTS = pokerCard('two-hearts', 'Two of hearts', 'hearts', 2);
const THREE_DIAMONDS = pokerCard('three-diamonds', 'Three of diamonds', 'diamonds', 3);

const YOUR_CARDS = [ACE_SPADES, KING_SPADES];
const BOARD = [QUEEN_SPADES, JACK_SPADES, TEN_SPADES, TWO_HEARTS, THREE_DIAMONDS];
const SHOWDOWN = {
  alex: [pokerCard('nine-hearts', 'Nine of hearts', 'hearts', 9), pokerCard('nine-diamonds', 'Nine of diamonds', 'diamonds', 9)],
  blair: [pokerCard('ace-hearts', 'Ace of hearts', 'hearts', 'A'), pokerCard('queen-diamonds', 'Queen of diamonds', 'diamonds', 'Q')],
  drew: [pokerCard('eight-clubs', 'Eight of clubs', 'clubs', 8), pokerCard('seven-clubs', 'Seven of clubs', 'clubs', 7)],
  emery: [pokerCard('king-diamonds', 'King of diamonds', 'diamonds', 'K'), pokerCard('jack-hearts', 'Jack of hearts', 'hearts', 'J')],
  frankie: [pokerCard('six-spades', 'Six of spades', 'spades', 6), pokerCard('six-hearts', 'Six of hearts', 'hearts', 6)],
} satisfies Record<string, readonly PokerTableCard[]>;

type PlayerKey = keyof typeof SHOWDOWN | 'you';

interface Seat extends PokerTablePlayer {
  key: PlayerKey;
}

const SEATS: readonly Seat[] = [
  { key: 'alex', name: 'Alex', chips: 1240 },
  { key: 'blair', name: 'Blair', chips: 980, dealer: true },
  { key: 'you', name: 'You', chips: 1500, isMe: true },
  { key: 'drew', name: 'Drew', chips: 760 },
  { key: 'emery', name: 'Emery', chips: 2100 },
  { key: 'frankie', name: 'Frankie', chips: 640 },
];

const TURN = { remainingMs: 45000, durationMs: 60000 };
const DENOMINATIONS = [25, 5, 1] as const;

type Street = 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'folded';

interface GameState {
  street: Street;
  pot: number;
  board: number;
  deal: number;
  message: string;
  potFrom?: string;
}

const START: GameState = {
  street: 'idle',
  pot: 0,
  board: 0,
  deal: 0,
  message: 'Blinds 10 / 20 · Six seats',
};

const STREET_LABELS: Record<Street, string> = {
  idle: 'Waiting',
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
  folded: 'Hand over',
};

function playerCards(key: PlayerKey, street: Street) {
  if (street === 'idle') return undefined;
  if (key === 'you') return YOUR_CARDS;
  return street === 'showdown' ? SHOWDOWN[key] : undefined;
}

function act(state: GameState, action: string): GameState {
  if (action === 'deal') return { ...state, street: 'preflop', pot: 30, deal: state.deal + 1, message: 'Blinds posted · Your turn' };
  if (action === 'new') return { ...START, deal: state.deal, message: START.message };
  if (action === 'fold') return { ...state, street: 'folded', message: 'You fold · Blair takes the pot' };
  if (state.street === 'preflop') {
    return { ...state, street: 'flop', board: 3, pot: state.pot + (action === 'raise' ? 100 : 40),
      message: action === 'raise' ? 'You raise to 60 · Blair calls · Flop: Q♠ J♠ 10♠' : 'Blair calls 20 · Flop: Q♠ J♠ 10♠' };
  }
  if (state.street === 'flop') {
    return { ...state, street: 'turn', board: 4, pot: state.pot + (action === 'raise' ? 120 : 80),
      message: action === 'raise' ? 'You bet 40 · Blair calls · Turn: 2♥' : 'Drew checks · Turn: 2♥' };
  }
  if (state.street === 'turn') {
    return { ...state, street: 'river', board: 5, pot: state.pot + (action === 'raise' ? 200 : 160),
      message: action === 'raise' ? 'You bet 80 · Drew calls · River: 3♦' : 'Emery checks · River: 3♦' };
  }
  if (state.street === 'river') {
    return { ...state, street: 'showdown', pot: state.pot + (action === 'raise' ? 240 : 0),
      message: 'You win with a royal flush' };
  }
  return state;
}

function actionsFor(street: Street, play: (action: string) => void, busy: boolean) {
  if (street === 'idle') return [{ key: 'deal', label: 'Deal hand', tone: 'accent' as const, disabled: busy, onSelect: () => play('deal') }];
  if (street === 'showdown' || street === 'folded') return [{ key: 'new', label: 'New hand', tone: 'accent' as const, disabled: busy, onSelect: () => play('new') }];
  return [
    { key: 'fold', label: 'Fold', tone: 'danger' as const, variant: 'outline' as const, disabled: busy, onSelect: () => play('fold') },
    { key: 'call', label: street === 'preflop' ? 'Call 20' : 'Check', variant: 'soft' as const, disabled: busy, onSelect: () => play('call') },
    { key: 'raise', label: street === 'preflop' ? 'Raise 60' : `Bet ${street === 'flop' ? 40 : street === 'turn' ? 80 : 120}`,
      tone: 'accent' as const, disabled: busy, onSelect: () => play('raise') },
  ];
}

function PokerGame() {
  const [game, setGame] = useState<GameState>(START);
  const [busy, setBusy] = useState(false);
  const play = (action: string) => setGame(current => ({ ...act(current, action),
    potFrom: action === 'raise' || (action === 'call' && current.street === 'preflop') ? 'you' : undefined }));

  const players: PokerTablePlayer[] = SEATS.map((seat) => {
    const cards = playerCards(seat.key, game.street);
    const reveal = game.street === 'showdown';
    const active = seat.key === 'you' && (game.street === 'preflop' || game.street === 'flop' || game.street === 'turn' || game.street === 'river');
    const winner = (seat.key === 'you' && reveal) || (seat.key === 'blair' && game.street === 'folded');
    return {
      ...seat,
      cards,
      hiddenCards: game.street !== 'idle' && seat.key !== 'you' && !reveal ? 2 : 0,
      state: winner ? 'winner' : active ? 'active' : 'idle',
      turn: active ? TURN : undefined,
      folded: game.street === 'folded' && seat.key === 'you',
    };
  });

  return (
    <DocsStage>
      <PokerTable
        players={players}
        title="Texas Hold'em"
        subtitle={`${STREET_LABELS[game.street]} · Hand 42`}
        board={BOARD.slice(0, game.board)}
        pot={game.pot || undefined}
        chipTransfer={game.potFrom ? { id: `${game.deal}-${game.pot}`, fromPlayerKey: game.potFrom } : undefined}
        denominations={DENOMINATIONS}
        locale="en-US"
        announcement={game.message}
        actions={actionsFor(game.street, play, busy)}
        deal={game.deal}
        onBusyChange={setBusy}
      />
    </DocsStage>
  );
}

const meta = {
  title: 'Games/PokerTable',
  component: PokerTable,
  tags: ['autodocs'],
  args: { players: SEATS, title: "Texas Hold'em" },
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
    docs: {
      description: {
        component: 'Lay out a poker table with seats, stacks, hole cards, a community board, an event line, and commands.',
      },
      sections: [{ title: 'Hooks', stories: ['FlightQueue'] }, { title: 'Chip transfers', stories: ['ChipTransfer'] }, { title: 'The pot', stories: ['Pot'] }, { title: 'A hand', stories: ['PokerHand'] }],
      usage: `### When to use
Use PokerTable for a Hold'em-style table with seats, stacks, hidden or revealed cards, a pot, a community board, and a command bar. The component is presentational: it renders the state you pass and reports commands through the action items' \`onSelect\`. It depicts the pot total you supply using \`denominations\` and never computes that total. Betting rules, turn order, hand ranking, and card values belong to your application.

The seat you mark with \`isMe\` rotates to the front. Push a deal through \`useFlightQueue\` to deal the hole cards and grow \`board\` to reveal community cards; new cards fly from the deck. While cards are in flight, \`onBusyChange\` reports activity so you can disable commands. The table keeps seats on the felt edge on wide containers and moves them inside the felt on narrow ones so the surface uses the available width.

Use the [Flights guide](https://ui.jfrader.com/#/components/flights) for queue outcomes, serial transfers, the pot hold, and snapshot resynchronization.

### Values and constraints

Give the parent container an explicit inline and block size, exactly as for GameTable. \`players\` must contain at least two seats with unique keys; the local player's \`teamIdx\` is ignored because the table is a free-for-all.

### Keyboard and accessibility

The table is a labelled group, the board is a labelled group, and the event line is a polite live region. Every card needs a label. Commands use the GameActions toolbar and keep their native button behavior.`,
    },
  },
  render: () => <PokerGame />,
} satisfies Meta<typeof PokerTable>;
export default meta;
type Story = StoryObj<typeof meta>;

const flights = (document: Document) => document.querySelectorAll('[data-ui="card-flight"], [data-ui="chip-flight-layer"]');
const landed = async (document: Document) => waitFor(() => expect(flights(document)).toHaveLength(0), { timeout: 4000 });

const TransferStage = styled(DocsStage)({
  '& [data-game-surface]': { background: `radial-gradient(ellipse at center, transparent, color-mix(in srgb, ${vars.color.chipInk} 70%, transparent)), repeating-linear-gradient(25deg, transparent 0 2px, color-mix(in srgb, ${vars.color.chipSpot} 3%, transparent) 2px 3px), color-mix(in srgb, ${vars.color.chipGreen} 35%, ${vars.color.chipInk})` },
});
const TRANSFER_PLAYERS: readonly PokerTablePlayer[] = [
  { key: 'you', name: 'You', chips: 1500, isMe: true },
  { key: 'blair', name: 'Blair', chips: 980 },
];
function FlightQueueExample() {
  const queue = useFlightQueue();
  const [pot, setPot] = useState(30);
  return <DocsStage><PokerTable {...queue.props} players={TRANSFER_PLAYERS} title="Texas Hold'em" pot={pot}
    dock={<Button onClick={() => { setPot(current => current + 60); queue.push({ kind: 'transfer', from: 'you', amount: 60 }); }}>Raise 60</Button>} />
  </DocsStage>;
}
export const FlightQueue: Story = {
  name: 'Flight queue', render: () => <FlightQueueExample />,
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { styled } from '@jfrader/ui';
import { Button } from '@jfrader/ui/button';
import { useFlightQueue } from '@jfrader/ui/flights';
import { PokerTable } from '@jfrader/ui/poker-table';

const Stage = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 640, marginInline: 'auto' });
const players = [
  { key: 'you', name: 'You', chips: 1500, isMe: true },
  { key: 'blair', name: 'Blair', chips: 980 },
];
export function Poker() {
  const queue = useFlightQueue();
  const [pot, setPot] = useState(30);
  return <Stage><PokerTable {...queue.props} players={players} title="Texas Hold'em" pot={pot}
    dock={<Button onClick={() => {
      setPot(current => current + 60);
      queue.push({ kind: 'transfer', from: 'you', amount: 60 });
    }}>Raise 60</Button>} /></Stage>;
}` } } },
};
function TransferExample() {
  const queue = useFlightQueue();
  const [pot, setPot] = useState(30);
  return <TransferStage><PokerTable {...queue.props} players={TRANSFER_PLAYERS} title="Texas Hold'em" pot={pot} locale="en-US"
    dock={<Button onClick={() => { setPot(current => current + 60); queue.push({ kind: 'transfer', from: 'you', amount: 60 }); }}>Raise 60</Button>} />
  </TransferStage>;
}
export const ChipTransfer: Story = {
  name: 'Chip transfer', render: () => <TransferExample />,
  parameters: { docs: { source: { code: `import { useState } from 'react';
import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { PokerTable } from '@jfrader/ui/poker-table';
import { Button } from '@jfrader/ui/button';
import { useFlightQueue } from '@jfrader/ui/flights';

const Stage = styled.div({
  inlineSize: '100%', maxInlineSize: 640, blockSize: 640, marginInline: 'auto',
  '& [data-game-surface]': { background: \`radial-gradient(ellipse at center, transparent, color-mix(in srgb, \${vars.color.chipInk} 70%, transparent)), repeating-linear-gradient(25deg, transparent 0 2px, color-mix(in srgb, \${vars.color.chipSpot} 3%, transparent) 2px 3px), color-mix(in srgb, \${vars.color.chipGreen} 35%, \${vars.color.chipInk})\` },
});
const players = [
  { key: 'you', name: 'You', chips: 1500, isMe: true },
  { key: 'blair', name: 'Blair', chips: 980 },
];
export default function Example() {
  const queue = useFlightQueue();
  const [pot, setPot] = useState(30);
  return <Stage>
    <PokerTable {...queue.props} players={players} title="Texas Hold'em" pot={pot} locale="en-US"
      dock={<Button onClick={() => {
        setPot(current => current + 60);
        queue.push({ kind: 'transfer', from: 'you', amount: 60 });
      }}>Raise 60</Button>} />
  </Stage>;
}` } } },
  play: async ({ canvasElement, userEvent }) => {
    const table = canvasElement.querySelector<HTMLElement>('[data-ui="poker-table"]')!;
    const raise = within(table).getByRole('button', { name: 'Raise 60' });
    await userEvent.click(raise);
    await waitFor(() => expect(table.ownerDocument.querySelector('[data-ui="chip-flight-layer"]')).not.toBeNull());
    await expect(table.querySelector('[data-poker-pot]')).toHaveTextContent('Pot30');
    await landed(table.ownerDocument);
    await waitFor(() => expect(table.querySelector('[data-poker-pot]')).toHaveTextContent('Pot90'));
    await userEvent.click(raise);
    const oldLayer = table.ownerDocument.querySelector('[data-ui="chip-flight"]');
    await userEvent.click(raise);
    await expect(oldLayer?.isConnected).toBe(true);
    await waitFor(() => expect(oldLayer?.isConnected).toBe(false), { timeout: 4000 });
    await landed(table.ownerDocument);
    await waitFor(() => expect(table.querySelector('[data-poker-pot]')).toHaveTextContent('Pot210'));
  },
};

export const Pot: Story = {
  args: { pot: 1886, board: BOARD, locale: 'en-US', denominations: [1, 25, 1000, 5, 100, 500] },
  render: args => <DocsStage><PokerTable {...args} /></DocsStage>,
  parameters: { docs: { source: { code: `import { styled } from '@jfrader/ui';
import { PokerTable, type PokerTableCard } from '@jfrader/ui/poker-table';

const Stage = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 640, marginInline: 'auto' });
const players = [
  { key: 'alex', name: 'Alex', chips: 1240 },
  { key: 'blair', name: 'Blair', chips: 980, dealer: true },
  { key: 'you', name: 'You', chips: 1500, isMe: true },
  { key: 'drew', name: 'Drew', chips: 760 },
  { key: 'emery', name: 'Emery', chips: 2100 },
  { key: 'frankie', name: 'Frankie', chips: 640 },
];
const board: PokerTableCard[] = [
  { id: 'queen-spades', label: 'Queen of spades', value: { suit: 'spades', rank: 'Q' } },
  { id: 'jack-spades', label: 'Jack of spades', value: { suit: 'spades', rank: 'J' } },
  { id: 'ten-spades', label: 'Ten of spades', value: { suit: 'spades', rank: 10 } },
  { id: 'two-hearts', label: 'Two of hearts', value: { suit: 'hearts', rank: 2 } },
  { id: 'three-diamonds', label: 'Three of diamonds', value: { suit: 'diamonds', rank: 3 } },
];

<Stage>
  <PokerTable players={players} title="Texas Hold'em" board={board} pot={1886}
    denominations={[1, 25, 1000, 5, 100, 500]} locale="en-US" />
</Stage>` } } },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-ui="poker-table"]')!;
    const stack = table.querySelector('[data-ui="game-chip-stack"]')!;
    await expect(stack).toHaveAttribute('aria-hidden', 'true');
    await expect(stack).not.toHaveAttribute('aria-label');
    await expect(table.querySelector('[data-poker-pot]')).toHaveTextContent('Pot1,886');
    const towers = [...stack.querySelectorAll('[data-ui="game-chip-stack-stack"]')];
    await expect(towers.map(tower => [tower.getAttribute('data-value'), tower.getAttribute('data-count')]))
      .toEqual([['1000', '1'], ['500', '1'], ['100', '3'], ['25', '3'], ['5', '2'], ['1', '1']]);
    const surface = table.querySelector('[data-game-surface]')!;
    await expectInside(table.querySelector('[data-ui="game-table-center"]')!, surface);
    await expectInside(stack, surface);
    await expectInside(within(table as HTMLElement).getByRole('group', { name: 'Community cards' }), surface);
    for (const denominations of [[], [0], [-1], [NaN], [Infinity]]) {
      await expect(() => renderToString(<PokerTable players={SEATS} title="Poker" denominations={denominations} />))
        .toThrow(RangeError);
      await expect(() => renderToString(<PokerTable players={SEATS} title="Poker" denominations={denominations} />))
        .toThrow('PokerTable denominations must contain at least one positive, finite value.');
    }
    for (const pot of [undefined, 0]) {
      await expect(renderToString(<PokerTable players={SEATS} title="Poker" pot={pot} />)).not.toContain('game-chip-stack');
    }
  },
};

export const FractionalPot: Story = {
  tags: ['!autodocs'], args: { pot: 0.35, denominations: [0.1, 0.2, 0.1], locale: 'en-US' },
  render: args => <DocsStage><PokerTable {...args} /></DocsStage>,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-ui="poker-table"]')!;
    await expect(table.querySelector('[data-poker-pot]')).toHaveTextContent('Pot0.35');
    await expect([...table.querySelectorAll('[data-ui="game-chip-stack-stack"]')].map(tower => [tower.getAttribute('data-value'), tower.getAttribute('data-count')]))
      .toEqual([['0.2', '1'], ['0.1', '1']]);
  },
};

export const NarrowPot: Story = {
  tags: ['!autodocs'], args: Pot.args,
  render: args => <NarrowStage><PokerTable {...args} /></NarrowStage>,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<HTMLElement>('[data-ui="poker-table"]')!;
    await expect(table.getBoundingClientRect().width).toBe(390);
    await expect(table.getBoundingClientRect().height).toBe(844);
    const surface = table.querySelector('[data-game-surface]')!;
    const pot = table.querySelector('[data-poker-pot-group]')!;
    const stack = pot.querySelector('[data-ui="game-chip-stack"]')!;
    await expectInside(pot, surface);
    await expectInside(stack, surface);
    await expectInside(within(table).getByRole('group', { name: 'Community cards' }), surface);
    for (const tower of stack.querySelectorAll('[data-ui="game-chip-stack-stack"]')) await expectInside(tower, pot);
  },
};

export const PokerHand: Story = {
  name: 'Poker hand',
  parameters: {
    docs: {
      description: {
        story: 'Deal a hand, call or raise through the streets, and reach a showdown. Every action is a prop; the script lives in this example, not in the component.',
      },
      source: { language: 'tsx', code: `import { useState } from 'react';
import { styled } from '@jfrader/ui';
import {
  PokerTable,
  type PokerTableCard,
  type PokerTablePlayer,
} from '@jfrader/ui/poker-table';

const Stage = styled.div({
  inlineSize: '100%',
  maxInlineSize: 640,
  blockSize: 640,
  marginInline: 'auto',
});

const card = (id: string, label: string, suit: string, rank: string | number): PokerTableCard => ({
  id,
  label,
  value: { suit, rank },
});

const yourCards = [
  card('ace-spades', 'Ace of spades', 'spades', 'A'),
  card('king-spades', 'King of spades', 'spades', 'K'),
];
const board = [
  card('queen-spades', 'Queen of spades', 'spades', 'Q'),
  card('jack-spades', 'Jack of spades', 'spades', 'J'),
  card('ten-spades', 'Ten of spades', 'spades', 10),
  card('two-hearts', 'Two of hearts', 'hearts', 2),
  card('three-diamonds', 'Three of diamonds', 'diamonds', 3),
];
const showdown = {
  alex: [card('nine-hearts', 'Nine of hearts', 'hearts', 9), card('nine-diamonds', 'Nine of diamonds', 'diamonds', 9)],
  blair: [card('ace-hearts', 'Ace of hearts', 'hearts', 'A'), card('queen-diamonds', 'Queen of diamonds', 'diamonds', 'Q')],
  drew: [card('eight-clubs', 'Eight of clubs', 'clubs', 8), card('seven-clubs', 'Seven of clubs', 'clubs', 7)],
  emery: [card('king-diamonds', 'King of diamonds', 'diamonds', 'K'), card('jack-hearts', 'Jack of hearts', 'hearts', 'J')],
  frankie: [card('six-spades', 'Six of spades', 'spades', 6), card('six-hearts', 'Six of hearts', 'hearts', 6)],
};

const seats = [
  { key: 'alex', name: 'Alex', chips: 1240 },
  { key: 'blair', name: 'Blair', chips: 980, dealer: true },
  { key: 'you', name: 'You', chips: 1500, isMe: true },
  { key: 'drew', name: 'Drew', chips: 760 },
  { key: 'emery', name: 'Emery', chips: 2100 },
  { key: 'frankie', name: 'Frankie', chips: 640 },
] satisfies readonly PokerTablePlayer[];

type Street = 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'folded';

const STREET_LABELS: Record<Street, string> = {
  idle: 'Waiting',
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
  folded: 'Hand over',
};

const turn = { remainingMs: 45000, durationMs: 60000 };
const denominations = [25, 5, 1] as const;

export default function Example() {
  const [street, setStreet] = useState<Street>('idle');
  const [pot, setPot] = useState(0);
  const [potFrom, setPotFrom] = useState<string>();
  const [boardCount, setBoardCount] = useState(0);
  const [deal, setDeal] = useState(0);
  const [message, setMessage] = useState('Blinds 10 / 20 · Six seats');
  const [busy, setBusy] = useState(false);

  const play = (action: string) => {
    setPotFrom(action === 'raise' || (action === 'call' && street === 'preflop') ? 'you' : undefined);
    if (action === 'deal') {
      setStreet('preflop');
      setPot(30);
      setDeal((value) => value + 1);
      setMessage('Blinds posted · Your turn');
      return;
    }
    if (action === 'new') {
      setStreet('idle');
      setPot(0);
      setBoardCount(0);
      setMessage('Blinds 10 / 20 · Six seats');
      return;
    }
    if (action === 'fold') {
      setStreet('folded');
      setMessage('You fold · Blair takes the pot');
      return;
    }
    if (street === 'preflop') {
      setStreet('flop');
      setBoardCount(3);
      setPot((value) => value + (action === 'raise' ? 100 : 40));
      setMessage(action === 'raise' ? 'You raise to 60 · Blair calls · Flop: Q♠ J♠ 10♠' : 'Blair calls 20 · Flop: Q♠ J♠ 10♠');
      return;
    }
    if (street === 'flop') {
      setStreet('turn');
      setBoardCount(4);
      setPot((value) => value + (action === 'raise' ? 120 : 80));
      setMessage(action === 'raise' ? 'You bet 40 · Blair calls · Turn: 2♥' : 'Drew checks · Turn: 2♥');
      return;
    }
    if (street === 'turn') {
      setStreet('river');
      setBoardCount(5);
      setPot((value) => value + (action === 'raise' ? 200 : 160));
      setMessage(action === 'raise' ? 'You bet 80 · Drew calls · River: 3♦' : 'Emery checks · River: 3♦');
      return;
    }
    if (street === 'river') {
      setStreet('showdown');
      setPot((value) => value + (action === 'raise' ? 240 : 0));
      setMessage('You win with a royal flush');
    }
  };

  const active = street === 'preflop' || street === 'flop' || street === 'turn' || street === 'river';
  const reveal = street === 'showdown';
  const players: PokerTablePlayer[] = seats.map((seat) => ({
    ...seat,
    cards: seat.key === 'you'
      ? street === 'idle' ? undefined : yourCards
      : reveal ? showdown[seat.key as keyof typeof showdown] : undefined,
    hiddenCards: street !== 'idle' && seat.key !== 'you' && !reveal ? 2 : 0,
    state: (seat.key === 'you' && reveal) || (seat.key === 'blair' && street === 'folded')
      ? 'winner'
      : seat.key === 'you' && active ? 'active' : 'idle',
    turn: seat.key === 'you' && active ? turn : undefined,
    folded: seat.key === 'you' && street === 'folded',
  }));

  const actions = street === 'idle'
    ? [{ key: 'deal', label: 'Deal hand', tone: 'accent' as const, disabled: busy, onSelect: () => play('deal') }]
    : street === 'showdown' || street === 'folded'
      ? [{ key: 'new', label: 'New hand', tone: 'accent' as const, disabled: busy, onSelect: () => play('new') }]
      : [
        { key: 'fold', label: 'Fold', tone: 'danger' as const, variant: 'outline' as const, disabled: busy, onSelect: () => play('fold') },
        { key: 'call', label: street === 'preflop' ? 'Call 20' : 'Check', variant: 'soft' as const, disabled: busy, onSelect: () => play('call') },
        { key: 'raise', label: street === 'preflop' ? 'Raise 60' : 'Bet ' + (street === 'flop' ? 40 : street === 'turn' ? 80 : 120),
          tone: 'accent' as const, disabled: busy, onSelect: () => play('raise') },
      ];

  return (
    <Stage>
      <PokerTable
        players={players}
        title="Texas Hold'em"
        subtitle={STREET_LABELS[street] + ' · Hand 42'}
        board={board.slice(0, boardCount)}
        pot={pot || undefined}
        chipTransfer={potFrom ? { id: deal + '-' + pot, fromPlayerKey: potFrom } : undefined}
        denominations={denominations}
        locale="en-US"
        announcement={message}
        actions={actions}
        deal={deal}
        onBusyChange={setBusy}
      />
    </Stage>
  );
}
` },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const table = canvasElement.querySelector<HTMLElement>('[data-ui="poker-table"]');
    await expect(table).not.toBeNull();
    const canvas = within(table!);
    const seats = table!.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]');
    await expect(seats).toHaveLength(6);
    await expect(table!.querySelectorAll('[data-ui="game-hand-hidden-card"]'), 'initial hidden cards').toHaveLength(0);
    await expect(canvas.getByRole('status')).toHaveTextContent('Blinds 10 / 20');

    const dealButton = canvas.getByRole('button', { name: 'Deal hand' });
    await userEvent.tab();
    await expect(table!.ownerDocument.activeElement).toBe(dealButton);
    await expect(getComputedStyle(dealButton).outlineStyle).not.toBe('none');

    await userEvent.click(dealButton);
    const fold = canvas.getByRole('button', { name: 'Fold' });
    if (canvasElement.ownerDocument.querySelector('[data-ui="card-flight"]')) {
      await expect(fold).toHaveAttribute('aria-disabled', 'true');
    }
    await landed(canvasElement.ownerDocument);
    await expect(fold).not.toHaveAttribute('aria-disabled', 'true');
    await expect(table!.querySelectorAll('[data-ui="game-hand-hidden-card"]'), 'dealt hidden cards').toHaveLength(10);
    await expect(table!.querySelectorAll('[data-ui="game-table-seat"] [data-ui~="game-card"]')).toHaveLength(12);
    await expect(canvas.getByRole('status')).toHaveTextContent('Your turn');
    await expect(canvas.getByRole('button', { name: 'Call 20' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Raise 60' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Fold' })).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: 'Call 20' }));
    await landed(canvasElement.ownerDocument);
    await expect(table!.querySelectorAll('[data-board-card]'), 'flop cards').toHaveLength(3);
    await expect(canvas.getByRole('status')).toHaveTextContent('Flop');

    await userEvent.click(canvas.getByRole('button', { name: 'Check' }));
    await landed(canvasElement.ownerDocument);
    await expect(table!.querySelectorAll('[data-board-card]'), 'turn cards').toHaveLength(4);
    await expect(canvas.getByRole('status')).toHaveTextContent('Turn');

    await userEvent.click(canvas.getByRole('button', { name: 'Check' }));
    await landed(canvasElement.ownerDocument);
    await expect(table!.querySelectorAll('[data-board-card]'), 'river cards').toHaveLength(5);
    await expect(canvas.getByRole('status')).toHaveTextContent('River');

    await userEvent.click(canvas.getByRole('button', { name: 'Check' }));
    await landed(canvasElement.ownerDocument);
    await expect(canvas.getByRole('status')).toHaveTextContent('royal flush');
    await expect(table!.querySelectorAll('[data-ui="game-hand-hidden-card"]')).toHaveLength(0);
    await expect(table!.querySelectorAll('[data-ui="game-table-seat"] [data-ui~="game-card"]')).toHaveLength(12);
    await expect(table!.querySelectorAll('[data-ui="game-seat"][data-state="winner"]')).toHaveLength(1);
    await expect(canvas.getByRole('button', { name: 'New hand' })).toBeVisible();

    const surface = table!.querySelector<HTMLElement>('[data-game-surface]');
    if (!surface) throw new Error('Missing surface');
    for (const seat of seats) await expectInside(seat, table!);
    await expectInside(table!.querySelector<HTMLElement>('[data-ui="game-table-center"]')!, surface);

    await userEvent.click(canvas.getByRole('button', { name: 'New hand' }));
    await expect(table!.querySelectorAll('[data-board-card]'), 'reset board').toHaveLength(0);
    await expect(canvas.getByRole('button', { name: 'Deal hand' })).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: 'Deal hand' }));
    await landed(canvasElement.ownerDocument);
    await userEvent.click(canvas.getByRole('button', { name: 'Fold' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('You fold');
    await expect(canvas.getByRole('button', { name: 'New hand' })).toBeVisible();
    await expect(table!.querySelectorAll('[data-ui="game-seat"][data-state="winner"]')).toHaveLength(1);

    await userEvent.click(canvas.getByRole('button', { name: 'New hand' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Deal hand' }));
    await landed(canvasElement.ownerDocument);
    await expect(canvas.getByRole('button', { name: 'Call 20' })).toBeVisible();
  },
};

export const EmptyCommands: Story = {
  name: 'Empty commands',
  tags: ['!autodocs'],
  render: () => <DocsStage>
    <PokerTable players={SEATS.slice(0, 2)} title="Poker" dock={0} actions={[{ key: 'check', label: 'Check' }]} />
  </DocsStage>,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<HTMLElement>('[data-ui="poker-table"]');
    await expect(table).not.toBeNull();
    await expect(within(table!).getByRole('button', { name: 'Check' })).toBeVisible();
  },
};

export const EmptyTable: Story = {
  name: 'Empty table',
  tags: ['!autodocs'],
  render: () => <DocsStage><PokerTable players={[]} title="Poker" /></DocsStage>,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector<HTMLElement>('[data-ui="poker-table"]');
    await expect(table).not.toBeNull();
    await expect(table!.querySelectorAll('[data-ui="game-table-seat"]')).toHaveLength(2);
    await expect(table!.querySelectorAll('[data-poker-seat]')).toHaveLength(0);
  },
};

function PotFlightExample({ onBusyChange, from = 'you' }: { onBusyChange?: (busy: boolean) => void; from?: string }) {
  const [pot, setPot] = useState(30);
  const [busy, setBusy] = useState(false);
  return <DocsStage><PokerTable players={SEATS} title="Texas Hold'em" subtitle="Preflop · Hand 42" pot={pot}
    potFrom={from} denominations={DENOMINATIONS} locale="en-US"
    onBusyChange={value => { setBusy(value); onBusyChange?.(value); }}
    actions={[{ key: 'raise', label: 'Raise 60', tone: 'accent', disabled: busy, onSelect: () => setPot(value => value + 100) }]} />
  </DocsStage>;
}
export const PotFlight: Story = {
  tags: ['!autodocs'], args: { onBusyChange: fn() },
  render: args => <PotFlightExample onBusyChange={args.onBusyChange} />,
  play: async ({ canvasElement, args, userEvent }) => {
    const table = canvasElement.querySelector<HTMLElement>('[data-ui="poker-table"]')!;
    const canvas = within(table);
    await userEvent.click(canvas.getByRole('button', { name: 'Raise 60' }));
    await waitFor(() => expect(table.ownerDocument.querySelector('[data-ui="chip-flight-layer"]')).not.toBeNull());
    await expect(table.querySelector('[data-poker-pot]')).toHaveTextContent('Pot30');
    await expect(args.onBusyChange).toHaveBeenCalledWith(true);
    await expect(canvas.getByRole('button', { name: 'Raise 60' })).toHaveAttribute('aria-disabled', 'true');
    await landed(table.ownerDocument);
    await waitFor(() => expect(table.querySelector('[data-poker-pot]')).toHaveTextContent('Pot130'));
    await expect(args.onBusyChange).toHaveBeenLastCalledWith(false);
    await expect(table.ownerDocument.querySelectorAll('[data-ui="chip-flight"]')).toHaveLength(0);
  },
};
export const PotFlightReducedMotion: Story = {
  name: 'Poker chips reduced motion', tags: ['!autodocs'], args: { onBusyChange: fn() },
  render: args => <PotFlightExample onBusyChange={args.onBusyChange} />,
  play: async ({ canvasElement, args, userEvent }) => {
    const table = canvasElement.querySelector<HTMLElement>('[data-ui="poker-table"]')!;
    await expect(table.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    await userEvent.click(within(table).getByRole('button', { name: 'Raise 60' }));
    await waitFor(() => expect(table.querySelector('[data-poker-pot]')).toHaveTextContent('Pot130'));
    await expect(table.ownerDocument.querySelector('[data-ui="chip-flight-layer"]')).toBeNull();
    await expect(args.onBusyChange).not.toHaveBeenCalledWith(true);
  },
};
export const PotFlightMissingSeat: Story = {
  tags: ['!autodocs'], render: () => <PotFlightExample from="missing-seat" />,
  play: async ({ canvasElement, userEvent }) => {
    const table = canvasElement.querySelector<HTMLElement>('[data-ui="poker-table"]')!;
    const warn = console.warn;
    const warning = fn(warn);
    console.warn = warning;
    try {
      await userEvent.click(within(table).getByRole('button', { name: 'Raise 60' }));
      await expect(warning).toHaveBeenCalledWith('PokerTable: unknown player key "missing-seat".');
    } finally { console.warn = warn; }
    await waitFor(() => expect(table.querySelector('[data-poker-pot]')).toHaveTextContent('Pot130'));
    await expect(table.ownerDocument.querySelector('[data-ui="chip-flight-layer"]')).toBeNull();
  },
};

function TransferEdgeExample() {
  const [state, setState] = useState({ pot: 30, id: 0, fromPlayerKey: 'you' });
  return <DocsStage><PokerTable players={TRANSFER_PLAYERS} title="Poker" pot={state.pot} locale="en-US"
    chipTransfer={state} dock={<>
      <Button onClick={() => setState(current => ({ ...current, pot: current.pot + 60 }))}>Same id</Button>
      <Button onClick={() => setState(current => ({ ...current, id: current.id + 1 }))}>No increase</Button>
      <Button onClick={() => setState(current => ({ pot: current.pot + 60, id: current.id + 1, fromPlayerKey: 'unknown' }))}>Unknown seat</Button>
      <Button onClick={() => setState(current => ({ pot: current.pot + 60, id: current.id + 1, fromPlayerKey: 'you' }))}>Transfer</Button>
    </>} /></DocsStage>;
}
export const TransferEdges: Story = {
  tags: ['!autodocs'], render: () => <TransferEdgeExample />,
  play: async ({ canvasElement, userEvent }) => {
    const table = canvasElement.querySelector<HTMLElement>('[data-ui="poker-table"]')!;
    const canvas = within(table);
    const pot = table.querySelector('[data-poker-pot]');
    const noFlight = async () => expect(table.ownerDocument.querySelector('[data-ui="chip-flight-layer"]')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Same id' }));
    await expect(pot).toHaveTextContent('Pot90');
    await noFlight();
    await userEvent.click(canvas.getByRole('button', { name: 'No increase' }));
    await expect(pot).toHaveTextContent('Pot90');
    await noFlight();
    const warn = console.warn;
    const warning = fn(warn);
    console.warn = warning;
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Unknown seat' }));
      await expect(warning).toHaveBeenCalledWith('PokerTable: unknown player key "unknown".');
    } finally { console.warn = warn; }
    await expect(pot).toHaveTextContent('Pot150');
    await noFlight();
    table.querySelector('[data-slot-player="you"] [data-ui~="game-seat"]')?.remove();
    table.querySelector('[data-slot-player="you"]')?.remove();
    await userEvent.click(canvas.getByRole('button', { name: 'Transfer' }));
    await expect(pot).toHaveTextContent('Pot210');
    await noFlight();
  },
};
