import { StrictMode, useRef, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { Avatar, type AvatarSize } from '../avatar';
import { Badge } from '../badge';
import { GameSeat } from '../game-seat';
import { GameHand } from '../game-hand';
import { Button } from '../button';
import { CARD_BACK_PATTERNS, GameCard } from '../game-card';
import { DeckProvider } from '../deck';
import { CardFlightsProvider, measureCardBox, useCardFlights } from '../card-flights';
import { motionDurationMs } from '../../styling/motion-timings';
import { ThemeRoot } from '../theme-root';
import {
  GameTable as Table, useGameTableSeat, buildAlternatingSlots, buildBoardLayoutModel, buildTableOrderSlots,
  getTablePointSeatIndexes, resolveTableTurnDirection,
  type BoardPlayerCount, type BoardViewportProfile, type GameTableProps as TableProps, type BoardSeatGeometry, type SeatLike,
  type GameTableSlot, type GameTableRootProps,
  resolveBoardViewportProfile,
} from './index';
import { BREAKPOINT_CASES, REFERENCE_SLOT_KEYS } from './reference-fixtures';
import { fitBoardContent, GAME_TABLE_LIMITS } from './fit-layout';
import { validateSlots } from './table-slots';
import { expectInside, expectNoOverlap, expectMirroredDirection } from '../../testing/geometry-assertions';

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;
type GameTableProps<T extends SeatLike = SeatLike> = Omit<TableProps<T>, 'slots' | 'seatSlots'> & {
  slots?: readonly GameTableSlot<T>[];
  renderSeat: RegionFixture<T>;
  renderPlay?: RegionFixture<T>;
  header?: ReactNode; center?: ReactNode; dock?: ReactNode; footer?: ReactNode; floating?: ReactNode;
};
function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
}
function GameTable<T extends SeatLike>({ seats, slots, renderSeat, renderPlay, header, center, dock, footer, floating, ...props }: GameTableProps<T>) {
  const seatInput = slots ? { seatSlots: slots } : { seats: seats ?? [] };
  return <Table {...props} {...seatInput}>
    <Table.Seat><FixtureContent content={renderSeat} /></Table.Seat>
    <Table.Play><FixtureContent content={renderPlay} /></Table.Play>
    <Table.Center>{center}</Table.Center>
    {header != null && <Table.Header>{header}</Table.Header>}
    {footer != null && <Table.Footer>{footer}</Table.Footer>}
    {dock != null && <Table.Dock>{dock}</Table.Dock>}
    {floating != null && <Table.Floating>{floating}</Table.Floating>}
  </Table>;
}
GameTable.SeatChrome = Table.SeatChrome;

function ReplacementRoot(props: GameTableRootProps) {
  return <div {...props} data-replacement="slots" />;
}
function UnusedReplacementRoot(props: GameTableRootProps) {
  return <div {...props} data-replacement="component" />;
}
function AlternativeReplacementRoot(props: GameTableRootProps) {
  return <div {...props} data-replacement="alternative" />;
}
function ContextSeat() {
  const { player, index, geometry, slot } = useGameTableSeat<Player>();
  return <span data-context-player={player?.key} data-context-index={index}
    data-context-slot={slot.key} data-context-total={geometry.totalSeats}>{player?.name ?? 'Open seat'}</span>;
}
const partEvents = { root: fn(), slot: fn(), attaches: 0, cleanups: 0 };
function CompoundPartsFixture() {
  const [mounted, setMounted] = useState(true);
  const [alternative, setAlternative] = useState(false);
  return <>
    <Button onClick={() => setMounted(false)}>Unmount table</Button>
    <Button onClick={() => setAlternative(true)}>Replace root</Button>
    {mounted && <StrictMode><div style={{ inlineSize: 1000, blockSize: 800 }}>
      <Table players={2} seats={SEATS.slice(0, 2)} viewport={VIEWPORTS.desktop}
        component={UnusedReplacementRoot} slots={{ root: alternative ? AlternativeReplacementRoot : ReplacementRoot }} data-ui="consumer game-table"
        title="host" slotProps={{ root: { title: 'slot', 'data-ui': 'consumer slot' } }}>
        <Table.Dock data-region="dock"><Button>Check</Button></Table.Dock>
        <Table.Floating aria-label="Floating">0</Table.Floating>
        <><Table.Footer data-region="footer">Footer</Table.Footer>
          <Table.Center aria-label="Pot">Pot: 240</Table.Center></>
        <Table.Play><ContextSeat /></Table.Play>
        <Table.Header data-region="header">Poker</Table.Header>
        <Table.Seat component={ReplacementRoot} data-ui="seat-extra game-table-seat"
          title="host-seat" onClick={partEvents.root} className="host-seat" style={{ fontWeight: 400 }}
          sx={{ fontStyle: 'normal' }} slotProps={{ root: {
            title: 'slot-seat', onClick: partEvents.slot, className: 'slot-seat', style: { fontWeight: 700 },
            css: { fontStyle: 'italic' }, ref: (node) => {
              if (node) { partEvents.attaches += 1; return () => { partEvents.cleanups += 1; }; }
            },
          } }}>
          <ContextSeat />
          <GameCard size="sm" label="Hidden card" />
          <Table.SeatChrome aria-label="Seat chrome">Name</Table.SeatChrome>
        </Table.Seat>
      </Table>
    </div></StrictMode>}
  </>;
}

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
const PHONE_WIDE_FELT_ASPECT_RATIO = 2.15;
const measurementFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing fixture item');
  return value;
}

