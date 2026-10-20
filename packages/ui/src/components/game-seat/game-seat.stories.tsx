import { StrictMode, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../index';
import { Avatar } from '../avatar';
import { Badge } from '../badge';
import { Button } from '../button';
import { GameHand } from '../game-hand';
import { GameSeat, type GameSeatTurnMilestone } from './index';
import type { GameCardRootProps } from '../game-card/game-card-root';
import type { GameSeatPartProps, GameSeatSlotProps } from './game-seat';

const DURATION = 60000;
const turn = { remainingMs: DURATION * 0.75, durationMs: DURATION };
const ClockRow = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[8] });
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
    description: { component: 'Place a player’s identity, score and turn status at the table edge, or show their hand and chat in a standalone panel.' },
    sections: [
      { title: 'At the table', stories: ['Default', 'Panel', 'Count'] },
    ],
    usage: `### When to use
Show a player's identity and turn status on its own or inside a GameTable seat region. GameSeat does not position players around the board or enforce turn rules.

The default chip reserves its avatar footprint. Its hidden-card fan is decorative, capped at three backs and absolutely positioned around the avatar. Changing handCount never resizes the chip. Use handDisplay="count" with formatHandCount for localized count text, or "none" to hide the shorthand. Custom hand content overrides handDisplay. Chat is shown only in variant="panel".

### Clock constraints

Pass turn={{ remainingMs, durationMs }} from authoritative game state, including for server rendering. The caller owns time: GameSeat never samples a clock or schedules timers. The ring shows the supplied fraction, clamped between zero and one, without a ticking animation. turned defaults to false independently of turn.

Updating remainingMs crosses half (50%), quarter (25%) and ending (zero); a jump across several thresholds emits each in order, once per crossing. Initial values do not emit past milestones. Increasing remainingMs emits extended and rearms thresholds above the new value. Clear turn between turns to start fresh. Use authoritative game state to enforce a deadline.

### Keyboard and accessibility

The seat is a named group, not an interactive widget, and adds no focus target or keyboard bindings. The timer ring and shorthand hand are decorative. Supply localized time text, visible offline status and a labeled hidden hand when its count needs announcing. Announce turn changes or milestones, not ticks. Mark decorative avatars aria-hidden to avoid repeating the player's name.`,
    source: { language: 'tsx', code: `import { Avatar, Badge } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

<GameSeat name="Alex" avatar={<Avatar name="Alex" size="lg" aria-hidden="true" />}
  handCount={3} badges={<Badge>Host</Badge>} points={0}
  turn={{ remainingMs: 45000, durationMs: 60000 }}
  chat={<span aria-live="polite">Your turn · 45 seconds</span>} />` },
  } },
} satisfies Meta<typeof GameSeat>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Player identity, hand count and caller-owned remaining time. */
export const Default: Story = {
  name: 'Player seat',
  parameters: { docs: { description: { story: 'Show a player with host status, points, hidden cards and a turn timer.' } } },
  play: async ({ canvas, canvasElement }) => {
    const seat = canvas.getByRole('group', { name: 'Alex' });
    await expect(seat).toHaveAttribute('data-turned', 'false');
    await expect(seat.querySelector('[data-ui="game-seat-points"]')).toHaveTextContent('0');
    await expect(canvasElement.querySelector('[data-ui="game-seat-timer"]')).toHaveAttribute('aria-hidden', 'true');
    await expect(canvasElement.querySelector('circle')).toHaveAttribute('stroke-dashoffset', '25');
  },
};
export const Panel: Story = {
  name: 'Player panel', args: { variant: 'panel' },
  parameters: { docs: { source: { language: 'tsx', code: `import { Avatar } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

<GameSeat variant="panel" name="Alex" avatar={<Avatar name="Alex" aria-hidden="true" />}
  handCount={3} points={35} chat="Your turn" />` } } },
};
export const Count: Story = {
  name: 'Compact hand count', args: { handDisplay: 'count', locale: 'en-US', formatHandCount: (_count, value) => `${value} cards` },
  parameters: { docs: { source: { language: 'tsx', code: `import { GameSeat } from '@jfrader/ui/game-seat';

<GameSeat name="Alex" handCount={3} handDisplay="count" locale="en-US"
  formatHandCount={(_count, value) => value + ' cards'} points={35} />` } } },
  play: async ({ canvas }) => { await expect(canvas.getByText('3 cards')).toBeVisible(); },
};
export const Winner: Story = {
  tags: ['!autodocs'], args: { state: 'winner', turn: undefined, badges: <Badge>Won the trick</Badge> },
};
export const WinnerWithTimer: Story = {
  tags: ['!autodocs'], args: { state: 'winner', turn, badges: <Badge>Won the trick</Badge> },
  play: async ({ canvas }) => {
    const seat = canvas.getByRole('group', { name: 'Alex' });
    await expect(seat).toHaveAttribute('data-state', 'winner');
    const avatar = seat.querySelector('[data-ui="game-seat-avatar"]')!;
    const timer = seat.querySelector('[data-ui="game-seat-timer"]')!;
    await expect(getComputedStyle(timer).stroke).toBe(getComputedStyle(avatar).outlineColor);
    await expect(timer.querySelector('circle')).toHaveAttribute('stroke-dashoffset', '25');
  },
};
export const ForcedColors: Story = {
  name: 'Game Seat Forced Colors', tags: ['!autodocs'],
  args: { state: 'winner', turn, badges: <Badge>Won the trick</Badge> },
  play: async ({ canvas, canvasElement }) => {
    await expect(window.matchMedia('(forced-colors: active)').matches).toBe(true);
    const seat = canvas.getByRole('group', { name: 'Alex' });
    await expect(seat).toHaveTextContent('Won the trick');
    const avatar = seat.querySelector('[data-ui="game-seat-avatar"]')!;
    const timer = seat.querySelector('[data-ui="game-seat-timer"]')!;
    await expect(getComputedStyle(avatar).outlineStyle).toBe('double');
    await expect(getComputedStyle(avatar).outlineWidth).toBe('3px');
    await expect(getComputedStyle(timer).stroke).toBe(getComputedStyle(avatar).outlineColor);
    await expect(timer).toHaveAttribute('aria-hidden', 'true');
    await expect(canvasElement.querySelectorAll('[data-ui="game-hand-hidden-card"]')).toHaveLength(3);
    await expect(canvasElement.getAnimations({ subtree: true })).toHaveLength(0);
  },
};
export const Active: Story = {
  tags: ['!autodocs'], args: { state: 'active', turned: true, badges: <Badge>Your turn</Badge> },
};
export const StableFootprint: Story = {
  tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    const host = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(host);
    const root = createRoot(host);
    const ref = fn();
    let previous: Element | null = null;
    let bounds: DOMRect | undefined;
    try {
      for (const count of [0, 1, 3, 50, 0]) {
        flushSync(() => root.render(<GameSeat ref={ref} name="Alex" avatar={<Avatar name="Alex" aria-hidden="true" />}
          handCount={count} points={count} badges={count > 3 ? <Badge>Won the trick</Badge> : undefined} />));
        const seat = host.querySelector('[data-ui~="game-seat"]')!;
        const current = seat.getBoundingClientRect();
        if (bounds) {
          await expect(current.width).toBe(bounds.width);
          await expect(current.height).toBe(bounds.height);
          await expect(seat).toBe(previous);
        }
        bounds = current;
        previous = seat;
        await expect(host.querySelectorAll('[data-ui="game-hand-hidden-card"]')).toHaveLength(Math.min(count, 3));
        await expect(host.querySelector('[data-ui="game-seat-chat"]')).toBeNull();
        await expect(ref).toHaveBeenCalledWith(seat);
      }
    } finally { flushSync(() => root.unmount()); host.remove(); }
  },
};
export const Light: Story = {
  tags: ['!autodocs'],
  ...Default, name: 'Light theme', globals: { theme: 'light' },
  parameters: { docs: { source: { language: 'tsx', code: `import { Avatar, Badge, ThemeRoot } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

<ThemeRoot theme="light">
  <GameSeat name="Alex" avatar={<Avatar name="Alex" size="lg" aria-hidden="true" />}
    handCount={3} badges={<Badge>Host</Badge>} points={0}
    turn={{ remainingMs: 45000, durationMs: 60000 }}
    chat={<span aria-live="polite">Your turn · 45 seconds</span>} />
</ThemeRoot>` } } },
};
export const Offline: Story = {
  tags: ['!autodocs'],
  name: 'Offline player',
  args: { turn: undefined, offline: true, dimmed: true, badges: <Badge>Disconnected</Badge>, chat: undefined },
  parameters: { docs: { description: { story: 'Pair a dimmed player seat with a visible disconnected label.' }, source: { language: 'tsx', code: `import { Avatar, Badge } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

<GameSeat name="Alex" avatar={<Avatar name="Alex" aria-hidden="true" />}
  offline dimmed badges={<Badge>Disconnected</Badge>} points={0} handCount={3} />` } } },
};
export const TurnedWithoutTimer: Story = {
  tags: ['!autodocs'], args: { turned: true, turn: undefined },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('group')).toHaveAttribute('data-turned', 'true');
    await expect(canvasElement.querySelector('circle')).toBeNull();
  },
};
export const TimerOnly: Story = {
  tags: ['!autodocs'],
  name: 'Turn timer only',
  args: { avatar: undefined },
  parameters: { docs: { description: { story: 'Keep the turn countdown ring when no avatar is supplied.' }, source: { language: 'tsx', code: `import { GameSeat } from '@jfrader/ui/game-seat';

<GameSeat name="Alex" turn={{ remainingMs: 45000, durationMs: 60000 }}
  chat={<span>Your turn · 45 seconds</span>} />` } } },
  play: async ({ canvasElement }) => {
    const anchor = canvasElement.querySelector<HTMLElement>('[data-ui~="game-seat-avatar"]')!;
    await expect(anchor).toHaveAttribute('data-timer-only', 'true');
    await expect(anchor.getBoundingClientRect().width).toBeGreaterThan(0);
    await expect(anchor.getBoundingClientRect().height).toBe(anchor.getBoundingClientRect().width);
  },
};

