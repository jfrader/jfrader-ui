import type { Meta, StoryObj } from '@storybook/react-vite';
import { StrictMode } from 'react';
import { expect, spyOn, waitFor } from 'storybook/test';
import { CardFlightsRegressionFixture as CardFlightsFixture, FlightIdentityProbe } from './card-flights-regression-fixture';
import { motionDurationMs } from '../../styling/motion-timings';
import { CardFlightsProvider } from './index';
import { FLIGHT_GEOMETRY, dealSequence, measureCardBox } from './geometry';

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

const meta = {
  title: 'Games/CardFlights/Regressions', component: CardFlightsProvider, tags: ['!autodocs'],
  args: { children: null, scopeRef: { current: null } },
  render: () => <CardFlightsFixture />,
  beforeEach: () => mockPreference(),
  parameters: { a11y: { test: 'error' }, docs: {
    description: { component: 'Deal cards to a hand and move played cards to their table piles.' },
    source: { code: `const boardRef = useRef<HTMLDivElement>(null);

<ThemeRoot theme="dark">
  <CardFlightsProvider scopeRef={boardRef}>
    <div ref={boardRef}>
      <MatchBoard />
    </div>
  </CardFlightsProvider>
</ThemeRoot>

// In MatchBoard:
useDealFlights({ handIndex, dealt, forehandIdx, players, resyncKey });
usePlayedCardFlights({ plays, playerCount, resyncKey });` },
    usage: `### Setup
- Wrap one board in \`CardFlightsProvider\` with its wrapper \`scopeRef\`. Portals inherit ThemeRoot tokens, appearance and portalContainer.
- Call \`useDealFlights\` and \`usePlayedCardFlights\` below the provider with labeled card records. Keep game rules and snapshot parsing in your app.
- GameTable supplies \`data-game-surface="true"\`. GameHand supplies \`data-hand-card={card.id}\`. Pass \`playerKey\` to a rival's GameHand.Hidden for hidden-card markers. Render GameCardStack.Pile with the same play records for destination markers.
- Destinations must be mounted and measurable in the same commit as the snapshot. Missing origins or destinations appear in place. A down flight never mounts its front content.

### Snapshots and landing
- Initial snapshots do not fly. Change \`resyncKey\` when applying a reconnect/resync snapshot. Played bursts larger than one round also appear in place.
- Deal order starts at forehandIdx, sorts player idx and deals at most three cards, one per player per round. Timings are 380ms with 70ms stagger. Own plays take 400ms; rivals take 520ms and reveal in flight.
- Capture an own card with \`useCardFlights().rememberPlayOrigin(key, elementOrBox)\` before accepting a click or drag. Origins expire after 4000ms and are consumed once; otherwise the preceding render supplies the origin.
- Mounted flights hide each destination until their animation tracks finish, then remove the painted flight before showing the destination. An unavailable portal completes at the duration deadline. Read \`landingTargets\` for app bookkeeping; do not write the destination's visibility while it is in flight.
- Replacing the same target stops all old tracks and starts a new flight. Old completions cannot land its replacement. Call \`reset()\` or remount the provider for a new match: pending destinations become visible and origins/baselines are cleared.
- Reduced motion skips flights and still advances both snapshot baselines. Enabling it in flight lands all pending cards immediately.

### Keyboard and content
- Flights are decorative, aria-hidden and noninteractive; there is no APG widget or keyboard command. Keep controls and named final cards in your app.
- Front/back nodes must fit the measured card frame; direct GameCard children fill it. Custom front content remains mounted during a reveal, so do not pass secret values.`,
  } },
} satisfies Meta<typeof CardFlightsProvider>;
export default meta;
type Story = StoryObj<typeof meta>;

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

export const DealAndPlay: Story = {
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

export const Light: Story = {
  render: () => <CardFlightsFixture theme="light" initialPlayed />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Replace flight' }));
    await expect(required(flights(canvasElement)[0]).closest('[data-theme]')?.getAttribute('data-theme')).toBe('light');
    await landed(canvasElement);
  },
};
export const InitialSnapshot: Story = {
  render: () => <CardFlightsFixture initialDealt />,
  play: async ({ canvasElement, canvas, userEvent }) => {
    await expect(flights(canvasElement)).toHaveLength(0);
    await expect(canvas.getByRole('img', { name: 'A of spades' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Resync hand' }));
    await expect(flights(canvasElement)).toHaveLength(0);
    await expect(canvas.getByRole('img', { name: 'A of spades' })).toBeVisible();
  },
};
export const ReducedMotion: Story = {
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
export const Interruption: Story = {
  render: () => <><CardFlightsFixture initialPlayed /><StrictMode><FlightIdentityProbe /></StrictMode></>,
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
  render: () => <CardFlightsFixture initialDealt />,
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
  render: () => <CardFlightsFixture initialDealt />,
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
  render: () => <CardFlightsFixture initialDealt />,
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
  render: () => <CardFlightsFixture initialPlayed />,
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
  render: () => <CardFlightsFixture initialPlayed />,
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
  render: () => <CardFlightsFixture initialPlayed portalReady={false} />,
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
  render: () => <CardFlightsFixture initialDealt />,
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
