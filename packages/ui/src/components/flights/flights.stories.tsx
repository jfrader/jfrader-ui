import { useLayoutEffect, useRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor } from 'storybook/test';
import { styled } from '../../index';
import { vars } from '@jfrader/tokens/vars';
import { Button } from '../button';
import { PokerTable } from '../poker-table';
import { CardFlights } from '../card-flights';
import { GameCard } from '../game-card';
import { FlightProvider, useFlights, type FlightProviderProps } from './index';
import { useFlightScope } from './flight-provider';
import type { FlightEventInput, FlightOutcome } from './types';

const Stage = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 640, marginInline: 'auto' });
const Controls = styled.div({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: vars.space[2], padding: vars.space[3] });
const Output = styled.output({ display: 'block', color: vars.color.text, backgroundColor: vars.color.bg });
const CardStage = styled.div({ display: 'flex', gap: vars.space[8], padding: vars.space[4] });
const players = [{ key: 'you', name: 'You', chips: 200, isMe: true, hiddenCards: 2 }, { key: 'rival', name: 'Rival', chips: 200, hiddenCards: 2 }];

function QueueTable({ onBusyChange, onResync }: { onBusyChange?: (busy: boolean) => void; onResync: (outcome: FlightOutcome) => void }) {
  const flights = useFlights();
  const events = useFlightScope()!.events;
  const [pot, setPot] = useState(100);
  const [outcomes, setOutcomes] = useState<FlightOutcome[]>([]);
  const [, rerender] = useState(0);
  const [edges, setEdges] = useState<boolean[]>([]);
  const lastBusy = useRef(false);
  useLayoutEffect(() => {
    if (lastBusy.current !== flights.busy) { lastBusy.current = flights.busy; setEdges(current => [...current, flights.busy]); }
  }, [flights.busy]);
  const push = (event: FlightEventInput) => {
    const handle = event.kind === 'transfer' ? flights.sendChips(event) : flights[event.kind]();
    void handle.result.then(outcome => setOutcomes(current => [...current, outcome]));
    if (event.kind === 'resync') void handle.result.then(onResync);
    return handle;
  };
  return <>
    <Stage><PokerTable onBusyChange={onBusyChange} title="Poker" players={players} pot={pot} locale="en-US" /></Stage>
    <Output aria-label="Queue busy">{String(flights.busy)}</Output>
    <Output aria-label="Queue size">{events.length}</Output>
    <Output aria-label="Outcomes">{JSON.stringify(outcomes)}</Output>
    <Output aria-label="Busy edges">{JSON.stringify(edges)}</Output>
    <Controls>
      <Button onClick={() => push({ kind: 'transfer', from: 'you', amount: 25 })}>Transfer</Button>
      <Button onClick={() => { setPot(175); push({ kind: 'transfer', from: 'you', amount: 25 }); push({ kind: 'transfer', from: 'rival', amount: 50 }); }}>Two transfers</Button>
      <Button onClick={() => { push({ kind: 'deal' }); push({ kind: 'deal' }); }}>Two deals</Button>
      <Button onClick={() => push({ kind: 'deal' })}>Deal</Button>
      <Button onClick={() => { push({ kind: 'transfer', from: 'you', amount: 25 }); push({ kind: 'deal' }); }}>Deal and transfer</Button>
      <Button onClick={() => push({ kind: 'resync' })}>Resync</Button>
      <Button onClick={() => push({ kind: 'transfer', from: 'missing', amount: 25 })}>Unknown player</Button>
      <Button onClick={() => rerender(current => current + 1)}>Rerender</Button>
      <Button onClick={() => flights.cancel()}>Cancel</Button>
      <Button onClick={() => { push({ kind: 'transfer', from: 'you', amount: 25 }); push({ kind: 'transfer', from: 'rival', amount: 25 }); push({ kind: 'deal' }); push({ kind: 'resync' }); }}>Resync batch</Button>
      <Button onClick={() => { setPot(250); push({ kind: 'resync' }); push({ kind: 'transfer', from: 'you', amount: 25 }); }}>Resync then transfer</Button>
    </Controls>
  </>;
}

