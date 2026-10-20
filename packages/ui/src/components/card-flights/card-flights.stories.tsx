import type { Meta, StoryObj } from '@storybook/react-vite';
import { Component, StrictMode, useRef, useState, type ReactNode } from 'react';
import { expect, spyOn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../index';
import { motionDurationMs } from '../../styling/motion-timings';
import { Button } from '../button';
import { GameHand, type GameHandCard } from '../game-hand';
import { GameCard } from '../game-card';
import { GameCardStack } from '../game-card-stack';
import { GameTable } from '../game-table';
import { ThemeRoot } from '../theme-root';
import { CardFlights, useBoardFlights, useCardFlightOrigin, useCardFlightStatus, type PlayingCard } from './index';
import { measureCardBox } from './geometry';

const Controls = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2], padding: vars.space[3] });
const Board = styled.div({ blockSize: '600px', maxInlineSize: '850px', inlineSize: '100%' });
const CustomBoard = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[8], padding: vars.space[4] });
const StatusOutput = styled.output({ color: vars.color.text, background: vars.color.bg });
const DemoTheme = styled.div({ background: vars.color.bg, color: vars.color.text });
const ResponsiveHand = styled(GameHand)({
  '@media (max-width: 30rem)': {
    '--game-card-width': vars.size.gameCardSm,
    '[data-ui~="game-card"]': { '--game-card-width': vars.size.gameCardSm },
  },
});
const cards = [
  { id: 'ace', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'two', label: 'Two of spades', value: { deck: 'french', suit: 'spades', rank: 2 } },
  { id: 'three', label: 'Three of spades', value: { deck: 'french', suit: 'spades', rank: 3 } },
  { id: 'four', label: 'Four of spades', value: { deck: 'french', suit: 'spades', rank: 4 } },
] satisfies GameHandCard[];
const seats = [{ key: 'own', teamIdx: 0, isMe: true }, { key: 'rival', teamIdx: 1 }];
type Play = PlayingCard & { cardId: string; playerKey: string };

function Status() { const { busy } = useCardFlightStatus(); return <StatusOutput aria-label="Flight status">{busy ? 'Flying' : 'Ready'}</StatusOutput>; }

function MatchTree({ plays, onPlay, onBurst, onDeal, onResync, onClear }: {
  plays: Play[]; onPlay: (card: GameHandCard) => void; onBurst: () => void; onDeal: () => void; onResync: () => void; onClear: () => void;
}) {
  const own = plays.filter((play) => play.playerKey === 'own');
  const rival = plays.filter((play) => play.playerKey === 'rival');
  return <>
    <Controls><Button onClick={onDeal}>Deal hand</Button><Button onClick={onResync}>Resync board</Button>
      <Button onClick={onClear}>Clear plays</Button><Button onClick={onBurst}>Play all</Button><Status /></Controls>
    <Board><GameTable players={2} seats={seats}>
      <GameTable.Seat slotKey="rival"><GameHand.Hidden count={cards.length - rival.length} label="Rival hand" /></GameTable.Seat>
      <GameTable.Dock><ResponsiveHand cards={cards.filter((card) => !own.some((play) => play.cardId === card.id))}
        playLabel="Play selected" onPlayIntent={onPlay} /></GameTable.Dock>
      {seats.map((seat) => <GameTable.Play key={seat.key} slotKey={seat.key}>
        <GameCardStack.Pile playerKey={seat.key} label={`${seat.key} pile`} maxCards={3} cards={plays.filter((play) => play.playerKey === seat.key)} />
      </GameTable.Play>)}
    </GameTable></Board>
  </>;
}

