import { StrictMode, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../index';
import { PersonAvatar } from '../person-avatar';
import { Badge } from '../badge';
import { Button } from '../button';
import { GameHand } from '../game-hand';
import { GameSeat, type GameSeatTurnMilestone } from './index';
import type { GameCardRootProps } from '../game-card/game-card-root';
import type { GameSeatPartProps, GameSeatSlotProps } from './game-seat';

const DURATION = 60000;
const turn = { remainingMs: DURATION * 0.75, durationMs: DURATION };
const ClockRow = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[8] });
const TableEdgeRow = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[4] });
const TurnExample = styled.div({ display: 'grid', justifyItems: 'start', gap: vars.space[4] });
const TURN_MESSAGES = { ready: 'Ready', started: 'Your turn', half: 'Half time', quarter: 'Final quarter', ending: 'Turn ended', extended: 'Turn extended' };

const meta = {
  title: 'Games/GameSeat', component: GameSeat, tags: ['autodocs'],
  args: {
    name: 'Alex', avatar: <PersonAvatar seed="Alex" size="full" />,
    badges: <Badge>Host</Badge>, points: 35, handCount: 3, turn,
    chat: <span aria-live="polite">Your turn · 45 seconds</span>,
  },
  parameters: { docs: {
    description: { component: 'Place a player’s identity, score and turn status at the table edge, or show their hand and chat in a standalone panel.' },
    sections: [
      { title: 'At the table', stories: ['TableEdge', 'Default', 'Panel', 'Count'] },
    ],
    usage: `### When to use
Show a player's identity and turn status on its own or inside a GameTable seat region. GameSeat does not position players around the board or enforce turn rules.

The default chip reserves its avatar footprint. Its hidden-card fan is decorative, capped at three backs and positioned radially behind the opaque avatar, inside the surface. Changing handCount never resizes the chip. Use handDisplay="count" with formatHandCount for localized count text, or "none" to hide the shorthand. Custom hand content overrides handDisplay. Chat is shown only in variant="panel".

The chip is a compact raised plaque with a fixed footprint; the panel is a larger raised plaque. Set surface="transparent" when composing inside an existing surface. Layout and the opaque avatar are retained.

### Clock constraints

Pass turn={{ remainingMs, durationMs }} from authoritative game state, including for server rendering. The caller owns time: GameSeat never samples a clock or schedules timers. The ring shows the supplied fraction, clamped between zero and one, without a ticking animation. turned defaults to false independently of turn.

Updating remainingMs crosses half (50%), quarter (25%) and ending (zero); a jump across several thresholds emits each in order, once per crossing. Initial values do not emit past milestones. Increasing remainingMs emits extended and rearms thresholds above the new value. Clear turn between turns to start fresh. Use authoritative game state to enforce a deadline.

### Keyboard and accessibility

The seat is a named group, not an interactive widget, and adds no focus target or keyboard bindings. The timer ring and shorthand hand are decorative. Supply localized time text, visible offline status and a labeled hidden hand when its count needs announcing. Announce turn changes or milestones, not ticks. Mark decorative avatars aria-hidden to avoid repeating the player's name.`,
    source: { language: 'tsx', code: `import { Badge, PersonAvatar } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

<GameSeat name="Alex" avatar={<PersonAvatar seed="Alex" size="full" />}
  handCount={3} badges={<Badge>Host</Badge>} points={35}
  turn={{ remainingMs: 45000, durationMs: 60000 }}
  chat={<span aria-live="polite">Your turn · 45 seconds</span>} />` },
  } },
} satisfies Meta<typeof GameSeat>;
export default meta;
type Story = StoryObj<typeof meta>;

async function expectSeatContainment(seat: HTMLElement) {
  const bounds = seat.getBoundingClientRect();
  for (const part of seat.querySelectorAll('[data-ui="game-seat-name"], [data-ui="game-seat-badges"], [data-ui="game-seat-points"]')) {
    const content = part.getBoundingClientRect();
    await expect(getComputedStyle(part).overflow).toBe('hidden');
    await expect(content.left).toBeGreaterThanOrEqual(bounds.left);
    await expect(content.top).toBeGreaterThanOrEqual(bounds.top);
    await expect(content.right).toBeLessThanOrEqual(bounds.right);
    await expect(content.bottom).toBeLessThanOrEqual(bounds.bottom);
  }
  for (const back of seat.querySelectorAll('[data-ui="game-hand-hidden-card"]')) {
    const card = back.getBoundingClientRect();
    await expect(card.left).toBeGreaterThanOrEqual(bounds.left + 1);
    await expect(card.top).toBeGreaterThanOrEqual(bounds.top + 1);
    await expect(card.right).toBeLessThanOrEqual(bounds.right - 1);
    await expect(card.bottom).toBeLessThanOrEqual(bounds.bottom - 1);
  }
}

