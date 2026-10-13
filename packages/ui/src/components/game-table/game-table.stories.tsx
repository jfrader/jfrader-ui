import { StrictMode, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { Avatar, type AvatarSize } from '../avatar';
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

async function expectSeatFraming(table: HTMLElement, players: BoardPlayerCount, profile: BoardViewportProfile, expectedFit = 'fitted') {
  await table.ownerDocument.fonts.ready;
  await waitFor(() => expect(table).toHaveAttribute('data-layout-fit', expectedFit));
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
  const isRtl = table.getAttribute('dir') === 'rtl' || style.direction === 'rtl';
  const direction = isRtl ? -1 : 1;
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

    // All seats remain upright for spectator: no rotation
    const matrix = new DOMMatrix(getComputedStyle(seat).transform);
    const rotationDeg = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
    await expect(Math.abs(rotationDeg), `${label} upright (no rotation)`).toBeLessThan(0.01);

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
  <div style={{ position: 'relative', display: 'flex', gap: vars.space[1] }}>
    <GameTable.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </GameTable.SeatChrome>
    <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: first hidden card`} />
    <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: second hidden card`} />
  </div>
);
const seatCardsOnly = (slot: GameTableSlot<Player>) => (
  <div style={{ position: 'relative', display: 'flex', gap: vars.space[1] }}>
    <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: first hidden card`} />
    <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: second hidden card`} />
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
The curve uses θᵢ = π/2 + 2πi/N and Pᵢ = C + (Rx cosθᵢ, Ry sinθᵢ). C is the surface border-box center. A near-square available area (axis ratio ≤1.15) gives a circle; beyond that the shared axis ratio grows continuously up to 1.5. On an ellipse the physical polar-angle gaps differ from the equal parametric gaps; no per-seat angular correction is applied. Content stays upright, with zero seat rotation; RTL mirrors placement only. No table-owned decoration requires rotation. The old reference's per-profile position corrections and group translations are deliberately removed.
\`seats\` requires compatible alternating teams (at most half the places per team for 2/4/6); incompatible capacities and duplicate player/slot keys throw. Use \`slots\` for arbitrary orders or teams.
\`clearance\` requests additional block-axis space. Header, dock and footer remain unscaled, outside the surface. The request is a preference: if the content floors cannot fit, both clearance edges yield to \`GAME_TABLE_LIMITS.minimumClearancePx\` (0). The table retries the requested CSS padding on content/size changes, so the request is restored when space returns. This is a two-step policy (requested, then minimum), not a search for the largest feasible clearance.
Coordinates are measured from inline-start and mirror with \`dir="rtl"\`. \`data-game-surface="true"\` marks the surface for measuring future card flights.

### Content size
\`GAME_TABLE_LIMITS.minimumCardWidthPx\` is 32px, matching the existing GameCard sm width. It is a product size floor, not a universal legibility guarantee for arbitrary artwork. Each seat and the center have their own minimum scale: max(32 / intrinsic card width) over that region's GameCards, combined with its control-size floor. Thus lg seat cards can shrink without shrinking sm community cards below their floor. Custom artwork without GameCard markers is not covered by the card floor.
For a preferred scale t in [0,1], each region uses max(t, its minimum scale). A bounded monotone search finds the largest feasible t under upright border-box containment and seat/seat/center separation. The outer space-2 gap remains unscaled. An intrinsically undersized card is enlarged to the floor rather than silently exempted. Content is never substituted or truncated to obtain a fit.
Precedence: preserve card/control floors → try requested clearance → retry at clearance zero → declare insufficient space if the floors still do not fit. \`data-clearance="requested" | "reduced"\` and numeric \`data-clearance-start/end\` report effective local CSS pixels. \`data-layout-fit="measuring" | "fitted" | "insufficient-space"\` reports card geometry independently. The 840×360 match matrix now fits with upright cards and out-of-flow chrome. The square lobby frame at that viewport remains insufficient for 4/6 seats; insufficient space also has an oversized-content regression. Floors remain intact rather than hiding overflow or collisions.

### Seat chrome
Put names, avatars and non-layout adornments inside \`<GameTable.SeatChrome>…</GameTable.SeatChrome>\` within renderSeat. The part is absolutely positioned: it reserves no space and its descendants do not constrain card scale. It floats on the outward side; when a side label does not fit horizontally inside the root, only the chrome moves above/below the cards. No card-anchor compensation is applied. Removing the part from the DOM does not move the card block. Unmarked in-flow content still counts as content; the table does not guess which arbitrary text is a player name. Avoid wrappers that reserve padding/gaps for the chrome.
Chrome is independent of card fit: \`fitted\` does not guarantee arbitrary oversized labels or controls fit. Keep chrome concise and respect control/card minimum sizes within your custom content. The table does not rotate names, avatars, or faces; user-supplied transforms are the consumer's responsibility.
\`--game-table-content-scale\` on each seat and \`--game-table-center-scale\` on the root expose actual region scales; the root content-scale value is only the preferred t. \`--game-table-radius-x/y\` and \`--game-table-content-gap\` expose local geometry. \`geometry.scale\` is informational: never multiply child sizes by it again. Floors are local CSS-pixel sizes before external ancestor transforms; a consumer scaling the entire table must account for its own scale.
Native seat/center controls preserve at least 24px on both axes and 32px on their main axis, unless already smaller intrinsically. Regions without GameCards or controls retain their intrinsic size rather than disappearing at a zero floor. \`fitted\` covers normal-flow border boxes, not overflowing artwork, shadows or floating overlays. Keep absolute artwork's full footprint reserved in normal flow.

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
      await expectSeatFraming(table, required(COUNTS[index]), profile, 'fitted');
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
    const mixed = fitBoardContent({ ...measured, width: 500, height: 240, centerX: 250, centerY: 120,
      seats: [{ width: 112, height: 165.75, minimumScale: 32 / 112 }, { width: 112, height: 165.75, minimumScale: 32 / 112 }],
      center: { width: 104, height: 77.36, minimumScale: 1 } });
    await expect(mixed.fits).toBe(true);
    await expect(mixed.centerScale).toBe(1);
    await expect(required(mixed.positions[0]).scale).toBeLessThan(1);
    await expect(required(mixed.positions[0]).scale * 112).toBeGreaterThanOrEqual(GAME_TABLE_LIMITS.minimumCardWidthPx);
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
      const profile = resolveBoardViewportProfile(viewport);
      const expectedFit = profile === 'phoneWide' && players > 2 ? 'insufficient-space' : 'fitted';
      await expectSeatFraming(required(tables[index++]), players, profile, expectedFit);
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
      const profile = resolveBoardViewportProfile(viewport);
      await expectSeatFraming(required(tables[index++]), players, profile, 'fitted');
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
  const [clearance, setClearance] = useState(0);
  const [roomy, setRoomy] = useState(false);
  return (
    <>
      <Button onClick={() => setLarge(true)}>Grow content</Button>
      <Button onClick={() => setNarrow(true)}>Shrink container</Button>
      <Button onClick={() => setRevealed(true)}>Reveal first</Button>
      <Button onClick={() => setRemoved(true)}>Remove second</Button>
      <Button onClick={() => setEmpty(true)}>Empty rival</Button>
      <Button onClick={() => setClearance(96)}>Request clearance</Button>
      <Button onClick={() => setRoomy(true)}>Restore room</Button>
      <div style={{ inlineSize: narrow ? 380 : 500, blockSize: roomy ? 800 : narrow ? 360 : 440 }}>
        <GameTable players={2} viewport={VIEWPORTS.desktop} clearance={clearance} seats={empty ? [SEATS[2]] : seatsFor(2)}
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
    await userEvent.click(canvas.getByRole('button', { name: 'Request clearance' }));
    await waitFor(() => expect(table).toHaveAttribute('data-clearance', 'reduced'));
    await expectSeatFraming(table, 2, 'desktop');
    await userEvent.click(canvas.getByRole('button', { name: 'Restore room' }));
    await waitFor(() => expect(table).toHaveAttribute('data-clearance', 'requested'));
    await expect(table).toHaveAttribute('data-clearance-start', '96');
    await expectSeatFraming(table, 2, 'desktop');
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

const seatWithAvatar = (slot: GameTableSlot<Player>, size: AvatarSize = 'sm') => (
  <div style={{ position: 'relative', display: 'flex', gap: vars.space[1] }}>
    <GameTable.SeatChrome>
      <Avatar size={size} name={slot.player?.name ?? 'Open seat'} />
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </GameTable.SeatChrome>
    <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: first hidden card`} />
    <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: second hidden card`} />
  </div>
);

export const WithAvatars: Story = {
  args: {
    players: 6, seats: SEATS, viewport: VIEWPORTS.desktop,
    renderSeat: fn((slot, _index, _geometry) => seatWithAvatar(slot, 'sm')),
    center, header: 'Poker · Avatars', dock: <Button>Check</Button>,
  },
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(table, 6, 'desktop', 'fitted');
    const avatars = table.querySelectorAll('[data-ui="avatar"]');
    await expect(avatars).toHaveLength(6);
    for (const seat of table.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]')) {
      const matrix = new DOMMatrix(getComputedStyle(seat).transform);
      const rotationDeg = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
      await expect(Math.abs(rotationDeg)).toBeLessThan(0.01);
    }
  },
};

export const UprightProfilesWithAvatars: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: vars.space[6] }}>
      {(['phoneCompact', 'phoneTall', 'phoneWide', 'tablet', 'tabletWide', 'desktop'] as const).map((profile) => (
        <div key={profile} data-profile-target={profile} style={{ inlineSize: VIEWPORTS[profile].width, blockSize: VIEWPORTS[profile].height }}>
          <GameTable
            players={6}
            seats={SEATS}
            viewport={VIEWPORTS[profile]}
            renderSeat={(slot) => seatWithAvatar(slot, 'sm')}
            center={center}
            header={`Poker · ${profile} (6p)`}
            dock={<Button>Check</Button>}
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const tables = canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]');
    await expect(tables).toHaveLength(6);
    for (const table of Array.from(tables)) {
      await waitFor(() => expect(table).toHaveAttribute('data-layout-fit', 'fitted'));
      for (const chrome of table.querySelectorAll<HTMLElement>('[data-ui="game-table-seat-chrome"]')) {
        await waitFor(async () => { await expectInside(chrome, table, { tolerancePx: 0.5 }); });
      }
      const avatars = table.querySelectorAll('[data-ui="avatar"]');
      await expect(avatars).toHaveLength(6);
      for (const seat of Array.from(table.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]'))) {
        const matrix = new DOMMatrix(getComputedStyle(seat).transform);
        const rotationDeg = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
        await expect(Math.abs(rotationDeg)).toBeLessThan(0.01);
      }
    }
  },
};

export const AvatarIndependence: Story = {
  args: {
    players: 4, seats: seatsFor(4), viewport: VIEWPORTS.desktop,
    renderSeat: fn((slot, index, _geometry) => {
      if (index === 0) return seatChrome(slot);
      if (index === 1) return (
        <div style={{ position: 'relative', display: 'flex', gap: vars.space[1] }}>
          <GameCard size="sm" label="First hidden card" />
          <GameCard size="sm" label="Second hidden card" />
        </div>
      );
      if (index === 2) return seatWithAvatar(slot, 'sm');
      return seatWithAvatar(slot, 'md');
    }),
    center, header: 'Poker · Avatar Independence', dock: <Button>Check</Button>,
  },
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(table, 4, 'desktop', 'fitted');
  },
};

export const ChromeRemovalParity: Story = {
  args: {
    players: 6, seats: SEATS, viewport: VIEWPORTS.desktop,
    center, header: 'Poker · Chrome Removal Parity', dock: <Button>Check</Button>,
  },
  render: (args) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: vars.space[4] }}>
      <div data-parity-group="with-chrome">
        <GameTable {...args} renderSeat={seatChrome} />
      </div>
      <div data-parity-group="without-chrome">
        <GameTable {...args} renderSeat={seatCardsOnly} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const withChromeTable = required(canvasElement.querySelector<HTMLElement>('[data-parity-group="with-chrome"] [data-ui="game-table"]') ?? undefined);
    const withoutChromeTable = required(canvasElement.querySelector<HTMLElement>('[data-parity-group="without-chrome"] [data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(withChromeTable, 6, 'desktop', 'fitted');
    await expectSeatFraming(withoutChromeTable, 6, 'desktop', 'fitted');

    const seatsA = Array.from(withChromeTable.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]'));
    const seatsB = Array.from(withoutChromeTable.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]'));
    await expect(seatsA).toHaveLength(6);
    await expect(seatsB).toHaveLength(6);

    const surfaceA = required(withChromeTable.querySelector<HTMLElement>('[data-game-surface]') ?? undefined).getBoundingClientRect();
    const surfaceB = required(withoutChromeTable.querySelector<HTMLElement>('[data-game-surface]') ?? undefined).getBoundingClientRect();

    for (let i = 0; i < 6; i++) {
      const boxA = seatsA[i]!.getBoundingClientRect();
      const boxB = seatsB[i]!.getBoundingClientRect();
      await expect(Math.abs(boxA.width - boxB.width)).toBeLessThanOrEqual(1);
      await expect(Math.abs(boxA.height - boxB.height)).toBeLessThanOrEqual(1);

      const relX_A = boxA.x + boxA.width / 2 - (surfaceA.x + surfaceA.width / 2);
      const relY_A = boxA.y + boxA.height / 2 - (surfaceA.y + surfaceA.height / 2);
      const relX_B = boxB.x + boxB.width / 2 - (surfaceB.x + surfaceB.width / 2);
      const relY_B = boxB.y + boxB.height / 2 - (surfaceB.y + surfaceB.height / 2);
      await expect(Math.abs(relX_A - relX_B)).toBeLessThanOrEqual(1);
      await expect(Math.abs(relY_A - relY_B)).toBeLessThanOrEqual(1);
    }
    const cards = Array.from(withChromeTable.querySelectorAll<HTMLElement>('[data-ui~="game-card"]'));
    const before = cards.map((card) => card.getBoundingClientRect());
    withChromeTable.querySelectorAll('[data-ui="game-table-seat-chrome"]').forEach((chrome) => chrome.remove());
    for (let frame = 0; frame < 12; frame++) await new Promise(requestAnimationFrame);
    for (const [index, card] of cards.entries()) {
      const after = card.getBoundingClientRect();
      const previous = required(before[index]);
      for (const coordinate of ['x', 'y', 'width', 'height'] as const) {
        await expect(Math.abs(after[coordinate] - previous[coordinate])).toBeLessThan(0.01);
      }
    }
  },
};

export const OversizedInsufficientSpace: Story = {
  args: {
    players: 6, seats: SEATS, viewport: VIEWPORTS.phoneCompact,
    center, header: 'Poker · Insufficient Space', dock: <Button>Check</Button>,
    renderSeat: fn((slot, _index, _geometry) => (
      <div style={{ display: 'flex', gap: vars.space[2] }}>
        <GameCard size="lg" label={`${slot.player?.name}: card 1`} />
        <GameCard size="lg" label={`${slot.player?.name}: card 2`} />
        <GameCard size="lg" label={`${slot.player?.name}: card 3`} />
        <GameCard size="lg" label={`${slot.player?.name}: card 4`} />
      </div>
    )),
  },
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expect(table).toHaveAttribute('data-layout-fit', 'insufficient-space');
    for (const card of table.querySelectorAll<HTMLElement>('[data-ui~="game-card"]')) {
      const box = card.getBoundingClientRect();
      await expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(GAME_TABLE_LIMITS.minimumCardWidthPx - 0.01);
    }
  },
};

export const StateStability: Story = {
  args: {
    players: 6, seats: SEATS, viewport: VIEWPORTS.phoneWide,
    renderSeat: fn((slot, _index, _geometry) => seatWithAvatar(slot, 'sm')), center, header: 'Poker · State Stability', dock: <Button>Check</Button>,
  },
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(table, 6, 'phoneWide', 'fitted');
    const states = new Set<string | null>();
    for (let frame = 0; frame < 12; frame++) {
      await new Promise(requestAnimationFrame);
      states.add(table.getAttribute('data-layout-fit'));
    }
    await expect([...states]).toEqual(['fitted']);
  },
};
