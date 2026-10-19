import { StrictMode, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { Avatar } from '../avatar';
import { Badge } from '../badge';
import { Button } from '../button';
import { GameHand } from '../game-hand';
import { GameSeat, type GameSeatTurnMilestone } from './index';
import type { GameCardRootProps } from '../game-card/game-card-root';
import type { GameSeatPartProps, GameSeatSlotProps } from './game-seat';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const DURATION = 60000;
const turn = { deadline: NOW + DURATION, durationMs: DURATION, now: NOW + DURATION / 4 };
const ClockRow = styled.div({ display: 'flex', gap: vars.space[8] });
const TurnExample = styled.div({ display: 'grid', justifyItems: 'start', gap: vars.space[4] });
const TURN_MESSAGES = { ready: 'Ready', started: 'Your turn', half: 'Half time', quarter: 'Final quarter', ending: 'Turn ended', extended: 'Turn extended' };

const meta = {
  title: 'Games/GameSeat', component: GameSeat, tags: ['autodocs'],
  args: {
    name: 'Alex', avatar: <Avatar name="Alex" size="lg" aria-hidden="true" />,
    badges: <Badge>Host</Badge>, points: 0, handCount: 3, turn,
    chat: <span aria-live="polite">Your turn · 45 seconds</span>,
  },
  parameters: { docs: {
    description: { component: 'Show a player, their hand and the current turn. Supply avatars, badges, points and chat in your game’s language.' },
    usage: `## Placement
GameTable.Seat is the region that places a player around the table. GameSeat is the player’s appearance inside that region; it also works on its own.

## Content
Pass name and any avatar, badges, points, chat or hand nodes. The shell does not choose avatar sizes, badge meanings or chat behavior. handCount renders a decorative GameHand.Hidden when hand is absent. Pass handLabel with the consumer-localized count for assistive tech; supply a labeled GameHand.Hidden through hand only when you need different markup. null explicitly suppresses the hand shorthand.

## Turn
deadline and now are epoch milliseconds; durationMs is the full positive turn length. Inject now for server rendering and deterministic synchronization. Without now, the clock is sampled when deadline or durationMs changes. CSS drains the ring with no React ticks. Reduced motion keeps the sampled geometry without movement. A changed now resynchronizes it.
onTurnMilestone schedules at most three one-shot deadlines, never an interval: half (50% remaining), quarter (25%) and ending (zero). Past thresholds are skipped. Increasing a still-live deadline emits extended and starts a new threshold schedule. Removing the turn or callback cancels pending notifications. Callbacks may run late in background tabs.

## Accessibility
The seat is a named group, not an APG widget. It adds no keyboard bindings or focus target. The ring is decorative. Supply localized remaining-time text in chat or your own content; announce only turn changes or milestones, not ticks. Mark decorative avatars aria-hidden to avoid repeating the player name. turned, offline and dimmed are exposed as data attributes; supply visible state labels in your slots.

## Customization
slotProps accepts native props and css for root, avatar, name, badges, points, hand, timer and chat. component is sugar for slots.root; slots.root wins. Replacements forward props and ref to one div and are declared outside render. Root slot props win conflicts; className and style merge. Consumer css and sx apply after slot styles.`,
    source: { language: 'tsx', code: `import { Avatar, Badge } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

const durationMs = 60000;

const start = Date.parse('2026-10-14T12:00:00Z');

const turn = { deadline: start + durationMs, durationMs, now: start + durationMs / 4 };

<GameSeat name="Alex" avatar={<Avatar name="Alex" size="lg" aria-hidden="true" />}
  handCount={3} badges={<Badge>Host</Badge>} points={0} turn={turn}
  chat={<span aria-live="polite">Your turn · 45 seconds</span>} />` },
  } },
} satisfies Meta<typeof GameSeat>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Player seat displaying player identity, status badges, hand count, and turn timer ring. */
export const Default: Story = {
  name: 'Default',
  play: async ({ canvasElement }) => {
    const seat = within(canvasElement).getByRole('group', { name: 'Alex' });
    await expect(seat).toHaveAttribute('data-turned', 'true');
    await expect(seat.querySelector('[data-ui="game-seat-points"]')).toHaveTextContent('0');
    await expect(seat.querySelector('[data-ui="game-seat-timer"]')).toHaveAttribute('aria-hidden', 'true');
  },
};

/** Hidden hand count exposed to assistive tech without replacing the decorative fan. */
export const HandCountLabel: Story = {
  name: 'Accessible hand count',
  args: { handLabel: '3 hidden cards' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const seat = canvas.getByRole('group', { name: 'Alex' });
    const label = canvas.getByText('3 hidden cards');
    await expect(label).toHaveAttribute('data-ui', 'game-seat-hand-label');
    await expect(seat.contains(label)).toBe(true);
  },
};

/** Display player seat in light theme with turn timer ring. */
export const Light: Story = {
  name: 'Light theme',
  globals: { theme: 'light' },
  parameters: { docs: { source: { language: 'tsx', code: `import { Avatar, Badge, ThemeRoot } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

const durationMs = 60000;
const start = Date.parse('2026-10-14T12:00:00Z');
const turn = { deadline: start + durationMs, durationMs, now: start + durationMs / 4 };

<ThemeRoot theme="light">
  <GameSeat name="Alex" avatar={<Avatar name="Alex" size="lg" aria-hidden="true" />}
    handCount={3} badges={<Badge>Host</Badge>} points={0} turn={turn}
    chat={<span aria-live="polite">Your turn · 45 seconds</span>} />
</ThemeRoot>` } } },
};

/** Display disconnected player with dimmed avatar and badges. */
export const Offline: Story = {
  name: 'Offline player',
  args: { turn: undefined, offline: true, dimmed: true, badges: <Badge>Disconnected</Badge>, chat: undefined },
  parameters: { docs: { source: { language: 'tsx', code: `import { Avatar, Badge } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

<GameSeat name="Alex" avatar={<Avatar name="Alex" size="lg" aria-hidden="true" />}
  handCount={3} badges={<Badge>Disconnected</Badge>} points={0} offline dimmed />` } } },
};

/** Display active turn countdown ring when avatar is omitted. */
export const TimerOnly: Story = {
  name: 'Turn timer only',
  args: { avatar: undefined },
  parameters: { docs: { source: { language: 'tsx', code: `import { Badge } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

const durationMs = 60000;

const start = Date.parse('2026-10-14T12:00:00Z');

const turn = { deadline: start + durationMs, durationMs, now: start + durationMs / 4 };

<GameSeat name="Alex"
  handCount={3} badges={<Badge>Host</Badge>} points={0} turn={turn}
  chat={<span aria-live="polite">Your turn · 45 seconds</span>} />` } } },
  play: async ({ canvasElement }) => {
    const anchor = canvasElement.querySelector<HTMLElement>('[data-ui~="game-seat-avatar"]')!;
    const probe = anchor.ownerDocument.createElement('div');
    probe.style.inlineSize = vars.space[10];
    probe.style.blockSize = vars.space[10];
    anchor.ownerDocument.body.append(probe);
    try {
      const expected = probe.getBoundingClientRect();
      const actual = anchor.getBoundingClientRect();
      await expect(actual.width).toBe(expected.width);
      await expect(actual.height).toBe(expected.height);
      await expect(anchor.querySelector('[data-ui~="game-seat-timer"]')).not.toBeNull();
    } finally { probe.remove(); }
  },
};

function ReplacementDiv(props: GameSeatPartProps) { return <div {...props} data-replacement="true" />; }
function ReplacementName(props: NonNullable<GameSeatSlotProps['name']>) { return <span {...props} data-replacement="true" />; }
function ReplacementTimer(props: NonNullable<GameSeatSlotProps['timer']>) { return <svg {...props} data-replacement="true" />; }

/** Replace every interior anatomy part with custom elements. */
export const InteriorReplacements: Story = {
  name: 'Replace the seat interior',
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { Avatar, Badge } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

const durationMs = 60000;
const start = Date.parse('2026-10-14T12:00:00Z');
const turn = { deadline: start + durationMs, durationMs, now: start + durationMs / 4 };

function ReplacementDiv(props: ComponentPropsWithRef<'div'>) { return <div {...props} data-replacement="true" />; }
function ReplacementName(props: ComponentPropsWithRef<'span'>) { return <span {...props} data-replacement="true" />; }
function ReplacementTimer(props: ComponentPropsWithRef<'svg'>) { return <svg {...props} data-replacement="true" />; }

<GameSeat name="Alex" avatar={<Avatar name="Alex" size="lg" aria-hidden="true" />}
  handCount={3} badges={<Badge>Host</Badge>} points={0} turn={turn}
  chat={<span aria-live="polite">Your turn · 45 seconds</span>} slots={{ avatar: ReplacementDiv, name: ReplacementName, badges: ReplacementDiv,
    points: ReplacementDiv, hand: ReplacementDiv, timer: ReplacementTimer, chat: ReplacementDiv }}
  slotProps={{ avatar: { 'data-ui': 'consumer consumer game-seat-avatar' }, name: { 'data-ui': 'consumer consumer' } }}/>` } } },
  args: {
    slots: { avatar: ReplacementDiv, name: ReplacementName, badges: ReplacementDiv, points: ReplacementDiv,
      hand: ReplacementDiv, timer: ReplacementTimer, chat: ReplacementDiv },
    slotProps: { avatar: { 'data-ui': 'consumer consumer game-seat-avatar' }, name: { 'data-ui': 'consumer consumer' } },
  },
  play: async ({ canvasElement }) => {
    for (const part of ['avatar', 'name', 'badges', 'points', 'hand', 'timer', 'chat']) {
      const element = canvasElement.querySelector<HTMLElement>(`[data-ui~="game-seat-${part}"]`)!;
      await expect(element).toHaveAttribute('data-replacement', 'true');
      await expect(element.className).not.toBe('');
    }
    const avatar = canvasElement.querySelector('[data-ui~="game-seat-avatar"]')!;
    await expect(avatar).toHaveAttribute('data-ui', 'game-seat-avatar consumer');
    await expect(within(canvasElement).getByRole('group', { name: 'Alex' })).toBeVisible();
  },
};

/** Two seats show different remaining portions of the same turn. */
export const InjectedClock: Story = {
  name: 'Injected clock',
  render: (args) => <ClockRow>
    <GameSeat {...args} name="Earlier" turn={turn} />
    <GameSeat {...args} name="Later" turn={{ ...turn, now: NOW + DURATION * 3 / 4 }} />
  </ClockRow>,
  parameters: { docs: { source: { language: 'tsx', code: `import { Avatar, Badge, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameSeat } from '@jfrader/ui/game-seat';

const durationMs = 60000;
const start = Date.parse('2026-10-14T12:00:00Z');
const turn = { deadline: start + durationMs, durationMs, now: start + durationMs / 4 };

const ClockRow = styled.div({ display: 'flex', gap: vars.space[8] });

const common = {
  avatar: <Avatar name="Alex" size="lg" aria-hidden="true" />,
  badges: <Badge>Host</Badge>, points: 0, handCount: 3,
  chat: <span aria-live="polite">Your turn · 45 seconds</span>,
};

<ClockRow>
  <GameSeat {...common} name="Earlier" turn={turn} />
  <GameSeat {...common} name="Later" turn={{ ...turn, now: start + durationMs * 3 / 4 }} />
</ClockRow>` } } },
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

/** Display right-to-left seat layout with custom hand cards. */
export const RtlAndReducedMotion: Story = {
  name: 'RTL and reduced motion',
  args: { dir: 'rtl', hand: <GameHand.Hidden count={2} size="sm" label="Two hidden cards" playerKey="alex" /> },
  parameters: { docs: { source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';
import { Avatar, Badge } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

const durationMs = 60000;

const start = Date.parse('2026-10-14T12:00:00Z');

const turn = { deadline: start + durationMs, durationMs, now: start + durationMs / 4 };

<GameSeat name="Alex" avatar={<Avatar name="Alex" size="lg" aria-hidden="true" />}
  handCount={3} badges={<Badge>Host</Badge>} points={0} turn={turn}
  chat={<span aria-live="polite">Your turn · 45 seconds</span>} dir="rtl" hand={<GameHand.Hidden count={2} size="sm" label="Two hidden cards" playerKey="alex" />}/>` } } },
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
  tags: ['!autodocs'],
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