async function expectAvatarOrbit(seat: HTMLElement) {
  await expectSeatContainment(seat);
  const avatar = seat.querySelector('[data-ui="game-seat-avatar-content"]')!;
  const avatarBounds = avatar.getBoundingClientRect();
  const centerX = avatarBounds.x + avatarBounds.width / 2;
  const centerY = avatarBounds.y + avatarBounds.height / 2;
  const backs = [...seat.querySelectorAll('[data-ui="game-hand-hidden-card"]')];
  await expect(backs).toHaveLength(3);
  await expect(getComputedStyle(seat).overflow).toBe('visible');
  await expect(getComputedStyle(seat.querySelector('[data-ui~="game-seat-name"]')!).overflow).toBe('hidden');
  await expect(getComputedStyle(avatar).borderTopWidth).toBe('1px');
  await expect(getComputedStyle(avatar).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  for (const back of backs) {
    const card = back.getBoundingClientRect();
    await expect(card.top).toBeLessThan(centerY);
    await expect(card.bottom).toBeGreaterThan(avatarBounds.top);
    for (const part of seat.querySelectorAll('[data-ui="game-seat-name"], [data-ui="game-seat-badges"], [data-ui="game-seat-points"]')) {
      const content = part.getBoundingClientRect();
      const overlap = card.left < content.right && card.right > content.left && card.top < content.bottom && card.bottom > content.top;
      await expect(overlap).toBe(false);
    }
  }
  const centers = backs.map(back => { const rect = back.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; }).sort((a, b) => a.x - b.x);
  await expect(centers[0]!.x).toBeLessThan(centerX);
  await expect(centers[2]!.x).toBeGreaterThan(centerX);
  await expect(centers[1]!.y).toBeLessThan(centers[0]!.y);
  await expect(centers[1]!.y).toBeLessThan(centers[2]!.y);
  for (const back of [backs[0]!, backs[2]!]) {
    const transform = new DOMMatrix(getComputedStyle(back).transform);
    await expect(Math.abs(Math.atan2(transform.b, transform.a) * 180 / Math.PI)).toBeGreaterThan(25);
  }
}

/** Four seats around one table: the active player with a timer, the trick winner, a waiting player and a disconnected one. */
export const TableEdge: Story = {
  name: 'Seats at the table',
  render: () => <TableEdgeRow>
    <GameSeat name="Alex" avatar={<PersonAvatar seed="Alex" size="full" />} handCount={3} points={35}
      state="active" turned turn={turn} badges="Your turn" />
    <GameSeat name="Sam" avatar={<PersonAvatar seed="Sam" size="full" />} handCount={2} points={30}
      state="winner" badges="Won the trick" />
    <GameSeat name="Rui" avatar={<PersonAvatar seed="Rui" size="full" />} handCount={3} points={12} badges="Dealer" />
    <GameSeat name="Kai" avatar={<PersonAvatar seed="Kai" size="full" />} handCount={1} points={8}
      offline dimmed badges="Disconnected" />
  </TableEdgeRow>,
  parameters: { docs: { description: { story: 'Show each seat state with the same fixed footprint.' }, source: { language: 'tsx', code: `import { PersonAvatar, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameSeat } from '@jfrader/ui/game-seat';

const TableEdgeRow = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[4] });

<TableEdgeRow>
  <GameSeat name="Alex" avatar={<PersonAvatar seed="Alex" size="full" />} handCount={3} points={35}
    state="active" turned turn={{ remainingMs: 45000, durationMs: 60000 }} badges="Your turn" />
  <GameSeat name="Sam" avatar={<PersonAvatar seed="Sam" size="full" />} handCount={2} points={30}
    state="winner" badges="Won the trick" />
  <GameSeat name="Rui" avatar={<PersonAvatar seed="Rui" size="full" />} handCount={3} points={12} badges="Dealer" />
  <GameSeat name="Kai" avatar={<PersonAvatar seed="Kai" size="full" />} handCount={1} points={8}
    offline dimmed badges="Disconnected" />
</TableEdgeRow>` } } },
  play: async ({ canvas }) => {
    const seats = canvas.getAllByRole('group');
    await expect(seats).toHaveLength(4);
    const [first] = seats.map((seat) => seat.getBoundingClientRect());
    for (const seat of seats) {
      await expect(seat.getBoundingClientRect().width).toBe(first!.width);
      await expect(seat.getBoundingClientRect().height).toBe(first!.height);
      await expectSeatContainment(seat);
    }
    await expect(canvas.getByRole('group', { name: 'Sam' })).toHaveAttribute('data-state', 'winner');
  },
};

/** Player identity, hand count and caller-owned remaining time. */
export const Default: Story = {
  name: 'Player seat',
  parameters: { docs: { description: { story: 'Show a player with host status, points, hidden cards and a turn timer.' } } },
  play: async ({ canvas, canvasElement }) => {
    const seat = canvas.getByRole('group', { name: 'Alex' });
    await expect(seat).toHaveAttribute('data-turned', 'false');
    await expect(seat.querySelector('[data-ui="game-seat-points"]')).toHaveTextContent('35');
    await expect(seat).toHaveAttribute('data-game-material', 'chip');
    await expect(getComputedStyle(seat).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    const plaque = getComputedStyle(seat, '::before');
    await expect(plaque.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    await expect(plaque.borderTopWidth).toBe('1px');
    await expect(plaque.boxShadow).not.toBe('none');
    await expect(parseFloat(plaque.width)).toBeLessThan(seat.getBoundingClientRect().width);
    const avatar = seat.querySelector('[data-ui="game-seat-avatar-content"]')!;
    const fan = seat.querySelector('[data-ui="game-seat-hand"]')!;
    await expect(getComputedStyle(avatar).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    await expect(Number(getComputedStyle(avatar).zIndex)).toBeGreaterThan(Number(getComputedStyle(fan).zIndex));
    await expect(Number(getComputedStyle(fan).zIndex)).toBeGreaterThanOrEqual(0);
    await expect(canvasElement.querySelector('[data-ui="game-seat-timer"]')).toHaveAttribute('aria-hidden', 'true');
    await expect(canvasElement.querySelector('circle')).toHaveAttribute('stroke-dashoffset', '25');
    await expectAvatarOrbit(seat);
  },
};
export const Panel: Story = {
  name: 'Player panel', args: { variant: 'panel' },
  parameters: { docs: { source: { language: 'tsx', code: `import { PersonAvatar } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

<GameSeat variant="panel" name="Alex" avatar={<PersonAvatar seed="Alex" size="full" />}
  handCount={3} points={35} chat="Your turn" />` } } },
  play: async ({ canvas }) => {
    const seat = canvas.getByRole('group', { name: 'Alex' });
    await expect(seat).toHaveAttribute('data-game-material', 'panel');
    await expect(getComputedStyle(seat).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    await expect(getComputedStyle(seat).borderTopWidth).toBe('1px');
    await expect(seat.querySelector('[data-ui="game-seat-chat"]')).toBeVisible();
    await expectAvatarOrbit(seat);
  },
};
export const Transparent: Story = {
  tags: ['!autodocs'], args: { surface: 'transparent' },
  play: async ({ canvas }) => {
    const seat = canvas.getByRole('group', { name: 'Alex' });
    await expect(seat).toHaveAttribute('data-game-material', 'transparent');
    await expect(getComputedStyle(seat).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    await expect(getComputedStyle(seat).borderTopWidth).toBe('0px');
    await expect(getComputedStyle(seat).boxShadow).toBe('none');
    await expect(getComputedStyle(seat, '::before').content).toBe('none');
    await expect(getComputedStyle(seat.querySelector('[data-ui="game-seat-avatar-content"]')!).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  },
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
    const medallion = seat.querySelector('[data-ui="game-seat-avatar-content"]')!;
    const timer = seat.querySelector('[data-ui="game-seat-timer"]')!;
    for (const animation of seat.getAnimations({ subtree: true })) animation.finish();
    await expect(getComputedStyle(medallion).boxShadow).toContain(getComputedStyle(timer).stroke);
    await expect(getComputedStyle(medallion).outlineStyle).toBe('none');
    await expect(timer.querySelector('circle')).toHaveAttribute('stroke-dashoffset', '25');
    await expectAvatarOrbit(seat);
  },
};
export const ForcedColors: Story = {
  name: 'Game Seat Forced Colors', tags: ['!autodocs'],
  args: { state: 'winner', turn, badges: <Badge>Won the trick</Badge> },
  play: async ({ canvas, canvasElement }) => {
    await expect(window.matchMedia('(forced-colors: active)').matches).toBe(true);
    const seat = canvas.getByRole('group', { name: 'Alex' });
    await expect(seat).toHaveTextContent('Won the trick');
    const medallion = seat.querySelector('[data-ui="game-seat-avatar-content"]')!;
    const timer = seat.querySelector('[data-ui="game-seat-timer"]')!;
    await expect(getComputedStyle(medallion).borderTopStyle).toBe('solid');
    await expect(getComputedStyle(medallion).borderTopWidth).toBe('3px');
    await expect(getComputedStyle(medallion).boxShadow).toBe('none');
    await expect(getComputedStyle(timer).stroke).toBe(getComputedStyle(medallion).borderTopColor);
    await expect(timer).toHaveAttribute('aria-hidden', 'true');
    await expect(canvasElement.querySelectorAll('[data-ui="game-hand-hidden-card"]')).toHaveLength(3);
    await expect(canvasElement.getAnimations({ subtree: true })).toHaveLength(0);
  },
};
export const Active: Story = {
  tags: ['!autodocs'], args: { state: 'active', turned: true, badges: <Badge>Your turn</Badge> },
};
export const RtlOrbit: Story = {
  tags: ['!autodocs'], args: { dir: 'rtl' },
  play: async ({ canvas }) => {
    const seat = canvas.getByRole('group', { name: 'Alex' });
    await expect(getComputedStyle(seat).direction).toBe('rtl');
    await expectAvatarOrbit(seat);
  },
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
        flushSync(() => root.render(<GameSeat ref={ref} name="Alex" avatar={<PersonAvatar seed="Alex" size="full" />}
          handCount={count} points={count} badges={count > 3 ? <Badge>Won the trick with the highest score</Badge> : undefined} />));
        const seat = host.querySelector<HTMLElement>('[data-ui~="game-seat"]')!;
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
        await expectSeatContainment(seat);
        if (count > 3) {
          const badges = seat.querySelector('[data-ui="game-seat-badges"]')!;
          await expect(badges.scrollWidth).toBeGreaterThan(badges.clientWidth);
        }
      }
    } finally { flushSync(() => root.unmount()); host.remove(); }
  },
};
export const Light: Story = {
  tags: ['!autodocs'],
  ...Default, name: 'Light theme', globals: { theme: 'light' },
  parameters: { docs: { source: { language: 'tsx', code: `import { Badge, PersonAvatar, ThemeRoot } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

<ThemeRoot theme="light">
  <GameSeat name="Alex" avatar={<PersonAvatar seed="Alex" size="full" />}
    handCount={3} badges={<Badge>Host</Badge>} points={0}
    turn={{ remainingMs: 45000, durationMs: 60000 }}
    chat={<span aria-live="polite">Your turn · 45 seconds</span>} />
</ThemeRoot>` } } },
};
export const Offline: Story = {
  tags: ['!autodocs'],
  name: 'Offline player',
  args: { turn: undefined, offline: true, dimmed: true, badges: <Badge>Disconnected</Badge>, chat: undefined },
  parameters: { docs: { description: { story: 'Pair a dimmed player seat with a visible disconnected label.' }, source: { language: 'tsx', code: `import { Badge, PersonAvatar } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

<GameSeat name="Alex" avatar={<PersonAvatar seed="Alex" size="full" />}
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
import { Badge, PersonAvatar } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

const durationMs = 60000;
const turn = { remainingMs: durationMs * 0.75, durationMs };

function ReplacementDiv(props: ComponentPropsWithRef<'div'>) { return <div {...props} data-replacement="true" />; }
function ReplacementName(props: ComponentPropsWithRef<'span'>) { return <span {...props} data-replacement="true" />; }
function ReplacementTimer(props: ComponentPropsWithRef<'svg'>) { return <svg {...props} data-replacement="true" />; }

<GameSeat name="Alex" avatar={<PersonAvatar seed="Alex" size="full" />}
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
  parameters: { docs: { description: { story: 'Compare earlier and later clock samples within the same turn.' }, source: { language: 'tsx', code: `import { Badge, PersonAvatar, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameSeat } from '@jfrader/ui/game-seat';

const durationMs = 60000;
const turn = { remainingMs: durationMs * 0.75, durationMs };

const ClockRow = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[8] });
const TableEdgeRow = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[4] });

const common = {
  avatar: <PersonAvatar seed="Alex" size="full" />,
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
import { Badge, PersonAvatar } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

<GameSeat name="Alex" avatar={<PersonAvatar seed="Alex" size="full" />}
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
import { PersonAvatar } from '@jfrader/ui';
import { GameSeat } from '@jfrader/ui/game-seat';

function Replacement(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="slot" />;
}

function UnusedReplacement(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="component" />;
}

<GameSeat name="Alex" avatar={<PersonAvatar seed="Alex" size="full" />}
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