function Match({ theme = 'dark', below = false, rtl = false }: { theme?: 'dark' | 'light'; below?: boolean; rtl?: boolean }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [deal, setDeal] = useState(0);
  const [revision, setRevision] = useState(0);
  const [plays, setPlays] = useState<Play[]>([]);
  const [busy, setBusy] = useState(false);
  const accept = (card: GameHandCard) => setPlays((current) => [...current,
    { ...card, id: `play-${card.id}`, cardId: card.id, playerKey: 'own' },
    { ...card, id: `reply-${card.id}`, cardId: `rival-${card.id}`, playerKey: 'rival' }]);
  return <div ref={setHost} dir={rtl ? 'rtl' : undefined}><ThemeRoot theme={theme} portalContainer={host}><DemoTheme>
    <StatusOutput aria-label="Reported status">{busy ? 'Flying' : 'Ready'}</StatusOutput>
    <CardFlights deal={deal} revision={revision} forehand="rival" onBusyChange={setBusy}>
      {below ? <BelowState /> : <MatchTree plays={plays} onPlay={accept}
        onDeal={() => { setPlays([]); setDeal((key) => key + 1); }} onResync={() => {
          setRevision((key) => key + 1);
          const card = required(cards.at(-1));
          setPlays([{ ...card, id: 'server-four', cardId: card.id, playerKey: 'own' }]);
        }} onClear={() => setPlays([])}
        onBurst={() => setPlays(cards.map((card) => ({ ...card, id: `play-${card.id}`, cardId: card.id, playerKey: 'own' })))} />}
    </CardFlights>
  </DemoTheme></ThemeRoot></div>;
}

function BelowState() {
  const [plays, setPlays] = useState<Play[]>([]);
  return <MatchTree plays={plays} onPlay={(card) => setPlays((current) => [...current, { ...card, id: `play-${card.id}`, cardId: card.id, playerKey: 'own' }])}
    onBurst={() => setPlays(cards.map((card) => ({ ...card, id: `play-${card.id}`, cardId: card.id, playerKey: 'own' })))}
    onClear={() => setPlays([])} onDeal={() => setPlays([])} onResync={() => setPlays([])} />;
}

function CustomMatch() {
  const [played, setPlayed] = useState(false);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return <div ref={setHost}><ThemeRoot theme="dark" portalContainer={host}><CardFlights>
    <Controls><Button onClick={() => setPlayed((value) => !value)}>{played ? 'Return card' : 'Play card'}</Button><Status /></Controls>
    <CustomBoard>{!played && <CardFlights.Target kind="hand" cardId="custom"><GameCard {...required(cards[0])} /></CardFlights.Target>}
      {played && <CardFlights.Target kind="play" cardId="custom"><GameCard {...required(cards[0])} /></CardFlights.Target>}
    </CustomBoard>
  </CardFlights></ThemeRoot></div>;
}

