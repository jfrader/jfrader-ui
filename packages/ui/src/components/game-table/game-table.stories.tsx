import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { Button } from '../button';
import { GameCard } from '../game-card';
import { ThemeRoot } from '../theme-root';
import {
  GameTable, buildAlternatingSlots, buildBoardLayoutModel, buildTableOrderSlots,
  getMatchSeatPresentationForIndex, getTablePointSeatIndexes, resolveTableTurnDirection,
  type BoardPlayerCount, type BoardViewportProfile, type GameTableProps, type SeatLike,
} from './index';

interface Player extends SeatLike { name: string }
const SEATS: [Player, Player, Player, Player, Player, Player] = [
  { key: 'alex', teamIdx: 0, name: 'Alex' },
  { key: 'blair', teamIdx: 1, name: 'Blair' },
  { key: 'you', teamIdx: 0, isMe: true, name: 'You' },
  { key: 'drew', teamIdx: 1, name: 'Drew' },
  { key: 'emery', teamIdx: 0, name: 'Emery' },
  { key: 'frankie', teamIdx: 1, name: 'Frankie' },
];
const COUNTS = [2, 4, 6] as const;
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing fixture item');
  return value;
}
const VIEWPORTS = {
  phoneCompact: { width: 412, height: 816 },
  phoneTall: { width: 390, height: 844 },
  phoneWide: { width: 840, height: 360 },
  tablet: { width: 834, height: 1112 },
  tabletWide: { width: 1000, height: 900 },
  desktop: { width: 1440, height: 900 },
} satisfies Record<BoardViewportProfile, { width: number; height: number }>;
const seatsFor = (players: BoardPlayerCount) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const renderSeat = fn<GameTableProps<Player>['renderSeat']>((slot) => (
  <div style={{ display: 'grid', justifyItems: 'center', gap: vars.space[1] }}>
    <span>{slot.player?.name ?? 'Open seat'}</span>
    <div style={{ display: 'flex', gap: vars.space[1] }}>
      <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: first hidden card`} />
      <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: second hidden card`} />
    </div>
  </div>
));
const center = (
  <div style={{ display: 'grid', justifyItems: 'center', gap: vars.space[2] }}>
    <span>Pot: 240</span>
    <div style={{ display: 'flex', gap: vars.space[1] }}>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </div>
  </div>
);