function TurnNotifications() {
  const [startedAt, setStartedAt] = useState<number>();
  const [milestone, setMilestone] = useState<GameSeatTurnMilestone | 'ready' | 'started'>('ready');
  return <TurnExample>
    <Button onClick={() => { setStartedAt(Date.now()); setMilestone('started'); }}>Start turn</Button>
    <GameSeat name="Alex" handCount={3}
      turn={startedAt === undefined ? undefined : { deadline: startedAt + DURATION, durationMs: DURATION, now: startedAt }}
      onTurnMilestone={setMilestone} chat={<span aria-live="polite">{TURN_MESSAGES[milestone]}</span>} />
  </TurnExample>;
}

/** Turn announcements update live chat at milestone intervals. */
export const TurnMilestoneNotifications: Story = {
  name: 'Turn announcements',
  render: () => <TurnNotifications />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const seat = canvas.getByRole('group', { name: 'Alex' });
    await expect(within(seat).getByText('Ready')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Start turn' }));
    await expect(seat).toHaveAttribute('data-turned', 'true');
    await expect(within(seat).getByText('Your turn')).toBeVisible();
  },
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameSeat, type GameSeatTurnMilestone } from '@jfrader/ui/game-seat';

const DURATION = 60000;
const TurnExample = styled.div({ display: 'grid', justifyItems: 'start', gap: vars.space[4] });
const TURN_MESSAGES = { ready: 'Ready', started: 'Your turn', half: 'Half time', quarter: 'Final quarter', ending: 'Turn ended', extended: 'Turn extended' };

