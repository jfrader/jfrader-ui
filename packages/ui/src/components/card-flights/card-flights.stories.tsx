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
import { Surface } from '../surface';
import { ThemeRoot } from '../theme-root';
import { CardFlights, useBoardFlights, useCardFlightOrigin, useCardFlightStatus, type PlayingCard } from './index';
import { measureCardBox } from './geometry';

const STAGE_MAX_INLINE_SIZE = 640;
const BOARD_MAX_INLINE_SIZE = 480;
const BOARD_BLOCK_SIZE = 640;
const CUSTOM_STAGE_MIN_BLOCK_SIZE = 320;
const SLOT_INLINE_SIZE = 136;
const SLOT_BLOCK_SIZE = 176;
const Controls = styled.div({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: vars.space[2], padding: vars.space[3] });
const Board = styled.div({ inlineSize: '100%', maxInlineSize: BOARD_MAX_INLINE_SIZE, blockSize: BOARD_BLOCK_SIZE, marginInline: 'auto' });
const CustomStage = styled.div({
  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: vars.space[8],
  inlineSize: '100%', maxInlineSize: STAGE_MAX_INLINE_SIZE, minBlockSize: CUSTOM_STAGE_MIN_BLOCK_SIZE, marginInline: 'auto',
});
const Slot = styled(Surface)({
  display: 'grid', gridTemplateRows: 'auto 1fr', justifyItems: 'center', alignItems: 'center', gap: vars.space[2],
  inlineSize: SLOT_INLINE_SIZE, blockSize: SLOT_BLOCK_SIZE, padding: vars.space[3],
});
const SlotLabel = styled.span({ color: vars.color.textMuted, fontSize: vars.textSize.sm });
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

/** `compact` shows the docs controls; `full` adds the resync and burst controls the regression stories drive. */
type ControlMode = 'compact' | 'full';

function MatchTree({ plays, controls, onPlay, onBurst, onDeal, onResync, onClear }: {
  plays: Play[]; controls: ControlMode; onPlay: (card: GameHandCard) => void; onBurst: () => void; onDeal: () => void; onResync: () => void; onClear: () => void;
}) {
  const own = plays.filter((play) => play.playerKey === 'own');
  const rival = plays.filter((play) => play.playerKey === 'rival');
  return <>
    <Controls><Button onClick={onDeal}>Deal hand</Button><Button onClick={onClear}>Clear plays</Button>
      {controls === 'full' && <><Button onClick={onResync}>Resync board</Button><Button onClick={onBurst}>Play all</Button></>}
      <Status /></Controls>
    <Board><GameTable places={2} seats={seats}>
      <GameTable.Seat slotKey="rival"><GameHand.Hidden count={cards.length - rival.length} label="Rival hand" /></GameTable.Seat>
      <GameTable.Dock><ResponsiveHand cards={cards.filter((card) => !own.some((play) => play.cardId === card.id))}
        ><GameHand.Confirm onPlay={onPlay}>Play selected</GameHand.Confirm></ResponsiveHand></GameTable.Dock>
      {seats.map((seat) => <GameTable.Play key={seat.key} slotKey={seat.key}>
        <GameCardStack.Pile playerKey={seat.key} label={`${seat.key} pile`} visible={3} cards={plays.filter((play) => play.playerKey === seat.key)} />
      </GameTable.Play>)}
    </GameTable></Board>
  </>;
}

