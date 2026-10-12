import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { Button } from '../button';
import { GameCard } from '../game-card';
import { ThemeRoot } from '../theme-root';
import {
  GameTable, buildAlternatingSlots, buildBoardLayoutModel, buildTableOrderSlots,
  getTablePointSeatIndexes, resolveTableTurnDirection,
  type BoardPlayerCount, type BoardViewportProfile, type GameTableProps, type SeatLike,
  type GameTableSlot,
  resolveBoardViewportProfile,
} from './index';
import { REFERENCE_GEOMETRY, BREAKPOINT_CASES, REFERENCE_SLOT_KEYS } from './reference-fixtures';
import { ReferenceShell } from './reference-shell.fixture';
import { validateSlots } from './table-slots';
import { expectInside, expectMirrored, expectNoOverlap, expectMirroredDirection } from '../../testing/geometry-assertions';

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
const GEOMETRY_TOLERANCE_PX = 1;
const measurementFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing fixture item');
  return value;
}

async function expectSeatFraming(table: HTMLElement, players: BoardPlayerCount, profile: BoardViewportProfile) {
  const surface = required(table.querySelector<HTMLElement>('[data-game-surface]') ?? undefined);
  const frame = surface.getBoundingClientRect();
  const style = getComputedStyle(surface);
  const borderX = Number.parseFloat(style.borderLeftWidth);
  const borderY = Number.parseFloat(style.borderTopWidth);
  const paddingWidth = frame.width - borderX - Number.parseFloat(style.borderRightWidth);
  const paddingHeight = frame.height - borderY - Number.parseFloat(style.borderBottomWidth);
  const fixture = required(REFERENCE_GEOMETRY.find(([kind, name, count]) => kind === 'match' && name === profile && count === players));
  const [, , , ...positions] = fixture;
  const seats = Array.from(table.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]'));
  const dock = required(table.querySelector<HTMLElement>('[data-ui="game-table-dock"]') ?? undefined);
  for (const [index, seat] of seats.entries()) {
    const [inline, block, shiftX, shiftY, groupY] = required(positions[index]);
    const box = seat.getBoundingClientRect();
    const inlinePercent = style.direction === 'rtl' ? 100 - inline : inline;
    const inlineShift = style.direction === 'rtl' ? -shiftX : shiftX;
    const x = borderX + inlinePercent / 100 * paddingWidth + inlineShift - box.width / 2;
    const y = borderY + block / 100 * paddingHeight + shiftY + groupY - box.height / 2;
    const expected = { left: x, right: frame.width - x - box.width, top: y, bottom: frame.height - y - box.height };
    const actual = { left: box.left - frame.left, right: frame.right - box.right, top: box.top - frame.top, bottom: frame.bottom - box.bottom };
    // Overflow is a signed reference target, not a blanket 40px measurement tolerance.
    const designOverhang = Math.max(0, -Math.min(...Object.values(expected)));
    await expectInside(seat, surface, { tolerancePx: designOverhang + GEOMETRY_TOLERANCE_PX });
    for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
      await expect(Math.abs(actual[edge] - expected[edge]), `${profile}/${players} seat ${index} ${edge}: measured=${actual[edge]}px; reference=${expected[edge]}px; measurement tolerance=${GEOMETRY_TOLERANCE_PX}px`)
        .toBeLessThanOrEqual(GEOMETRY_TOLERANCE_PX);
    }
    await expectNoOverlap(seat, dock, { tolerancePx: GEOMETRY_TOLERANCE_PX });
    for (const other of seats.slice(index + 1)) await expectNoOverlap(seat, other, { tolerancePx: GEOMETRY_TOLERANCE_PX });
  }
  // Two/four-seat presets are antipodal, not axial mirrors. Mobile group shifts move their symmetry center.
  for (let index = 0; index < players / 2; index++) {
    const a = required(seats[index]).getBoundingClientRect();
    const b = required(seats[index + players / 2]).getBoundingClientRect();
    const groupSum = required(positions[index])[4] + required(positions[index + players / 2])[4];
    const dx = a.left + a.width / 2 + b.left + b.width / 2 - frame.left - frame.right;
    const dy = a.top + a.height / 2 + b.top + b.height / 2 - frame.top - frame.bottom - groupSum;
    await expect(Math.abs(dx), `Antipodal X seats ${index}/${index + players / 2}: delta=${dx}px; tolerance=${GEOMETRY_TOLERANCE_PX}px`).toBeLessThanOrEqual(GEOMETRY_TOLERANCE_PX);
    await expect(Math.abs(dy), `Antipodal Y seats ${index}/${index + players / 2}: delta=${dy}px after reference group shift ${groupSum}px; tolerance=${GEOMETRY_TOLERANCE_PX}px`).toBeLessThanOrEqual(GEOMETRY_TOLERANCE_PX);
  }
  if (players === 6) {
    await expectMirrored(required(seats[1]), required(seats[5]), surface, 'vertical', { tolerancePx: GEOMETRY_TOLERANCE_PX });
    await expectMirrored(required(seats[2]), required(seats[4]), surface, 'vertical', { tolerancePx: GEOMETRY_TOLERANCE_PX });
    if (required(positions[0])[4] + required(positions[3])[4] === 0) {
      await expectMirrored(required(seats[0]), required(seats[3]), surface, 'horizontal', { tolerancePx: GEOMETRY_TOLERANCE_PX });
      await expectMirrored(required(seats[1]), required(seats[2]), surface, 'horizontal', { tolerancePx: GEOMETRY_TOLERANCE_PX });
    }
  }
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