const meta = {
  title: 'Games/CardFlights', component: CardFlights, tags: ['autodocs'], args: { children: null },
  render: () => <Match />,
  parameters: { a11y: { test: 'error' }, docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { CardFlights } from '@jfrader/ui/card-flights';
import { GameHand } from '@jfrader/ui/game-hand';
import { GameCardStack } from '@jfrader/ui/game-card-stack';
import { GameTable } from '@jfrader/ui/game-table';

function Board({ cards, seats, deal, revision }) {
  const [plays, setPlays] = useState([]);
  return <CardFlights deal={deal} revision={revision} forehand="rival">
    <GameTable players={2} seats={seats}>
      <GameTable.Seat slotKey="rival"><GameHand.Hidden count={4} label="Rival hand" /></GameTable.Seat>
      <GameTable.Dock>
        <GameHand cards={cards.filter(card => !plays.some(play => play.cardId === card.id))}
          playLabel="Play selected" onPlayIntent={card => setPlays(current => [...current,
            { ...card, id: 'play-' + card.id, cardId: card.id }])} />
      </GameTable.Dock>
      <GameTable.Play slotKey="own"><GameCardStack.Pile playerKey="own" label="Own pile" cards={plays} /></GameTable.Play>
    </GameTable>
  </CardFlights>;
}` },
    description: { component: 'Animate deals and plays from the rendered card tree.' },
    usage: `## Setup
Import from \`@jfrader/ui/card-flights\` and wrap one board in \`CardFlights\`. This subpath is opt-in; it is not exported from the package root. The component adds no DOM wrapper.

## Deals and snapshots
The first render appears in place. Change \`deal\` to fly every rendered hand card from \`CardFlights.Deck\`, or the GameTable surface centre when no Deck is present. \`forehand\` is a seat key; cards follow the table seat order, one card per seat per round. Change \`revision\` to cancel flights and apply a snapshot in place.

## Plays and identity
\`PlayingCard\` contains \`id\`, \`label\` and optional \`value\`. GameHand requires a value. Each played card has a unique play \`id\`; set its optional \`cardId\` when the source card id differs. GameHand, GameHand.Hidden, GameCardStack.Pile and GameTable register their rendered nodes. Piles display their newest maxCards cards. Hidden hands inherit their player key from GameTable.Seat, or take an explicit \`playerKey\` outside it.
New play nodes fly from the previous hand with the same cardId, or the rival seat's last hidden card. Missing origins appear in place. Confirm captures the current hand position automatically. Use \`useCardFlightOrigin()\` to capture an origin before accepting a custom drag.

## Custom destinations and activity
\`CardFlights.Target\` renders a div. Use \`kind="play" cardId="ace"\` without a pile, or \`kind="seat" seatKey="rival" index={0}\` for a hidden destination. Children supply the front artwork; optional \`front\`, \`back\` and \`face\` override it. Deck and Target forward native div props, refs and sx.
\`useCardFlightStatus().busy\` reports activity inside the board and is false without a provider. Stock GameHand blocks selection and confirmation while busy. \`onBusyChange\` reports activity to a state owner above CardFlights, including cancellation on unmount. Reduced motion completes in place and interrupts active flights.

## Accessibility
Flights are decorative and hidden from assistive technology. GameHand keeps its native card buttons and explicit confirmation action; select a card with Enter or Space, then activate Play selected. No additional keyboard commands are introduced.

## Migration
CardFlightsProvider, useBoardFlights, useDealFlights, usePlayedCardFlights, useCardFlights, CardFlightSpec, CARD_FLIGHT_ATTRIBUTES, flightTarget and measureCardBox are deprecated and will be removed in the next major release. Replace provider and hook pairs with CardFlights around the existing tree; remove duplicated hand/play hook arguments and landing Sets. Do not mix legacy deal/play hooks with CardFlights.`,
  } },
} satisfies Meta<typeof CardFlights>;
export default meta;
type Story = StoryObj<typeof meta>;

function mockMotion(reduced = false) {
  const original = window.matchMedia.bind(window);
  return spyOn(window, 'matchMedia').mockImplementation((query) => query === '(prefers-reduced-motion: reduce)'
    ? { ...original(query), matches: reduced, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => true }
    : original(query));
}
const flights = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-ui="card-flight"]')];
const landed = async (root: HTMLElement) => waitFor(() => expect(flights(root)).toHaveLength(0));
function required<T>(value: T | null | undefined): T { if (value == null) throw new Error('Missing measured card'); return value; }

