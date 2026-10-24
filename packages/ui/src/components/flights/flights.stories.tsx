import { useLayoutEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor } from 'storybook/test';
import { styled } from '../../index';
import { vars } from '@jfrader/tokens/vars';
import { Button } from '../button';
import { PokerTable } from '../poker-table';
import { CardFlights } from '../card-flights';
import { GameCard } from '../game-card';
import { useFlightQueue } from './index';
import type { FlightEvent, FlightEventInput, FlightOutcome } from './index';

const Stage = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 640, marginInline: 'auto' });
const Controls = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2], padding: vars.space[2] });
const Output = styled.output({ display: 'block', color: vars.color.text, backgroundColor: vars.color.bg });
const CardStage = styled.div({ display: 'flex', gap: vars.space[8], padding: vars.space[4] });
const players = [{ key: 'you', name: 'You', chips: 200, isMe: true, hiddenCards: 2 }, { key: 'rival', name: 'Rival', chips: 200, hiddenCards: 2 }];

function QueueTable({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const queue = useFlightQueue();
  const [pot, setPot] = useState(100);
  const [outcomes, setOutcomes] = useState<FlightOutcome[]>([]);
  const [, rerender] = useState(0);
  const [manual, setManual] = useState<FlightEvent | null>(null);
  const [edges, setEdges] = useState<boolean[]>([]);
  const lastBusy = useRef(false);
  useLayoutEffect(() => {
    if (lastBusy.current !== queue.busy) { lastBusy.current = queue.busy; setEdges(current => [...current, queue.busy]); }
  }, [queue.busy]);
  const push = (event: FlightEventInput) => {
    const handle = queue.push(event);
    void handle.result.then(outcome => setOutcomes(current => [...current, outcome]));
    return handle;
  };
  return <>
    <Controls>
      <Button onClick={() => push({ kind: 'transfer', from: 'you', amount: 25 })}>Transfer</Button>
      <Button onClick={() => { setPot(175); push({ kind: 'transfer', from: 'you', amount: 25 }); push({ kind: 'transfer', from: 'rival', amount: 50 }); }}>Two transfers</Button>
      <Button onClick={() => { push({ kind: 'deal' }); push({ kind: 'deal' }); }}>Two deals</Button>
      <Button onClick={() => push({ kind: 'deal' })}>Deal</Button>
      <Button onClick={() => push({ kind: 'resync' })}>Resync</Button>
      <Button onClick={() => push({ kind: 'transfer', from: 'missing', amount: 25 })}>Unknown player</Button>
      <Button onClick={() => rerender(current => current + 1)}>Rerender</Button>
      <Button onClick={() => queue.cancel()}>Cancel</Button>
      <Button onClick={() => { push({ kind: 'transfer', from: 'you', amount: 25 }); push({ kind: 'transfer', from: 'rival', amount: 25 }); push({ kind: 'deal' }); push({ kind: 'resync' }); }}>Resync batch</Button>
      <Button onClick={() => { setPot(250); push({ kind: 'resync' }); push({ kind: 'transfer', from: 'you', amount: 25 }); }}>Resync then transfer</Button>
      <Button onClick={() => setManual({ id: 'manual', kind: 'transfer', from: 'you', amount: 25 })}>Manual event</Button>
      <Button onClick={() => setManual(null)}>Remove manual</Button>
    </Controls>
    <Output aria-label="Queue busy">{String(queue.busy)}</Output>
    <Output aria-label="Queue size">{queue.events.length}</Output>
    <Output aria-label="Outcomes">{JSON.stringify(outcomes)}</Output>
    <Output aria-label="Busy edges">{JSON.stringify(edges)}</Output>
    <Stage><PokerTable {...queue.props} flights={manual ? [...queue.events, manual] : queue.events} onBusyChange={onBusyChange} title="Poker" players={players} pot={pot} locale="en-US" /></Stage>
  </>;
}

function QueueDemo() {
  const queue = useFlightQueue();
  return <>
    <Button onClick={() => queue.push({ kind: 'transfer', from: 'you', amount: 25 })}>Transfer</Button>
    <Stage><PokerTable {...queue.props} title="Poker" players={players} pot={100} /></Stage>
  </>;
}

const meta = {
  title: 'Games/Flights',
  tags: ['autodocs'],
  args: { onBusyChange: fn() },
  render: args => <QueueTable {...args} />,
  parameters: { docs: {
    description: { component: 'Queue card deals, chip transfers, and snapshot resynchronization.' },
    usage: 'Push events from the interaction that updates your game state. See the [Flights guide](https://ui.jfrader.com/#/components/flights) for lane policies, outcomes, and custom chip surfaces.',
    sections: [{ title: 'Hooks', stories: ['Queue'] }],
  } },
} satisfies Meta<{ onBusyChange: (busy: boolean) => void }>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Queue: Story = {
  render: () => <QueueDemo />,
  parameters: { docs: { source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { Button } from '@jfrader/ui/button';
import { useFlightQueue } from '@jfrader/ui/flights';
import { PokerTable } from '@jfrader/ui/poker-table';

const Stage = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 640, marginInline: 'auto' });
export function Poker() {
  const queue = useFlightQueue();
  const players = [
    { key: 'you', name: 'You', chips: 200, isMe: true, hiddenCards: 2 },
    { key: 'rival', name: 'Rival', chips: 200, hiddenCards: 2 },
  ];
  return <>
    <Button onClick={() => queue.push({ kind: 'transfer', from: 'you', amount: 25 })}>Transfer</Button>
    <Stage><PokerTable {...queue.props} title="Poker" players={players} pot={100} /></Stage>
  </>;
}` } } },
};

export const UnchangedPot: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const doc = canvasElement.ownerDocument;
    await userEvent.click(canvas.getByRole('button', { name: 'Transfer' }));
    await waitFor(() => expect(doc.querySelectorAll('[data-ui="chip-flight-layer"]')).toHaveLength(1));
    await expect(canvasElement.querySelector('[data-poker-pot]')).toHaveTextContent('Pot100');
    await waitFor(() => expect(canvas.getByLabelText('Outcomes')).toHaveTextContent('"landed"'), { timeout: 6000 });
    await expect(canvas.getByLabelText('Queue busy')).toHaveTextContent('false');
    await expect(canvas.getByLabelText('Queue size')).toHaveTextContent('0');
    await expect(doc.querySelectorAll('[data-ui="chip-flight-layer"]')).toHaveLength(0);
  },
};

export const SerialTransfers: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const doc = canvasElement.ownerDocument;
    const layers: number[] = [];
    const observer = new MutationObserver(() => layers.push(doc.querySelectorAll('[data-ui="chip-flight-layer"]').length));
    observer.observe(doc.body, { subtree: true, childList: true });
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Two transfers' }));
      await waitFor(() => expect(doc.querySelectorAll('[data-ui="chip-flight-layer"]')).toHaveLength(1));
      await expect(canvas.getByLabelText('Queue size')).toHaveTextContent('2');
      await expect(canvasElement.querySelector('[data-poker-pot]')).toHaveTextContent('Pot100');
      await userEvent.click(canvas.getByRole('button', { name: 'Rerender' }));
      await expect(canvas.getByLabelText('Queue size')).toHaveTextContent('2');
      await waitFor(() => expect(canvas.getByLabelText('Queue size')).toHaveTextContent('1'), { timeout: 6000 });
      await expect(canvasElement.querySelector('[data-poker-pot]')).toHaveTextContent('Pot100');
      await waitFor(() => expect(canvas.getByLabelText('Queue size')).toHaveTextContent('0'), { timeout: 6000 });
      await expect(JSON.parse(canvas.getByLabelText('Outcomes').textContent!)).toEqual([{ status: 'landed' }, { status: 'landed' }]);
      await expect(canvasElement.querySelector('[data-poker-pot]')).toHaveTextContent('Pot175');
      await expect(canvas.getByLabelText('Busy edges')).toHaveTextContent('[true,false]');
      await expect(Math.max(...layers)).toBe(1);
      await expect(args.onBusyChange).toHaveBeenCalledTimes(3);
    } finally { observer.disconnect(); }
  },
};

export const LatestDeal: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Two deals' }));
    await waitFor(() => expect(canvas.getByLabelText('Outcomes')).toHaveTextContent('"cancelled"'));
    await expect(canvas.getByLabelText('Queue size')).toHaveTextContent('1');
    await userEvent.click(canvas.getByRole('button', { name: 'Rerender' }));
    await waitFor(() => expect(canvas.getByLabelText('Queue size')).toHaveTextContent('0'), { timeout: 6000 });
    await expect(JSON.parse(canvas.getByLabelText('Outcomes').textContent!)).toEqual([{ status: 'cancelled' }, { status: 'landed' }]);
  },
};

export const Resync: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Two transfers' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Deal' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Resync' }));
    await waitFor(() => expect(canvas.getByLabelText('Queue size')).toHaveTextContent('0'));
    const results: FlightOutcome[] = JSON.parse(canvas.getByLabelText('Outcomes').textContent!);
    await expect(results.filter(outcome => outcome.status === 'cancelled')).toHaveLength(3);
    await expect(results).toContainEqual({ status: 'skipped', reason: 'resync' });
    await expect(canvasElement.ownerDocument.querySelectorAll('[data-ui="chip-flight-layer"], [data-card-flight]')).toHaveLength(0);
    await expect(canvasElement.querySelector('[data-poker-pot]')).toHaveTextContent('Pot175');
  },
};

export const ResyncBoundary: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Resync batch' }));
    await waitFor(() => expect(canvas.getByLabelText('Queue size')).toHaveTextContent('0'));
    const results: FlightOutcome[] = JSON.parse(canvas.getByLabelText('Outcomes').textContent!);
    await expect(results).toHaveLength(4);
    await expect(results.filter(outcome => outcome.status === 'cancelled')).toHaveLength(3);
    await expect(results).toContainEqual({ status: 'skipped', reason: 'resync' });
  },
};

export const UnknownPlayer: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, userEvent }) => {
    const warning = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Unknown player' }));
      await waitFor(() => expect(canvas.getByLabelText('Outcomes')).toHaveTextContent('"missing-geometry"'));
      await expect(warning).toHaveBeenCalledWith('PokerTable: unknown player key "missing".');
      await expect(canvas.getByLabelText('Queue size')).toHaveTextContent('0');
    } finally { warning.mockRestore(); }
  },
};

export const TransferAfterResync: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Two transfers' }));
    await expect(canvasElement.querySelector('[data-poker-pot]')).toHaveTextContent('Pot100');
    await userEvent.click(canvas.getByRole('button', { name: 'Resync then transfer' }));
    await waitFor(() => expect(canvasElement.ownerDocument.querySelector('[data-ui="chip-flight-layer"]')).not.toBeNull());
    await expect(canvasElement.querySelector('[data-poker-pot]')).toHaveTextContent('Pot250');
    await expect(canvas.getByLabelText('Queue size')).toHaveTextContent('1');
    await waitFor(() => expect(canvas.getByLabelText('Queue size')).toHaveTextContent('0'), { timeout: 6000 });
    const results: FlightOutcome[] = JSON.parse(canvas.getByLabelText('Outcomes').textContent!);
    await expect(results).toHaveLength(4);
    await expect(results.filter(outcome => outcome.status === 'cancelled')).toHaveLength(2);
    await expect(results).toContainEqual({ status: 'skipped', reason: 'resync' });
    await expect(results).toContainEqual({ status: 'landed' });
  },
};

export const Cancel: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Two transfers' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(canvas.getByLabelText('Queue size')).toHaveTextContent('0'));
    await expect(JSON.parse(canvas.getByLabelText('Outcomes').textContent!)).toEqual([{ status: 'cancelled' }, { status: 'cancelled' }]);
  },
};

export const ReducedMotion: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const view = canvasElement.ownerDocument.defaultView!;
    const matchMedia = view.matchMedia;
    view.matchMedia = query => {
      const media = matchMedia.call(view, query);
      if (query === '(prefers-reduced-motion: reduce)') Object.defineProperty(media, 'matches', { value: true });
      return media;
    };
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Two transfers' }));
      await userEvent.click(canvas.getByRole('button', { name: 'Deal' }));
      await waitFor(() => expect(canvas.getByLabelText('Queue size')).toHaveTextContent('0'));
      await expect(JSON.parse(canvas.getByLabelText('Outcomes').textContent!)).toEqual([
        { status: 'skipped', reason: 'reduced-motion' }, { status: 'skipped', reason: 'reduced-motion' }, { status: 'skipped', reason: 'reduced-motion' },
      ]);
      await expect(canvasElement.querySelector('[data-poker-pot]')).toHaveTextContent('Pot175');
      await expect(view.document.querySelectorAll('[data-ui="chip-flight-layer"]')).toHaveLength(0);
    } finally { view.matchMedia = matchMedia; }
  },
};

export const StaleId: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const warning = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Manual event' }));
      await waitFor(() => expect(canvasElement.ownerDocument.querySelector('[data-ui="chip-flight-layer"]')).not.toBeNull());
      await waitFor(() => expect(canvasElement.ownerDocument.querySelector('[data-ui="chip-flight-layer"]')).toBeNull(), { timeout: 6000 });
      await userEvent.click(canvas.getByRole('button', { name: 'Remove manual' }));
      await userEvent.click(canvas.getByRole('button', { name: 'Manual event' }));
      await expect(warning).toHaveBeenCalledWith('PokerTable: stale flight id "manual". Push a new event with useFlightQueue instead.');
      await expect(canvasElement.ownerDocument.querySelector('[data-ui="chip-flight-layer"]')).toBeNull();
    } finally { warning.mockRestore(); }
  },
};

function ReactiveCards() {
  const queue = useFlightQueue();
  const [played, setPlayed] = useState(false);
  const [outcome, setOutcome] = useState<FlightOutcome | null>(null);
  return <>
    <Controls>
      <Button onClick={() => { const handle = queue.push({ kind: 'deal' }); void handle.result.then(setOutcome); }}>Deal</Button>
      <Button onClick={() => setPlayed(true)}>Play</Button>
    </Controls>
    <Output aria-label="Deal result">{JSON.stringify(outcome)}</Output>
    <CardFlights flights={queue.events.filter(event => event.kind !== 'transfer')} onFlightSettled={queue.props.onFlightSettled}>
      <CardStage>
        <CardFlights.Deck><GameCard label="Deck" /></CardFlights.Deck>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(index => <CardFlights.Target key={index} kind="hand" cardId={`hand-${index}`}>
          <GameCard label={`Hand ${index}`} />
        </CardFlights.Target>)}
        {played && <CardFlights.Target kind="play" cardId="hand-0"><GameCard label="Played card" /></CardFlights.Target>}
      </CardStage>
    </CardFlights>
  </>;
}

export const ReactiveGroup: Story = {
  tags: ['!autodocs'], render: () => <ReactiveCards />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Deal' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Play' }));
    const doc = canvasElement.ownerDocument;
    await waitFor(() => expect(doc.querySelector('[data-flight-target="played:hand-0"]')).not.toBeNull());
    await waitFor(() => expect(doc.querySelector('[data-flight-target="played:hand-0"]')).toBeNull());
    await expect(doc.querySelector('[data-flight-target="hand:hand-7"]')).not.toBeNull();
    await expect(canvas.getByLabelText('Deal result')).toHaveTextContent('null');
    await waitFor(() => expect(canvas.getByLabelText('Deal result')).toHaveTextContent('"landed"'), { timeout: 6000 });
  },
};

function DeprecatedTable() {
  const [snapshot, setSnapshot] = useState({ pot: 100, deal: 0, revision: 0 });
  return <>
    <Controls>
      <Button onClick={() => setSnapshot(current => ({ ...current, pot: current.pot + 25, deal: current.deal + 1 }))}>Legacy deal</Button>
      <Button onClick={() => setSnapshot(current => ({ ...current, revision: current.revision + 1 }))}>Legacy resync</Button>
    </Controls>
    <Stage><PokerTable players={players} title="Poker" {...snapshot} potFrom="you"
      chipTransfer={{ id: snapshot.deal, fromPlayerKey: 'you', amount: 25 }} /></Stage>
  </>;
}
const legacyWarning = fn();
export const DeprecatedProps: Story = {
  tags: ['!autodocs'], render: () => <DeprecatedTable />,
  beforeEach: () => {
    legacyWarning.mockClear();
    const warning = spyOn(console, 'warn').mockImplementation(legacyWarning);
    return () => warning.mockRestore();
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const warnings = [
      'PokerTable: chipTransfer is deprecated. Use useFlightQueue().push instead.',
      'PokerTable: potFrom is deprecated. Use useFlightQueue().push instead.',
      'CardFlights: deal is deprecated. Use useFlightQueue().push instead.',
      'CardFlights: revision is deprecated. Use useFlightQueue().push instead.',
    ];
    for (const message of warnings) await expect(legacyWarning).toHaveBeenCalledWith(message);
    await userEvent.click(canvas.getByRole('button', { name: 'Legacy deal' }));
    await waitFor(() => expect(canvasElement.ownerDocument.querySelector('[data-ui="chip-flight-layer"]')).not.toBeNull());
    await waitFor(() => expect(canvasElement.ownerDocument.querySelector('[data-ui="card-flight"]')).not.toBeNull());
    await userEvent.click(canvas.getByRole('button', { name: 'Legacy resync' }));
    await waitFor(() => expect(canvasElement.ownerDocument.querySelector('[data-ui="chip-flight-layer"], [data-ui="card-flight"]')).toBeNull());
    await expect(legacyWarning).toHaveBeenCalledTimes(4);
  },
};