const seatChrome = (slot: GameTableSlot<Player>) => (
  <div style={{ display: 'grid', justifyItems: 'center', gap: vars.space[1] }}>
    <span>{slot.player?.name ?? 'Open seat'}</span>
    <div style={{ display: 'flex', gap: vars.space[1] }}>
      <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: first hidden card`} />
      <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: second hidden card`} />
    </div>
  </div>
);
const renderSeat = fn<GameTableProps<Player>['renderSeat']>((slot) => seatChrome(slot));
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
GameTable owns surface framing and seat coordinates. Avatars, hands, fans, points and card piles belong to children; their presentation rules are not public table APIs. Geometry coefficients remain profile presets, not theme tokens.
The default shell padding, strip spacing, maximum width and match translation follow the reference. The lobby landscape auto/auto frame uses a 100% height constraint rather than collapsing to its border; this is an intentional deviation.
\`seats\` requires compatible alternating teams (at most half the places per team for 2/4/6); incompatible capacities and duplicate player/slot keys throw. Use \`slots\` for arbitrary orders or teams.
\`clearance\` reserves extra block-axis space around the surface; the default is zero for reference framing. There is no automatic fit or content measurement. Large cards and tall seat chrome can overlap or be clipped in short containers. Increase clearance, reduce chrome/card size, or give the table more height; changing clearance also changes percentage-based surface dimensions. The landscape examples use 32px/64px/96px for sm/md/lg, not universal safe minima.
Clearance can separate seats from the dock while making the surface smaller; it does not prevent seats from overlapping each other. Six lg cards do not fit in the 840×360 example even with the dock cleared. Use more height or smaller cards for that composition.
Coordinates are measured from inline-start and mirror with \`dir="rtl"\`. \`data-game-surface="true"\` marks the surface for measuring future card flights.

### Seat framing
The inherited presets do not put every seat border box on the same edge of the table's bounding rectangle. Two/four-seat layouts use antipodal pairs (a 180° rotation), not left/right or top/bottom axial mirrors; six-seat layouts mirror left/right. Mobile group offsets move the antipodal symmetry center: phoneCompact +4px, phoneTall −2px and phoneWide −1px vertically.
Seat chrome can extend beyond the surface rectangle. With the story's 188.80×73.36px chrome on desktop, two-seat top/bottom overflow is about 1.72px; four-seat side overflow is 13.96px; six-seat side overflow is 39.53px and top/bottom overflow is 7.93px. These are reference placements, not rounding tolerances or an equal-edge-alignment promise. Negative edge distance means overflow; positive means inside the rectangle, not distance to the curved rim.
The matrix tests bound every signed edge against independent reference coordinates within 1 CSS px (subpixel layout/rounding), separate from the design overhang. Mirrors and seat/dock non-overlap use the same 1px measurement tolerance. They do not allow a blanket 40px error.

### Measuring flights
Query from the root ref, never from the document (multiple tables may exist):
\`\`\`tsx
const surface = tableRef.current?.querySelector<HTMLElement>('[data-game-surface="true"]');
const box = surface?.getBoundingClientRect();
\`\`\`
\`box\` is the transformed viewport border box, including borders (not outlines). Absolute-child percentages resolve against the padding box, excluding borders; do not multiply them by \`box.width\`. For an axis-aligned positive scale, use \`scaleX = box.width / surface.offsetWidth\` (and height/offsetHeight for Y); viewport-to-local border-box coordinates are \`(clientX - box.left) / scaleX\`, with the inverse \`box.left + localX * scaleX\`. Subtract the computed physical border widths for padding-box coordinates. RTL inline-start coordinates are \`paddingBoxWidth - physicalX\`; card flight viewport coordinates themselves are not mirrored. Measure both actual endpoints instead of deriving them from seat percentages. Rotation, skew and negative scale require the full transform matrix, not these scale formulas.
Measure again after viewport updates, resize, scroll, zoom or ancestor transform changes. Measurements are snapshots, not a cache maintained by GameTable.
\`offsetWidth\` and \`offsetHeight\` are integer-rounded; use a ResizeObserver border-box measurement if subpixel scale precision matters.

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
          <GameTable {...args} clearance={32} slots={undefined} players={players} seats={seatsFor(players)} header={`Poker · ${players / 2}v${players / 2}`} />
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
      await expectSeatFraming(table, required(COUNTS[index]), profile);
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

const referenceChromeStory = (profile: 'desktop' | 'phoneCompact'): Story => ({
  args: { viewport: VIEWPORTS[profile] },
  render: (args) => (
    <div style={{ inlineSize: 'max-content' }}>
      {COUNTS.map((players) => {
        const slots = buildAlternatingSlots(seatsFor(players), players, 'counterclockwise');
        return (
          <div key={players} data-reference-chrome-count={players} style={{ inlineSize: args.viewport.width, blockSize: args.viewport.height }}>
            <ReferenceShell profile={profile} surface="match" players={players} renderSeat={(index) => seatChrome(required(slots[index]))} />
          </div>
        );
      })}
    </div>
  ),
});
export const ReferenceChromeDesktop = referenceChromeStory('desktop');
export const ReferenceChromePhoneCompact = referenceChromeStory('phoneCompact');

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
        }
      }
    }
    await expect(profiles).toHaveLength(6);
    await expect(groupShifts).toEqual([8, 24, 18, 0, 0, 0]);
    const compact = buildBoardLayoutModel({ surface: 'match', totalSeats: 6, viewport: { ...VIEWPORTS.phoneCompact, aspectRatio: 412 / 816 } });
    const desktop = buildBoardLayoutModel({ surface: 'match', totalSeats: 6, viewport: { ...VIEWPORTS.desktop, aspectRatio: 1440 / 900 } });
    await expect(required(compact.seatGeometries[1]).leftPercent).not.toBeCloseTo(required(desktop.seatGeometries[1]).leftPercent, 4);
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
    await expectMirroredDirection(ltr, '[data-ui="game-table-seat"]');
    await expectMirroredDirection(rtl, '[data-ui="game-table-seat"]');
  },
};

export const ReferenceModelFixtures: Story = {
  play: async () => {
    await expect(REFERENCE_GEOMETRY).toHaveLength(36);
    for (const [surface, profile, totalSeats, ...positions] of REFERENCE_GEOMETRY) {
      const viewport = VIEWPORTS[profile];
      const layout = buildBoardLayoutModel({ surface, totalSeats, viewport: { ...viewport, aspectRatio: viewport.width / viewport.height } });
      await expect(layout.seatGeometries).toHaveLength(positions.length);
      for (const [index, position] of positions.entries()) {
        const geometry = required(layout.seatGeometries[index]);
        const actual = [geometry.leftPercent, geometry.topPercent, geometry.seatShiftX, geometry.seatShiftY, geometry.groupShiftY];
        for (const [axis, value] of position.entries()) await expect(required(actual[axis])).toBeCloseTo(value, 4);
      }
    }
    for (const [width, height, profile] of BREAKPOINT_CASES) {
      await expect(resolveBoardViewportProfile({ width, height })).toBe(profile);
    }
  },
};

export const InputConservation: Story = {
  play: async () => {
    for (const direction of ['clockwise', 'counterclockwise'] as const) {
      for (const [count, keys] of REFERENCE_SLOT_KEYS[direction].entries()) {
        await expect(buildAlternatingSlots(SEATS.slice(0, count), 6, direction).map((slot) => slot.key)).toEqual(keys);
      }
    }
    for (const players of COUNTS) {
      for (const direction of ['clockwise', 'counterclockwise'] as const) {
        for (const seats of [seatsFor(players), seatsFor(players).map((seat) => ({ ...seat, isMe: false })), seatsFor(players).map((seat) => ({ ...seat, isMe: seat.key === 'blair' }))]) {
          const slots = buildAlternatingSlots(seats, players, direction);
          await expect(slots.flatMap((slot) => slot.player ? [slot.player.key] : []).sort()).toEqual(seats.map((seat) => seat.key).sort());
          await expect(new Set(slots.map((slot) => slot.key)).size).toBe(players);
          const local = seats.find((seat) => seat.isMe);
          if (local) await expect(required(slots[0]).player?.key).toBe(local.key);
        }
      }
    }
    await expect(() => buildAlternatingSlots([SEATS[0], { ...SEATS[2], key: 'other' }], 2, 'clockwise')).toThrow('team 0 capacity is 1');
    await expect(() => buildAlternatingSlots([SEATS[0], SEATS[0]], 2, 'clockwise')).toThrow('unique');
    await expect(() => buildTableOrderSlots([SEATS[0], SEATS[0]], 'clockwise')).toThrow('unique');
    const slot = { key: 'same', teamIdx: 0, player: SEATS[0] } as const;
    await expect(() => validateSlots([slot, slot])).toThrow('unique');
    const collision = buildAlternatingSlots([{ ...SEATS[0], key: 'slot-1' }], 2, 'clockwise');
    await expect(collision.map((slot) => slot.key)).toEqual(['slot-1', 'slot-1-empty']);
  },
};

export const ReferenceDomFraming: Story = {
  render: () => (
    <div style={{ inlineSize: 'max-content' }}>
      {REFERENCE_GEOMETRY.map(([surface, profile, players]) => (
        <div key={`${surface}-${profile}-${players}`} data-parity-case={`${surface}-${profile}-${players}`} style={{ display: 'flex' }}>
          <div style={{ inlineSize: VIEWPORTS[profile].width, blockSize: VIEWPORTS[profile].height }}>
            <ReferenceShell profile={profile} surface={surface} players={players} />
          </div>
          <div style={{ inlineSize: VIEWPORTS[profile].width, blockSize: VIEWPORTS[profile].height }}>
            <GameTable players={players} seats={[]} viewport={VIEWPORTS[profile]} surface={surface} header="Poker" dock={<Button>Check</Button>} renderSeat={(_, index) => <>Seat {index}</>} />
          </div>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const pair of canvasElement.querySelectorAll<HTMLElement>('[data-parity-case]')) {
      const reference = required(pair.querySelector<HTMLElement>('[data-reference-root]') ?? undefined).getBoundingClientRect();
      const table = required(pair.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined).getBoundingClientRect();
      const a = required(pair.querySelector<HTMLElement>('[data-reference-surface]') ?? undefined).getBoundingClientRect();
      const b = required(pair.querySelector<HTMLElement>('[data-game-surface]') ?? undefined).getBoundingClientRect();
      // The documented auto/auto lobby constraint is intentionally not reference parity.
      if (pair.dataset.parityCase?.startsWith('lobby-phoneWide')) {
        await expect(a.width).toBeLessThan(32);
        await expect(b.width).toBeGreaterThan(100);
        await expect(b.height).toBeGreaterThan(100);
        continue;
      }
      await expect(b.width).toBeCloseTo(a.width, 1);
      await expect(b.height).toBeCloseTo(a.height, 1);
      await expect(b.x - table.x).toBeCloseTo(a.x - reference.x, 1);
      await expect(b.y - table.y).toBeCloseTo(a.y - reference.y, 1);
      const expectedSeats = pair.querySelectorAll('[data-reference-seat]');
      const actualSeats = pair.querySelectorAll('[data-ui="game-table-seat"]');
      for (const [index, seat] of Array.from(expectedSeats).entries()) {
        const x = seat.getBoundingClientRect();
        const y = required(actualSeats[index]).getBoundingClientRect();
        await expect(y.x - table.x).toBeCloseTo(x.x - reference.x, 1);
        await expect(y.y - table.y).toBeCloseTo(x.y - reference.y, 1);
        await expect(y.width).toBeCloseTo(x.width, 1);
      }
    }
  },
};

const cardComposition = (clearance: boolean): Story => ({
  args: { viewport: VIEWPORTS.phoneWide },
  parameters: { docs: { description: { story: clearance ? 'Explicit clearance separates each own seat from the dock. Larger cards can still overlap other seats; use more height or smaller cards.' : 'Compare sm, md and lg cards at 840×360 with reference framing. The larger cards overlap the dock.' } } },
  render: (args) => (
    <div style={{ inlineSize: 'max-content' }}>
      {(['sm', 'md', 'lg'] as const).map((size, index) => (
        <div key={size} data-card-composition={size} style={{ inlineSize: 840, blockSize: 360 }}>
          <GameTable {...args} clearance={clearance ? [32,64,96][index] : 0} renderSeat={(slot) => (
            <GameCard size={size} label={`${slot.player?.name}: hidden card`} />
          )} />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const wrapper of canvasElement.querySelectorAll('[data-card-composition]')) {
      const own = required(wrapper.querySelector<HTMLElement>('[data-ui="game-table-seat"]') ?? undefined).getBoundingClientRect();
      const dock = required(wrapper.querySelector<HTMLElement>('[data-ui="game-table-dock"]') ?? undefined).getBoundingClientRect();
      if (clearance) await expect(own.bottom).toBeLessThanOrEqual(dock.top);
      else if (wrapper.getAttribute('data-card-composition') !== 'sm') await expect(own.bottom).toBeGreaterThan(dock.top);
      await expect(own.height).toBeGreaterThan(0);
    }
  },
});
export const LandscapeCardSizes = cardComposition(false);
export const LandscapeCardSizesWithClearance = cardComposition(true);

function ResizingTables() {
  const [viewport, setViewport] = useState(VIEWPORTS.phoneCompact);
  const first = useRef<HTMLDivElement>(null);
  const second = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState('');
  return (
    <>
      <Button onClick={() => setViewport(VIEWPORTS.phoneWide)}>Landscape viewport</Button>
      <Button onClick={() => {
        const a = first.current?.querySelector<HTMLElement>('[data-game-surface]');
        const b = second.current?.querySelector<HTMLElement>('[data-game-surface]');
        setMeasured(a && b && a !== b ? `${measurementFormat.format(a.getBoundingClientRect().width)} / ${measurementFormat.format(b.getBoundingClientRect().width)}` : 'Missing surface');
      }}>Measure tables</Button>
      <output>{measured}</output>
      {[first, second].map((ref, index) => (
        <section key={index} style={{ inlineSize: viewport.width, blockSize: viewport.height, transform: index ? 'scale(0.75)' : undefined, transformOrigin: 'top left' }}>
          <div style={{ blockSize: '100%' }}>
            <GameTable ref={ref} dir={index ? 'rtl' : 'ltr'} players={2} slots={buildTableOrderSlots([SEATS[0],SEATS[2]], 'clockwise')} viewport={viewport} renderSeat={(slot) => <span>{slot.player?.name}</span>} />
          </div>
        </section>
      ))}
    </>
  );
}
export const WrappedTablesAndViewportUpdate: Story = {
  render: () => <ResizingTables />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Measure tables' }));
    const before = canvas.getByRole('status').textContent;
    const tables = canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]');
    const a = required(tables[0]).querySelector<HTMLElement>('[data-game-surface]');
    const b = required(tables[1]).querySelector<HTMLElement>('[data-game-surface]');
    if (!a || !b) throw new Error('Missing scoped surface');
    await expect(a).not.toBe(b);
    await expect(b.getBoundingClientRect().width / b.offsetWidth).toBeCloseTo(0.75, 2);
    const box = b.getBoundingClientRect();
    const scaleX = box.width / b.offsetWidth;
    const scaleY = box.height / b.offsetHeight;
    const clientX = box.left + 20 * scaleX;
    const clientY = box.top + 30 * scaleY;
    await expect((clientX - box.left) / scaleX).toBeCloseTo(20, 5);
    await expect((clientY - box.top) / scaleY).toBeCloseTo(30, 5);
    const firstSeat = required(required(tables[0]).querySelector<HTMLElement>('[data-ui="game-table-seat"]') ?? undefined).getBoundingClientRect();
    const secondSeat = required(required(tables[1]).querySelector<HTMLElement>('[data-ui="game-table-seat"]') ?? undefined).getBoundingClientRect();
    const firstBox = a.getBoundingClientRect();
    const ltrFraction = (firstSeat.x + firstSeat.width / 2 - firstBox.left) / firstBox.width;
    const rtlFraction = (secondSeat.x + secondSeat.width / 2 - box.left) / box.width;
    await expect(ltrFraction + rtlFraction).toBeCloseTo(1, 4);
    await userEvent.click(canvas.getByRole('button', { name: 'Landscape viewport' }));
    await expect(required(tables[0])).toHaveAttribute('data-profile', 'phoneWide');
    await userEvent.click(canvas.getByRole('button', { name: 'Measure tables' }));
    await expect(canvas.getByRole('status').textContent).not.toBe(before);
  },
};