/** Deal from the table centre, then confirm a local card and receive a rival reply. */
export const ComposedBoard: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(flights(canvasElement)).toHaveLength(0);
    const hand = canvas.getByRole('button', { name: 'Ace of spades' });
    await userEvent.click(canvas.getByRole('button', { name: 'Deal hand' }));
    await expect(flights(canvasElement)).toHaveLength(8);
    const firstRival = required(flights(canvasElement).find((node) => node.dataset.flightTarget === 'seat:rival:0'));
    const firstOwn = required(flights(canvasElement).find((node) => node.dataset.flightTarget === 'hand:ace'));
    await expect(firstRival.getAnimations()[0]?.effect?.getTiming().delay).toBe(0);
    await expect(firstOwn.getAnimations()[0]?.effect?.getTiming().delay).toBe(motionDurationMs.cardDealStagger);
    await expect(canvas.getByLabelText('Flight status')).toHaveTextContent('Flying');
    await expect(hand).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(hand);
    await expect(hand).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(canvas.getByRole('button', { name: 'Play selected' }));
    await expect(canvasElement.querySelector('[data-played-key]')).toBeNull();
    await landed(canvasElement);
    const rivalOrigin = measureCardBox(required([...canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-hand-hidden-card"]')].at(-1)));
    await userEvent.click(hand);
    const origin = measureCardBox(hand);
    await userEvent.click(canvas.getByRole('button', { name: 'Play selected' }));
    await expect(flights(canvasElement)).toHaveLength(2);
    const own = required(flights(canvasElement).find((node) => node.dataset.flightTarget === 'played:play-ace'));
    const destination = required(canvasElement.querySelector<HTMLElement>('[data-played-key="play-ace"]'));
    const effect = required(own.getAnimations()[0]?.effect);
    if (!(effect instanceof KeyframeEffect)) throw new Error('Missing travel effect');
    const pose = new DOMMatrixReadOnly(String(effect.getKeyframes()[0]?.transform));
    await expect(pose.e).toBeCloseTo(origin.cx - measureCardBox(destination).width / 2, 2);
    await expect(pose.f).toBeCloseTo(origin.cy - measureCardBox(destination).height / 2, 2);
    const rival = required(flights(canvasElement).find((node) => node.dataset.flightTarget === 'played:reply-ace'));
    const rivalEffect = required(rival.getAnimations()[0]?.effect);
    if (!(rivalEffect instanceof KeyframeEffect)) throw new Error('Missing rival travel effect');
    const rivalPose = new DOMMatrixReadOnly(String(rivalEffect.getKeyframes()[0]?.transform));
    await expect(rivalPose.e).toBeCloseTo(rivalOrigin.cx - parseFloat(rival.style.width) / 2, 2);
    await expect(rivalPose.f).toBeCloseTo(rivalOrigin.cy - parseFloat(rival.style.height) / 2, 2);
    await landed(canvasElement);
    await expect(canvas.getByLabelText('Reported status')).toHaveTextContent('Ready');
  },
};

/** Play into a custom node without a GameCardStack. */
export const CustomTarget: Story = {
  render: () => <CustomMatch />,
  parameters: { docs: { source: { language: 'tsx', code: `import { CardFlights } from '@jfrader/ui/card-flights';
import { GameCard } from '@jfrader/ui/game-card';

function CustomBoard({ card, played }) {
  return <CardFlights>
    {!played && <CardFlights.Target kind="hand" cardId={card.id}><GameCard {...card} /></CardFlights.Target>}
    {played && <CardFlights.Target kind="play" cardId={card.id}><GameCard {...card} /></CardFlights.Target>}
  </CardFlights>;
}` } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play card' }));
    await expect(flights(canvasElement)).toHaveLength(1);
    await expect(required(flights(canvasElement)[0]).querySelector('[data-ui~="game-card"]')).not.toBeNull();
    await landed(canvasElement);
  },
};

/** Reduced motion places dealt cards without a flight. */
export const ReducedMotion: Story = {
};
export const ReducedMotionRegression: Story = {
  tags: ['!autodocs'],
  beforeEach: () => { mockMotion(true); },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Deal hand' }));
    await expect(flights(canvasElement)).toHaveLength(0);
    await expect(canvas.getByLabelText('Flight status')).toHaveTextContent('Ready');
  },
};

/** Apply a server snapshot while cards are moving. */
export const ResyncInPlace: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Deal hand' }));
    flights(canvasElement).flatMap((node) => node.getAnimations({ subtree: true })).forEach((animation) => animation.pause());
    await userEvent.click(canvas.getByRole('button', { name: 'Resync board' }));
    await expect(flights(canvasElement)).toHaveLength(0);
    await expect(canvas.getByLabelText('Flight status')).toHaveTextContent('Ready');
    await expect(canvas.getByRole('button', { name: 'Ace of spades' })).toBeVisible();
    await expect(required(canvasElement.querySelector('[data-played-key="server-four"]'))).toBeVisible();
  },
};