const meta = {
  title: 'Games/GameTable',
  component: GameTable<Player>,
  tags: ['autodocs'],
  args: {
    players: 6, seats: SEATS, viewport: VIEWPORTS.phoneCompact,
    renderSeat, center, header: 'Poker · 10 / 20', dock: <Button>Check</Button>,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: { component: 'Arrange players around a game surface. Add cards, controls and floating content to named regions.' },
      usage: `### Regions
Pass seat chrome through \`renderSeat(slot, index, geometry)\`. Use \`header\`, \`center\`, \`dock\`, \`footer\` and \`floating\` for other content; children are not inspected.

### Geometry
Give the parent a block size and pass current viewport dimensions in CSS pixels. Update \`viewport\` on resize; the component does not read the browser viewport, so server and client can share the same model.
\`seats\` fills empty places, alternates teams and puts your seat first. \`slots\` preserves a prebuilt visual order and must contain exactly \`players\` places; order it with the exported builders when needed. Do not pass both.
The pure model retains the reference's surface frames, seat geometry and match seat presentation. Hand sizing, command bars and played-card piles remain consumer layouts.
The shell reserves \`--game-table-seat-clearance\` above and below the surface (32px by default); increase it for taller seat chrome.
Coordinates are measured from inline-start and mirror with \`dir="rtl"\`. \`data-game-surface="true"\` marks the surface for measuring future card flights.

### Keyboard
The table is a passive layout, not an APG grid or application. It adds no roles, landmarks, focus movement, state or animation; supplied controls keep their own semantics and native tab order. Floating content is table-local, not a dialog or portal.`,
      source: { code: `<GameTable players={6} seats={players} viewport={{ width: 412, height: 816 }} renderSeat={(slot) => <span>{slot.player?.name ?? 'Open seat'}</span>} center={<GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />} dock={<Button>Check</Button>} />` },
    },
  },
  render: (args) => <div style={{ inlineSize: args.viewport.width, blockSize: args.viewport.height }}><GameTable {...args} /></div>,
} satisfies Meta<typeof GameTable<Player>>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args, userEvent }) => {
    const table = canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]');
    if (!table) throw new Error('Missing table');
    await expect(table).toHaveAttribute('data-profile', 'phoneCompact');
    await expect(table.querySelector('[data-game-surface="true"]')).toHaveAttribute('data-ui', 'game-table-surface');
    await expect(table.querySelector('[role="grid"], [role="application"], [role="region"]')).toBeNull();
    const slots = buildAlternatingSlots(SEATS, 6, 'counterclockwise');
    const layout = buildBoardLayoutModel({ surface: 'match', totalSeats: 6, viewport: { ...args.viewport, aspectRatio: args.viewport.width / args.viewport.height } });
    const seats = table.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]');
    await expect(seats).toHaveLength(6);
    for (const [index, slot] of slots.entries()) {
      await expect(seats[index]).toHaveAttribute('data-slot-key', slot.key);
      await expect(args.renderSeat).toHaveBeenCalledWith(slot, index, layout.seatGeometries[index]);
      await expect(required(seats[index]).style.getPropertyValue('--game-table-seat-inline')).toBe(`${required(layout.seatGeometries[index]).leftPercent}%`);
    }
    const surface = table.querySelector<HTMLElement>('[data-game-surface]');
    if (!surface) throw new Error('Missing surface');
    const surfaceBox = surface.getBoundingClientRect();
    const ownBox = required(seats[0]).getBoundingClientRect();
    await expect(ownBox.y + ownBox.height / 2).toBeGreaterThan(surfaceBox.y + surfaceBox.height / 2);
    await userEvent.tab();
    const button = within(table).getByRole('button', { name: 'Check' });
    await expect(table.ownerDocument.activeElement).toBe(button);
    await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
  },
};

const matrixStory = (profile: BoardViewportProfile, theme: 'dark' | 'light'): Story => ({
  args: { viewport: VIEWPORTS[profile] },
  render: (args) => (
    <div style={{ display: 'grid', gap: vars.space[6], inlineSize: 'max-content' }}>
      {COUNTS.map((players) => (
        <ThemeRoot key={players} theme={theme} style={{ inlineSize: args.viewport.width, blockSize: args.viewport.height }}>
          <GameTable {...args} slots={undefined} players={players} seats={seatsFor(players)} header={`Poker · ${players / 2}v${players / 2}`} />
        </ThemeRoot>
      ))}
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const tables = canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]');
    await expect(tables).toHaveLength(3);
    for (const [index, table] of Array.from(tables).entries()) {
      await expect(table).toHaveAttribute('data-profile', profile);
      await expect(table.querySelectorAll('[data-ui="game-table-seat"]')).toHaveLength(required(COUNTS[index]));
      const surface = table.querySelector<HTMLElement>('[data-game-surface]');
      if (!surface) throw new Error('Missing surface');
      const box = surface.getBoundingClientRect();
      await expect(box.width).toBeGreaterThan(0);
      await expect(box.height).toBeGreaterThan(0);
      await expect(box.width).toBeLessThanOrEqual(args.viewport.width);
      const dock = required(table.querySelector<HTMLElement>('[data-ui="game-table-dock"]') ?? undefined).getBoundingClientRect();
      const own = required(table.querySelector<HTMLElement>('[data-ui="game-table-seat"]') ?? undefined).getBoundingClientRect();
      await expect(own.bottom).toBeLessThanOrEqual(dock.top);
    }
  },
});

