import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, spyOn, waitFor } from 'storybook/test';
import { CardFlightsFixture } from './card-flights-fixture';
import { FLIGHT_GEOMETRY, dealSequence } from './geometry';
import { StrictMode, useRef, useState, type ComponentPropsWithRef } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { motionDurationMs } from '../../styling/motion-timings';
import { Button } from '../button';
import { GameCard } from '../game-card';
import { GameHand } from '../game-hand';
import { GameTable } from '../game-table';
import { ThemeRoot } from '../theme-root';
import { GameCardStack } from '../game-card-stack';
import { CardFlight } from './card-flight';
import { CardFlightsProvider, flightTarget, measureCardBox, useCardFlights, useDealFlights, usePlayedCardFlights,
  type CardFlightSpec, type DealFlightPlayer, type PlayedFlightCard,
} from './index';

const meta = {
  title: 'Games/CardFlights', component: CardFlightsProvider, tags: ['autodocs'],
  args: { children: null },
  render: () => <CardFlightsFixture />,
  parameters: { a11y: { test: 'error' }, docs: {
    description: { component: 'Deal cards to a hand and move played cards to their table piles.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
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

function App() {
  return <CardFlightsProvider><Match /></CardFlightsProvider>;
}

const seats = [{ key: 'own', teamIdx: 0, isMe: true }, { key: 'rival', teamIdx: 1 }];
const cards: GameHandCard[] = [
  { id: 'ace', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'queen', label: 'Queen of hearts', value: { deck: 'french', suit: 'hearts', rank: 'Q' } },
];

function Match() {
  const [hand, setHand] = useState(cards);
  const [plays, setPlays] = useState<PlayedFlightCard[]>([]);
  const handIndex = 1;
  const { scopeRef, rememberPlayOrigin, landingTargets } = useCardFlights();
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
  );
}` },
    usage: `### Setup
- Import from \`@jfrader/ui/card-flights\`. Card flights are an opt-in subpath and are not re-exported by the package root.

### Card records
- Pass the same labeled records to GameHand and useDealFlights: each has an id, label and value. No face nodes are needed. Optional front, back and backPattern customize flight artwork.
- Give each accepted play a unique id. Pass that record to both GameCardStack.Pile and usePlayedCardFlights. Set cardId to its source hand id when the play id differs. Labels come from your app, never from a suit or rank formatter in the library.
- The pile's data-played-key is the play id. GameHand's data-hand-card is the hand id. Hidden hands keep playerKey and zero-based card-index markers; no opponent value is exposed.

### Match state
- Wrap one board in CardFlightsProvider and call flight hooks in a child of the provider. It renders the scope div; ref points to that div.
- Use component or slots.root to replace the root, and slotProps.root, className or sx to customize it. To use an existing wrapper instead, pass its scopeRef; no root div is rendered in that mode.
- Initial and resync snapshots appear in place. Change resyncKey when applying a server snapshot; bursts larger than playerCount also appear in place.
- Deal order starts at forehandIdx, sorts player idx and deals at most three cards per player. Deal duration is 380ms with 70ms stagger; own plays take 400ms and rival plays 520ms.
- Capture the hand origin with rememberPlayOrigin(card.id, element) before accepting onPlayIntent. Captures expire after 4000ms; otherwise the preceding render supplies the origin. Mount measurable destinations in the same commit as the new plays. Missing endpoints appear in place.
- landingTargets contains destinations still in flight. Disable play while necessary for your rules. reset() cancels flights and forgets origins and snapshot baselines; remount for a new match.
- Destinations stay hidden until the tracks finish. Replacements cancel old tracks. A waiting portal completes at the duration deadline. Reduced motion completes without a flight, including preference changes during animation.

### Accessibility and artwork
- Flights are decorative and aria-hidden. Name final cards and controls. GameHand uses native selection buttons and an explicit play button; selecting a card does not play it.
- Portals inherit ThemeRoot tokens, appearance and portalContainer. Custom front/back content must fit the measured frame. Down flights never mount front content; reveal flights do, so do not pass secret values.`,
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

const preference = { matches: false, media: null as MediaQueryList | null };
function mockPreference(reduced = false) {
  const original = window.matchMedia.bind(window);
  preference.matches = reduced;
  if (!preference.media) {
    preference.media = original('(prefers-reduced-motion)');
    Object.defineProperty(preference.media, 'matches', { get: () => preference.matches });
  }
  preference.media.dispatchEvent(new MediaQueryListEvent('change', { matches: reduced }));
  const spy = spyOn(window, 'matchMedia').mockImplementation((query) => query.includes('prefers-reduced-motion') ? preference.media! : original(query));
  return () => spy.mockRestore();
}


const controlsStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2], padding: vars.space[3] });
const boardStyle = css({ blockSize: '600px', maxInlineSize: '850px' });
const ownHand = (['A', 2, 3] as const).map((rank, index) => ({
  id: `own:${index}`, label: `${rank} of spades`, value: { deck: 'french' as const, rank, suit: 'spades' as const },
}));
const rivalHand = ([4, 5, 6] as const).map((rank, index) => ({
  id: `rival:${index}`, label: `${rank} of hearts`, value: { deck: 'french' as const, rank, suit: 'hearts' as const },
}));
const OWN_PLAY: PlayedFlightCard = { ...ownHand[0]!, cardId: ownHand[0]!.id, id: '0-own-own:0', playerKey: 'own', isOwn: true };
const RIVAL_PLAY: PlayedFlightCard = { ...rivalHand[0]!, cardId: rivalHand[0]!.id, id: '0-rival-rival:0', playerKey: 'rival', isOwn: false };