async function expectSeatFraming(table: HTMLElement, players: BoardPlayerCount, profile: BoardViewportProfile, expectedFit = 'fitted', checkInsufficientGeometry = false) {
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
    if (!checkInsufficientGeometry) return;
  }
  const surface = required(table.querySelector<HTMLElement>('[data-game-surface]') ?? undefined);
  const frame = surface.getBoundingClientRect();
  if (profile === 'phoneWide' && table.dataset.surface === 'match') {
    await expect(frame.width / frame.height, 'landscape felt keeps its profile aspect').toBeCloseTo(PHONE_WIDE_FELT_ASPECT_RATIO, 2);
  }
  const style = getComputedStyle(table);
  const rx = Number.parseFloat(style.getPropertyValue('--game-table-radius-x'));
  const ry = Number.parseFloat(style.getPropertyValue('--game-table-radius-y'));
  const isRtl = table.getAttribute('dir') === 'rtl' || style.direction === 'rtl';
  const direction = isRtl ? -1 : 1;
  await expect(rx).toBeGreaterThan(0);
  await expect(ry).toBeGreaterThan(0);
  if (table.dataset.seatPlacement === 'inside') {
    await expect(Math.max(rx, ry) / Math.min(rx, ry)).toBeLessThanOrEqual(1.5 + Number.EPSILON);
  } else {
    await expect(rx / ry).toBeCloseTo(frame.width / frame.height, 3);
    await expect(Math.abs(rx - frame.width / 2)).toBeLessThan(GEOMETRY_TOLERANCE_PX);
    await expect(Math.abs(ry - frame.height / 2)).toBeLessThan(GEOMETRY_TOLERANCE_PX);
    await expect(surface.style.inlineSize).toBe('');
    await expect(surface.style.blockSize).toBe('');
  }
  const seats = Array.from(table.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]'));
  await expect(seats).toHaveLength(players);
  const obstacles = Array.from(table.querySelectorAll<HTMLElement>('[data-ui="game-table-dock"], [data-ui="game-table-header"], [data-ui="game-table-center"], [data-ui="game-table-footer"]'));

  for (const [index, seat] of seats.entries()) {
    const box = seat.getBoundingClientRect();
    const dx = box.x + box.width / 2 - frame.x - frame.width / 2;
    const dy = box.y + box.height / 2 - frame.y - frame.height / 2;
    const theta = Math.PI / 2 + 2 * Math.PI * index / players;
    const label = `${profile}/${players} seat ${index}`;
    const length = Math.hypot(rx * Math.cos(theta), ry * Math.sin(theta));
    const ux = rx * Math.cos(theta) / length;
    const uy = ry * Math.sin(theta) / length;
    const offset = table.dataset.seatPlacement === 'outside' ? (Math.abs(ux) * box.width + Math.abs(uy) * box.height) / 2 : 0;
    await expect(Math.abs(dx - direction * (rx * Math.cos(theta) + ux * offset)), `${label} regular-angle X`).toBeLessThan(GEOMETRY_TOLERANCE_PX);
    await expect(Math.abs(dy - (ry * Math.sin(theta) + uy * offset)), `${label} regular-angle Y`).toBeLessThan(GEOMETRY_TOLERANCE_PX);
    await expect(Math.abs(Math.hypot((dx - direction * ux * offset) / rx, (dy - uy * offset) / ry) - 1), `${label} on placement curve`).toBeLessThan(0.01);

    // All seats remain upright for spectator: no rotation
    const matrix = new DOMMatrix(getComputedStyle(seat).transform);
    const rotationDeg = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
    await expect(Math.abs(rotationDeg), `${label} upright (no rotation)`).toBeLessThan(0.01);

    await expectInside(seat, table, { tolerancePx: GEOMETRY_TOLERANCE_PX });
    if (table.dataset.seatPlacement === 'inside') await expectInside(seat, surface, { tolerancePx: GEOMETRY_TOLERANCE_PX });
    for (const other of [...seats.slice(index + 1), ...obstacles]) {
      const otherBox = other.getBoundingClientRect();
      if (otherBox.width > 0 && otherBox.height > 0) await expectNoOverlap(seat, other, { tolerancePx: GEOMETRY_TOLERANCE_PX });
    }
  }
  const plays = Array.from(table.querySelectorAll<HTMLElement>('[data-ui="game-table-play"]')).filter((play) => play.getBoundingClientRect().width > 0 && play.getBoundingClientRect().height > 0);
  for (const [index, play] of plays.entries()) {
    const playBox = play.getBoundingClientRect();
    const seat = required(seats.find((seat) => seat.dataset.slotKey === play.dataset.playSlotKey));
    const seatBox = seat.getBoundingClientRect();
    const px = playBox.x + playBox.width / 2 - frame.x - frame.width / 2;
    const py = playBox.y + playBox.height / 2 - frame.y - frame.height / 2;
    const sx = seatBox.x + seatBox.width / 2 - frame.x - frame.width / 2;
    const sy = seatBox.y + seatBox.height / 2 - frame.y - frame.height / 2;
    await expect(Math.abs(px * sy - py * sx) / Math.max(1, Math.hypot(sx, sy)), 'play shares seat direction').toBeLessThan(GEOMETRY_TOLERANCE_PX);
    await expect(Math.hypot(px, py)).toBeLessThan(Math.hypot(sx, sy));
    const angle = Number.parseFloat(play.style.getPropertyValue('--game-table-play-angle')) * Math.PI / 180;
    await expect(Math.abs(Math.cos(angle) - px / Math.hypot(px, py))).toBeLessThan(0.01);
    await expect(Math.abs(Math.sin(angle) - py / Math.hypot(px, py))).toBeLessThan(0.01);
    await expectInside(play, surface, { tolerancePx: GEOMETRY_TOLERANCE_PX });
    for (const other of [...plays.slice(index + 1), ...seats, ...obstacles]) {
      const otherBox = other.getBoundingClientRect();
      if (otherBox.width && otherBox.height) await expectNoOverlap(play, other, { tolerancePx: GEOMETRY_TOLERANCE_PX });
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
  component: Table<Player>,
  tags: ['autodocs'],
  args: {
    players: 6, seats: SEATS, viewport: VIEWPORTS.phoneCompact,
    renderSeat, center, header: 'Poker · 10 / 20', dock: <Button>Check</Button>,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: { component: 'Arrange players around a game surface. Add cards, controls and floating content to named regions.' },
      usage: `### Setup
- Import from \`@jfrader/ui/game-table\`. GameTable is an opt-in subpath and is not re-exported by the package root.

### Regions
Compose direct \`GameTable.Seat\`, \`GameTable.Play\`, \`GameTable.Center\`, \`GameTable.Header\`, \`GameTable.Dock\`, \`GameTable.Footer\` and \`GameTable.Floating\` children in any order (fragments are accepted). Seat and Play repeat at every place unless you pass \`slotKey\`. Their children read \`{ player, slot, index, geometry }\` with \`useGameTableSeat<Player>()\`. Empty play content reserves nothing. Center holds shared cards, the pot or deck and is measured independently. Keep measured footprints in normal flow; absolute artwork must reserve its footprint in its parent. The node-region props and seat/play callbacks have been replaced by these parts.

Each public part accepts native div props, ref and sx. \`component\` is sugar for \`slots.root\`; \`slotProps.root\` passes root props, with slot conflicts winning except merged className/style. Geometry variables and measurement markers remain table-owned. Use \`seatSlots\` for prebuilt player order; \`slots\` now replaces structure.

### Geometry
Give the parent a block size and pass current viewport dimensions in CSS pixels. Update \`viewport\` on resize; it selects the surface frame. ResizeObserver measures the actual root, shell, surface and intrinsic regions, including when the parent is smaller than the viewport. Regions remain hidden until measurement; the server does not guess their dimensions.
\`seatPlacement\` defaults to \`edge\`: the content centre sits on the felt boundary. \`inside\` keeps content contained with its outer edge inset by the gap; \`outside\` moves the inner edge to the boundary, using the directional box support as an outward offset. This deliberately replaces the previous containment-only default. The felt keeps its profile frame's size and aspect; edge/outside placement follows its measured ellipse. The shell reserves the outboard footprint at each region's minimum scale. If the root cannot hold a placement at its floor, the table declares insufficient space rather than calling an inward fallback fitted.
The play anchor shares its seat's physical polar direction on an inward ring. Its distance leaves the measured seat/play boxes separated by the content gap on at least one axis, moving farther inward when the surface border requires it. Plays must stay inside the surface, clear of other regions and the measured centre; no invisible centre-size percentage is reserved.
\`players\` accepts any integer >= 2. \`seats\` fills empty places, distributes teams round-robin and puts your seat first. \`teamCount\` defaults to 2; use 1 for free-for-all with every seat's \`teamIdx: 0\`. \`seatSlots\` preserves a prebuilt visual order and any team numbers, and must contain exactly \`players\` places; order it with the exported builders when needed. Do not pass both.
The curve uses θᵢ = π/2 + 2πi/N and Pᵢ = C + (Rx cosθᵢ, Ry sinθᵢ). C is the surface border-box center. In edge/outside modes Rx and Ry are the measured surface half-extents; the ring follows the felt's aspect, including landscape frames. Only inside mode bounds the available-area axis stretch: near-square areas (axis ratio ≤1.15) give a circle, growing continuously up to 1.5. On an ellipse the physical polar-angle gaps differ from the equal parametric gaps; no per-seat angular correction is applied. Content stays upright, with zero seat rotation; RTL mirrors placement only. No table-owned decoration requires rotation.
\`seats\` requires team indices in [0, teamCount). Team j has as many places as indices i in [0, players) with i % teamCount === j; odd seat counts can give teams different capacities. Incompatible capacities and duplicate player/slot keys throw. Use \`seatSlots\` for arbitrary orders or teams. \`buildAlternatingSlots(seats, players, direction, teamCount)\` follows the same policy. \`getTablePointSeatIndexes(slots, teamCount)\` selects the occupied rival nearest the bottom seat's antipode (ties use visual order); with teamCount=1 there is no front team leader and its index is -1.
\`clearance\` requests additional block-axis space. Header, dock and footer remain unscaled, outside the surface. The request is a preference: if the content floors cannot fit, both clearance edges yield to \`GAME_TABLE_LIMITS.minimumClearancePx\` (0). The table retries the requested CSS padding on content/size changes, so the request is restored when space returns. This is a two-step policy (requested, then minimum), not a search for the largest feasible clearance.
Coordinates are measured from inline-start and mirror with \`dir="rtl"\`. \`data-game-surface="true"\` marks the surface for measuring future card flights.

### Content size
\`GAME_TABLE_LIMITS.minimumCardWidthPx\` is 32px, matching GameCard sm. Each seat, play and centre has its own minimum scale: max(32 / intrinsic card width), combined with its control-size floor. Chrome is excluded. Regions without cards or controls retain intrinsic size. Custom artwork without GameCard markers is not covered by the card floor.
The solver chooses the largest shared preferred scale t in [0,1]; each region uses max(t, its minimum scale). It pushes the seat ring outward within placement and measured shell constraints, separates neighbours and plays, and keeps the inward play ring clear of the measured centre. The space-2 gap stays unscaled. Content is never substituted or truncated.
Precedence: preserve card/control floors → try requested clearance → retry at clearance zero → declare insufficient space if floors still cannot fit. \`data-clearance="requested" | "reduced"\` and numeric \`data-clearance-start/end\` report effective local CSS pixels. \`data-layout-fit="measuring" | "fitted" | "insufficient-space"\` reports geometry. Insufficient space means the composition cannot satisfy all clearances at its floors, including the play-to-centre band; overflow or collisions may remain. Give the parent more space or reduce the composition.

### Seat chrome
Put names, avatars and non-layout adornments inside \`<GameTable.SeatChrome>…</GameTable.SeatChrome>\` within Seat. The part is absolutely positioned: it reserves no space and its descendants do not constrain card scale. It floats on the outward side; when a side label does not fit horizontally inside the root, only the chrome moves above/below the cards. No card-anchor compensation is applied. Removing the part from the DOM does not move the card block. Unmarked in-flow content still counts as content; the table does not guess which arbitrary text is a player name. Avoid wrappers that reserve padding/gaps for the chrome.
Chrome is independent of card fit: \`fitted\` does not guarantee arbitrary oversized labels or controls fit. Keep chrome concise and respect control/card minimum sizes within your custom content. The table does not rotate names, avatars, or faces; user-supplied transforms are the consumer's responsibility.
\`--game-table-content-scale\` on each seat and \`--game-table-center-scale\` on the root expose actual region scales; the root content-scale value is only the preferred t. \`--game-table-radius-x/y\` and \`--game-table-content-gap\` expose local geometry. Each play publishes \`--game-table-play-inline/block\` (logical percentages), \`--game-table-play-scale\`, \`--game-table-play-angle\` (outward physical degrees) and \`--game-table-play-cos/sin\`. \`geometry.scale\` and \`geometry.playScale\` are informational: never multiply child sizes by them again. Floors are local CSS-pixel sizes before external ancestor transforms; a consumer scaling the entire table must account for its own scale.
Native seat/play/center controls preserve at least 24px on both axes and 32px on their main axis, unless already smaller intrinsically. Regions without GameCards or controls retain their intrinsic size rather than disappearing at a zero floor. \`fitted\` covers normal-flow border boxes, not overflowing artwork, shadows or floating overlays. Keep absolute artwork's full footprint reserved in normal flow.

### Rival-card flight markers
After commit, GameTable marks each actual \`GameCard\` back in an occupied non-own seat with \`data-seat-hidden-card={player.key}\` and \`data-seat-hidden-card-index={index}\`. Index is current zero-based DOM order within that seat, not seat index. Markers update on card/face/player changes and are removed when a card is revealed or a seat becomes empty/own. No opponent value is exposed. Own-hand markers remain the hand's responsibility; custom card renderers must provide their own markers. The flight consumer example is \`packages/ui/src/components/card-flights/card-flights-fixture.tsx\`.

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
      source: { language: 'tsx', code: `import { Button } from '@jfrader/ui';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable, useGameTableSeat } from '@jfrader/ui/game-table';

function SeatCards() {
  const { player } = useGameTableSeat<Player>();
  return <GameCard label={player?.name ?? 'Open seat'} />;
}

<GameTable players={6} seats={players} viewport={viewport}>
  <GameTable.Seat><SeatCards /></GameTable.Seat>
  <GameTable.Center><GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} /></GameTable.Center>
  <GameTable.Dock><Button>Check</Button></GameTable.Dock>
</GameTable>` },
    },
  },
  render: (args: GameTableProps<Player>) => <div style={{ inlineSize: args.viewport.width, blockSize: args.viewport.height }}><GameTable {...args} /></div>,
} satisfies Omit<Meta<GameTableProps<Player>>, 'component'> & Pick<Meta<typeof Table<Player>>, 'component'>;
export default meta;
const fixtureMeta = { ...meta, component: GameTable<Player> } satisfies Meta<typeof GameTable<Player>>;
type Story = StoryObj<typeof fixtureMeta>;

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

/** Native region props, replacement roots and seat context. */
export const CompoundParts: Story = {
  render: () => <CompoundPartsFixture />,
  beforeEach: () => { partEvents.root.mockClear(); partEvents.slot.mockClear(); partEvents.attaches = 0; partEvents.cleanups = 0; },
  play: async ({ canvasElement, userEvent }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui~="game-table"]') ?? undefined);
    await waitFor(() => expect(table).toHaveAttribute('data-layout-fit', 'fitted'));
    await expect(table).toHaveAttribute('data-ui', 'game-table consumer slot');
    await expect(table).toHaveAttribute('data-replacement', 'slots');
    await expect(table).toHaveAttribute('title', 'slot');
    const seats = [...table.querySelectorAll<HTMLElement>('[data-ui~="game-table-seat"]')];
    const plays = [...table.querySelectorAll<HTMLElement>('[data-ui~="game-table-play"]')];
    await expect(seats).toHaveLength(2);
    await expect(plays).toHaveLength(2);
    for (const [index, seat] of seats.entries()) {
      await expect(seat).toHaveAttribute('data-ui', 'game-table-seat seat-extra');
      await expect(seat).toHaveAttribute('title', 'slot-seat');
      await expect(seat).toHaveClass('host-seat', 'slot-seat');
      await expect(getComputedStyle(seat).fontWeight).toBe('700');
      await expect(getComputedStyle(seat).fontStyle).toBe('normal');
      const context = required(seat.querySelector('[data-context-index]') ?? undefined);
      await expect(context).toHaveAttribute('data-context-index', String(index));
      await expect(context).toHaveAttribute('data-context-total', '2');
      await expect(context).toHaveAttribute('data-context-slot', seat.dataset.slotKey);
      await expect(context).toHaveAttribute('data-context-player', seat.dataset.slotPlayer);
      await expect(plays[index]?.querySelector('[data-context-index]')).toHaveAttribute('data-context-slot', seat.dataset.slotKey);
      await expect(Number.parseFloat(seat.style.getPropertyValue('--game-table-seat-inline'))).toBeGreaterThan(0);
    }
    await expect([...table.querySelectorAll('[data-region]')].map((node) => node.getAttribute('data-region'))).toEqual(['header', 'footer', 'dock']);
    await userEvent.click(required(seats[0]));
    await expect(partEvents.slot).toHaveBeenCalledTimes(1);
    await expect(partEvents.root).not.toHaveBeenCalled();
    await expect(partEvents.attaches).toBeGreaterThanOrEqual(2);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Replace root' }));
    const replacement = required(canvasElement.querySelector<HTMLElement>('[data-ui~="game-table"]') ?? undefined);
    await expect(replacement).not.toBe(table);
    await expect(replacement).toHaveAttribute('data-replacement', 'alternative');
    await waitFor(() => expect(replacement).toHaveAttribute('data-layout-fit', 'fitted'));
    await waitFor(() => expect(replacement.querySelectorAll('[data-seat-hidden-card="blair"]')).toHaveLength(1));
    await expect(replacement.querySelector('[data-seat-hidden-card="alex"]')).toHaveAttribute('data-seat-hidden-card-index', '0');
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Unmount table' }));
    await expect(partEvents.cleanups).toBe(partEvents.attaches);
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
  args: { renderPlay: (slot, index, geometry) => spanishPlay?.(slot, index, geometry), renderSeat: fn((slot, index, geometry) => spanishSeat(slot, index, geometry)), center: <span>Truco</span>, header: 'Truco', dock: <Button>Quiero</Button> },
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
    const ltrSeats = ltr.querySelectorAll('[data-ui="game-table-seat"], [data-ui="game-table-play"]');
    const rtlSeats = rtl.querySelectorAll('[data-ui="game-table-seat"], [data-ui="game-table-play"]');
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
    const wideEdge = fitBoardContent({ ...measured, width: 2000, centerX: 1000, seatPlacement: 'edge',
      surfaceBorderBox: { width: 2000, height: 500 }, available: { left: 1200, right: 1200, top: 350, bottom: 350 } });
    await expect(wideEdge.fits).toBe(true);
    await expect(wideEdge.radiusX).toBeCloseTo(1000, 8);
    await expect(wideEdge.radiusY).toBeCloseTo(250, 8);
    const mixed = fitBoardContent({ ...measured, width: 500, height: 240, centerX: 250, centerY: 120,
      seats: [{ width: 112, height: 165.75, minimumScale: 32 / 112 }, { width: 112, height: 165.75, minimumScale: 32 / 112 }],
      center: { width: 104, height: 77.36, minimumScale: 1 } });
    await expect(mixed.fits).toBe(true);
    await expect(mixed.centerScale).toBe(1);
    await expect(required(mixed.positions[0]).scale).toBeLessThan(1);
    await expect(required(mixed.positions[0]).scale * 112).toBeGreaterThanOrEqual(GAME_TABLE_LIMITS.minimumCardWidthPx);
    const emptyPlays = fitBoardContent({ ...measured, plays: measured.seats.map(() => ({ width: 0, height: 0, minimumScale: 1 })) });
    await expect(emptyPlays.radiusX).toBe(circle.radiusX);
    await expect(emptyPlays.scale).toBe(circle.scale);
    const blockedPlays = fitBoardContent({ ...measured, plays: measured.seats.map(() => ({ width: 200, height: 200, minimumScale: 1 })) });
    await expect(blockedPlays.fits).toBe(false);
    await expect(blockedPlays.positions.map((position) => position.playScale)).toEqual(Array(6).fill(1));
    const centerBand = { width: 300, height: 300, centerX: 150, centerY: 150,
      seatPlacement: 'edge' as const, available: { left: 300, right: 300, top: 300, bottom: 300 },
      seats: Array.from({ length: 2 }, () => ({ width: 32, height: 47, minimumScale: 1 })),
      center: { width: 200, height: 180, minimumScale: 1 }, gap: 8, minimumScale: 1 };
    await expect(fitBoardContent(centerBand).fits).toBe(true);
    await expect(fitBoardContent({ ...centerBand, plays: centerBand.seats }).fits).toBe(false);
  },
};

function ChangingPlays() {
  const [empty, setEmpty] = useState(false);
  return <>
    <Button onClick={() => setEmpty(true)}>Retirar jugadas</Button>
    <div style={{ inlineSize: VIEWPORTS.phoneCompact.width, blockSize: VIEWPORTS.phoneCompact.height }}>
      <GameTable players={6} seats={SEATS} viewport={VIEWPORTS.phoneCompact} renderSeat={spanishSeat}
        center={<span>Truco</span>} header="Truco" dock={<Button>Quiero</Button>}
        renderPlay={() => empty ? null : <GameCard size="lg" value={{ deck: 'spanish', suit: 'bastos', rank: 12 }} label="rey de bastos" />} />
    </div>
  </>;
}

/** Large played cards scale to their own floor; empty regions release their footprint. */
export const PlayRegionResizeAndFloors: Story = {
  render: () => <ChangingPlays />,
  play: async ({ canvasElement, userEvent }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(table, 6, 'phoneCompact');
    const play = required(table.querySelector<HTMLElement>('[data-ui="game-table-play"]') ?? undefined);
    const scale = Number.parseFloat(play.style.getPropertyValue('--game-table-play-scale'));
    await expect(scale).toBeLessThan(1);
    await expect(scale * 112).toBeGreaterThanOrEqual(GAME_TABLE_LIMITS.minimumCardWidthPx - 0.01);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Retirar jugadas' }));
    await waitFor(() => expect(table.querySelectorAll('[data-ui="game-table-play"] [data-ui~="game-card"]')).toHaveLength(0));
    await expectSeatFraming(table, 6, 'phoneCompact');
    await expect(play.getBoundingClientRect().width).toBe(0);
    await expect(play.getBoundingClientRect().height).toBe(0);
    await expect(Number.parseFloat(getComputedStyle(table).getPropertyValue('--game-table-content-scale'))).toBe(1);
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
      const expectedFit = profile === 'phoneWide' && players === 6 ? 'insufficient-space' : 'fitted';
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
    await expect(Number(table.dataset.clearanceStart)).toBeCloseTo(96, 2);
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
        <GameCard size="lg" label={`${slot.player?.name}: card 5`} />
        <GameCard size="lg" label={`${slot.player?.name}: card 6`} />
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

const spanishSeat = fn<GameTableProps<Player>['renderSeat']>((slot) => (
  <div style={{ display: 'flex', gap: vars.space[1] }}>
    <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={`${slot.player?.name ?? 'Lugar libre'}: carta oculta`} />
    <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={`${slot.player?.name ?? 'Lugar libre'}: segunda carta oculta`} />
  </div>
));
const spanishPlay: GameTableProps<Player>['renderPlay'] = (_slot, index) => (
  index % 2 === 0
    ? <GameCard size="sm" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} label="as de oros" />
    : <GameCard size="sm" value={{ deck: 'spanish', suit: 'copas', rank: 10 }} label="sota de copas" />
);

function TrucoPlayerSeat() {
  const { player, index } = useGameTableSeat<Player>();
  const name = player?.name ?? 'Lugar libre';
  const now = Date.parse('2026-10-14T12:00:00Z');
  return <GameSeat name={name} avatar={<Avatar name={name} size="sm" aria-hidden="true" />}
    badges={<Badge>{player?.isMe ? 'Vos' : index === 1 ? 'Anfitrión' : 'Jugador'}</Badge>}
    points={index === 0 ? '12' : undefined}
    hand={<GameHand.Hidden count={3} size="sm" label="Tres cartas ocultas" playerKey={player?.key} />}
    turn={index === 1 ? { deadline: now + 60000, durationMs: 60000, now: now + 15000 } : undefined}
    chat={index === 1 ? <span aria-live="polite">Tu turno</span> : undefined} />;
}

/** Cada plaza muestra al jugador, sus insignias, la mano oculta y el turno. */
export const TrucoPlayerChrome: Story = {
  args: { viewport: VIEWPORTS.desktop, players: 4, seats: seatsFor(4) },
  render: (args) => <DeckProvider default="spanish">
    <div style={{ inlineSize: args.viewport.width, blockSize: args.viewport.height }}>
      <Table players={args.players} seats={args.seats ?? []} viewport={args.viewport}>
        <Table.Seat><TrucoPlayerSeat /></Table.Seat>
        <Table.Play><FixtureContent content={spanishPlay} /></Table.Play>
        <Table.Center>Truco</Table.Center>
        <Table.Header>Nosotros 12 · Ellos 8</Table.Header>
        <Table.Dock><Button>Quiero</Button></Table.Dock>
      </Table>
    </div>
  </DeckProvider>,
  parameters: { docs: { source: { language: 'tsx', code: `<GameSeat name="Alex" avatar={<Avatar name="Alex" aria-hidden="true" />}
  handCount={3} badges={<Badge>Anfitrión</Badge>} turn={{ deadline, durationMs, now }} />

function PlayerSeat() {
  const { player } = useGameTableSeat();
  return <GameSeat name={player.name} avatar={<Avatar name={player.name} aria-hidden="true" />}
    badges={<Badge>{player.badgeLabel}</Badge>}
    hand={<GameHand.Hidden count={3} size="sm" label="Tres cartas ocultas" playerKey={player.key} />}
    turn={player.turn} />;
}

<DeckProvider default="spanish">
  <GameTable players={4} seats={players} viewport={viewport}>
    <GameTable.Seat><PlayerSeat /></GameTable.Seat>
    <GameTable.Center>Truco</GameTable.Center>
    <GameTable.Dock><Button>Quiero</Button></GameTable.Dock>
  </GameTable>
</DeckProvider>` } } },
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(table, 4, 'desktop');
    await expect(table.querySelectorAll('[data-ui="game-seat"]')).toHaveLength(4);
    await expect(table.querySelectorAll('[data-ui="game-hand-hidden-card"]')).toHaveLength(12);
    await expect(table.querySelectorAll('[data-ui="game-seat-timer"]')).toHaveLength(1);
  },
};

/** Cartas ocultas al borde y jugadas hacia el centro, en los seis tamaños. */
export const TrucoPlayRing: Story = {
  args: { seatPlacement: 'edge', renderSeat: spanishSeat, renderPlay: spanishPlay, center: <span>Truco</span>, header: 'Truco', dock: <Button>Quiero</Button> },
  render: (args) => <div style={{ inlineSize: 'max-content' }}>
    {Object.entries(VIEWPORTS).map(([profile, viewport]) => COUNTS.map((players) => (
      <div key={`${profile}-${players}`} style={{ display: 'flex' }}>
        <div data-measurement="before" style={{ inlineSize: viewport.width, blockSize: viewport.height }}>
          <GameTable {...args} seatPlacement="inside" renderPlay={undefined} viewport={viewport} players={players} slots={undefined} seats={seatsFor(players)} />
        </div>
        <div data-measurement="after" style={{ inlineSize: viewport.width, blockSize: viewport.height }}>
          <GameTable {...args} viewport={viewport} players={players} slots={undefined} seats={seatsFor(players)} />
        </div>
      </div>
    )))}
  </div>,
  play: async ({ canvasElement }) => {
    const tables = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-measurement="after"] [data-ui="game-table"]'));
    const previousTables = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-measurement="before"] [data-ui="game-table"]'));
    await expect(tables).toHaveLength(18);
    const measurements = [];
    let index = 0;
    for (const [profile, viewport] of Object.entries(VIEWPORTS)) for (const players of COUNTS) {
      const table = required(tables[index++]);
      const previous = required(previousTables[index - 1]);
      await expectSeatFraming(previous, players, profile as BoardViewportProfile);
      await waitFor(() => expect(table.dataset.layoutFit).not.toBe('measuring'));
      const surface = required(table.querySelector<HTMLElement>('[data-game-surface]') ?? undefined).getBoundingClientRect();
      const seats = Array.from(table.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]'));
      const plays = Array.from(table.querySelectorAll<HTMLElement>('[data-ui="game-table-play"]'));
      await expect(plays).toHaveLength(players);
      const own = required(seats[0]).getBoundingClientRect();
      const play = required(plays[0]).getBoundingClientRect();
      const seatRadius = own.y + own.height / 2 - surface.y - surface.height / 2;
      const playRadius = play.y + play.height / 2 - surface.y - surface.height / 2;
      const innerRadius = (regions: HTMLElement[], frame: DOMRect) => Math.min(...regions.map((region) => {
        const box = region.getBoundingClientRect();
        const dx = box.x + box.width / 2 - frame.x - frame.width / 2;
        const dy = box.y + box.height / 2 - frame.y - frame.height / 2;
        const distance = Math.hypot(dx, dy);
        return distance - (Math.abs(dx / distance) * box.width + Math.abs(dy / distance) * box.height) / 2;
      }));
      const previousSurface = required(previous.querySelector<HTMLElement>('[data-game-surface]') ?? undefined).getBoundingClientRect();
      const previousSeats = Array.from(previous.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]'));
      const previousOwn = required(previousSeats[0]).getBoundingClientRect();
      const radialMetrics = (regions: HTMLElement[]) => regions.map((region) => {
        const box = region.getBoundingClientRect();
        const dx = box.x + box.width / 2 - surface.x - surface.width / 2;
        const dy = box.y + box.height / 2 - surface.y - surface.height / 2;
        const radius = Math.hypot(dx, dy);
        const ux = dx / radius;
        const uy = dy / radius;
        const extent = (Math.abs(ux) * box.width + Math.abs(uy) * box.height) / 2;
        const edge = 1 / Math.hypot(ux / (surface.width / 2), uy / (surface.height / 2));
        return { radius: Number(radius.toFixed(2)), overhang: Number((radius + extent - edge).toFixed(2)) };
      });
      measurements.push({ profile, players, fit: table.dataset.layoutFit,
        beforeSurface: [Number(previousSurface.width.toFixed(2)), Number(previousSurface.height.toFixed(2))],
        afterSurface: [Number(surface.width.toFixed(2)), Number(surface.height.toFixed(2))],
        seatOverhangs: radialMetrics(seats).map((metric) => metric.overhang),
        playRadii: radialMetrics(plays).map((metric) => metric.radius),
        beforeInset: Number((previousSurface.bottom - previousOwn.bottom).toFixed(2)),
        beforeFreeInnerRadius: Number(innerRadius(previousSeats, previousSurface).toFixed(2)),
        seatOutset: Number((own.bottom - surface.bottom).toFixed(2)),
        playRadius: Number(playRadius.toFixed(2)), freeInnerRadius: Number(innerRadius(plays, surface).toFixed(2)),
        seatInnerRadius: Number((seatRadius - own.height / 2).toFixed(2)), viewport });
      await expectSeatFraming(table, players, profile as BoardViewportProfile);
      if (table.dataset.layoutFit === 'fitted') {
        await expect(own.bottom - surface.bottom, `${profile}/${players} crosses felt border`).toBeGreaterThan(0.5);
        await expect(playRadius).toBeGreaterThan(0);
        await expect(playRadius).toBeLessThan(seatRadius);
      }
    }
    console.info('GAME_TABLE_PLAY_MEASUREMENTS', JSON.stringify(measurements));
  },
};

/** Compare legacy containment, edge-centred cards and cards outside the felt. */
export const SeatPlacementModes: Story = {
  args: { players: 2, seats: seatsFor(2), renderSeat: spanishSeat, renderPlay: spanishPlay, center: <span>Truco</span>, header: 'Truco', dock: <Button>Quiero</Button> },
  render: (args) => <div style={{ display: 'flex', inlineSize: 'max-content' }}>
    {COUNTS.map((players) => (['inside', 'edge', 'outside'] as const).map((seatPlacement) => (
      <div key={`${players}-${seatPlacement}`} data-placement-count={players} style={{ inlineSize: args.viewport.width, blockSize: args.viewport.height }}>
        <GameTable {...args} players={players} slots={undefined} seats={seatsFor(players)} seatPlacement={seatPlacement} />
      </div>
    )))}
  </div>,
  play: async ({ canvasElement }) => {
    for (const table of canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]')) {
      const players = Number(table.parentElement?.dataset.placementCount) as BoardPlayerCount;
      await expectSeatFraming(table, players, 'phoneCompact');
      const surface = required(table.querySelector<HTMLElement>('[data-game-surface]') ?? undefined).getBoundingClientRect();
      const seat = required(table.querySelector<HTMLElement>('[data-ui="game-table-seat"]') ?? undefined).getBoundingClientRect();
      if (table.dataset.seatPlacement === 'inside') await expect(seat.bottom).toBeLessThan(surface.bottom - 1);
      if (table.dataset.seatPlacement === 'edge') {
        await expect(seat.top).toBeLessThan(surface.bottom);
        await expect(seat.bottom).toBeGreaterThan(surface.bottom);
        await expect(Math.abs(seat.top + seat.height / 2 - surface.bottom)).toBeLessThan(0.5);
      }
      if (table.dataset.seatPlacement === 'outside') await expect(seat.top).toBeGreaterThanOrEqual(surface.bottom - GEOMETRY_TOLERANCE_PX);
      for (const content of table.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]')) {
        const box = content.getBoundingClientRect();
        const dx = box.x + box.width / 2 - surface.x - surface.width / 2;
        const dy = box.y + box.height / 2 - surface.y - surface.height / 2;
        const distance = Math.hypot(dx, dy);
        const ux = dx / distance;
        const uy = dy / distance;
        const edge = 1 / Math.hypot(ux / (surface.width / 2), uy / (surface.height / 2));
        const extent = (Math.abs(ux) * box.width + Math.abs(uy) * box.height) / 2;
        if (table.dataset.seatPlacement === 'edge') await expect(Math.abs(distance - edge)).toBeLessThan(GEOMETRY_TOLERANCE_PX);
        if (table.dataset.seatPlacement === 'outside') await expect(distance - extent).toBeGreaterThanOrEqual(edge - GEOMETRY_TOLERANCE_PX);
      }
    }
  },
};

const GENERAL_COUNTS = [2, 3, 4, 5, 6, 7, 9] as const;
const GENERAL_PROFILES = ['phoneCompact', 'desktop'] as const;
const generalSeats = (count: number, teamCount: number): Player[] => Array.from({ length: count }, (_, index) => ({
  key: `player-${index}`, name: `P${index + 1}`, teamIdx: index % teamCount, isMe: index === count - 1,
}));

export const RoundRobinTeams: Story = {
  args: { players: 9, teamCount: 3, seats: generalSeats(9, 3), viewport: VIEWPORTS.desktop },
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(table, 9, 'desktop');
    await expect(Array.from(table.querySelectorAll<HTMLElement>('[data-slot-team]'), (seat) => seat.dataset.slotTeam))
      .toEqual(['2', '1', '0', '2', '1', '0', '2', '1', '0']);
    for (const count of GENERAL_COUNTS) for (const teamCount of [1, 2, 3, 4, count + 1]) {
      const players = generalSeats(count, teamCount);
      for (const direction of ['clockwise', 'counterclockwise'] as const) {
        const slots = buildAlternatingSlots(players, count, direction, teamCount);
        await expect(slots).toHaveLength(count);
        await expect(slots[0]?.player?.key).toBe(`player-${count - 1}`);
        await expect(slots.flatMap((slot) => slot.player ? [slot.player.key] : []).sort()).toEqual(players.map((player) => player.key).sort());
        for (let team = 0; team < teamCount; team++) {
          const capacity = Array.from({ length: count }, (_, index) => index).filter((index) => index % teamCount === team).length;
          await expect(slots.filter((slot) => slot.teamIdx === team)).toHaveLength(capacity);
        }
        await expect(buildBoardLayoutModel({ surface: 'match', totalSeats: count,
          viewport: { ...VIEWPORTS.desktop, aspectRatio: VIEWPORTS.desktop.width / VIEWPORTS.desktop.height } }).playerCount).toBe(count);
      }
    }
    const teams = generalSeats(5, 3);
    await expect(buildAlternatingSlots(teams, 5, 'clockwise', 3).map((slot) => slot.teamIdx)).toEqual([1, 0, 1, 2, 0]);
    await expect(() => buildAlternatingSlots([{ key: 'a', teamIdx: 2 }, { key: 'b', teamIdx: 2 }], 5, 'clockwise', 3)).toThrow('team 2 capacity is 1');
    await expect(() => buildAlternatingSlots([{ key: 'a', teamIdx: 2 }, { key: 'b', teamIdx: 2 }, { key: 'c', teamIdx: 2 }], 5, 'clockwise', 3)).toThrow('team 2 capacity is 1; received 3 players');
    await expect(() => buildAlternatingSlots([{ key: 'a', teamIdx: 3 }], 3, 'clockwise', 4)).toThrow('team 3 capacity is 0');
    for (const teamCount of [0, -1, 1.5, NaN, Infinity]) {
      await expect(() => buildAlternatingSlots([], 5, 'clockwise', teamCount)).toThrow('integer teamCount >= 1');
    }
    for (const teamIdx of [-1, 3, 0.5, NaN, Infinity]) {
      await expect(() => buildAlternatingSlots([{ key: 'invalid', teamIdx }], 5, 'clockwise', 3)).toThrow('outside the round-robin range');
    }
    for (const count of [0, 1, -2, 2.5, NaN, Infinity]) {
      await expect(() => buildAlternatingSlots([], count, 'clockwise')).toThrow('integer seat count >= 2');
      await expect(() => buildBoardLayoutModel({ surface: 'match', totalSeats: count,
        viewport: { ...VIEWPORTS.desktop, aspectRatio: 1.6 } })).toThrow('integer seat count >= 2');
    }
    const freeForAll = buildAlternatingSlots(generalSeats(5, 1), 5, 'clockwise', 1);
    await expect(getTablePointSeatIndexes(freeForAll, 1)).toEqual({ bottomLeaderSeatIndex: 0, frontLeaderSeatIndex: -1 });
    const threeTeams = buildAlternatingSlots(generalSeats(9, 3), 9, 'clockwise', 3);
    await expect(getTablePointSeatIndexes(threeTeams, 3)).toEqual({ bottomLeaderSeatIndex: 0, frontLeaderSeatIndex: 4 });
  },
};

/** An arbitrary visual order and team numbers do not go through round-robin validation. */
export const ArbitraryPrebuiltTeams: Story = {
  args: { players: 3, seats: undefined, slots: [
    { key: 'third', teamIdx: 42, player: { key: 'c', name: 'Casey', teamIdx: 42 } },
    { key: 'first', teamIdx: 7, player: { key: 'a', name: 'Alex', teamIdx: 7 } },
    { key: 'empty', teamIdx: 99, player: null },
  ] },
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(table, 3, 'phoneCompact');
    await expect(Array.from(table.querySelectorAll<HTMLElement>('[data-slot-team]'), (seat) => [seat.dataset.slotKey, seat.dataset.slotTeam]))
      .toEqual([['third', '42'], ['first', '7'], ['empty', '99']]);
  },
};

const generalCountMatrix = (seatPlacement: NonNullable<GameTableProps['seatPlacement']>, dir = 'ltr'): Story => ({
  args: { seatPlacement, dir, center: <span>Pot: 240</span>, renderPlay: spanishPlay },
  render: (args) => <div style={{ inlineSize: 'max-content' }}>
    {GENERAL_PROFILES.map((profile) => GENERAL_COUNTS.map((players) => (
      <div key={`${profile}-${players}`} data-general-count={players} style={{ inlineSize: VIEWPORTS[profile].width, blockSize: VIEWPORTS[profile].height }}>
        <GameTable {...args} viewport={VIEWPORTS[profile]} players={players} teamCount={3} slots={undefined} seats={generalSeats(players, 3)} />
      </div>
    )))}
  </div>,
  play: async ({ canvasElement }) => {
    const tables = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]'));
    await expect(tables).toHaveLength(GENERAL_PROFILES.length * GENERAL_COUNTS.length);
    const measurements = [];
    let index = 0;
    for (const profile of GENERAL_PROFILES) for (const players of GENERAL_COUNTS) {
      const table = required(tables[index++]);
      const expectedFit = seatPlacement === 'inside' && profile === 'phoneCompact' && players === 9 ? 'insufficient-space' : 'fitted';
      await expectSeatFraming(table, players, profile, expectedFit, true);
      const surface = required(table.querySelector<HTMLElement>('[data-game-surface]') ?? undefined).getBoundingClientRect();
      const plays = Array.from(table.querySelectorAll<HTMLElement>('[data-ui="game-table-play"]'));
      await expect(plays).toHaveLength(players);
      const innerRadii = plays.map((play) => {
        const box = play.getBoundingClientRect();
        const dx = box.x + box.width / 2 - surface.x - surface.width / 2;
        const dy = box.y + box.height / 2 - surface.y - surface.height / 2;
        const radius = Math.hypot(dx, dy);
        return radius - (Math.abs(dx / radius) * box.width + Math.abs(dy / radius) * box.height) / 2;
      });
      const freeInnerRadius = Math.min(...innerRadii);
      await expect(freeInnerRadius, `${profile}/${players} free inner radius`).toBeGreaterThan(0);
      const regions = Array.from(table.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"], [data-ui="game-table-play"], [data-ui="game-table-center"]'));
      const separations = regions.flatMap((region, index) => regions.slice(index + 1).map((other) => {
        const a = region.getBoundingClientRect();
        const b = other.getBoundingClientRect();
        return Math.max(Math.max(a.left - b.right, b.left - a.right), Math.max(a.top - b.bottom, b.top - a.bottom));
      }));
      const minimumSeparation = Math.min(...separations);
      const gap = Number.parseFloat(getComputedStyle(table).getPropertyValue('--game-table-content-gap'));
      if (expectedFit === 'fitted') await expect(minimumSeparation).toBeGreaterThanOrEqual(gap - GEOMETRY_TOLERANCE_PX);
      else await expect(minimumSeparation, 'insufficient space has a measurable gap violation at the preserved floor').toBeLessThan(gap - GEOMETRY_TOLERANCE_PX);
      measurements.push({ profile, players, seatPlacement, fit: table.dataset.layoutFit,
        surface: [surface.width, surface.height], freeInnerRadius, minimumSeparation,
        scale: Number.parseFloat(getComputedStyle(table).getPropertyValue('--game-table-content-scale')) });
    }
    console.info('GAME_TABLE_GENERAL_MEASUREMENTS', JSON.stringify(measurements));
  },
});

/** Three round-robin teams, 2–9 places, and one played card per seat. */
export const GeneralSeatCounts = generalCountMatrix('edge');
export const GeneralSeatCountsInside = generalCountMatrix('inside');
export const GeneralSeatCountsOutside = generalCountMatrix('outside');
export const GeneralSeatCountsRtl = generalCountMatrix('edge', 'rtl');

const POKER_BOARD = [
  { id: 'as', label: 'Ace of spades', value: { suit: 'spades', rank: 'A' } },
  { id: 'kh', label: 'King of hearts', value: { suit: 'hearts', rank: 'K' } },
  { id: 'qc', label: 'Queen of clubs', value: { suit: 'clubs', rank: 'Q' } },
  { id: 'jd', label: 'Jack of diamonds', value: { suit: 'diamonds', rank: 'J' } },
  { id: 'ts', label: 'Ten of spades', value: { suit: 'spades', rank: 10 } },
] as const;

function PokerTable({ viewport }: { viewport: GameTableProps['viewport'] }) {
  const { scopeRef, launch, landingTargets } = useCardFlights();
  return <Table players={6} teamCount={1} seats={generalSeats(6, 1)} viewport={viewport}>
    <Table.Header>Texas Hold'em · 10 / 20</Table.Header>
    <Table.Seat><PokerSeat /></Table.Seat>
    <Table.Center><div style={{ display: 'grid', justifyItems: 'center', gap: vars.space[2] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: vars.space[2] }}>
        <span>Pot: 240</span><div data-community-deck><GameCard size="sm" label="Deck" /></div>
      </div>
      <div style={{ display: 'flex', gap: vars.space[1] }}>
        {POKER_BOARD.map((card) => <div key={card.id} data-community-card={card.id}><GameCard size="sm" value={card.value} label={card.label} /></div>)}
      </div>
    </div></Table.Center>
    <Table.Dock><Button disabled={landingTargets.size > 0} onClick={() => {
      const root = scopeRef.current;
      const deck = root?.querySelector<HTMLElement>('[data-community-deck]');
      if (!root || !deck) return;
      const from = measureCardBox(deck);
      launch(POKER_BOARD.map((card, index) => {
        const destination = required(root.querySelector<HTMLElement>(`[data-community-card="${card.id}"]`) ?? undefined);
        return { card, target: `community:${card.id}`, destination, from, to: measureCardBox(destination), face: 'reveal',
          durationMs: motionDurationMs.cardDeal, delayMs: index * motionDurationMs.cardDealStagger };
      }));
    }}>Deal board</Button></Table.Dock>
  </Table>;
}

function PokerSeat() {
  const { player } = useGameTableSeat<Player>();
  return <div data-poker-seat style={{ display: 'grid', justifyItems: 'center' }}><span>{player?.name}</span><span>1,200 chips</span></div>;
}

function PokerViewport({ viewport }: { viewport: GameTableProps['viewport'] }) {
  const scopeRef = useRef<HTMLDivElement>(null);
  return <div ref={scopeRef} style={{ inlineSize: viewport.width, blockSize: viewport.height }}>
    <CardFlightsProvider scopeRef={scopeRef}>
      <PokerTable viewport={viewport} />
    </CardFlightsProvider>
  </div>;
}

function PokerFixture() {
  return <DeckProvider default="french"><div style={{ inlineSize: 'max-content' }}>
    {(['phoneCompact', 'phoneTall', 'phoneWide', 'desktop'] as const).map((profile) => <PokerViewport key={profile} viewport={VIEWPORTS[profile]} />)}
  </div></DeckProvider>;
}

/** Six free-for-all seats, five community cards and a pot. Press Deal board to replay the deal. */
export const PokerCommunityBoard: Story = {
  render: () => <PokerFixture />,
  parameters: { a11y: { test: 'error' }, docs: { source: { language: 'tsx', code: `import { DeckProvider } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable, useGameTableSeat } from '@jfrader/ui/game-table';

