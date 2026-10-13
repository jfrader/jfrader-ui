import { StrictMode, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within, waitFor } from 'storybook/test';
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
import { BREAKPOINT_CASES, REFERENCE_SLOT_KEYS } from './reference-fixtures';
import { fitBoardContent, GAME_TABLE_LIMITS } from './fit-layout';
import { validateSlots } from './table-slots';
import { expectInside, expectNoOverlap, expectMirroredDirection } from '../../testing/geometry-assertions';

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
const GEOMETRY_TOLERANCE_PX = 0.5;
const measurementFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing fixture item');
  return value;
}

async function expectSeatFraming(table: HTMLElement, players: BoardPlayerCount, profile: BoardViewportProfile) {
  await table.ownerDocument.fonts.ready;
  await waitFor(() => expect(table.getAttribute('data-layout-fit')).toMatch(/^(fitted|insufficient-space)$/));
  for (const card of table.querySelectorAll<HTMLElement>('[data-ui~="game-card"]')) {
    const box = card.getBoundingClientRect();
    await expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(GAME_TABLE_LIMITS.minimumCardWidthPx - 0.01);
  }
  if (table.dataset.layoutFit === 'insufficient-space') {
    await expect(table).toHaveAttribute('data-clearance-start', String(GAME_TABLE_LIMITS.minimumClearancePx));
    await expect(table).toHaveAttribute('data-clearance-end', String(GAME_TABLE_LIMITS.minimumClearancePx));
    // The floor remains visible in geometry even when containment cannot be promised.
    return;
  }
  const surface = required(table.querySelector<HTMLElement>('[data-game-surface]') ?? undefined);
  const frame = surface.getBoundingClientRect();
  const style = getComputedStyle(table);
  const rx = Number.parseFloat(style.getPropertyValue('--game-table-radius-x'));
  const ry = Number.parseFloat(style.getPropertyValue('--game-table-radius-y'));
  const direction = style.direction === 'rtl' ? -1 : 1;
  await expect(rx).toBeGreaterThan(0);
  await expect(ry).toBeGreaterThan(0);
  await expect(Math.max(rx, ry) / Math.min(rx, ry)).toBeLessThanOrEqual(1.5 + Number.EPSILON);
  const seats = Array.from(table.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]'));
  await expect(seats).toHaveLength(players);
  const obstacles = Array.from(table.querySelectorAll<HTMLElement>('[data-ui="game-table-dock"], [data-ui="game-table-header"], [data-ui="game-table-center"], [data-ui="game-table-footer"]'));
  for (const [index, seat] of seats.entries()) {
    const box = seat.getBoundingClientRect();
    const dx = box.x + box.width / 2 - frame.x - frame.width / 2;
    const dy = box.y + box.height / 2 - frame.y - frame.height / 2;
    const theta = Math.PI / 2 + 2 * Math.PI * index / players;
    const label = `${profile}/${players} seat ${index}`;
    await expect(Math.abs(dx - direction * rx * Math.cos(theta)), `${label} regular-angle X`).toBeLessThan(GEOMETRY_TOLERANCE_PX);
    await expect(Math.abs(dy - ry * Math.sin(theta)), `${label} regular-angle Y`).toBeLessThan(GEOMETRY_TOLERANCE_PX);
    await expect(Math.abs(Math.hypot(dx / rx, dy / ry) - 1), `${label} on curve`).toBeLessThan(0.01);
    const matrix = new DOMMatrix(getComputedStyle(seat).transform);
    const rotation = Math.atan2(matrix.b, matrix.a);
    const inwardAngle = Math.atan2(dy, dx) - Math.PI / 2;
    const rotationError = Math.atan2(Math.sin(rotation - inwardAngle), Math.cos(rotation - inwardAngle));
    await expect(Math.abs(rotationError), `${label} faces center`).toBeLessThan(0.01);
    await expectInside(seat, surface, { tolerancePx: GEOMETRY_TOLERANCE_PX });
    for (const other of [...seats.slice(index + 1), ...obstacles]) {
      const otherBox = other.getBoundingClientRect();
      if (otherBox.width > 0 && otherBox.height > 0) await expectNoOverlap(seat, other, { tolerancePx: GEOMETRY_TOLERANCE_PX });
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
Pass intrinsic seat content through \`renderSeat(slot, index, geometry)\`. Use \`header\`, \`center\`, \`dock\`, \`footer\` and \`floating\` for other content. Seat and center border boxes are measured; keep their content in normal flow. Absolutely positioned artwork must reserve its full footprint in its parent.

### Geometry
Give the parent a block size and pass current viewport dimensions in CSS pixels. Update \`viewport\` on resize; it selects the surface frame. ResizeObserver measures the actual local surface and intrinsic content, including when the parent is smaller than the viewport. Seats and center remain hidden until the first measurement; the server does not guess their dimensions.
\`seats\` fills empty places, alternates teams and puts your seat first. \`slots\` preserves a prebuilt visual order and must contain exactly \`players\` places; order it with the exported builders when needed. Do not pass both.
The curve uses θᵢ = π/2 + 2πi/N and Pᵢ = C + (Rx cosθᵢ, Ry sinθᵢ). C is the surface border-box center. A near-square available area (axis ratio ≤1.15) gives a circle; beyond that the axis ratio grows continuously up to 1.5. Every seat faces the physical center, not the ellipse's parametric angle. RTL mirrors both placement and rotation. The old reference's per-profile position corrections and group translations are deliberately removed.
\`seats\` requires compatible alternating teams (at most half the places per team for 2/4/6); incompatible capacities and duplicate player/slot keys throw. Use \`slots\` for arbitrary orders or teams.
\`clearance\` reserves additional block-axis space; content fits the remaining space. Header, dock and footer remain unscaled, outside the surface. More clearance can make the content smaller, not larger.
Coordinates are measured from inline-start and mirror with \`dir="rtl"\`. \`data-game-surface="true"\` marks the surface for measuring future card flights.

### Content size
The table applies one uniform scale, at most 1, to the measured seats and center. A card with intrinsic width w renders at s·w; chrome, text and internal gaps follow the same rule. The outer separation is the measured space-2 token multiplied by s. The scale is the largest one satisfying rotated border-box containment and no seat/seat or seat/center intersection. Content is not substituted, truncated or changed in the stories to obtain a fit.
\`--game-table-content-scale\`, \`--game-table-radius-x\`, \`--game-table-radius-y\` and \`--game-table-content-gap\` expose the resolved local geometry. \`geometry.scale\` is informational: do not multiply child dimensions by it again, or use it to change the intrinsic box that is being measured. For detached artwork outside the table, rendered size = intrinsic size × content scale × ancestor scale.
Native seat/center controls constrain scaling to preserve at least 24px on both axes and 32px on their main axis, unless already smaller at their intrinsic size. If there is not enough room at that minimum, \`data-layout-fit="insufficient-space"\` is emitted instead of silently shrinking controls further. Give that composition more space. \`data-layout-fit="fitted"\` covers normal-flow border boxes, not overflowing artwork, shadows or floating overlays. Decorative content can become small in short containers; inspect it at its intended display size.

### Rival-card flight markers
After commit, GameTable marks each actual \`GameCard\` back in an occupied non-own seat with \`data-seat-hidden-card={player.key}\` and \`data-seat-hidden-card-index={index}\`. Index is current zero-based DOM order within that seat, not seat index. Markers update on card/face/player changes and are removed when a card is revealed or a seat becomes empty/own. No opponent value is exposed. Own-hand markers remain the hand's responsibility; custom card renderers must provide their own markers. The flight consumer example is \`apps/storybook/stories/card-flights-fixture.tsx\`.

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
    const seats = table.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]');
    await expect(seats).toHaveLength(6);
    for (const [index, slot] of slots.entries()) {
      await expect(seats[index]).toHaveAttribute('data-slot-key', slot.key);
      await expect(args.renderSeat).toHaveBeenCalledWith(slot, index, expect.objectContaining({ index, totalSeats: 6 }));
    }
    const surface = table.querySelector<HTMLElement>('[data-game-surface]');
    if (!surface) throw new Error('Missing surface');
    const surfaceBox = surface.getBoundingClientRect();
    const ownBox = required(seats[0]).getBoundingClientRect();
    await expect(ownBox.y + ownBox.height / 2).toBeGreaterThan(surfaceBox.y + surfaceBox.height / 2);
    await expectSeatFraming(table, 6, 'phoneCompact');
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
    for (const [profile, viewport] of Object.entries(VIEWPORTS)) {
      for (const players of COUNTS) {
        const layout = buildBoardLayoutModel({ surface: 'match', totalSeats: players, viewport: { ...viewport, aspectRatio: viewport.width / viewport.height } });
        await expect(layout.profile).toBe(profile);
        await expect(layout.seatGeometries).toHaveLength(players);
        await expect(layout.fit).toBe('measuring');
        await expect(layout.seatConfig.radiusX).toBe(0);
        for (const [index, seat] of layout.seatGeometries.entries()) {
          await expect(seat.angleDeg).toBeCloseTo(90 + 360 * index / players, 8);
          await expect(seat.groupShiftY).toBe(0);
        }
      }
    }
  },
};

export const PrebuiltSlotsAndEmptyPlaces: Story = {
  args: { seats: undefined, slots: buildAlternatingSlots([SEATS[2]], 6, 'clockwise') },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="game-table-seat"]')).toHaveLength(6);
    await expect(within(canvasElement).getAllByText('Open seat')).toHaveLength(5);
    await expect(canvasElement.querySelectorAll('[data-seat-hidden-card]')).toHaveLength(0);
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
    await expectSeatFraming(ltr, 6, 'phoneCompact');
    await expectSeatFraming(rtl, 6, 'phoneCompact');
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

export const MeasuredModel: Story = {
  play: async () => {
    for (const [width, height, profile] of BREAKPOINT_CASES) {
      await expect(resolveBoardViewportProfile({ width, height })).toBe(profile);
    }
    const measured = { width: 500, height: 500, centerX: 250, centerY: 250,
      seats: Array.from({ length: 6 }, () => ({ width: 110, height: 90 })),
      center: { width: 120, height: 80 }, gap: 8, minimumScale: 0 };
    const circle = fitBoardContent(measured);
    await expect(circle.radiusX).toBe(circle.radiusY);
    await expect(circle.scale).toBe(1);
    const small = fitBoardContent({ ...measured, width: 160, height: 100, centerX: 80, centerY: 50 });
    await expect(small.scale).toBeLessThan(circle.scale);
    await expect(small.fits).toBe(true);
    const blocked = fitBoardContent({ ...measured, width: 160, height: 100, centerX: 80, centerY: 50, minimumScale: 1 });
    await expect(blocked.fits).toBe(false);
    await expect(blocked.positions.every((seat) => seat.scale === 1)).toBe(true);
    await expect(blocked.centerScale).toBe(1);
    const grownContent = fitBoardContent({ ...measured, seats: measured.seats.map((seat) => ({ width: seat.width * 5, height: seat.height * 5 })) });
    await expect(grownContent.scale).toBeLessThan(circle.scale);
    const wide = fitBoardContent({ ...measured, width: 2000, centerX: 1000 });
    await expect(wide.radiusX / wide.radiusY).toBeCloseTo(1.5, 8);
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

export const LobbyMatrix: Story = {
  render: (args) => (
    <div style={{ inlineSize: 'max-content' }}>
      {Object.entries(VIEWPORTS).map(([profile, viewport]) => COUNTS.map((players) => (
        <div key={`${profile}-${players}`} style={{ inlineSize: viewport.width, blockSize: viewport.height }}>
          <GameTable {...args} viewport={viewport} players={players} slots={undefined} seats={seatsFor(players)} surface="lobby" />
        </div>
      )))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const tables = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]'));
    await expect(tables).toHaveLength(18);
    let index = 0;
    for (const viewport of Object.values(VIEWPORTS)) for (const players of COUNTS) {
      await expectSeatFraming(required(tables[index++]), players, resolveBoardViewportProfile(viewport));
    }
  },
};

export const RtlMatrix: Story = {
  render: (args) => (
    <div style={{ inlineSize: 'max-content' }}>
      {Object.entries(VIEWPORTS).map(([profile, viewport]) => COUNTS.map((players) => (
          <div key={`${profile}-${players}`} style={{ inlineSize: viewport.width, blockSize: viewport.height }}>
            <GameTable {...args} viewport={viewport} players={players} slots={undefined} seats={seatsFor(players)} dir="rtl" />
          </div>
      )))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const tables = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]'));
    await expect(tables).toHaveLength(18);
    let index = 0;
    for (const viewport of Object.values(VIEWPORTS)) for (const players of COUNTS) {
      await expectSeatFraming(required(tables[index++]), players, resolveBoardViewportProfile(viewport));
    }
  },
};

const cardComposition = (clearance: boolean): Story => ({
  args: { viewport: VIEWPORTS.phoneWide },
  parameters: { docs: { description: { story: clearance ? 'Compare the same sm, md and lg cards with additional shell clearance.' : 'Compare sm, md and lg cards at 840×360. Their intrinsic sizes stay unchanged; the table scales the composition to fit.' } } },
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
      const table = required(wrapper.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
      await expectSeatFraming(table, 6, 'phoneWide');
      await expect(table).toHaveAttribute('data-layout-fit', 'fitted');
      if (clearance && wrapper.getAttribute('data-card-composition') === 'lg') {
        await expect(table).toHaveAttribute('data-clearance', 'reduced');
        await expect(table).toHaveAttribute('data-clearance-start', '0');
      }
      const ownCard = required(table.querySelector<HTMLElement>('[data-ui="game-table-seat"] [data-ui="game-card"]') ?? undefined);
      const intrinsicWidths = { sm: 32, md: 72, lg: 112 };
      const size = wrapper.getAttribute('data-card-composition');
      if (size !== 'sm' && size !== 'md' && size !== 'lg') throw new Error('Unknown card size');
      await expect(Number.parseFloat(getComputedStyle(ownCard).width)).toBe(intrinsicWidths[size]);
      const communityCards = table.querySelectorAll<HTMLElement>('[data-ui="game-table-center"] [data-ui="game-card"]');
      await expect(communityCards).toHaveLength(3);
      for (const card of communityCards) {
        card.scrollIntoView({ block: 'center', inline: 'center' });
        const rect = card.getBoundingClientRect();
        for (const [u, v] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.75]]) {
          const front = card.ownerDocument.elementsFromPoint(rect.x + rect.width * required(u), rect.y + rect.height * required(v))[0];
          await expect(front === card || card.contains(front ?? null), `${size} community card exposed`).toBe(true);
        }
      }
    }
  },
});
export const LandscapeCardSizes = cardComposition(false);
export const LandscapeCardSizesWithClearance = cardComposition(true);

function ChangingContent() {
  const [large, setLarge] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [empty, setEmpty] = useState(false);
  return (
    <>
      <Button onClick={() => setLarge(true)}>Grow content</Button>
      <Button onClick={() => setNarrow(true)}>Shrink container</Button>
      <Button onClick={() => setRevealed(true)}>Reveal first</Button>
      <Button onClick={() => setRemoved(true)}>Remove second</Button>
      <Button onClick={() => setEmpty(true)}>Empty rival</Button>
      <div style={{ inlineSize: narrow ? 380 : 500, blockSize: narrow ? 360 : 440 }}>
        <GameTable players={2} viewport={VIEWPORTS.desktop} seats={empty ? [SEATS[2]] : seatsFor(2)}
          center={center} header="Poker" dock={<Button>Check</Button>}
          renderSeat={(slot) => slot.player ? (
            <div style={{ display: 'flex', gap: vars.space[2] }}>
              {['first', 'second', 'third'].filter((key) => !removed || key !== 'second').map((key) => (
                <GameCard key={key} size={large ? 'lg' : 'sm'} label={`${slot.player?.name}: ${key}`}
                  value={revealed && key === 'first' ? { deck: 'french', suit: 'spades', rank: 'A' } : undefined} />
              ))}
            </div>
          ) : <span>Open seat</span>} />
      </div>
    </>
  );
}

/** Changing card sizes and container dimensions keeps the same card nodes and flight markers. */
export const ContentResizeAndFlightMarkers: Story = {
  render: () => <StrictMode><ChangingContent /></StrictMode>,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    const rival = () => Array.from(table.querySelectorAll<HTMLElement>('[data-seat-hidden-card="blair"]'));
    await waitFor(() => expect(rival()).toHaveLength(3));
    await expect(rival().map((card) => card.dataset.seatHiddenCardIndex)).toEqual(['0', '1', '2']);
    await expect(table.querySelectorAll('[data-seat-hidden-card="you"]')).toHaveLength(0);
    const third = required(rival()[2]);
    await expectSeatFraming(table, 2, 'desktop');
    const scale = () => Number.parseFloat(getComputedStyle(table).getPropertyValue('--game-table-content-scale'));
    const initialScale = scale();
    await userEvent.click(canvas.getByRole('button', { name: 'Grow content' }));
    await waitFor(() => expect(scale()).toBeLessThan(initialScale));
    await expectSeatFraming(table, 2, 'desktop');
    const grownScale = scale();
    await userEvent.click(canvas.getByRole('button', { name: 'Shrink container' }));
    await waitFor(() => expect(scale()).toBeLessThan(grownScale));
    await expect(table).toHaveAttribute('data-profile', 'desktop');
    await expectSeatFraming(table, 2, 'desktop');
    await userEvent.click(canvas.getByRole('button', { name: 'Reveal first' }));
    await waitFor(() => expect(rival()).toHaveLength(2));
    await expect(rival().map((card) => card.dataset.seatHiddenCardIndex)).toEqual(['0', '1']);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove second' }));
    await waitFor(() => expect(rival()).toHaveLength(1));
    await expect(rival()[0]).toBe(third);
    await expect(third).toHaveAttribute('data-seat-hidden-card-index', '0');
    await expect(third.getBoundingClientRect().width).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole('button', { name: 'Empty rival' }));
    await waitFor(() => expect(rival()).toHaveLength(0));
    await expect(third).not.toHaveAttribute('data-seat-hidden-card');
  },
};

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
