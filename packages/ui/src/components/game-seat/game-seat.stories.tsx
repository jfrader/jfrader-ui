import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { Avatar } from '../avatar';
import { Badge } from '../badge';
import { GameHand } from '../game-hand';
import { GameSeat } from './index';
import type { GameCardRootProps } from '../game-card/game-card-root';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const DURATION = 60000;
const turn = { deadline: NOW + DURATION, durationMs: DURATION, now: NOW + DURATION / 4 };
const meta = {
  title: 'Games/GameSeat', component: GameSeat, tags: ['autodocs'],
  args: {
    name: 'Alex', avatar: <Avatar name="Alex" size="lg" aria-hidden="true" />,
    badges: <Badge>Host</Badge>, points: 0, handCount: 3, turn,
    chat: <span aria-live="polite">Your turn · 45 seconds</span>,
  },
  parameters: { docs: {
    description: { component: 'Show a player, their hand and the current turn. Supply avatars, badges, points and chat in your game’s language.' },
    usage: `### Placement
GameTable.Seat is the region that places a player around the table. GameSeat is the player’s appearance inside that region; it also works on its own.

### Content
Pass name and any avatar, badges, points, chat or hand nodes. The shell does not choose avatar sizes, badge meanings or chat behavior. handCount renders a decorative GameHand.Hidden when hand is absent. Supply a labeled GameHand.Hidden through hand if the count needs an accessible description. null explicitly suppresses the hand shorthand.

### Turn
deadline and now are epoch milliseconds; durationMs is the full positive turn length. Inject now for server rendering and deterministic synchronization. Without now, the clock is sampled once per deadline. CSS drains the ring with no React ticks. Reduced motion keeps the sampled geometry without movement. A changed now resynchronizes it.
onTurnMilestone schedules at most three one-shot deadlines, never an interval: half (50% remaining), quarter (25%) and ending (zero). Past thresholds are skipped. Increasing a still-live deadline emits extended and starts a new threshold schedule. Removing the turn or callback cancels pending notifications. Callbacks may run late in background tabs.

### Accessibility
The seat is a named group, not an APG widget. It adds no keyboard bindings or focus target. The ring is decorative. Supply localized remaining-time text in chat or your own content; announce only turn changes or milestones, not ticks. Mark decorative avatars aria-hidden to avoid repeating the player name. turned, offline and dimmed are exposed as data attributes; supply visible state labels in your slots.

### Customization
slotProps accepts native props and css for root, avatar, name, badges, points, hand, timer and chat. component is sugar for slots.root; slots.root wins. Replacements forward props and ref to one div and are declared outside render. Root slot props win conflicts; className and style merge. Consumer css and sx apply after slot styles.`,
    source: { language: 'tsx', code: `<GameSeat name="Alex" avatar={<Avatar name="Alex" size="lg" aria-hidden="true" />}
  handCount={3} badges={<Badge>Host</Badge>}
  turn={{ deadline, durationMs: 60000, now }}
  chat={<span aria-live="polite">{remainingTimeLabel}</span>} />` },
  } },
} satisfies Meta<typeof GameSeat>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const seat = within(canvasElement).getByRole('group', { name: 'Alex' });
    await expect(seat).toHaveAttribute('data-turned', 'true');
    await expect(seat.querySelector('[data-ui="game-seat-points"]')).toHaveTextContent('0');
    await expect(seat.querySelector('[data-ui="game-seat-timer"]')).toHaveAttribute('aria-hidden', 'true');
  },
};
export const Light: Story = { globals: { theme: 'light' } };
export const Offline: Story = { args: { turn: undefined, offline: true, dimmed: true, badges: <Badge>Disconnected</Badge>, chat: undefined } };

/** Two seats show different remaining portions of the same turn. */
export const InjectedClock: Story = {
  render: (args) => <div style={{ display: 'flex', gap: vars.space[8] }}>
    <GameSeat {...args} name="Earlier" turn={turn} />
    <GameSeat {...args} name="Later" turn={{ ...turn, now: NOW + DURATION * 3 / 4 }} />
  </div>,
  parameters: { docs: { source: { language: 'tsx', code: `<GameSeat name="Earlier" avatar={avatar} turn={{ deadline, durationMs, now: earlier }} />
<GameSeat name="Later" avatar={avatar} turn={{ deadline, durationMs, now: later }} />` } } },
  play: async ({ canvasElement }) => {
    const circles = canvasElement.querySelectorAll('circle');
    await expect(circles[0]).toHaveAttribute('stroke-dashoffset', '25');
    await expect(circles[1]).toHaveAttribute('stroke-dashoffset', '75');
    await expect(Number.parseFloat(getComputedStyle(circles[1]!).strokeDashoffset)
      - Number.parseFloat(getComputedStyle(circles[0]!).strokeDashoffset)).toBeGreaterThan(45);
    const host = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(host);
    const root = createRoot(host);
    const interval = spyOn(window, 'setInterval');
    const timeout = spyOn(window, 'setTimeout');
    let intervals = 0;
    let timeouts = 0;
    try {
      flushSync(() => root.render(<StrictMode><GameSeat name="Measured" avatar={<Avatar name="Measured" aria-hidden="true" />} turn={turn} /></StrictMode>));
      flushSync(() => root.render(<StrictMode><GameSeat name="Measured" avatar={<Avatar name="Measured" aria-hidden="true" />} turn={{ ...turn, deadline: turn.deadline + DURATION }} /></StrictMode>));
      intervals = interval.mock.calls.length;
      timeouts = timeout.mock.calls.length;
    } finally {
      flushSync(() => root.unmount());
      host.remove();
      interval.mockRestore(); timeout.mockRestore();
    }
    await expect(intervals).toBe(0);
    await expect(timeouts).toBe(0);
  },
};