function ReplacementDiv(props: GameSeatPartProps) { return <div {...props} data-replacement="true" />; }
function ReplacementName(props: NonNullable<GameSeatSlotProps['name']>) { return <span {...props} data-replacement="true" />; }
function ReplacementTimer(props: NonNullable<GameSeatSlotProps['timer']>) { return <svg {...props} data-replacement="true" />; }
export const InteriorReplacements: Story = {
  tags: ['!autodocs'],
  name: 'Replace the seat interior',
  parameters: { docs: { description: { story: 'Replace the interior elements while retaining the player name and timer semantics.' }, source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { Avatar, Badge } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

const durationMs = 60000;
const turn = { remainingMs: durationMs * 0.75, durationMs };

function ReplacementDiv(props: ComponentPropsWithRef<'div'>) { return <div {...props} data-replacement="true" />; }
function ReplacementName(props: ComponentPropsWithRef<'span'>) { return <span {...props} data-replacement="true" />; }
function ReplacementTimer(props: ComponentPropsWithRef<'svg'>) { return <svg {...props} data-replacement="true" />; }

<GameSeat name="Alex" avatar={<Avatar name="Alex" size="lg" aria-hidden="true" />}
  handCount={3} badges={<Badge>Host</Badge>} points={0} turn={turn}
  chat={<span aria-live="polite">Your turn · 45 seconds</span>} slots={{ avatar: ReplacementDiv, name: ReplacementName, badges: ReplacementDiv,
    points: ReplacementDiv, hand: ReplacementDiv, timer: ReplacementTimer, chat: ReplacementDiv }}
  slotProps={{ avatar: { 'data-ui': 'consumer consumer game-seat-avatar' }, name: { 'data-ui': 'consumer consumer' } }}/>` } } },
  args: {
    variant: 'panel',
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
    await expect(canvasElement.querySelector('[data-ui~="game-seat-avatar"]')).toHaveAttribute('data-ui', 'game-seat-avatar consumer');
  },
};

/** Two explicit remaining-time values, with no internal clock or scheduled notifications. */
export const InjectedClock: Story = {
  tags: ['!autodocs'],
  name: 'Synchronized turn clocks',
  render: (args) => <ClockRow>
    <GameSeat {...args} name="Earlier" turn={turn} />
    <GameSeat {...args} name="Later" turn={{ ...turn, remainingMs: DURATION / 4 }} chat={<span>Your turn · 15 seconds</span>} />
  </ClockRow>,
  parameters: { docs: { description: { story: 'Compare earlier and later clock samples within the same turn.' }, source: { language: 'tsx', code: `import { Avatar, Badge, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameSeat } from '@jfrader/ui/game-seat';

const durationMs = 60000;
const turn = { remainingMs: durationMs * 0.75, durationMs };

const ClockRow = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[8] });

const common = {
  avatar: <Avatar name="Alex" size="lg" aria-hidden="true" />,
  badges: <Badge>Host</Badge>, points: 0, handCount: 3,
  chat: <span aria-live="polite">Your turn · 45 seconds</span>,
};

<ClockRow>
  <GameSeat {...common} name="Earlier" turn={turn} />
  <GameSeat {...common} name="Later" turn={{ ...turn, remainingMs: durationMs / 4 }}
    chat={<span aria-live="polite">Your turn · 15 seconds</span>} />
</ClockRow>` } } },
  play: async ({ canvasElement }) => {
    const circles = canvasElement.querySelectorAll('circle');
    await expect(circles[0]).toHaveAttribute('stroke-dashoffset', '25');
    await expect(circles[1]).toHaveAttribute('stroke-dashoffset', '75');
    await expect(getComputedStyle(circles[0]!.closest('[data-ui~="game-seat"]')!.parentElement!).flexWrap).toBe('wrap');
    const host = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(host);
    const root = createRoot(host);
    const interval = spyOn(window, 'setInterval');
    const timeout = spyOn(window, 'setTimeout');
    const clock = spyOn(Date, 'now');
    let calls: number[] = [];
    try {
      const callback = fn();
      flushSync(() => root.render(<StrictMode><GameSeat name="Measured" turn={turn} onTurnMilestone={callback} /></StrictMode>));
      flushSync(() => root.render(<StrictMode><GameSeat name="Measured" turn={{ ...turn, remainingMs: 0 }} onTurnMilestone={callback} /></StrictMode>));
      calls = [interval.mock.calls.length, timeout.mock.calls.length, clock.mock.calls.length];
    } finally {
      flushSync(() => root.unmount()); host.remove();
      interval.mockRestore(); timeout.mockRestore(); clock.mockRestore();
    }
    await expect(calls).toEqual([0, 0, 0]);
  },
};
export const RtlAndReducedMotion: Story = {
  tags: ['!autodocs'],
  name: 'RTL and reduced motion',
  args: { dir: 'rtl', hand: <GameHand.Hidden count={2} size="sm" label="Two hidden cards" playerKey="alex" /> },
  parameters: { docs: { source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';
import { Avatar, Badge } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

<GameSeat name="Alex" avatar={<Avatar name="Alex" size="lg" aria-hidden="true" />}
  handCount={3} badges={<Badge>Host</Badge>} points={0}
  turn={{ remainingMs: 45000, durationMs: 60000 }}
  chat={<span aria-live="polite">Your turn · 45 seconds</span>} dir="rtl"
  hand={<GameHand.Hidden count={2} size="sm" label="Two hidden cards" playerKey="alex" />} />` } } },
  play: async ({ canvas, canvasElement, args }) => {
    await expect(getComputedStyle(canvas.getByRole('group')).direction).toBe('rtl');
    await expect(canvasElement.querySelectorAll('[data-ui="game-hand-hidden-card"]')).toHaveLength(2);
    await expect(canvas.getByRole('img', { name: 'Two hidden cards' })).toBeVisible();
    await expect(canvasElement.querySelector('circle')).toHaveAttribute('stroke-dashoffset', '25');
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
      await expect(circle).toHaveAttribute('stroke-dashoffset', '25');
      await expect(circle.getAnimations()).toHaveLength(0);
      await expect(getComputedStyle(circle).transitionDuration).toBe('0s');
    } finally {
      flushSync(() => root.unmount()); host.remove(); media.mockRestore();
    }
  },
};
export const Milestones: Story = {
  tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    const callback = fn();
    const host = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(host);
    const root = createRoot(host);
    const render = (remainingMs: number) => flushSync(() => root.render(<StrictMode><GameSeat name="Milestones"
      turn={{ remainingMs, durationMs: DURATION }} onTurnMilestone={callback} /></StrictMode>));
    try {
      render(DURATION * 0.4);
      await expect(callback).not.toHaveBeenCalled();
      render(DURATION * 0.25);
      render(DURATION * 0.25);
      render(0);
      render(-1);
      render(DURATION);
      render(0);
      await expect(callback.mock.calls.map(([milestone]) => milestone)).toEqual(['quarter', 'ending', 'extended', 'half', 'quarter', 'ending']);
      callback.mockClear();
      render(DURATION * 0.5);
      callback.mockClear();
      render(DURATION * 0.49);
      await expect(callback.mock.calls.map(([milestone]) => milestone)).toEqual(['half']);
      await expect(host.querySelector('circle')).toHaveAttribute('stroke-dashoffset', '51');
    } finally { flushSync(() => root.unmount()); host.remove(); }
  },
};