function QueueDemo() {
  const flights = useFlights();
  return <>
    <Stage data-flight-stage><PokerTable title="Poker" players={players} pot={100} /></Stage>
    <Controls><Button onClick={() => flights.sendChips({ from: 'you', amount: 25 })}>Transfer</Button></Controls>
  </>;
}

const meta = {
  title: 'Games/Flights',
  component: FlightProvider,
  tags: ['autodocs'],
  args: { children: null, onBusyChange: fn(), onResync: fn() },
  render: () => <FlightProvider><QueueDemo /></FlightProvider>,
  parameters: { layout: 'fullscreen', docs: {
    description: { component: 'Queue card deals, chip transfers, and snapshot resynchronization.' },
    usage: 'Wrap one surface and its controls in FlightProvider. Call useFlights from the controls to deal cards, send chips, or resync. See the [Flights guide](https://ui.jfrader.com/#/components/flights) for lane policies, outcomes, and custom chip surfaces.',
    sections: [{ title: 'Hooks', stories: ['Queue'] }],
    source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { Button } from '@jfrader/ui/button';
import { FlightProvider, useFlights } from '@jfrader/ui/flights';
import { PokerTable } from '@jfrader/ui/poker-table';

const Stage = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 640, marginInline: 'auto' });
const Controls = styled.div({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: vars.space[2], padding: vars.space[3] });
function PokerSurface() {
  const flights = useFlights();
  const players = [
    { key: 'you', name: 'You', chips: 200, isMe: true, hiddenCards: 2 },
    { key: 'rival', name: 'Rival', chips: 200, hiddenCards: 2 },
  ];
  return <>
    <Stage><PokerTable title="Poker" players={players} pot={100} /></Stage>
    <Controls><Button onClick={() => flights.sendChips({ from: 'you', amount: 25 })}>Transfer</Button></Controls>
  </>;
}
export function Poker() {
  return <FlightProvider><PokerSurface /></FlightProvider>;
}` },
  } },
} satisfies Meta<FlightProviderProps & { onResync: (outcome: FlightOutcome) => void }>;
export default meta;
type Story = StoryObj<FlightProviderProps & { onResync: (outcome: FlightOutcome) => void }>;
const renderQueueTable: Story['render'] = args => <FlightProvider><QueueTable onBusyChange={args.onBusyChange} onResync={args.onResync} /></FlightProvider>;

export const Queue: Story = {
  name: 'Provider and hook',
  render: () => <FlightProvider><QueueDemo /></FlightProvider>,
  play: async ({ canvas, canvasElement }) => {
    const stage = canvasElement.querySelector('[data-flight-stage]')!;
    await expect(canvas.getByRole('button', { name: 'Transfer' }).getBoundingClientRect().top)
      .toBeGreaterThanOrEqual(stage.getBoundingClientRect().bottom);
  },
};

export const UnchangedPot: Story = {
  render: renderQueueTable,
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
  render: renderQueueTable,
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
  render: renderQueueTable,
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

export const DealAndTransfer: Story = {
  render: renderQueueTable,
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Deal and transfer' }));
    await expect(canvas.getByLabelText('Queue size')).toHaveTextContent('2');
    await expect(canvasElement.ownerDocument.querySelector('[data-ui="chip-flight-layer"]')).not.toBeNull();
    await expect(canvasElement.ownerDocument.querySelector('[data-ui="card-flight"]')).not.toBeNull();
    await waitFor(() => expect(canvas.getByLabelText('Queue size')).toHaveTextContent('0'), { timeout: 6000 });
    await expect(JSON.parse(canvas.getByLabelText('Outcomes').textContent!)).toEqual([{ status: 'landed' }, { status: 'landed' }]);
  },
};

export const Resync: Story = {
  render: renderQueueTable,
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Two transfers' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Deal' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Resync' }));
    await waitFor(() => expect(canvas.getByLabelText('Queue size')).toHaveTextContent('0'));
    const results: FlightOutcome[] = JSON.parse(canvas.getByLabelText('Outcomes').textContent!);
    await expect(results.filter(outcome => outcome.status === 'cancelled')).toHaveLength(3);
    await expect(results).toContainEqual({ status: 'skipped', reason: 'resync' });
    await expect(results.at(-1)).toEqual({ status: 'skipped', reason: 'resync' });
    await expect(args.onResync).toHaveBeenCalledTimes(1);
    await expect(args.onResync).toHaveBeenCalledWith({ status: 'skipped', reason: 'resync' });
    await expect(canvasElement.ownerDocument.querySelectorAll('[data-ui="chip-flight-layer"], [data-card-flight]')).toHaveLength(0);
    await expect(canvasElement.querySelector('[data-poker-pot]')).toHaveTextContent('Pot175');
  },
};

export const ResyncBoundary: Story = {
  render: renderQueueTable,
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
  render: renderQueueTable,
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
  render: renderQueueTable,
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
  render: renderQueueTable,
  tags: ['!autodocs'],
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Two transfers' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(canvas.getByLabelText('Queue size')).toHaveTextContent('0'));
    await expect(JSON.parse(canvas.getByLabelText('Outcomes').textContent!)).toEqual([{ status: 'cancelled' }, { status: 'cancelled' }]);
  },
};

export const ReducedMotion: Story = {
  render: renderQueueTable,
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

function ReactiveCards() {
  const flights = useFlights();
  const [played, setPlayed] = useState(false);
  const [outcome, setOutcome] = useState<FlightOutcome | null>(null);
  return <>
    <CardFlights>
      <CardStage>
        <CardFlights.Deck><GameCard label="Deck" /></CardFlights.Deck>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(index => <CardFlights.Target key={index} kind="hand" cardId={`hand-${index}`}>
          <GameCard label={`Hand ${index}`} />
        </CardFlights.Target>)}
        {played && <CardFlights.Target kind="play" cardId="hand-0"><GameCard label="Played card" /></CardFlights.Target>}
      </CardStage>
    </CardFlights>
    <Output aria-label="Deal result">{JSON.stringify(outcome)}</Output>
    <Controls>
      <Button onClick={() => { const handle = flights.deal(); void handle.result.then(setOutcome); }}>Deal</Button>
      <Button onClick={() => setPlayed(true)}>Play</Button>
    </Controls>
  </>;
}

export const ReactiveGroup: Story = {
  tags: ['!autodocs'], render: () => <FlightProvider><ReactiveCards /></FlightProvider>,
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

function OutsideScope() { useFlights(); return null; }
export const HookRequiresProvider: Story = {
  tags: ['!autodocs'],
  play: async () => {
    await expect(() => renderToString(<OutsideScope />)).toThrow('useFlights must be used inside FlightProvider.');
  },
};

function MissingSurfaceControls() {
  const flights = useFlights();
  const [outcomes, setOutcomes] = useState<FlightOutcome[]>([]);
  return <>
    <Button onClick={() => {
      const handles = [flights.deal(), flights.sendChips({ from: 'you', amount: 25 }), flights.resync()];
      void Promise.all(handles.map(handle => handle.result)).then(setOutcomes);
    }}>Trigger without a surface</Button>
    <Output aria-label="Missing surface outcomes">{JSON.stringify(outcomes)}</Output>
    <Output aria-label="Missing surface busy">{String(flights.busy)}</Output>
  </>;
}
export const MissingSurface: Story = {
  tags: ['!autodocs'], render: () => <FlightProvider><MissingSurfaceControls /></FlightProvider>,
  play: async ({ canvas, userEvent }) => {
    const warning = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Trigger without a surface' }));
      await waitFor(() => expect(JSON.parse(canvas.getByLabelText('Missing surface outcomes').textContent!)).toEqual([
        { status: 'skipped', reason: 'not-ready' }, { status: 'skipped', reason: 'not-ready' }, { status: 'skipped', reason: 'not-ready' },
      ]));
      await expect(canvas.getByLabelText('Missing surface busy')).toHaveTextContent('false');
      await expect(warning).toHaveBeenCalledTimes(3);
      await expect(warning).toHaveBeenCalledWith('FlightProvider: deal() has no registered cards surface. Render its surface inside this FlightProvider before triggering motion.');
      await expect(warning).toHaveBeenCalledWith('FlightProvider: sendChips() has no registered chips surface. Render its surface inside this FlightProvider before triggering motion.');
    } finally { warning.mockRestore(); }
  },
};

function ScopedSurface({ name }: { name: string }) {
  const flights = useFlights();
  return <>
    <Stage><PokerTable title={name} players={players} pot={100} /></Stage>
    <Output aria-label={`${name} busy`}>{String(flights.busy)}</Output>
    <Output aria-label={`${name} last`}>{JSON.stringify(flights.last)}</Output>
    <Controls><Button onClick={() => flights.sendChips({ from: 'you', amount: 25 })}>{name} transfer</Button></Controls>
  </>;
}
export const NestedProviders: Story = {
  tags: ['!autodocs'], render: () => <FlightProvider><ScopedSurface name="Outer" />
    <FlightProvider><ScopedSurface name="Inner" /></FlightProvider>
  </FlightProvider>,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Inner transfer' }));
    await expect(canvas.getByLabelText('Inner busy')).toHaveTextContent('true');
    await expect(canvas.getByLabelText('Outer busy')).toHaveTextContent('false');
    await expect(canvas.getByLabelText('Outer last')).toHaveTextContent('null');
    await waitFor(() => expect(canvas.getByLabelText('Inner last')).toHaveTextContent('"landed"'), { timeout: 6000 });
    await userEvent.click(canvas.getByRole('button', { name: 'Outer transfer' }));
    await expect(canvas.getByLabelText('Outer busy')).toHaveTextContent('true');
    await expect(canvas.getByLabelText('Inner busy')).toHaveTextContent('false');
    await waitFor(() => expect(canvas.getByLabelText('Outer last')).toHaveTextContent('"landed"'), { timeout: 6000 });
  },
};

export const ProviderBusyEdges: Story = {
  tags: ['!autodocs'],
  render: args => <FlightProvider onBusyChange={args.onBusyChange}><QueueTable onResync={args.onResync} /></FlightProvider>,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Two transfers' }));
    await expect(args.onBusyChange).toHaveBeenCalledTimes(1);
    await expect(args.onBusyChange).toHaveBeenCalledWith(true);
    await waitFor(() => expect(canvas.getByLabelText('Queue size')).toHaveTextContent('0'), { timeout: 10000 });
    await expect(args.onBusyChange).toHaveBeenCalledTimes(2);
    await expect(args.onBusyChange).toHaveBeenLastCalledWith(false);
  },
};

export const NestedMissingSurface: Story = {
  tags: ['!autodocs'], render: () => <FlightProvider><ScopedSurface name="Outer" />
    <FlightProvider><MissingSurfaceControls /></FlightProvider>
  </FlightProvider>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const warning = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Trigger without a surface' }));
      await waitFor(() => expect(JSON.parse(canvas.getByLabelText('Missing surface outcomes').textContent!)).toEqual([
        { status: 'skipped', reason: 'not-ready' }, { status: 'skipped', reason: 'not-ready' }, { status: 'skipped', reason: 'not-ready' },
      ]));
      await expect(canvas.getByLabelText('Outer busy')).toHaveTextContent('false');
      await expect(canvas.getByLabelText('Outer last')).toHaveTextContent('null');
      await expect(canvasElement.ownerDocument.querySelector('[data-ui="chip-flight-layer"], [data-ui="card-flight"]')).toBeNull();
      await expect(warning).toHaveBeenCalledTimes(3);
    } finally { warning.mockRestore(); }
  },
};