function Match({ theme = 'dark', below = false, rtl = false, controls = 'compact' }: {
  theme?: 'dark' | 'light'; below?: boolean; rtl?: boolean; controls?: ControlMode;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [deal, setDeal] = useState(0);
  const [revision, setRevision] = useState(0);
  const [plays, setPlays] = useState<Play[]>([]);
  const accept = (card: GameHandCard) => setPlays((current) => [...current,
    { ...card, id: `play-${card.id}`, cardId: card.id, playerKey: 'own' },
    { ...card, id: `reply-${card.id}`, cardId: `rival-${card.id}`, playerKey: 'rival' }]);
  return <div ref={setHost} dir={rtl ? 'rtl' : undefined}><ThemeRoot theme={theme} portalContainer={host}><DemoTheme>
    <CardFlights deal={deal} revision={revision} forehand="rival">
      {below ? <BelowState controls={controls} /> : <MatchTree plays={plays} controls={controls} onPlay={accept}
        onDeal={() => { setPlays([]); setDeal((key) => key + 1); }} onResync={() => {
          setRevision((key) => key + 1);
          const card = required(cards.at(-1));
          setPlays([{ ...card, id: 'server-four', cardId: card.id, playerKey: 'own' }]);
        }} onClear={() => setPlays([])}
        onBurst={() => setPlays(cards.map((card) => ({ ...card, id: `play-${card.id}`, cardId: card.id, playerKey: 'own' })))} />}
    </CardFlights>
  </DemoTheme></ThemeRoot></div>;
}

function BelowState({ controls }: { controls: ControlMode }) {
  const [plays, setPlays] = useState<Play[]>([]);
  return <MatchTree plays={plays} controls={controls} onPlay={(card) => setPlays((current) => [...current, { ...card, id: `play-${card.id}`, cardId: card.id, playerKey: 'own' }])}
    onBurst={() => setPlays(cards.map((card) => ({ ...card, id: `play-${card.id}`, cardId: card.id, playerKey: 'own' })))}
    onClear={() => setPlays([])} onDeal={() => setPlays([])} onResync={() => setPlays([])} />;
}

function CustomPlay() {
  const remember = useCardFlightOrigin();
  const hand = useRef<HTMLDivElement>(null);
  const [played, setPlayed] = useState(false);
  const toggle = () => {
    if (!played && hand.current) remember?.('custom', hand.current);
    setPlayed((value) => !value);
  };
  return <>
    <Controls><Button onClick={toggle}>{played ? 'Return card' : 'Play card'}</Button><Status /></Controls>
    <CustomStage>
      <Slot><SlotLabel>Hand</SlotLabel>{!played && <CardFlights.Target ref={hand} kind="hand" cardId="custom"><GameCard {...required(cards[0])} /></CardFlights.Target>}</Slot>
      <Slot><SlotLabel>Play</SlotLabel>{played && <CardFlights.Target kind="play" cardId="custom"><GameCard {...required(cards[0])} /></CardFlights.Target>}</Slot>
    </CustomStage>
  </>;
}

function CustomMatch() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return <div ref={setHost}><ThemeRoot theme="dark" portalContainer={host}><CardFlights><CustomPlay /></CardFlights></ThemeRoot></div>;
}

const meta = {
  title: 'Games/CardFlights', component: CardFlights, tags: ['autodocs'], args: { children: null },
  render: () => <Match />,
  parameters: { layout: 'padded', a11y: { test: 'error' }, docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { Button } from '@jfrader/ui/button';
import { CardFlights, useCardFlightStatus, type PlayingCard } from '@jfrader/ui/card-flights';
import { GameHand, type GameHandCard } from '@jfrader/ui/game-hand';
import { GameCardStack } from '@jfrader/ui/game-card-stack';
import { GameTable } from '@jfrader/ui/game-table';
import { ThemeRoot } from '@jfrader/ui/theme-root';

const Controls = styled.div({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: vars.space[2], padding: vars.space[3] });
const Board = styled.div({ inlineSize: '100%', maxInlineSize: 480, blockSize: 640, marginInline: 'auto' });
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

function FlightStatus() {
  const { busy } = useCardFlightStatus();
  return <StatusOutput aria-label="Flight status">{busy ? 'Flying' : 'Ready'}</StatusOutput>;
}

export function Match() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [deal, setDeal] = useState(0);
  const [plays, setPlays] = useState<Play[]>([]);
  const own = plays.filter(play => play.playerKey === 'own');
  const rival = plays.filter(play => play.playerKey === 'rival');
  const accept = (card: GameHandCard) => setPlays(current => [...current,
    { ...card, id: 'play-' + card.id, cardId: card.id, playerKey: 'own' },
    { ...card, id: 'reply-' + card.id, cardId: 'rival-' + card.id, playerKey: 'rival' },
  ]);
  return <div ref={setHost}><ThemeRoot theme="dark" portalContainer={host}><DemoTheme>
    <CardFlights deal={deal} forehand="rival">
      <Controls>
        <Button onClick={() => { setPlays([]); setDeal(key => key + 1); }}>Deal hand</Button>
        <Button onClick={() => setPlays([])}>Clear plays</Button>
        <FlightStatus />
      </Controls>
      <Board><GameTable places={2} seats={seats}>
        <GameTable.Seat slotKey="rival">
          <GameHand.Hidden count={cards.length - rival.length} label="Rival hand" />
        </GameTable.Seat>
        <GameTable.Dock>
          <ResponsiveHand cards={cards.filter(card => !own.some(play => play.cardId === card.id))}
          ><GameHand.Confirm onPlay={accept}>Play selected</GameHand.Confirm></ResponsiveHand>
        </GameTable.Dock>
        {seats.map(seat => <GameTable.Play key={seat.key} slotKey={seat.key}>
          <GameCardStack.Pile playerKey={seat.key} label={seat.key + ' pile'} visible={3}
            cards={plays.filter(play => play.playerKey === seat.key)} />
        </GameTable.Play>)}
      </GameTable></Board>
    </CardFlights>
  </DemoTheme></ThemeRoot></div>;
}` },
    description: { component: 'Animate cards moving from a deck or hand to their next position.' },
    sections: [
      { title: 'Deals and plays', stories: ['ComposedBoard'] },
      { title: 'Custom boards', stories: ['CustomTarget'] },
    ],
    usage: `### Board updates
Use one table per flight board. The first render appears in place; later deals start at the deck or table centre and follow seat order, one card per seat per round. Accept a play by updating your rendered hand and piles. Keep source identities stable and give each play a unique identity. Missing origins appear in place.

Apply server snapshots as resynchronizations so active flights are cancelled rather than replayed. Do not combine the rendered-tree engine with deprecated deal/play hooks.

Give each play a unique id and preserve its source cardId when they differ. New play nodes fly from the previous matching hand card or the rival seat's last hidden card. GameHand.Confirm captures the hand position before accepting a play; custom drag controls capture it with useCardFlightOrigin(). Piles show all cards by default; visible limits destinations to the newest N cards.

Use CardFlights.Target for custom hand, play, board or hidden-seat destinations. A board card that appears after the first render flies from the deck and reveals its face; pass \`face\` to override it. Hidden hands inherit their player key inside GameTable.Seat; pass an explicit playerKey outside it. Address hidden-seat targets by seatKey and card index. CardFlights.Deck supplies a custom deal origin.

### Keyboard and motion

Flights are decorative and hidden from assistive technology. Select a hand card with Enter or Space, then activate Play selected. The hand blocks selection and confirmation during flights. Custom controls must handle busy state themselves. Reduced motion places cards immediately and interrupts active flights.`,
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
  name: 'Deal and play at a table',
  parameters: { docs: { description: { story: 'Press Deal hand to deal both hands from the table center. Select a card, press Play selected, and watch the rival reply land in its pile.' } } },
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
    await expect(canvas.getByLabelText('Flight status')).toHaveTextContent('Ready');
  },
};