export const PhoneCompactDark = matrixStory('phoneCompact', 'dark');
export const PhoneCompactLight = matrixStory('phoneCompact', 'light');
export const PhoneTallDark = matrixStory('phoneTall', 'dark');
export const PhoneTallLight = matrixStory('phoneTall', 'light');
export const PhoneWideDark = matrixStory('phoneWide', 'dark');
export const PhoneWideLight = matrixStory('phoneWide', 'light');
export const TabletDark = matrixStory('tablet', 'dark');
export const TabletLight = matrixStory('tablet', 'light');
export const TabletWideDark = matrixStory('tabletWide', 'dark');
export const TabletWideLight = matrixStory('tabletWide', 'light');
export const DesktopDark = matrixStory('desktop', 'dark');
export const DesktopLight = matrixStory('desktop', 'light');

export const SlotOrderAndGeometry: Story = {
  play: async () => {
    await expect(resolveTableTurnDirection()).toBe('counterclockwise');
    await expect(resolveTableTurnDirection('clockwise')).toBe('clockwise');
    await expect(buildTableOrderSlots(SEATS, 'clockwise').map((slot) => slot.key)).toEqual(['you', 'drew', 'emery', 'frankie', 'alex', 'blair']);
    await expect(buildTableOrderSlots(SEATS, 'counterclockwise').map((slot) => slot.key)).toEqual(['you', 'blair', 'alex', 'frankie', 'emery', 'drew']);
    const partial = buildAlternatingSlots([SEATS[1], SEATS[2]], 6, 'clockwise');
    await expect(partial.map((slot) => slot.player?.key ?? null)).toEqual(['you', 'blair', null, null, null, null]);
    await expect(getTablePointSeatIndexes(partial)).toEqual({ bottomLeaderSeatIndex: 0, frontLeaderSeatIndex: 1 });
    await expect(getTablePointSeatIndexes(buildAlternatingSlots([], 2, 'clockwise'))).toEqual({ bottomLeaderSeatIndex: -1, frontLeaderSeatIndex: -1 });
    const profiles: BoardViewportProfile[] = [];
    const groupShifts: number[] = [];
    for (const [profile, viewport] of Object.entries(VIEWPORTS)) {
      for (const players of COUNTS) {
        const layout = buildBoardLayoutModel({ surface: 'match', totalSeats: players, viewport: { ...viewport, aspectRatio: viewport.width / viewport.height } });
        await expect(layout.profile).toBe(profile);
        await expect(layout.seatGeometries).toHaveLength(players);
        await expect(required(layout.seatGeometries[0]).topPercent).toBeGreaterThan(50);
        if (players === 6) {
          profiles.push(layout.profile);
          groupShifts.push(required(layout.seatGeometries[0]).groupShiftY);
          await expect(required(layout.seatGeometries[0]).leftPercent).toBeCloseTo(50, 8);
          await expect(getMatchSeatPresentationForIndex({ layout, seatIndex: 0, isMe: true }).translateY).toBe(profile === 'phoneWide' ? 16 : profile === 'desktop' || profile === 'tabletWide' ? 22 : 20);
        }
      }
    }
    await expect(profiles).toHaveLength(6);
    await expect(groupShifts).toEqual([8, 24, 18, 0, 0, 0]);
    const compact = buildBoardLayoutModel({ surface: 'match', totalSeats: 6, viewport: { ...VIEWPORTS.phoneCompact, aspectRatio: 412 / 816 } });
    const desktop = buildBoardLayoutModel({ surface: 'match', totalSeats: 6, viewport: { ...VIEWPORTS.desktop, aspectRatio: 1440 / 900 } });
    await expect(required(compact.seatGeometries[1]).leftPercent).not.toBeCloseTo(required(desktop.seatGeometries[1]).leftPercent, 4);
    await expect(getMatchSeatPresentationForIndex({ layout: compact, seatIndex: 3, isMe: false }).avatarNudgeY).toBe(-28);
    const expectedDesktopPositions = {
      2: { inline: 33.966578105553985, block: 6.4102692469195155 },
      4: { inline: 9.019573022886519, block: 79.28531809989322 },
      6: { inline: 5.743602791855864, block: 74.82487113059643 },
    };
    for (const totalSeats of COUNTS) {
      const layout = buildBoardLayoutModel({ surface: 'match', totalSeats, viewport: desktop.viewport });
      const sideSeat = required(layout.seatGeometries[1]);
      await expect(sideSeat.leftPercent).toBeCloseTo(expectedDesktopPositions[totalSeats].inline, 8);
      await expect(sideSeat.topPercent).toBeCloseTo(expectedDesktopPositions[totalSeats].block, 8);
    }
  },
};