function PokerSeat() {
  const { player } = useGameTableSeat<Player>();
  return <div>{player?.name} · 1,200 chips</div>;
}

<DeckProvider default="french">
  <GameTable players={6} teamCount={1} seats={players} viewport={viewport}>
    <GameTable.Seat><PokerSeat /></GameTable.Seat>
    <GameTable.Center><span>Pot: 240</span>{board.map((card) => <GameCard key={card.id} size="sm" value={card.value} label={card.label} />)}</GameTable.Center>
  </GameTable>
</DeckProvider>` } } },
  play: async ({ canvasElement, userEvent }) => {
    const tables = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]'));
    await expect(tables).toHaveLength(4);
    for (const table of tables) {
      const profile = table.dataset.profile as BoardViewportProfile;
      await expectSeatFraming(table, 6, profile);
      await expect(table.querySelectorAll('[data-ui="game-table-seat"] [data-ui~="game-card"]')).toHaveLength(0);
      await expect(table.querySelectorAll('[data-slot-team="0"]')).toHaveLength(6);
      const community = required(table.querySelector<HTMLElement>('[data-ui="game-table-center"]') ?? undefined);
      await expect(community.querySelectorAll('[data-community-card]')).toHaveLength(5);
      await expectInside(community, required(table.querySelector('[data-game-surface]') ?? undefined));
      for (const card of community.querySelectorAll('[data-community-card] [data-ui~="game-card"]')) {
        await expect(card).toHaveAttribute('data-deck', 'french');
      }
      const chrome = Array.from(table.querySelectorAll<HTMLElement>('[data-poker-seat]'));
      await expect(chrome).toHaveLength(6);
      for (const [index, seat] of chrome.entries()) {
        await expectInside(seat, table);
        for (const other of [...chrome.slice(index + 1), community,
          required(table.querySelector('[data-ui="game-table-header"]') ?? undefined),
          required(table.querySelector('[data-ui="game-table-dock"]') ?? undefined)]) await expectNoOverlap(seat, other);
      }
    }
    const first = required(tables[0]);
    const deal = within(first).getByRole('button', { name: 'Deal board' });
    await userEvent.click(deal);
    await expect(deal).toBeDisabled();
    await expect(canvasElement.ownerDocument.querySelectorAll('[data-ui="card-flight"][data-flight-target^="community:"]')).toHaveLength(5);
    await waitFor(() => expect(canvasElement.ownerDocument.querySelectorAll('[data-ui="card-flight"]')).toHaveLength(0));
    await expect(deal).toBeEnabled();
    for (const card of first.querySelectorAll<HTMLElement>('[data-community-card]')) {
      await expect(card).toBeVisible();
      await expect(card.style.visibility).toBe('');
    }
  },
};