/** The hand slot replaces the decorative hand count, including in RTL. */
export const RtlAndReducedMotion: Story = {
  args: { dir: 'rtl', hand: <GameHand.Hidden count={2} size="sm" label="Two hidden cards" playerKey="alex" /> },
  play: async ({ canvasElement, args }) => {
    const seat = within(canvasElement).getByRole('group', { name: 'Alex' });
    await expect(getComputedStyle(seat).direction).toBe('rtl');
    await expect(seat.querySelectorAll('[data-ui="game-hand-hidden-card"]')).toHaveLength(2);
    await expect(within(seat).getByRole('img', { name: 'Two hidden cards' })).toBeVisible();
    const original = window.matchMedia.bind(window);
    const media = spyOn(window, 'matchMedia').mockImplementation((query) => {
      const result = original(query);
      if (query.includes('prefers-reduced-motion')) Object.defineProperty(result, 'matches', { value: true });
      return result;
    });
    const host = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(host);
    const root = createRoot(host);
    try {
      flushSync(() => root.render(<GameSeat {...args} name="Reduced" />));
      const circle = host.querySelector('circle')!;
      await expect(circle.style.strokeDashoffset).toBe('25');
    } finally {
      flushSync(() => root.unmount()); host.remove(); media.mockRestore();
    }
  },
};

export const Milestones: Story = {
  args: { onTurnMilestone: fn() },
  play: async ({ canvasElement }) => {
    const callback = fn();
    const scheduled: { callback: () => void; delay: number }[] = [];
    const host = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(host);
    const root = createRoot(host);
    const originalTimeout = window.setTimeout.bind(window);
    const timeout = spyOn(window, 'setTimeout').mockImplementation((handler, delay) => {
      if (typeof handler !== 'function') throw new Error('Expected function timer');
      scheduled.push({ callback: () => handler(), delay: delay ?? 0 });
      return originalTimeout(() => {}, delay) as unknown as ReturnType<typeof window.setTimeout>;
    });
    let delays: number[] = [];
    try {
      flushSync(() => root.render(<GameSeat name="Milestones" turn={turn} onTurnMilestone={callback} />));
      delays = scheduled.map(({ delay }) => delay);
      scheduled.forEach(({ callback: notify }) => notify());
    } finally {
      flushSync(() => root.unmount()); host.remove(); timeout.mockRestore();
    }
    await expect(delays).toEqual([15000, 30000, 45000]);
    await expect(callback.mock.calls.map(([milestone]) => milestone)).toEqual(['half', 'quarter', 'ending']);
  },
};

function Replacement(props: GameCardRootProps) {
  return <div {...props} data-replacement="slot" />;
}
function UnusedReplacement(props: GameCardRootProps) {
  return <div {...props} data-replacement="component" />;
}

/** Replace the root and pass native props to each generated part. */
export const Slots: Story = {
  args: {
    component: UnusedReplacement, slots: { root: Replacement }, hand: null, badges: 0, points: 0, chat: 0,
    className: 'host-class', style: { fontWeight: 400 }, title: 'Host title',
    slotProps: { root: { className: 'slot-class', style: { fontWeight: 700 }, title: 'Slot title' },
      name: { id: 'consumer-seat-name', title: 'Player' }, chat: { 'aria-live': 'polite' } },
  },
  play: async ({ canvasElement }) => {
    const seat = within(canvasElement).getByRole('group', { name: 'Alex' });
    await expect(seat).toHaveAttribute('data-replacement', 'slot');
    await expect(seat).toHaveAttribute('title', 'Slot title');
    await expect(seat).toHaveClass('host-class', 'slot-class');
    await expect(seat.style.fontWeight).toBe('700');
    await expect(seat).toHaveAttribute('aria-labelledby', 'consumer-seat-name');
    await expect(seat.querySelector('[data-ui="game-seat-hand"]')).toBeNull();
    for (const part of ['badges', 'points', 'chat']) {
      await expect(seat.querySelector(`[data-ui="game-seat-${part}"]`)).toHaveTextContent('0');
    }
  },
};

/** Omit now to sample the current clock at the start of each turn. */
export const SampledClock: Story = {
  tags: ['!autodocs'],
  args: { turn: undefined, chat: undefined },
  play: async ({ canvasElement }) => {
    const host = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(host);
    const root = createRoot(host);
    const originalClock = Date.now;
    let clockSamples = 0;
    Date.now = () => { clockSamples += 1; return NOW; };
    let samples: number[] = [];
    try {
      const sampledTurn = { deadline: NOW + DURATION, durationMs: DURATION };
      flushSync(() => root.render(<GameSeat name="Sampled" turn={sampledTurn} />));
      samples.push(clockSamples);
      flushSync(() => root.render(<GameSeat name="Same turn" turn={sampledTurn} points={0} />));
      samples.push(clockSamples);
      flushSync(() => root.render(<GameSeat name="New turn" turn={{ ...sampledTurn, deadline: NOW + DURATION * 2 }} />));
      samples.push(clockSamples);
    } finally {
      flushSync(() => root.unmount()); host.remove(); Date.now = originalClock;
    }
    await expect(samples).toEqual([1, 1, 2]);
  },
};