/** Removing a moving play cancels its flight. */
export const InterruptedFlight: Story = {
  render: () => <CustomMatch />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play card' }));
    flights(canvasElement).flatMap((node) => node.getAnimations({ subtree: true })).forEach((animation) => animation.pause());
    await userEvent.click(canvas.getByRole('button', { name: 'Return card' }));
    await expect(flights(canvasElement)).toHaveLength(0);
    await expect(canvas.getByLabelText('Flight status')).toHaveTextContent('Ready');
  },
};

/** The composed board in the light theme. */
export const Light: Story = { render: () => <Match theme="light" /> };

export const BelowProviderState: Story = {
  tags: ['!autodocs'], render: () => <StrictMode><Match below /></StrictMode>, beforeEach: () => { mockMotion(); },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Ace of spades' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Play selected' }));
    await expect(flights(canvasElement)).toHaveLength(1);
    await landed(canvasElement);
  },
};

export const OverflowAndBurst: Story = {
  tags: ['!autodocs'], beforeEach: () => { mockMotion(); },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play all' }));
    await expect(flights(canvasElement)).toHaveLength(3);
    await expect(canvasElement.querySelector('[data-played-key="play-four"]')).not.toBeNull();
    await expect(canvasElement.querySelector('[data-played-key="play-ace"]')).toBeNull();
    await landed(canvasElement);
  },
};

export const RTL: Story = { tags: ['!autodocs'], render: () => <Match rtl />, beforeEach: () => { mockMotion(); }, play: ComposedBoard.play };

export const NoProvider: Story = {
  tags: ['!autodocs'], render: () => <><Status /><GameHand cards={cards} playLabel="Play selected" /></>,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByLabelText('Flight status')).toHaveTextContent('Ready');
    const card = canvas.getByRole('button', { name: 'Ace of spades' });
    await userEvent.click(card);
    await expect(card).toHaveAttribute('aria-pressed', 'true');
  },
};

function DeckProbe() {
  const [deal, setDeal] = useState(0);
  const [show, setShow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return <div ref={setHost}><ThemeRoot theme="dark" portalContainer={host}>
    <Controls><Button onClick={() => setDeal((key) => key + 1)}>Deal custom</Button>
      <Button onClick={() => setShow(false)}>Remove board</Button><StatusOutput aria-label="Reported status">{busy ? 'Flying' : 'Ready'}</StatusOutput></Controls>
    {show && <CardFlights deal={deal} onBusyChange={setBusy}><CustomBoard>
      <CardFlights.Deck><GameCard label="Deck" /></CardFlights.Deck>
      <CardFlights.Target kind="hand" cardId="custom"><GameCard label="Custom hand" /></CardFlights.Target>
      <CardFlights.Target kind="seat" seatKey="rival" index={0}><GameCard label="Custom rival" /></CardFlights.Target>
    </CustomBoard></CardFlights>}
  </ThemeRoot></div>;
}

function OriginPlay() {
  const remember = useCardFlightOrigin();
  const source = useRef<HTMLDivElement>(null);
  const [played, setPlayed] = useState(false);
  return <>
    <Controls>
      <div ref={source}><GameCard {...required(cards[0])} /></div>
      <Button onClick={() => { if (source.current) remember?.('custom-origin', source.current); setPlayed(true); }}>Play with origin</Button>
      <Status />
    </Controls>
    {played && <CustomBoard><CardFlights.Target kind="play" cardId="custom-origin">
      <GameCard {...required(cards[0])} />
    </CardFlights.Target></CustomBoard>}
  </>;
}

function OriginMatch() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return <div ref={setHost}><ThemeRoot theme="dark" portalContainer={host}><CardFlights><OriginPlay /></CardFlights></ThemeRoot></div>;
}

/** Capture a drag or custom gesture origin through the public hook before accepting the play. */
export const CustomOrigin: Story = {
  tags: ['!autodocs'],
  render: () => <OriginMatch />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play with origin' }));
    await expect(flights(canvasElement)).toHaveLength(1);
    await landed(canvasElement);
  },
};