interface CardFlightsFixtureProps {
  theme?: 'dark' | 'light';
  initialDealt?: boolean;
  initialPlayed?: boolean;
  portalReady?: boolean;
  externalScope?: boolean;
}

function FlightIdentityProbe() {
  const destinationRef = useRef<HTMLDivElement>(null);
  const [spec, setSpec] = useState<CardFlightSpec | null>(null);
  return <div data-identity-probe>
    <div ref={destinationRef}><GameCard label="Probe card" /></div>
    <div css={controlsStyle}>
      <Button onClick={() => {
        const destination = destinationRef.current;
        if (!destination) return;
        const to = measureCardBox(destination);
        setSpec({ target: 'identity-probe', destination, to, from: { ...to, cx: to.cx - to.width },
          face: 'reveal', front: <GameCard label="Probe front" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />,
          back: <GameCard label="Probe back" />, durationMs: motionDurationMs.cardPlay });
      }}>Start identity probe</Button>
      <Button onClick={() => setSpec((current) => current && ({ ...current, from: { ...current.from }, to: { ...current.to } }))}>Rerender identity probe</Button>
      <Button onClick={() => setSpec(null)}>Stop identity probe</Button>
    </div>
    {spec && <CardFlight flightId={1} spec={spec} onFinish={() => undefined} />}
  </div>;
}

function FlightScenarios({ theme = 'dark', initialDealt = false, initialPlayed = false, portalReady = true, externalScope = false }: CardFlightsFixtureProps) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(true);
  return <div ref={setHost}>
    <ThemeRoot theme={theme} portalContainer={portalReady ? host : null}>
      <Button onClick={() => setMounted(!mounted)}>{mounted ? 'Unmount board' : 'Mount board'}</Button>
      {mounted && <div ref={externalScope ? scopeRef : undefined}>
        <CardFlightsProvider scopeRef={externalScope ? scopeRef : undefined}>
          <FlightBoard initialDealt={initialDealt} initialPlayed={initialPlayed} />
        </CardFlightsProvider>
      </div>}
    </ThemeRoot>
  </div>;
}