/** Play into a custom node without a GameCardStack. */
export const CustomTarget: Story = {
  name: 'Custom play destination',
  render: () => <CustomMatch />,
  parameters: { docs: {
    description: { story: 'Move one card between the Hand and Play slots. Press Play card, then Return card.' },
    source: { language: 'tsx', code: `import { useRef, useState } from 'react';
import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { Button } from '@jfrader/ui/button';
import { CardFlights, useCardFlightOrigin, useCardFlightStatus } from '@jfrader/ui/card-flights';
import { GameCard } from '@jfrader/ui/game-card';
import { Surface } from '@jfrader/ui/surface';
import { ThemeRoot } from '@jfrader/ui/theme-root';

const Controls = styled.div({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: vars.space[2], padding: vars.space[3] });
const Board = styled.div({
  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: vars.space[8],
  inlineSize: '100%', maxInlineSize: 640, minBlockSize: 320, marginInline: 'auto',
});
const Slot = styled(Surface)({
  display: 'grid', gridTemplateRows: 'auto 1fr', justifyItems: 'center', alignItems: 'center', gap: vars.space[2],
  inlineSize: 136, blockSize: 176, padding: vars.space[3],
});
const SlotLabel = styled.span({ color: vars.color.textMuted, fontSize: vars.textSize.sm });
const StatusOutput = styled.output({ color: vars.color.text, background: vars.color.bg });
const ace = { label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } } as const;

function FlightStatus() {
  const { busy } = useCardFlightStatus();
  return <StatusOutput aria-label="Flight status">{busy ? 'Flying' : 'Ready'}</StatusOutput>;
}

function CustomPlay() {
  const remember = useCardFlightOrigin();
  const hand = useRef<HTMLDivElement>(null);
  const [played, setPlayed] = useState(false);
  const toggle = () => {
    if (!played && hand.current) remember?.('custom', hand.current);
    setPlayed(value => !value);
  };
  return <>
    <Controls>
      <Button onClick={toggle}>{played ? 'Return card' : 'Play card'}</Button>
      <FlightStatus />
    </Controls>
    <Board>
      <Slot>
        <SlotLabel>Hand</SlotLabel>
        {!played && <CardFlights.Target ref={hand} kind="hand" cardId="custom"><GameCard {...ace} /></CardFlights.Target>}
      </Slot>
      <Slot>
        <SlotLabel>Play</SlotLabel>
        {played && <CardFlights.Target kind="play" cardId="custom"><GameCard {...ace} /></CardFlights.Target>}
      </Slot>
    </Board>
  </>;
}

export function CustomBoard() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return <div ref={setHost}>
    <ThemeRoot theme="dark" portalContainer={host}>
      <CardFlights><CustomPlay /></CardFlights>
    </ThemeRoot>
  </div>;
}` } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    // Move the board after mount, as scrolling a docs page does, so a mount-time measurement goes stale.
    canvasElement.style.paddingBlockStart = '120px';
    const origin = measureCardBox(required(canvasElement.querySelector<HTMLElement>('[data-hand-card="custom"]')));
    await userEvent.click(canvas.getByRole('button', { name: 'Play card' }));
    await expect(flights(canvasElement)).toHaveLength(1);
    const flight = required(flights(canvasElement)[0]);
    await expect(flight.querySelector('[data-ui~="game-card"]')).not.toBeNull();
    // The flight starts from the hand box captured at click time, not one measured at mount.
    const effect = required(flight.getAnimations()[0]?.effect);
    if (!(effect instanceof KeyframeEffect)) throw new Error('Missing custom travel effect');
    const pose = new DOMMatrixReadOnly(String(effect.getKeyframes()[0]?.transform));
    await expect(pose.e).toBeCloseTo(origin.cx - parseFloat(flight.style.width) / 2, 2);
    await expect(pose.f).toBeCloseTo(origin.cy - parseFloat(flight.style.height) / 2, 2);
    await landed(canvasElement);
    // The hand and play slots sit side by side, so the flight travels at least one card width.
    const destination = measureCardBox(required(canvasElement.querySelector<HTMLElement>('[data-played-key="custom"]')));
    await expect(Math.abs(destination.cx - origin.cx)).toBeGreaterThan(origin.width);
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
  render: () => <Match controls="full" />,
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
  tags: ['!autodocs'], render: () => <Match controls="full" />, beforeEach: () => { mockMotion(); },
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
  tags: ['!autodocs'], render: () => <CardFlights><Board><GameTable places={2} seats={seats} /><GameTable places={2} seats={seats} /></Board></CardFlights>,
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
    await expect(canvas.getByLabelText('Flight status')).toHaveTextContent('Ready');
  },
};

const boardCards = [
  { id: 'board-queen', label: 'Queen of spades', value: { deck: 'french', suit: 'spades', rank: 'Q' } },
  { id: 'board-jack', label: 'Jack of spades', value: { deck: 'french', suit: 'spades', rank: 'J' } },
  { id: 'board-ten', label: 'Ten of spades', value: { deck: 'french', suit: 'spades', rank: 10 } },
] satisfies GameHandCard[];

function BoardRevealFixture() {
  const [revealed, setRevealed] = useState(0);
  const [deal, setDeal] = useState(0);
  return <DemoTheme><CardFlights deal={deal}>
    <Controls>
      <Button onClick={() => setRevealed((count) => Math.min(boardCards.length, count + 1))}>Reveal card</Button>
      <Button onClick={() => { setRevealed(0); setDeal((value) => value + 1); }}>Reset board</Button>
      <Button onClick={() => { setRevealed((count) => Math.min(boardCards.length, count + 1)); setDeal((value) => value + 1); }}>Deal and reveal</Button>
      <Status />
    </Controls>
    <CustomBoard>
      <CardFlights.Deck><GameCard size="sm" label="Deck" /></CardFlights.Deck>
      {boardCards.slice(0, revealed).map((card) => <CardFlights.Target key={card.id} kind="board" cardId={card.id}>
        <GameCard size="sm" {...card} />
      </CardFlights.Target>)}
    </CustomBoard>
  </CardFlights></DemoTheme>;
}

/** A board card that appears after the first render flies from the deck and reveals its face. */
export const BoardReveal: Story = {
  tags: ['!autodocs'], render: () => <BoardRevealFixture />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const document = canvasElement.ownerDocument;
    const inFlight = (selector: string) => document.querySelectorAll(selector);
    await userEvent.click(canvas.getByRole('button', { name: 'Reveal card' }));
    await waitFor(() => expect(inFlight('[data-ui="card-flight"][data-flight-target^="board:"]')).toHaveLength(1));
    await waitFor(() => expect(inFlight('[data-ui="card-flight"]')).toHaveLength(0));
    await expect(canvasElement.querySelectorAll('[data-board-card]')).toHaveLength(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Reveal card' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reveal card' }));
    await waitFor(() => expect(inFlight('[data-ui="card-flight"][data-flight-target^="board:"]')).toHaveLength(2));
    await waitFor(() => expect(inFlight('[data-ui="card-flight"]')).toHaveLength(0));
    await expect(canvasElement.querySelectorAll('[data-board-card]')).toHaveLength(3);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset board' }));
    await expect(canvasElement.querySelectorAll('[data-board-card]')).toHaveLength(0);
    await expect(inFlight('[data-ui="card-flight"]')).toHaveLength(0);
    await userEvent.click(canvas.getByRole('button', { name: 'Deal and reveal' }));
    await waitFor(() => expect(inFlight('[data-ui="card-flight"][data-flight-target^="board:"]')).toHaveLength(1));
    await waitFor(() => expect(inFlight('[data-ui="card-flight"]')).toHaveLength(0));
    await expect(canvasElement.querySelectorAll('[data-board-card]')).toHaveLength(1);
  },
};