function TurnNotifications() {
  const [remainingMs, setRemaining] = useState<number>();
  const [milestone, setMilestone] = useState<GameSeatTurnMilestone | 'ready' | 'started'>('ready');
  return <TurnExample>
    <Button onClick={() => { setRemaining(DURATION); setMilestone('started'); }}>Start turn</Button>
    <Button onClick={() => setRemaining(DURATION / 2)}>Half time</Button>
    <Button onClick={() => setRemaining(0)}>End turn</Button>
    <GameSeat variant="panel" name="Alex" handCount={3} turned={remainingMs !== undefined && remainingMs > 0}
      turn={remainingMs === undefined ? undefined : { remainingMs, durationMs: DURATION }}
      onTurnMilestone={setMilestone} chat={<span aria-live="polite">{TURN_MESSAGES[milestone]}</span>} />
  </TurnExample>;
}
export const TurnMilestoneNotifications: Story = {
  tags: ['!autodocs'],
  name: 'Turn announcements',
  render: () => <TurnNotifications />,
  parameters: { docs: { description: { story: 'Start a turn and announce its milestones through a polite live region.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameSeat, type GameSeatTurnMilestone } from '@jfrader/ui/game-seat';

const DURATION = 60000;
const TurnExample = styled.div({ display: 'grid', justifyItems: 'start', gap: vars.space[4] });
const TURN_MESSAGES = { ready: 'Ready', started: 'Your turn', half: 'Half time', quarter: 'Final quarter', ending: 'Turn ended', extended: 'Turn extended' };

function TurnNotifications() {
  const [remainingMs, setRemaining] = useState<number>();
  const [milestone, setMilestone] = useState<GameSeatTurnMilestone | 'ready' | 'started'>('ready');
  return <TurnExample>
    <Button onClick={() => { setRemaining(DURATION); setMilestone('started'); }}>Start turn</Button>
    <Button onClick={() => setRemaining(DURATION / 2)}>Half time</Button>
    <Button onClick={() => setRemaining(0)}>End turn</Button>
    <GameSeat variant="panel" name="Alex" handCount={3} turned={remainingMs !== undefined && remainingMs > 0}
      turn={remainingMs === undefined ? undefined : { remainingMs, durationMs: DURATION }}
      onTurnMilestone={setMilestone} chat={<span aria-live="polite">{TURN_MESSAGES[milestone]}</span>} />
  </TurnExample>;
}` } } },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('group')).toHaveTextContent('Ready');
    await userEvent.click(canvas.getByRole('button', { name: 'Start turn' }));
    await expect(canvas.getByRole('group')).toHaveAttribute('data-turned', 'true');
    await expect(canvas.getByRole('group')).toHaveTextContent('Your turn');
    await userEvent.click(canvas.getByRole('button', { name: 'Half time' }));
    await expect(canvas.getByRole('group')).toHaveTextContent('Half time');
    await userEvent.click(canvas.getByRole('button', { name: 'End turn' }));
    await expect(canvas.getByRole('group')).toHaveTextContent('Turn ended');
    await expect(canvas.getByRole('group')).toHaveAttribute('data-turned', 'false');
  },
};

function Replacement(props: GameCardRootProps) { return <div {...props} data-replacement="slot" />; }
function UnusedReplacement(props: GameCardRootProps) { return <div {...props} data-replacement="component" />; }
export const Slots: Story = {
  tags: ['!autodocs'],
  name: 'Replace every part',
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { Avatar } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

function Replacement(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="slot" />;
}

function UnusedReplacement(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="component" />;
}

<GameSeat name="Alex" avatar={<Avatar name="Alex" size="lg" aria-hidden="true" />}
  handCount={3} turn={{ remainingMs: 45000, durationMs: 60000 }} hand={null} badges={0} points={0} chat={0}
  component={UnusedReplacement} slots={{ root: Replacement }}
  className="host-class" style={{ fontWeight: 400 }} title="Host title"
  slotProps={{ root: { className: 'slot-class', style: { fontWeight: 700 }, title: 'Slot title' },
    name: { id: 'consumer-seat-name', title: 'Player' }, chat: { 'aria-live': 'polite' } }} />` } } },
  args: {
    variant: 'panel',
    component: UnusedReplacement, slots: { root: Replacement }, hand: null, badges: 0, points: 0, chat: 0,
    className: 'host-class', style: { fontWeight: 400 }, title: 'Host title',
    slotProps: { root: { className: 'slot-class', style: { fontWeight: 700 }, title: 'Slot title' },
      name: { id: 'consumer-seat-name', title: 'Player' }, chat: { 'aria-live': 'polite' } },
  },
  play: async ({ canvas }) => {
    const seat = canvas.getByRole('group', { name: 'Alex' });
    await expect(seat).toHaveAttribute('data-replacement', 'slot');
    await expect(seat).toHaveAttribute('title', 'Slot title');
    await expect(seat).toHaveClass('host-class', 'slot-class');
    await expect(seat.style.fontWeight).toBe('700');
    await expect(seat).toHaveAttribute('aria-labelledby', 'consumer-seat-name');
    await expect(seat.querySelector('[data-ui="game-seat-hand"]')).toBeNull();
    for (const part of ['badges', 'points', 'chat']) await expect(seat.querySelector(`[data-ui="game-seat-${part}"]`)).toHaveTextContent('0');
  },
};