function FlightBoard({ initialDealt, initialPlayed }: {
  initialDealt: boolean; initialPlayed: boolean;
}) {
  const [handIndex, setHandIndex] = useState(initialDealt || initialPlayed ? 1 : 0);
  const [plays, setPlays] = useState<PlayedFlightCard[]>(initialPlayed ? [OWN_PLAY, RIVAL_PLAY] : []);
  const [resyncKey, setResyncKey] = useState(0);
  const { scopeRef, landingTargets, rememberPlayOrigin, launch, reset } = useCardFlights();
  const ownPlayed = plays.some((play) => play.isOwn);
  const rivalPlayed = plays.some((play) => !play.isOwn);
  const players: DealFlightPlayer[] = [
    { key: 'own', idx: 0, isOwn: true, cards: handIndex ? ownHand.filter((card) => !plays.some((entry) => entry.cardId === card.id)) : [] },
    { key: 'rival', idx: 1, isOwn: false, cards: handIndex ? rivalHand.filter((card) => !plays.some((entry) => entry.cardId === card.id)) : [] },
  ];
  useDealFlights({ handIndex, players, forehandIdx: 1, dealt: handIndex > 0 && !plays.length, resyncKey });
  usePlayedCardFlights({ plays, playerCount: 2, resyncKey });
  const deal = () => { setPlays([]); setHandIndex((index) => index + 1); };
  const play = (entry: PlayedFlightCard, capture = true) => {
    if (entry.isOwn && capture) {
      const element = scopeRef.current?.querySelector<HTMLElement>(`[data-hand-card="${CSS.escape(entry.cardId ?? entry.id)}"]`);
      if (element) rememberPlayOrigin(entry.cardId ?? entry.id, element);
    }
    setPlays((current) => [...current, entry]);
  };
  const replace = () => {
    const destination = scopeRef.current?.querySelector<HTMLElement>(`[data-played-key="${OWN_PLAY.id}"]`);
    const surface = scopeRef.current?.querySelector<HTMLElement>('[data-game-surface="true"]');
    if (!destination || !surface) return;
    launch([{ card: OWN_PLAY, target: flightTarget.played(OWN_PLAY.id), destination,
      from: measureCardBox(surface), to: measureCardBox(destination), face: 'reveal', durationMs: motionDurationMs.cardPlay }]);
  };
  return <>
    <div css={controlsStyle}>
      <Button onClick={deal}>Deal hand</Button>
      <Button disabled={!handIndex || ownPlayed || landingTargets.size > 0} onClick={() => play(OWN_PLAY)}>Play own</Button>
      <Button disabled={!handIndex || rivalPlayed || landingTargets.size > 0} onClick={() => play(RIVAL_PLAY)}>Play rival</Button>
      <Button onClick={replace} disabled={!ownPlayed}>Replace flight</Button>
      <Button onClick={reset}>Reset flights</Button>
      <Button onClick={() => { setResyncKey((key) => key + 1); deal(); }}>Resync hand</Button>
      <Button disabled={!handIndex || ownPlayed} onClick={() => {
        const node = scopeRef.current?.querySelector<HTMLElement>('[data-hand-card="own:0"]');
        if (node) { const box = measureCardBox(node); rememberPlayOrigin('own:0', { ...box, cx: box.cx - 200, cy: box.cy - 100 }); }
      }}>Capture moved origin</Button>
      <Button disabled={!handIndex || ownPlayed || landingTargets.size > 0} onClick={() => play(OWN_PLAY, false)}>Play without capture</Button>
      <output aria-label="Flights in air">{landingTargets.size}</output>
    </div>
    <div css={boardStyle}>
      <GameTable players={2} viewport={{ width: 1000, height: 800 }}
        seats={[{ key: 'own', teamIdx: 0, isMe: true }, { key: 'rival', teamIdx: 1 }]}
      >
        <GameTable.Seat slotKey="rival"><GameHand.Hidden playerKey="rival" count={players[1]!.cards.length} label="Rival hand" /></GameTable.Seat>
        <GameTable.Dock><GameHand playLabel="Play selected" disabled={landingTargets.size > 0}
          onPlayIntent={(card) => play({ ...card, cardId: card.id, id: crypto.randomUUID(), playerKey: 'own', isOwn: true })}
          cards={ownHand.filter((card) => players[0]!.cards.some((entry) => entry.id === card.id))} /></GameTable.Dock>
        {players.map((player) => <GameTable.Play key={player.key} slotKey={player.key}>
          <GameCardStack.Pile playerKey={player.key} label={player.isOwn ? 'Own pile' : 'Rival pile'}
            cards={plays.filter((entry) => entry.playerKey === player.key)} />
        </GameTable.Play>)}
      </GameTable>
    </div>
  </>;
}

function flights(root: HTMLElement) { return [...root.querySelectorAll<HTMLElement>('[data-ui="card-flight"]')]; }
function required<T>(value: T | null | undefined): T { if (value == null) throw new Error('Missing fixture node'); return value; }
async function landed(root: HTMLElement) {
  await waitFor(() => expect(flights(root)).toHaveLength(0), { timeout: 2200 });
  await expect(root.querySelector('output')).toHaveTextContent('0');
}