export const PrebuiltSlotsAndEmptyPlaces: Story = {
  args: { seats: undefined, slots: buildAlternatingSlots([SEATS[2]], 6, 'clockwise') },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="game-table-seat"]')).toHaveLength(6);
    await expect(within(canvasElement).getAllByText('Open seat')).toHaveLength(5);
  },
};

export const Lobby: Story = { args: { surface: 'lobby', players: 4, seats: seatsFor(4) } };

export const LobbyLandscape: Story = {
  args: { surface: 'lobby', viewport: VIEWPORTS.phoneWide },
  play: async ({ canvasElement }) => {
    const surface = required(canvasElement.querySelector<HTMLElement>('[data-game-surface]') ?? undefined).getBoundingClientRect();
    await expect(surface.width).toBeGreaterThan(100);
    await expect(surface.height).toBeGreaterThan(100);
    await expect(surface.width).toBeCloseTo(surface.height, 1);
  },
};

export const ExplicitRegionsAndRtl: Story = {
  args: { dir: 'rtl', header: 0, dock: 0, footer: 0, floating: 0 },
  play: async ({ canvasElement }) => {
    for (const part of ['header', 'dock', 'footer', 'floating']) {
      await expect(canvasElement.querySelector(`[data-ui="game-table-${part}"]`)).toHaveTextContent('0');
    }
    const seat = canvasElement.querySelector<HTMLElement>('[data-ui="game-table-seat"]');
    if (!seat) throw new Error('Missing seat');
    await expect(getComputedStyle(seat).direction).toBe('rtl');
    await expect(getComputedStyle(seat).transform).not.toBe('none');
  },
};

export const MirroredSeats: Story = {
  render: (args) => (
    <div style={{ display: 'flex', inlineSize: 'max-content' }}>
      {(['ltr', 'rtl'] as const).map((dir) => (
        <div key={dir} style={{ inlineSize: args.viewport.width, blockSize: args.viewport.height }}>
          <GameTable {...args} dir={dir} />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const tables = canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]');
    const ltr = required(tables[0]);
    const rtl = required(tables[1]);
    const ltrBox = required(ltr.querySelector<HTMLElement>('[data-game-surface]') ?? undefined).getBoundingClientRect();
    const rtlBox = required(rtl.querySelector<HTMLElement>('[data-game-surface]') ?? undefined).getBoundingClientRect();
    const ltrSeats = ltr.querySelectorAll('[data-ui="game-table-seat"]');
    const rtlSeats = rtl.querySelectorAll('[data-ui="game-table-seat"]');
    for (const [index, seat] of Array.from(ltrSeats).entries()) {
      const a = seat.getBoundingClientRect();
      const b = required(rtlSeats[index]).getBoundingClientRect();
      await expect((a.x + a.width / 2 - ltrBox.x) + (b.x + b.width / 2 - rtlBox.x)).toBeCloseTo(ltrBox.width, 1);
      await expect(a.y - ltrBox.y).toBeCloseTo(b.y - rtlBox.y, 1);
    }
  },
};