export default function TurnNotifications() {
  const [startedAt, setStartedAt] = useState<number>();
  const [milestone, setMilestone] = useState<GameSeatTurnMilestone | 'ready' | 'started'>('ready');
  return <TurnExample>
    <Button onClick={() => { setStartedAt(Date.now()); setMilestone('started'); }}>Start turn</Button>
    <GameSeat name="Alex" handCount={3}
      turn={startedAt === undefined ? undefined : { deadline: startedAt + DURATION, durationMs: DURATION, now: startedAt }}
      onTurnMilestone={setMilestone} chat={<span aria-live="polite">{TURN_MESSAGES[milestone]}</span>} />
  </TurnExample>;
}` } } },
};

function Replacement(props: GameCardRootProps) {
  return <div {...props} data-replacement="slot" />;
}
function UnusedReplacement(props: GameCardRootProps) {
  return <div {...props} data-replacement="component" />;
}

/** Replace the root and pass native props to each generated part. */
export const Slots: Story = {
  name: 'Replace every part',
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { Avatar } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

const durationMs = 60000;
const start = Date.parse('2026-10-14T12:00:00Z');
const turn = { deadline: start + durationMs, durationMs, now: start + durationMs / 4 };

function Replacement(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="slot" />;
}

function UnusedReplacement(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="component" />;
}

<GameSeat name="Alex" avatar={<Avatar name="Alex" size="lg" aria-hidden="true" />}
  handCount={3} turn={turn} hand={null} badges={0} points={0} chat={0}
  component={UnusedReplacement} slots={{ root: Replacement }}
  className="host-class" style={{ fontWeight: 400 }} title="Host title"
  slotProps={{ root: { className: 'slot-class', style: { fontWeight: 700 }, title: 'Slot title' },
    name: { id: 'consumer-seat-name', title: 'Player' }, chat: { 'aria-live': 'polite' } }} />` } } },
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