// Sample before the interaction so no test depends on catching one particular phase of the flight.
function sampleFrames(root: HTMLElement, windowMs: number) {
  const samples = new Map<HTMLElement, { transforms: Set<string>; opacities: Set<string> }>();
  const started = performance.now();
  return new Promise<typeof samples>((resolve) => {
    const frame = () => {
      for (const node of flights(root)) {
        if (getComputedStyle(node).display === 'none') continue;
        const sample = samples.get(node) ?? { transforms: new Set<string>(), opacities: new Set<string>() };
        sample.transforms.add(getComputedStyle(node).transform);
        sample.opacities.add(getComputedStyle(required(node.querySelector('[data-ui="card-flight-shadow"]'))).opacity);
        samples.set(node, sample);
      }
      if (performance.now() - started < windowMs) requestAnimationFrame(frame);
      else resolve(samples);
    };
    requestAnimationFrame(frame);
  });
}
async function expectFlightSamples(samples: Awaited<ReturnType<typeof sampleFrames>>, count: number) {
  await expect(samples.size).toBe(count);
  for (const sample of samples.values()) {
    await expect(sample.transforms.size).toBeGreaterThan(3);
    await expect(sample.opacities.size).toBeGreaterThan(3);
    await expect([...sample.transforms].every((transform) => transform !== 'none')).toBe(true);
  }
}

export const DealOrderAndTracks: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(),
  render: () => <FlightScenarios />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(flights(canvasElement)).toHaveLength(0);
    await userEvent.tab();
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Deal hand' }));
    await expect(getComputedStyle(canvas.getByRole('button', { name: 'Deal hand' })).outlineStyle).not.toBe('none');
    const sampledDeal = sampleFrames(canvasElement, 1000);
    await userEvent.keyboard('{Enter}');
    const launched = flights(canvasElement);
    await expect(launched).toHaveLength(6);
    await expect(canvasElement.querySelector('output')).toHaveTextContent('6');
    for (const [index, node] of launched.entries()) {
      await expect(node.getAnimations()[0]?.effect?.getTiming().duration).toBe(motionDurationMs.cardDeal);
      await expect(node.getAnimations()[0]?.effect?.getTiming().delay).toBe(index * motionDurationMs.cardDealStagger);
      await expect(node.closest('[data-theme]')?.getAttribute('data-theme')).toBe('dark');
      const target = node.dataset.flightTarget!;
      const destination = target.startsWith('hand:')
        ? canvasElement.querySelector(`[data-hand-card="${target.slice(5)}"]`)
        : canvasElement.querySelector(`[data-seat-hidden-card="rival"][data-seat-hidden-card-index="${target.slice(-1)}"]`);
      await expect(getComputedStyle(required(destination)).visibility).toBe('hidden');
      const shadowTracks = required(node.querySelector('[data-ui="card-flight-shadow"]')).getAnimations();
      const shadowFrames = shadowTracks.flatMap((track) => track.effect instanceof KeyframeEffect ? track.effect.getKeyframes() : []);
      const peakOpacity = Number(required(shadowFrames.find((frame) => frame.offset === FLIGHT_GEOMETRY.offsets[1] && frame.opacity !== undefined)).opacity);
      await expect(peakOpacity).toBeGreaterThan(0);
      await expect(peakOpacity).toBeLessThan(1);
      await expect(shadowFrames.some((frame) => frame.offset === FLIGHT_GEOMETRY.offsets[1] && frame.transform === `scale(${FLIGHT_GEOMETRY.peakScale})`)).toBe(true);
    }
    await expectFlightSamples(await sampledDeal, 6);
    await landed(canvasElement);
    const sampledOwn = sampleFrames(canvasElement, 700);
    await userEvent.click(canvas.getByRole('button', { name: 'Play own' }));
    await expect(flights(canvasElement)[0]?.getAnimations()[0]?.effect?.getTiming().duration).toBe(400);
    await expectFlightSamples(await sampledOwn, 1);
    await landed(canvasElement);
    const sampledRival = sampleFrames(canvasElement, 800);
    await userEvent.click(canvas.getByRole('button', { name: 'Play rival' }));
    const rival = required(flights(canvasElement)[0]);
    const flip = required(rival.querySelector('[data-ui="card-flight-turn"]')).getAnimations()[0];
    await expect(flip?.effect?.getTiming().duration).toBe(364);
    await expect(flip?.effect?.getTiming().delay).toBe(78);
    await expectFlightSamples(await sampledRival, 1);
    await landed(canvasElement);
    await expect(canvas.getByRole('img', { name: 'A of spades' })).toBeVisible();
    await expect(canvas.getByRole('img', { name: '4 of hearts' })).toBeVisible();
  },
};