export const DeckAndUnmount: Story = {
  tags: ['!autodocs'], render: () => <StrictMode><DeckProbe /></StrictMode>, beforeEach: () => { mockMotion(); },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const deck = measureCardBox(required(canvasElement.querySelector<HTMLElement>('[data-ui="card-flights-deck"]')));
    await userEvent.click(canvas.getByRole('button', { name: 'Deal custom' }));
    await expect(flights(canvasElement)).toHaveLength(2);
    const flight = required(flights(canvasElement)[0]);
    const effect = required(flight.getAnimations()[0]?.effect);
    if (!(effect instanceof KeyframeEffect)) throw new Error('Missing deck travel effect');
    const pose = new DOMMatrixReadOnly(String(effect.getKeyframes()[0]?.transform));
    await expect(pose.e).toBeCloseTo(deck.cx - parseFloat(flight.style.width) / 2, 2);
    flight.getAnimations({ subtree: true }).forEach((animation) => animation.pause());
    await expect(canvas.getByLabelText('Reported status')).toHaveTextContent('Flying');
    await userEvent.click(canvas.getByRole('button', { name: 'Remove board' }));
    await expect(flights(canvasElement)).toHaveLength(0);
    await expect(canvas.getByLabelText('Reported status')).toHaveTextContent('Ready');
  },
};

export const MissingHiddenKey: Story = {
  tags: ['!autodocs'], render: () => <CardFlights><GameHand.Hidden count={1} label="Unkeyed hand" /></CardFlights>,
  beforeEach: () => { spyOn(console, 'warn').mockImplementation(() => {}); },
  play: async () => { await expect(console.warn).toHaveBeenCalledWith('GameHand.Hidden needs playerKey outside GameTable.Seat.'); },
};

export const TwoTables: Story = {
  tags: ['!autodocs'], render: () => <CardFlights><Board><GameTable players={2} seats={seats} /><GameTable players={2} seats={seats} /></Board></CardFlights>,
  beforeEach: () => { spyOn(console, 'warn').mockImplementation(() => {}); },
  play: async () => { await expect(console.warn).toHaveBeenCalledWith('CardFlights supports one GameTable per board.'); },
};

class LegacyBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <StatusOutput>{this.state.error}</StatusOutput> : this.props.children; }
}
function MixedEngine() { useBoardFlights({ hand: [], plays: [], handKey: 0 }); return null; }
export const LegacyConflict: Story = {
  tags: ['!autodocs'], render: () => <LegacyBoundary><CardFlights><MixedEngine /></CardFlights></LegacyBoundary>,
  beforeEach: () => { spyOn(console, 'error').mockImplementation(() => {}); },
  play: async ({ canvas }) => { await expect(canvas.getByText('Do not mix legacy flight hooks with CardFlights. Render the card tree instead.')).toBeVisible(); },
};

let reduceMotionNow = () => {};
export const ReducedMotionInterrupt: Story = {
  tags: ['!autodocs'],
  beforeEach: () => {
    let reduced = false;
    const events = new EventTarget();
    const original = window.matchMedia.bind(window);
    spyOn(window, 'matchMedia').mockImplementation((query) => query === '(prefers-reduced-motion: reduce)' ? {
      get matches() { return reduced; }, media: query, onchange: null,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => true,
    } : original(query));
    reduceMotionNow = () => { reduced = true; events.dispatchEvent(Object.assign(new Event('change'), { matches: true })); };
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Deal hand' }));
    await expect(flights(canvasElement)).toHaveLength(8);
    flights(canvasElement).flatMap((node) => node.getAnimations({ subtree: true })).forEach((animation) => animation.pause());
    reduceMotionNow();
    await waitFor(() => expect(flights(canvasElement)).toHaveLength(0));
    await expect(canvas.getByLabelText('Reported status')).toHaveTextContent('Ready');
  },
};