export const RescheduledClock: Story = {
  tags: ['!autodocs'],
  args: { turn: undefined, chat: undefined },
  play: async ({ canvasElement }) => {
    const host = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(host);
    const root = createRoot(host);
    let now = NOW;
    let timerId = 0;
    const pending = new Map<number, { at: number; notify: () => void }>();
    const originalClock = Date.now;
    Date.now = () => now;
    const timeout = spyOn(window, 'setTimeout').mockImplementation((handler, delay) => {
      if (typeof handler !== 'function') throw new Error('Expected function timer');
      const id = ++timerId;
      pending.set(id, { at: now + (delay ?? 0), notify: () => handler() });
      return id as unknown as ReturnType<typeof window.setTimeout>;
    });
    const clear = spyOn(window, 'clearTimeout').mockImplementation((id) => {
      if (typeof id === 'number') pending.delete(id);
    });
    const advance = (target: number) => {
      for (;;) {
        const next = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        now = next[1].at;
        pending.delete(next[0]);
        next[1].notify();
      }
      now = target;
    };
    const notifications: { milestone: string; at: number }[] = [];
    const callback = (milestone: string) => { notifications.push({ milestone, at: now }); };
    let transition = '';
    let remainingOffset = '';
    let due: number[] = [];
    let lateDue: number[] = [];
    const lateNotifications: string[] = [];
    try {
      const sampledTurn = { deadline: NOW + DURATION, durationMs: DURATION };
      flushSync(() => root.render(<GameSeat name="Rescheduled" turn={sampledTurn} />));
      advance(NOW + DURATION / 4);
      flushSync(() => root.render(<GameSeat name="Rescheduled" turn={sampledTurn} onTurnMilestone={callback} />));
      due = [...pending.values()].map(({ at }) => at);
      advance(NOW + DURATION);
      flushSync(() => root.render(<GameSeat name="Duration" turn={{ deadline: NOW + DURATION * 2, durationMs: DURATION }} />));
      advance(NOW + DURATION * 1.5);
      flushSync(() => root.render(<GameSeat name="Duration" turn={{ deadline: NOW + DURATION * 2, durationMs: DURATION * 2 }} />));
      const circle = host.querySelector('circle')!;
      transition = circle.style.transitionDuration;
      remainingOffset = circle.getAttribute('stroke-dashoffset')!;
      advance(NOW + DURATION * 2);
      const lateTurn = { deadline: NOW + DURATION * 3, durationMs: DURATION };
      flushSync(() => root.render(<GameSeat name="Late" turn={lateTurn} />));
      advance(NOW + DURATION * 2.625);
      flushSync(() => root.render(<GameSeat name="Late" turn={lateTurn} onTurnMilestone={(milestone) => lateNotifications.push(milestone)} />));
      lateDue = [...pending.values()].map(({ at }) => at);
      advance(lateTurn.deadline);
    } finally {
      flushSync(() => root.unmount()); host.remove();
      Date.now = originalClock; timeout.mockRestore(); clear.mockRestore();
    }
    await expect(due).toEqual([NOW + DURATION / 2, NOW + DURATION * 3 / 4, NOW + DURATION]);
    await expect(notifications).toEqual([
      { milestone: 'half', at: NOW + DURATION / 2 },
      { milestone: 'quarter', at: NOW + DURATION * 3 / 4 },
      { milestone: 'ending', at: NOW + DURATION },
    ]);
    await expect(transition).toBe('30000ms');
    await expect(remainingOffset).toBe('75');
    await expect(lateDue).toEqual([NOW + DURATION * 2.75, NOW + DURATION * 3]);
    await expect(lateNotifications).toEqual(['quarter', 'ending']);
  },
};