export const LightPortalTheme: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(),
  render: () => <FlightScenarios theme="light" initialPlayed />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Replace flight' }));
    await expect(required(flights(canvasElement)[0]).closest('[data-theme]')?.getAttribute('data-theme')).toBe('light');
    await landed(canvasElement);
  },
};
export const ResyncStartsInPlace: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(),
  render: () => <FlightScenarios initialDealt />,
  play: async ({ canvasElement, canvas, userEvent }) => {
    await expect(flights(canvasElement)).toHaveLength(0);
    await expect(canvas.getByRole('img', { name: 'A of spades' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Resync hand' }));
    await expect(flights(canvasElement)).toHaveLength(0);
    await expect(canvas.getByRole('img', { name: 'A of spades' })).toBeVisible();
  },
};
export const ReducedMotion: Story = {
  tags: ['!autodocs'],
  render: () => <FlightScenarios />,
  beforeEach: () => mockPreference(true),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Deal hand' }));
    await expect(flights(canvasElement)).toHaveLength(0);
    await expect(canvas.getByRole('img', { name: 'A of spades' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Play own' }));
    await expect(flights(canvasElement)).toHaveLength(0);
    await expect(canvas.getByRole('img', { name: 'A of spades' })).toBeVisible();
    preference.matches = false;
    preference.media?.dispatchEvent(new MediaQueryListEvent('change', { matches: false }));
    await userEvent.click(canvas.getByRole('button', { name: 'Play rival' }));
    await expect(flights(canvasElement)).toHaveLength(1);
    await expect(flights(canvasElement)[0]?.dataset.flightTarget).toBe('played:0-rival-rival:0');
    await landed(canvasElement);
  },
};
export const InterruptedFlightLands: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(),
  render: () => <><FlightScenarios initialPlayed /><StrictMode><FlightIdentityProbe /></StrictMode></>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Replace flight' }));
    const first = required(flights(canvasElement)[0]);
    const oldTracks = first.getAnimations({ subtree: true });
    await expect(oldTracks).toHaveLength(5);
    await userEvent.click(canvas.getByRole('button', { name: 'Replace flight' }));
    await expect(flights(canvasElement)[0]).not.toBe(first);
    await expect(first.isConnected).toBe(false);
    await expect(oldTracks.every((track) => track.playState !== 'running')).toBe(true);
    await expect(canvasElement.querySelector('output')).toHaveTextContent('1');
    await landed(canvasElement);
    await expect(canvas.getByRole('img', { name: 'A of spades' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Replace flight' }));
    const resetTracks = required(flights(canvasElement)[0]).getAnimations({ subtree: true });
    await userEvent.click(canvas.getByRole('button', { name: 'Reset flights' }));
    await landed(canvasElement);
    await expect(resetTracks.every((track) => track.playState !== 'running')).toBe(true);
    await expect(canvas.getByRole('img', { name: 'A of spades' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Replace flight' }));
    const unmountTracks = required(flights(canvasElement)[0]).getAnimations({ subtree: true });
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount board' }));
    await expect(flights(canvasElement)).toHaveLength(0);
    await expect(unmountTracks.every((track) => track.playState !== 'running')).toBe(true);
    await userEvent.click(canvas.getByRole('button', { name: 'Mount board' }));
    await expect(canvas.getByRole('img', { name: 'A of spades' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Start identity probe' }));
    const probe = required(canvasElement.querySelector<HTMLElement>('[data-identity-probe] [data-ui="card-flight"]'));
    const probeTracks = probe.getAnimations({ subtree: true });
    try {
      await expect(probeTracks).toHaveLength(5);
      await userEvent.click(canvas.getByRole('button', { name: 'Rerender identity probe' }));
      const afterRender = probe.getAnimations({ subtree: true });
      await expect(afterRender).toHaveLength(5);
      for (const [index, track] of probeTracks.entries()) await expect(afterRender[index]).toBe(track);
    } finally {
      await userEvent.click(canvas.getByRole('button', { name: 'Stop identity probe' }));
    }
    await expect(probeTracks.every((track) => track.playState !== 'running')).toBe(true);
  },
};
export const ReduceInFlight: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(),
  render: () => <FlightScenarios />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Deal hand' }));
    await expect(flights(canvasElement)).toHaveLength(6);
    preference.matches = true;
    preference.media?.dispatchEvent(new MediaQueryListEvent('change', { matches: true }));
    await landed(canvasElement);
    await expect(canvas.getByRole('img', { name: 'A of spades' })).toBeVisible();
  },
};
export const GeometryAndOrder: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(),
  render: () => <FlightScenarios initialDealt />,
  play: async ({ canvasElement }) => {
    for (const playerCount of [2, 4, 6]) {
      const players = Array.from({ length: playerCount }, (_, idx) => ({ key: `p${idx}`, idx, handSize: 9 })).reverse();
      const order = dealSequence(players, 1);
      await expect(order.map((step) => `${step.playerKey}:${step.cardIdx}`)).toEqual(
        Array.from({ length: 3 }, (_, cardIdx) => Array.from({ length: playerCount }, (_, index) => `p${(index + 1) % playerCount}:${cardIdx}`)).flat());
      await expect(motionDurationMs.cardDeal + (order.length - 1) * motionDurationMs.cardDealStagger).toBe(({ 2: 730, 4: 1150, 6: 1570 })[playerCount]);
    }
    const card = required(canvasElement.querySelector<HTMLElement>('[data-hand-card="own:0"]'));
    const parent = required(card.parentElement);
    const previousTransform = parent.style.transform;
    parent.style.transform = 'rotate(20deg) scale(1.2)';
    card.style.transform = 'rotate(10deg) scale(0.5)';
    try {
      const box = measureCardBox(card);
      await expect(box.rotate).toBeCloseTo(30, 3);
      await expect(box.width).toBeCloseTo(card.offsetWidth * 0.6, 2);
      await expect(box.height).toBeCloseTo(card.offsetHeight * 0.6, 2);
    } finally { parent.style.transform = previousTransform; card.style.transform = ''; }
  },
};

function firstPose(node: HTMLElement) {
  const effect = node.getAnimations()[0]?.effect;
  return effect instanceof KeyframeEffect ? effect.getKeyframes()[0]?.transform : undefined;
}
function originPose(box: ReturnType<typeof measureCardBox>, destination: HTMLElement) {
  const to = measureCardBox(destination);
  return `translate(${box.cx - to.width / 2}px, ${box.cy - to.height / 2}px) rotate(${box.rotate}deg) scale(${box.width / to.width})`;
}
async function expectOrigin(node: HTMLElement, box: ReturnType<typeof measureCardBox>, destination: HTMLElement) {
  const transform = firstPose(node);
  if (typeof transform !== 'string') throw new Error('Missing travel keyframes');
  const actual = new DOMMatrixReadOnly(transform);
  const expected = new DOMMatrixReadOnly(originPose(box, destination));
  for (const key of ['a', 'b', 'c', 'd', 'e', 'f'] as const) await expect(actual[key]).toBeCloseTo(expected[key], 2);
}

export const CapturedOrigin: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(),
  render: () => <FlightScenarios initialDealt />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const box = measureCardBox(required(canvasElement.querySelector<HTMLElement>('[data-hand-card="own:0"]')));
    await userEvent.click(canvas.getByRole('button', { name: 'Capture moved origin' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Play without capture' }));
    const destination = required(canvasElement.querySelector<HTMLElement>('[data-played-key="0-own-own:0"]'));
    await expectOrigin(required(flights(canvasElement)[0]), { ...box, cx: box.cx - 200, cy: box.cy - 100 }, destination);
    await landed(canvasElement);
    await expect(destination).toBeVisible();
  },
};
export const ExpiredOrigin: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(),
  render: () => <FlightScenarios initialDealt />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const box = measureCardBox(required(canvasElement.querySelector<HTMLElement>('[data-hand-card="own:0"]')));
    await userEvent.click(canvas.getByRole('button', { name: 'Capture moved origin' }));
    await new Promise((resolve) => setTimeout(resolve, FLIGHT_GEOMETRY.originTtlMs + 30));
    await userEvent.click(canvas.getByRole('button', { name: 'Play without capture' }));
    const destination = required(canvasElement.querySelector<HTMLElement>('[data-played-key="0-own-own:0"]'));
    await expectOrigin(required(flights(canvasElement)[0]), box, destination);
    await landed(canvasElement);
    await expect(destination).toBeVisible();
  },
};
export const LandingWaitsForAnimationCompletion: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(),
  render: () => <FlightScenarios initialPlayed />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Replace flight' }));
    const tracks = required(flights(canvasElement)[0]).getAnimations({ subtree: true });
    await expect(tracks.length).toBeGreaterThan(0);
    tracks.forEach((track) => track.pause());
    await new Promise((resolve) => setTimeout(resolve, motionDurationMs.cardPlay + 80));
    await expect(flights(canvasElement)).toHaveLength(1);
    await expect(getComputedStyle(required(canvasElement.querySelector('[data-played-key="0-own-own:0"]'))).visibility).toBe('hidden');
    tracks.forEach((track) => track.play());
    await landed(canvasElement);
    await expect(canvas.getByRole('img', { name: 'A of spades' })).toBeVisible();
    await expect(tracks.every((track) => track.playState !== 'running')).toBe(true);
  },
};

export const RealComponentsAndStagger: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(),
  render: () => <FlightScenarios />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const departures = new Map<string, number>();
    const scheduledDelays = new Map<string, number>();
    const pendingPaints: string[] = [];
    const started = performance.now();
    const sampling = new Promise<void>((resolve) => {
      const frame = () => {
        for (const node of flights(canvasElement)) {
          const track = node.getAnimations()[0];
          const visible = getComputedStyle(node).visibility === 'visible';
          const progress = track?.effect?.getComputedTiming().progress;
          const delay = Number(track?.effect?.getTiming().delay);
          if (Number.isFinite(delay) && !scheduledDelays.has(node.dataset.flightTarget!)) scheduledDelays.set(node.dataset.flightTarget!, delay);
          if (visible && Number(track?.currentTime) < Number(track?.effect?.getTiming().delay)) pendingPaints.push(node.dataset.flightTarget!);
          if (visible && progress !== null && progress !== undefined && progress > 0 && !departures.has(node.dataset.flightTarget!)) departures.set(node.dataset.flightTarget!, performance.now());
        }
        if (performance.now() - started < 1000) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Deal hand' }));
    await expect(canvasElement.querySelector('[data-ui="game-table"]')).not.toBeNull();
    await expect(canvasElement.querySelector('[data-ui="game-hand-card"][data-hand-card="own:0"]')).not.toBeNull();
    await expect(canvasElement.querySelector('[data-ui="game-hand-hidden-card"][data-seat-hidden-card="rival"][data-seat-hidden-card-index="0"]')).not.toBeNull();
    await sampling;
    await expect(pendingPaints).toEqual([]);
    await expect(departures.size).toBe(6);
    // Order is observed from real frames; the magnitude comes from the scheduled delays, which frames cannot compress.
    await expect(required(departures.get('hand:own:0'))).toBeGreaterThan(required(departures.get('seat:rival:0')));
    await expect(required(scheduledDelays.get('hand:own:0')) - required(scheduledDelays.get('seat:rival:0'))).toBe(motionDurationMs.cardDealStagger);
    const origin = measureCardBox(required(canvasElement.querySelector<HTMLElement>('[data-hand-card="own:0"]')));
    await userEvent.click(canvas.getByRole('button', { name: 'Play without capture' }));
    const destination = required(canvasElement.querySelector<HTMLElement>('[data-played-key="0-own-own:0"]'));
    await expectOrigin(required(flights(canvasElement)[0]), origin, destination);
    await landed(canvasElement);
    const hiddenOrigin = measureCardBox(required([...canvasElement.querySelectorAll<HTMLElement>('[data-seat-hidden-card="rival"]')].at(-1)));
    await userEvent.click(canvas.getByRole('button', { name: 'Play rival' }));
    await expectOrigin(required(flights(canvasElement)[0]), hiddenOrigin,
      required(canvasElement.querySelector<HTMLElement>('[data-played-key="0-rival-rival:0"]')));
    await landed(canvasElement);
  },
};

export const LandingFrameContinuity: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(),
  render: () => <FlightScenarios initialPlayed />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const destination = required(canvasElement.querySelector<HTMLElement>('[data-played-key="0-own-own:0"]'));
    const counts: number[] = [];
    const premature: number[] = [];
    let launched = false;
    let completed = false;
    const started = performance.now();
    const sampling = new Promise<void>((resolve) => {
      const frame = () => {
        const painted = flights(canvasElement).filter((node) => getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility === 'visible').length;
        counts.push(painted + (getComputedStyle(destination).visibility === 'visible' ? 1 : 0));
        if (launched && !completed && getComputedStyle(destination).visibility === 'visible') premature.push(performance.now() - started);
        if (performance.now() - started < 1450) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Replace flight' }));
    const tracks = required(flights(canvasElement)[0]).getAnimations({ subtree: true });
    tracks.forEach((track) => track.updatePlaybackRate(0.5));
    void required(tracks[0]).finished.then(() => { completed = true; }).catch(() => undefined);
    launched = true;
    await sampling;
    await expect(counts.length).toBeGreaterThan(10);
    await expect(counts.every((count) => count === 1)).toBe(true);
    await expect(premature).toEqual([]);
    await expect(completed).toBe(true);
    await landed(canvasElement);
  },
};

export const WaitingPortalStillLands: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(),
  render: () => <FlightScenarios initialPlayed portalReady={false} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Replace flight' }));
    await expect(flights(canvasElement)).toHaveLength(0);
    await expect(canvasElement.querySelector('output')).toHaveTextContent('1');
    const destination = required(canvasElement.querySelector<HTMLElement>('[data-played-key="0-own-own:0"]'));
    await expect(getComputedStyle(destination).visibility).toBe('hidden');
    await waitFor(() => expect(canvasElement.querySelector('output')).toHaveTextContent('0'));
    await expect(destination).toBeVisible();
  },
};

export const ResetForgetsOrigins: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(),
  render: () => <FlightScenarios initialDealt />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const box = measureCardBox(required(canvasElement.querySelector<HTMLElement>('[data-hand-card="own:0"]')));
    await userEvent.click(canvas.getByRole('button', { name: 'Capture moved origin' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reset flights' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Play without capture' }));
    const destination = required(canvasElement.querySelector<HTMLElement>('[data-played-key="0-own-own:0"]'));
    await expectOrigin(required(flights(canvasElement)[0]), box, destination);
    await landed(canvasElement);
    await expect(destination).toBeVisible();
  },
};

export const ExternalScope: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(),
  render: () => <FlightScenarios externalScope />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvasElement.querySelector('[data-ui="card-flights"]')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Deal hand' }));
    await expect(flights(canvasElement)).toHaveLength(6);
    await landed(canvasElement);
    await expect(canvas.getByRole('img', { name: 'A of spades' })).toBeVisible();
  },
};

function ScopeReplacement(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-scope-replacement />;
}

function ScopeCustomization() {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  return <CardFlightsProvider component={ScopeReplacement} ref={setRoot} title="Host title"
    className="host-scope" style={{ paddingBlock: 3, paddingInline: 4 }}
    slotProps={{ root: { title: 'Slot title', className: 'slot-scope', style: { paddingInline: 8 } } }}>
    <output aria-label="Root ref">{root?.dataset.ui ?? 'waiting'}</output>
  </CardFlightsProvider>;
}

export const OwnedScopeCustomization: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(),
  render: () => <StrictMode><ScopeCustomization /></StrictMode>,
  play: async ({ canvas, canvasElement }) => {
    const root = required(canvasElement.querySelector<HTMLElement>('[data-ui="card-flights"]'));
    await expect(root).toHaveAttribute('data-scope-replacement');
    await expect(root).toHaveAttribute('title', 'Slot title');
    await expect(root).toHaveClass('host-scope', 'slot-scope');
    await expect(root.style.paddingBlock).toBe('3px');
    await expect(root.style.paddingInline).toBe('8px');
    await expect(canvas.getByLabelText('Root ref')).toHaveTextContent('card-flights');
  },
};