export const SampledClock: Story = {
  tags: ['!autodocs'],
  args: { turn: undefined, chat: undefined },
  play: async ({ canvasElement }) => {
    const host = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(host);
    const root = createRoot(host);
    const callback = fn();
    try {
      flushSync(() => root.render(<GameSeat name="Supplied" turn={turn} onTurnMilestone={callback} />));
      const circle = host.querySelector('circle')!;
      await expect(circle).toHaveAttribute('stroke-dashoffset', '25');
      flushSync(() => root.render(<GameSeat name="Same sample" turn={{ ...turn }} points={0} onTurnMilestone={callback} />));
      await expect(host.querySelector('circle')).toBe(circle);
      await expect(circle).toHaveAttribute('stroke-dashoffset', '25');
      await expect(callback).not.toHaveBeenCalled();
      flushSync(() => root.render(<GameSeat name="New sample" turn={{ ...turn, remainingMs: DURATION / 4 }} onTurnMilestone={callback} />));
      await expect(circle).toHaveAttribute('stroke-dashoffset', '75');
      await expect(callback.mock.calls.map(([milestone]) => milestone)).toEqual(['half', 'quarter']);
    } finally { flushSync(() => root.unmount()); host.remove(); }
  },
};

export const RescheduledClock: Story = {
  tags: ['!autodocs'],
  args: { turn: undefined, chat: undefined },
  play: async ({ canvasElement }) => {
    const host = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(host);
    const root = createRoot(host);
    const callback = fn();
    try {
      flushSync(() => root.render(<GameSeat name="Late callback" turn={turn} />));
      flushSync(() => root.render(<GameSeat name="Late callback" turn={turn} onTurnMilestone={callback} />));
      await expect(callback).not.toHaveBeenCalled();
      flushSync(() => root.render(<GameSeat name="Late callback" turn={{ ...turn, remainingMs: 0 }} onTurnMilestone={callback} />));
      await expect(callback.mock.calls.map(([milestone]) => milestone)).toEqual(['half', 'quarter', 'ending']);
      callback.mockClear();
      flushSync(() => root.render(<GameSeat name="Between turns" onTurnMilestone={callback} />));
      flushSync(() => root.render(<GameSeat name="Next turn" turn={turn} onTurnMilestone={callback} />));
      await expect(callback).not.toHaveBeenCalled();
      flushSync(() => root.render(<GameSeat name="Next turn" turn={{ remainingMs: 0, durationMs: DURATION * 2 }} onTurnMilestone={callback} />));
      await expect(callback.mock.calls.map(([milestone]) => milestone)).toEqual(['half', 'quarter', 'ending']);
      await expect(host.querySelector('circle')).toHaveAttribute('stroke-dashoffset', '100');
    } finally { flushSync(() => root.unmount()); host.remove(); }
  },
};
