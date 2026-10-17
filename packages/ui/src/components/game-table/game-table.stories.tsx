import { StrictMode, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
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
  type GameTableProps as TableProps, type BoardSeatGeometry, type SeatLike,
  type GameTableSlot, type GameTableRootProps,
} from './index';
import { REFERENCE_SLOT_KEYS } from './reference-fixtures';
import { fitBoardContent, GAME_TABLE_LIMITS, type BoardMeasurements } from './fit-layout';
import { validateSlots } from './table-slots';
import { expectInside, expectNoOverlap, expectMirroredDirection } from '../../testing/geometry-assertions';

type CaseName = 'portraitShort' | 'portrait' | 'wide' | 'square' | 'squareWide' | 'wideLarge';
type ViewportSize = { width: number; height: number };

const viewportSize = ({ viewport }: { viewport: ViewportSize }) => ({ inlineSize: viewport.width, blockSize: viewport.height });
const ViewportFrame = styled.div(viewportSize);
function ThemeViewport({ viewport, theme, children }: {
  viewport: ViewportSize; theme: 'dark' | 'light'; children: ReactNode;
}) {
  return <ThemeRoot theme={theme}><ViewportFrame viewport={viewport}>{children}</ViewportFrame></ThemeRoot>;
}
const FlightsViewport = styled(({ viewport: _viewport, ...props }: { viewport: ViewportSize } & ComponentProps<typeof CardFlightsProvider>) => <CardFlightsProvider {...props} />)(viewportSize);
const ReplacementFrame = styled.div({ inlineSize: 1000, blockSize: 800 });
const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });
const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });
const SpacedCards = styled.div({ display: 'flex', gap: vars.space[2] });
const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });
const PotRow = styled.div({ display: 'flex', alignItems: 'center', gap: vars.space[2] });
const Matrix = styled.div({ inlineSize: 'max-content' });
const MatrixGrid = styled(Matrix)({ display: 'grid', gap: vars.space[6] });
const MatrixRow = styled(Matrix)({ display: 'flex' });
const Row = styled.div({ display: 'flex' });
const CaseColumn = styled.div({ display: 'flex', flexDirection: 'column', gap: vars.space[6] });
const ParityGrid = styled.div({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: vars.space[4], blockSize: 900, inlineSize: 2880 });
const FullHeight = styled.div({ blockSize: '100%' });
const PokerSeatContent = styled.div({ display: 'grid', justifyItems: 'center' });
const ResizableFrame = styled.div<{ narrow: boolean; roomy: boolean }>(({ narrow, roomy }) => ({
  inlineSize: narrow ? 380 : 500, blockSize: roomy ? 800 : narrow ? 360 : 440,
}));
const TransformedFrame = styled.section<{ viewport: ViewportSize; scaled: boolean }>(
  viewportSize,
  ({ scaled }) => ({ transform: scaled ? 'scale(0.75)' : undefined, transformOrigin: 'top left' }),
);

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;
type GameTableProps<T extends SeatLike = SeatLike> = Omit<TableProps<T>, 'slots' | 'seatSlots'> & {
  slots?: readonly GameTableSlot<T>[];
  renderSeat: RegionFixture<T>;
  renderPlay?: RegionFixture<T>;
  header?: ReactNode; center?: ReactNode; dock?: ReactNode; footer?: ReactNode; floating?: ReactNode;
  viewport: ViewportSize;
};
function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
}
function tableRootProps<T extends SeatLike>({ seats, slots, viewport: _viewport, renderSeat: _seat, renderPlay: _play, header: _header, center: _center, dock: _dock, footer: _footer, floating: _floating, ...props }: Omit<GameTableProps<T>, 'renderSeat'> & { renderSeat?: RegionFixture<T> }) {
  return { ...props, ...(slots ? { seatSlots: slots } : { seats: seats ?? [] }) };
}

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
    {mounted && <StrictMode><ReplacementFrame>
      <Table players={2} seats={SEATS.slice(0, 2)}
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
    </ReplacementFrame></StrictMode>}
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
const measurementFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing fixture item');
  return value;
}

async function expectSeatFraming(table: HTMLElement, players: number, caseName: string, expectedFit = 'fitted', checkInsufficientGeometry = false) {
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
  await expect(getComputedStyle(surface).borderRadius).toBe('50%');
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
    const label = `${caseName}/${players} seat ${index}`;
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
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<CaseName, ViewportSize>;
const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: first hidden card`} />
    <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: second hidden card`} />
  </SeatCards>
);
const seatCardsOnly = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: first hidden card`} />
    <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: second hidden card`} />
  </SeatCards>
);
const renderSeat = fn<GameTableProps<Player>['renderSeat']>((slot) => seatChrome(slot));
const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

const meta = {
  title: 'Games/GameTable',
  component: Table<Player>,
  tags: ['autodocs'],
  args: {
    players: 6, seats: SEATS, viewport: VIEWPORTS.portraitShort,
    renderSeat, center, header: 'Poker · 10 / 20', dock: <Button>Check</Button>,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: { component: 'Arrange players around a game surface. Add cards, controls and floating content to named regions.' },
      usage: `## Setup
- Import from \`@jfrader/ui/game-table\`. GameTable is an opt-in subpath and is not re-exported by the package root.

\`\`\`tsx
<GameTable players={6} seats={players}>
  <GameTable.Header>Poker · 10 / 20</GameTable.Header>
  <GameTable.Seat><SeatContent /></GameTable.Seat>
  <GameTable.Play />
  <GameTable.Center>Pot: 240</GameTable.Center>
  <GameTable.Dock><Button>Check</Button></GameTable.Dock>
</GameTable>
\`\`\`

## Regions
Compose direct \`GameTable.Seat\`, \`GameTable.Play\`, \`GameTable.Center\`, \`GameTable.Header\`, \`GameTable.Dock\`, \`GameTable.Footer\` and \`GameTable.Floating\` children in any order (fragments are accepted). Seat and Play repeat at every place unless you pass \`slotKey\`. Their children read \`{ player, slot, index, geometry }\` with \`useGameTableSeat<Player>()\`. Empty play content reserves nothing. Center holds shared cards, the pot or deck and is measured independently. Keep measured footprints in normal flow; absolute artwork must reserve its footprint in its parent. The node-region props and seat/play callbacks have been replaced by these parts.

Each public part accepts native div props, ref and sx. \`component\` is sugar for \`slots.root\`; \`slotProps.root\` passes root props, with slot conflicts winning except merged className/style. Geometry variables and measurement markers remain table-owned. Use \`seatSlots\` for prebuilt player order; \`slots\` now replaces structure.

## Geometry
Give the parent an inline and block size. Container queries derive the CSS frame from that container, independently of the browser viewport. The server renders the CSS frame directly; regions remain hidden until measured. ResizeObserver measures the actual root, shell, surface and intrinsic regions.
\`seatPlacement\` defaults to \`edge\`: the content centre sits on the felt boundary. \`inside\` keeps content contained with its outer edge inset by the gap; \`outside\` moves the inner edge to the boundary, using the directional box support as an outward offset. This deliberately replaces the previous containment-only default. The felt is a fluid ellipse with 50% border radius that follows container CSS; edge/outside placement follows its measured ellipse. The shell reserves the outboard footprint at each region's minimum scale. If the root cannot hold a placement at its floor, the table declares insufficient space rather than calling an inward fallback fitted.
The play anchor shares its seat's physical polar direction on an inward ring. Its distance leaves the measured seat/play boxes separated by the content gap on at least one axis, moving farther inward when the surface border requires it. Plays must stay inside the surface, clear of other regions and the measured centre; no invisible centre-size percentage is reserved.
\`players\` accepts any integer >= 2. \`seats\` fills empty places, distributes teams round-robin and puts your seat first. \`teamCount\` defaults to 2; use 1 for free-for-all. \`seatSlots\` preserves a prebuilt visual order and any team numbers, and must contain exactly \`players\` places; order it with the exported builders when needed. Do not pass both.
The curve uses θᵢ = π/2 + 2πi/N and Pᵢ = C + (Rx cosθᵢ, Ry sinθᵢ). C is the surface border-box center. In edge/outside modes Rx and Ry are the measured surface half-extents; the ring follows the felt's aspect, including landscape frames. Only inside mode bounds the available-area axis stretch: near-square areas (axis ratio ≤1.15) give a circle, growing continuously up to 1.5. On an ellipse the physical polar-angle gaps differ from the equal parametric gaps; no per-seat angular correction is applied. Content stays upright, with zero seat rotation; RTL mirrors placement only. No table-owned decoration requires rotation.
\`seats\` defaults missing \`teamIdx\` to \`index % teamCount\`; explicit indices must be in [0, teamCount). Team j has as many places as indices i in [0, players) with i % teamCount === j; odd seat counts can give teams different capacities. Incompatible capacities and duplicate player/slot keys throw. Use \`seatSlots\` or builders as escape hatches for arbitrary orders or teams. \`buildAlternatingSlots(seats, players, direction, teamCount)\` follows the same policy. \`getTablePointSeatIndexes(slots, teamCount)\` selects the occupied rival nearest the bottom seat's antipode (ties use visual order); with teamCount=1 there is no front team leader and its index is -1.
\`clearance\` requests additional block-axis space. Header, dock and footer remain unscaled, outside the surface. The request is a preference: if the content floors cannot fit, both clearance edges yield to \`GAME_TABLE_LIMITS.minimumClearancePx\` (0). The table retries the requested CSS padding on content/size changes, so the request is restored when space returns. This is a two-step policy (requested, then minimum), not a search for the largest feasible clearance.
Coordinates are measured from inline-start and mirror with \`dir="rtl"\`. \`data-game-surface="true"\` marks the surface for measuring future card flights.

## Content size
\`GAME_TABLE_LIMITS.minimumCardWidthPx\` is 32px, matching GameCard sm. Each seat, play and centre has its own minimum scale: max(32 / intrinsic card width), combined with its control-size floor. Chrome is excluded. Regions without cards or controls retain intrinsic size. Custom artwork without GameCard markers is not covered by the card floor.
The solver chooses the largest shared preferred scale t in [0,1]; each region uses max(t, its minimum scale). It pushes the seat ring outward within placement and measured shell constraints, separates neighbours and plays, and keeps the inward play ring clear of the measured centre. The space-2 gap stays unscaled. Content is never substituted or truncated.
Precedence: preserve card/control floors → try requested clearance → retry at clearance zero → declare insufficient space if floors still cannot fit. \`data-clearance="requested" | "reduced"\` and numeric \`data-clearance-start/end\` report effective local CSS pixels. \`data-layout-fit="measuring" | "fitted" | "insufficient-space"\` reports geometry. Insufficient space means the composition cannot satisfy all clearances at its floors, including the play-to-centre band; overflow or collisions may remain. Give the parent more space or reduce the composition.

## Seat chrome
Put names, avatars and non-layout adornments inside \`<GameTable.SeatChrome>…</GameTable.SeatChrome>\` within Seat. The part is absolutely positioned: it reserves no space and its descendants do not constrain card scale. It floats on the outward side; when a side label does not fit horizontally inside the root, only the chrome moves above/below the cards. No card-anchor compensation is applied. Removing the part from the DOM does not move the card block. Unmarked in-flow content still counts as content; the table does not guess which arbitrary text is a player name. Avoid wrappers that reserve padding/gaps for the chrome.
Chrome is independent of card fit: \`fitted\` does not guarantee arbitrary oversized labels or controls fit. Keep chrome concise and respect control/card minimum sizes within your custom content. The table does not rotate names, avatars, or faces; user-supplied transforms are the consumer's responsibility.
\`--game-table-content-scale\` on each seat and \`--game-table-center-scale\` on the root expose actual region scales; the root content-scale value is only the preferred t. \`--game-table-radius-x/y\` and \`--game-table-content-gap\` expose local geometry. Each play publishes \`--game-table-play-inline/block\` (logical percentages), \`--game-table-play-scale\`, \`--game-table-play-angle\` (outward physical degrees) and \`--game-table-play-cos/sin\`. \`geometry.scale\` and \`geometry.playScale\` are informational: never multiply child sizes by them again. Floors are local CSS-pixel sizes before external ancestor transforms; a consumer scaling the entire table must account for its own scale.
Native seat/play/center controls preserve at least 24px on both axes and 32px on their main axis, unless already smaller intrinsically. Regions without GameCards or controls retain their intrinsic size rather than disappearing at a zero floor. \`fitted\` covers normal-flow border boxes, not overflowing artwork, shadows or floating overlays. Keep absolute artwork's full footprint reserved in normal flow.

## Rival-card flight markers
After commit, GameTable marks each actual \`GameCard\` back in an occupied non-own seat with \`data-seat-hidden-card={player.key}\` and \`data-seat-hidden-card-index={index}\`. Index is current zero-based DOM order within that seat, not seat index. Markers update on card/face/player changes and are removed when a card is revealed or a seat becomes empty/own. No opponent value is exposed. Own-hand markers remain the hand's responsibility; custom card renderers must provide their own markers. The flight consumer example is \`packages/ui/src/components/card-flights/card-flights-fixture.tsx\`.

## Flights
\`CardFlightsProvider\` measures the destinations the library renders: \`GameHand\`, \`GameHand.Hidden\` and \`GameCardStack.Pile\` register their card nodes, and \`GameTable\` registers its seats and surface. A board composition calls \`useBoardFlights\` with the records it already renders and needs no measurements of its own.

For a composition the library does not describe — a shared board dealt from a deck, for example — \`useCardFlights\` exposes \`launch\` for measured endpoints, and \`CARD_FLIGHT_ATTRIBUTES\` names the markers the built-in pieces emit. Measure the endpoints you own through refs, from the board root rather than the document, and measure them again after viewport, resize, scroll, zoom or ancestor transform changes: they are snapshots, not a cache.

## Keyboard
The table is a passive layout, not an APG grid or application. It adds no roles, landmarks, focus movement, state or animation; supplied controls keep their own semantics and native tab order. Floating content is table-local, not a dialog or portal.`,
      source: { language: 'tsx', code: `import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable, useGameTableSeat, type SeatLike } from '@jfrader/ui/game-table';

const Frame = styled.div({ inlineSize: '100%', blockSize: 'calc(' + vars.space[4] + ' * 51)' });

interface Player extends SeatLike { name: string }

const players: Player[] = [
  { key: 'alex', name: 'Alex', teamIdx: 0 },
  { key: 'blair', name: 'Blair', teamIdx: 1 },
  { key: 'you', name: 'You', teamIdx: 0, isMe: true },
  { key: 'drew', name: 'Drew', teamIdx: 1 },
  { key: 'emery', name: 'Emery', teamIdx: 0 },
  { key: 'frankie', name: 'Frankie', teamIdx: 1 },
];

function SeatContent() {
  const { player } = useGameTableSeat<Player>();
  return (
    <>
      <GameTable.SeatChrome>
        <span>{player?.name ?? 'Open seat'}</span>
      </GameTable.SeatChrome>
      <GameCard size="sm" label="First hidden card" />
      <GameCard size="sm" label="Second hidden card" />
    </>
  );
}

export default function Example() {
  return (
    <Frame><GameTable players={6} seats={players}>
      <GameTable.Header>Poker · 10 / 20</GameTable.Header>
      <GameTable.Seat><SeatContent /></GameTable.Seat>
      <GameTable.Play />
      <GameTable.Center>
        <span>Pot: 240</span>
      </GameTable.Center>
      <GameTable.Dock><Button>Check</Button></GameTable.Dock>
    </GameTable></Frame>
  );
}` },
    },
  },
  render: (args: GameTableProps<Player>) => <ViewportFrame viewport={args.viewport}>
    <Table {...tableRootProps(args)}>
      <Table.Seat><FixtureContent<Player> content={args.renderSeat} /></Table.Seat>
      <Table.Play><FixtureContent<Player> content={args.renderPlay} /></Table.Play>
      <Table.Center>{args.center}</Table.Center>
      {args.header != null && <Table.Header>{args.header}</Table.Header>}
      {args.footer != null && <Table.Footer>{args.footer}</Table.Footer>}
      {args.dock != null && <Table.Dock>{args.dock}</Table.Dock>}
      {args.floating != null && <Table.Floating>{args.floating}</Table.Floating>}
    </Table>
  </ViewportFrame>,
} satisfies Omit<Meta<GameTableProps<Player>>, 'component'> & Pick<Meta<typeof Table<Player>>, 'component'>;
export default meta;
type Story = StoryObj<typeof meta>;

const ASPECT_CONTAINERS = [
  { width: 405, height: 900 },
  { width: 675, height: 900 },
  { width: 927, height: 900 },
  { width: 945, height: 900 },
  { width: 1161, height: 900 },
  { width: 1179, height: 900 },
  { width: 1440, height: 900 },
  { width: 840, height: 360 },
  { width: 864, height: 360 },
] as const;
const ASPECT_CASES = [
  { viewport: { width: 260, height: 300 }, players: 6 },
  ...ASPECT_CONTAINERS.flatMap((viewport) => COUNTS.map((players) => ({ viewport, players }))),
];
const ASPECT_MODES = [
  { surface: 'match', dir: 'ltr' },
  { surface: 'match', dir: 'rtl' },
  { surface: 'lobby', dir: 'ltr' },
] as const;

export const ContainerAspectBands: Story = {
  name: 'Container aspect bands',
  parameters: { docs: { source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameTable } from '@jfrader/ui/game-table';

const Frame = styled.div({ inlineSize: '100%', blockSize: 'calc(' + vars.space[4] + ' * 51)' });

export default function Example() {
  return <Frame><GameTable players={6} seats={[]}>
    <GameTable.Header>Poker</GameTable.Header>
    <GameTable.Seat />
    <GameTable.Center>Pot: 240</GameTable.Center>
  </GameTable></Frame>;
}` } } },
  render: () => <Matrix>
    {ASPECT_CASES.map(({ viewport: size, players }) => ASPECT_MODES.map(({ surface, dir }) => (
      <ViewportFrame key={`${size.width}-${players}-${surface}-${dir}`} viewport={size}
        data-aspect-width={size.width} data-aspect-height={size.height} data-aspect-players={players}>
        <Table players={players} seats={seatsFor(players)} surface={surface} dir={dir}>
          <Table.Header>Poker · 10 / 20</Table.Header>
          <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
          <Table.Center>{center}</Table.Center>
          <Table.Dock><Button>Check</Button></Table.Dock>
        </Table>
      </ViewportFrame>
    )))}
  </Matrix>,
  play: async ({ canvasElement }) => {
    const frames = canvasElement.querySelectorAll<HTMLElement>('[data-aspect-width]');
    await expect(frames).toHaveLength(ASPECT_CASES.length * ASPECT_MODES.length);
    for (const frame of frames) {
      const table = required(frame.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
      const width = Number(frame.dataset.aspectWidth);
      const height = Number(frame.dataset.aspectHeight);
      const players = Number(frame.dataset.aspectPlayers);
      const short = height === 360;
      const expectedFit = width === 260 || (short && table.dataset.surface === 'lobby' && players === 6) ? 'insufficient-space' : 'fitted';
      await expectSeatFraming(table, players, `${width}/${height}`, expectedFit);
      const container = required(table.querySelector<HTMLElement>('[data-ui="game-table-frame-container"]') ?? undefined);
      await expect(getComputedStyle(container).containerType).toBe('size');
      const surface = required(table.querySelector<HTMLElement>('[data-game-surface]') ?? undefined);
      await expect(getComputedStyle(surface).borderRadius).toBe('50%');
      if (table.dataset.surface === 'lobby' && width / height >= 1.3) {
        const box = surface.getBoundingClientRect();
        await expect(box.width).toBeCloseTo(box.height, 1);
      }
      if (!short && expectedFit === 'fitted' && table.dataset.surface === 'match') await expectMirroredDirection(table, '[data-ui="game-table-seat"]');
    }
  },
};

export const Default: Story = {
  name: 'Default',
  play: async ({ canvasElement, args, userEvent }) => {
    const table = canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]');
    if (!table) throw new Error('Missing table');
    await expect(table.parentElement?.getBoundingClientRect().width).toBe(VIEWPORTS.portraitShort.width);
    await expect(table.parentElement?.getBoundingClientRect().height).toBe(VIEWPORTS.portraitShort.height);
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
    await expectSeatFraming(table, 6, 'portraitShort');
    await userEvent.tab();
    const button = within(table).getByRole('button', { name: 'Check' });
    await expect(table.ownerDocument.activeElement).toBe(button);
    await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
  },
};

export const ReplacedRootKeepsFrame: Story = {
  tags: ['!autodocs'],
  render: (args) => <ViewportFrame viewport={args.viewport}>
    <Table {...tableRootProps(args)} slots={{ root: ReplacementRoot }}>
      <Table.Header>{args.header}</Table.Header>
      <Table.Seat><FixtureContent<Player> content={args.renderSeat} /></Table.Seat>
      <Table.Center>{args.center}</Table.Center>
      <Table.Dock>{args.dock}</Table.Dock>
    </Table>
  </ViewportFrame>,
  play: async ({ canvasElement, args }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui~="game-table"]') ?? undefined);
    await expect(table).toHaveAttribute('data-replacement', 'slots');
    await expectSeatFraming(table, 6, 'portraitShort');
    const container = required(table.querySelector<HTMLElement>(':scope > [data-ui="game-table-frame-container"]') ?? undefined);
    const frame = required(container.querySelector<HTMLElement>(':scope > [data-ui="game-table-frame"]') ?? undefined);
    await expect(getComputedStyle(container).containerType).toBe('size');
    await expect(frame).toHaveAttribute('data-surface', 'match');
    const frameStyle = getComputedStyle(frame);
    await expect(frameStyle.getPropertyValue('--game-table-max-width')).toContain('100cqi');
    await expect(Number.parseFloat(frameStyle.paddingBlockStart)).toBeCloseTo(args.viewport.height * 0.01, 1);
    await expect(frame.getBoundingClientRect().width).toBe(args.viewport.width);
    await expect(frame.getBoundingClientRect().height).toBe(args.viewport.height);
  },
};

/** Native region props, replacement roots and seat context. */
export const CompoundParts: Story = {
  tags: ['!autodocs'],
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

const matrixStory = (caseName: CaseName, theme: 'dark' | 'light'): Story => ({
  args: { viewport: VIEWPORTS[caseName] },

  render: (args) => (
    <MatrixGrid>
      {COUNTS.map((players) => (
        <ThemeViewport key={players} theme={theme} viewport={args.viewport}>
          <Table {...tableRootProps({ ...args, clearance: 32, slots: undefined, players, seats: seatsFor(players) })}>
            <Table.Seat><FixtureContent<Player> content={args.renderSeat} /></Table.Seat>
            <Table.Play><FixtureContent<Player> content={args.renderPlay} /></Table.Play>
            <Table.Center>{args.center}</Table.Center>
            <Table.Header>{`Poker · ${players / 2}v${players / 2}`}</Table.Header>
            <Table.Dock>{args.dock}</Table.Dock>
          </Table>
        </ThemeViewport>
      ))}
    </MatrixGrid>
  ),
  play: async ({ canvasElement, args }) => {
    const tables = canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]');
    await expect(tables).toHaveLength(3);
    for (const [index, table] of Array.from(tables).entries()) {
      await expect(table.parentElement?.getBoundingClientRect().width).toBe(VIEWPORTS[caseName].width);
      await expect(table.parentElement?.getBoundingClientRect().height).toBe(VIEWPORTS[caseName].height);
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
      await expectSeatFraming(table, required(COUNTS[index]), caseName, 'fitted');
    }
  },
});

export const PortraitShortDark = { name: 'Portrait short · dark', ...matrixStory('portraitShort', 'dark'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, ThemeRoot, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ThemeFrame = styled.div(viewportSize);
function ThemeViewport({ viewport, theme, children }: {
  viewport: { width: number; height: number }; theme: 'dark' | 'light'; children: ReactNode;
}) {
  return <ThemeRoot theme={theme}><ThemeFrame viewport={viewport}>{children}</ThemeFrame></ThemeRoot>;
}

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const MatrixGrid = styled(Matrix)({ display: 'grid', gap: vars.space[6] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<MatrixGrid>{COUNTS.map((players) => (
  <ThemeViewport key={players} theme="dark" viewport={VIEWPORTS.portraitShort}>
    <Table players={players} seats={seatsFor(players)} clearance={32}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>{\`Poker · \${players / 2}v\${players / 2}\`}</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ThemeViewport>
))}</MatrixGrid>);
}` } } } };
export const PortraitShortLight = { name: 'Portrait short · light', ...matrixStory('portraitShort', 'light'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, ThemeRoot, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ThemeFrame = styled.div(viewportSize);
function ThemeViewport({ viewport, theme, children }: {
  viewport: { width: number; height: number }; theme: 'dark' | 'light'; children: ReactNode;
}) {
  return <ThemeRoot theme={theme}><ThemeFrame viewport={viewport}>{children}</ThemeFrame></ThemeRoot>;
}

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const MatrixGrid = styled(Matrix)({ display: 'grid', gap: vars.space[6] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<MatrixGrid>{COUNTS.map((players) => (
  <ThemeViewport key={players} theme="light" viewport={VIEWPORTS.portraitShort}>
    <Table players={players} seats={seatsFor(players)} clearance={32}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>{\`Poker · \${players / 2}v\${players / 2}\`}</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ThemeViewport>
))}</MatrixGrid>);
}` } } } };
export const PortraitDark = { name: 'Portrait · dark', ...matrixStory('portrait', 'dark'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, ThemeRoot, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ThemeFrame = styled.div(viewportSize);
function ThemeViewport({ viewport, theme, children }: {
  viewport: { width: number; height: number }; theme: 'dark' | 'light'; children: ReactNode;
}) {
  return <ThemeRoot theme={theme}><ThemeFrame viewport={viewport}>{children}</ThemeFrame></ThemeRoot>;
}

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const MatrixGrid = styled(Matrix)({ display: 'grid', gap: vars.space[6] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<MatrixGrid>{COUNTS.map((players) => (
  <ThemeViewport key={players} theme="dark" viewport={VIEWPORTS.portrait}>
    <Table players={players} seats={seatsFor(players)} clearance={32}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>{\`Poker · \${players / 2}v\${players / 2}\`}</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ThemeViewport>
))}</MatrixGrid>);
}` } } } };
export const PortraitLight = { name: 'Portrait · light', ...matrixStory('portrait', 'light'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, ThemeRoot, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ThemeFrame = styled.div(viewportSize);
function ThemeViewport({ viewport, theme, children }: {
  viewport: { width: number; height: number }; theme: 'dark' | 'light'; children: ReactNode;
}) {
  return <ThemeRoot theme={theme}><ThemeFrame viewport={viewport}>{children}</ThemeFrame></ThemeRoot>;
}

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const MatrixGrid = styled(Matrix)({ display: 'grid', gap: vars.space[6] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<MatrixGrid>{COUNTS.map((players) => (
  <ThemeViewport key={players} theme="light" viewport={VIEWPORTS.portrait}>
    <Table players={players} seats={seatsFor(players)} clearance={32}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>{\`Poker · \${players / 2}v\${players / 2}\`}</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ThemeViewport>
))}</MatrixGrid>);
}` } } } };
export const WideDark = { name: 'Wide · dark', ...matrixStory('wide', 'dark'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, ThemeRoot, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ThemeFrame = styled.div(viewportSize);
function ThemeViewport({ viewport, theme, children }: {
  viewport: { width: number; height: number }; theme: 'dark' | 'light'; children: ReactNode;
}) {
  return <ThemeRoot theme={theme}><ThemeFrame viewport={viewport}>{children}</ThemeFrame></ThemeRoot>;
}

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const MatrixGrid = styled(Matrix)({ display: 'grid', gap: vars.space[6] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<MatrixGrid>{COUNTS.map((players) => (
  <ThemeViewport key={players} theme="dark" viewport={VIEWPORTS.wide}>
    <Table players={players} seats={seatsFor(players)} clearance={32}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>{\`Poker · \${players / 2}v\${players / 2}\`}</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ThemeViewport>
))}</MatrixGrid>);
}` } } } };
export const WideLight = { name: 'Wide · light', ...matrixStory('wide', 'light'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, ThemeRoot, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ThemeFrame = styled.div(viewportSize);
function ThemeViewport({ viewport, theme, children }: {
  viewport: { width: number; height: number }; theme: 'dark' | 'light'; children: ReactNode;
}) {
  return <ThemeRoot theme={theme}><ThemeFrame viewport={viewport}>{children}</ThemeFrame></ThemeRoot>;
}

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const MatrixGrid = styled(Matrix)({ display: 'grid', gap: vars.space[6] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<MatrixGrid>{COUNTS.map((players) => (
  <ThemeViewport key={players} theme="light" viewport={VIEWPORTS.wide}>
    <Table players={players} seats={seatsFor(players)} clearance={32}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>{\`Poker · \${players / 2}v\${players / 2}\`}</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ThemeViewport>
))}</MatrixGrid>);
}` } } } };
export const SquareDark = { name: 'Square · dark', ...matrixStory('square', 'dark'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, ThemeRoot, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ThemeFrame = styled.div(viewportSize);
function ThemeViewport({ viewport, theme, children }: {
  viewport: { width: number; height: number }; theme: 'dark' | 'light'; children: ReactNode;
}) {
  return <ThemeRoot theme={theme}><ThemeFrame viewport={viewport}>{children}</ThemeFrame></ThemeRoot>;
}

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const MatrixGrid = styled(Matrix)({ display: 'grid', gap: vars.space[6] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<MatrixGrid>{COUNTS.map((players) => (
  <ThemeViewport key={players} theme="dark" viewport={VIEWPORTS.square}>
    <Table players={players} seats={seatsFor(players)} clearance={32}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>{\`Poker · \${players / 2}v\${players / 2}\`}</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ThemeViewport>
))}</MatrixGrid>);
}` } } } };
export const SquareLight = { name: 'Square · light', ...matrixStory('square', 'light'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, ThemeRoot, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ThemeFrame = styled.div(viewportSize);
function ThemeViewport({ viewport, theme, children }: {
  viewport: { width: number; height: number }; theme: 'dark' | 'light'; children: ReactNode;
}) {
  return <ThemeRoot theme={theme}><ThemeFrame viewport={viewport}>{children}</ThemeFrame></ThemeRoot>;
}

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const MatrixGrid = styled(Matrix)({ display: 'grid', gap: vars.space[6] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<MatrixGrid>{COUNTS.map((players) => (
  <ThemeViewport key={players} theme="light" viewport={VIEWPORTS.square}>
    <Table players={players} seats={seatsFor(players)} clearance={32}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>{\`Poker · \${players / 2}v\${players / 2}\`}</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ThemeViewport>
))}</MatrixGrid>);
}` } } } };
export const SquareWideDark = { name: 'Square wide · dark', ...matrixStory('squareWide', 'dark'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, ThemeRoot, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ThemeFrame = styled.div(viewportSize);
function ThemeViewport({ viewport, theme, children }: {
  viewport: { width: number; height: number }; theme: 'dark' | 'light'; children: ReactNode;
}) {
  return <ThemeRoot theme={theme}><ThemeFrame viewport={viewport}>{children}</ThemeFrame></ThemeRoot>;
}

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const MatrixGrid = styled(Matrix)({ display: 'grid', gap: vars.space[6] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<MatrixGrid>{COUNTS.map((players) => (
  <ThemeViewport key={players} theme="dark" viewport={VIEWPORTS.squareWide}>
    <Table players={players} seats={seatsFor(players)} clearance={32}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>{\`Poker · \${players / 2}v\${players / 2}\`}</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ThemeViewport>
))}</MatrixGrid>);
}` } } } };
export const SquareWideLight = { name: 'Square wide · light', ...matrixStory('squareWide', 'light'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, ThemeRoot, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ThemeFrame = styled.div(viewportSize);
function ThemeViewport({ viewport, theme, children }: {
  viewport: { width: number; height: number }; theme: 'dark' | 'light'; children: ReactNode;
}) {
  return <ThemeRoot theme={theme}><ThemeFrame viewport={viewport}>{children}</ThemeFrame></ThemeRoot>;
}

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const MatrixGrid = styled(Matrix)({ display: 'grid', gap: vars.space[6] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<MatrixGrid>{COUNTS.map((players) => (
  <ThemeViewport key={players} theme="light" viewport={VIEWPORTS.squareWide}>
    <Table players={players} seats={seatsFor(players)} clearance={32}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>{\`Poker · \${players / 2}v\${players / 2}\`}</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ThemeViewport>
))}</MatrixGrid>);
}` } } } };
export const WideLargeDark = { name: 'Wide large · dark', ...matrixStory('wideLarge', 'dark'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, ThemeRoot, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ThemeFrame = styled.div(viewportSize);
function ThemeViewport({ viewport, theme, children }: {
  viewport: { width: number; height: number }; theme: 'dark' | 'light'; children: ReactNode;
}) {
  return <ThemeRoot theme={theme}><ThemeFrame viewport={viewport}>{children}</ThemeFrame></ThemeRoot>;
}

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const MatrixGrid = styled(Matrix)({ display: 'grid', gap: vars.space[6] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<MatrixGrid>{COUNTS.map((players) => (
  <ThemeViewport key={players} theme="dark" viewport={VIEWPORTS.wideLarge}>
    <Table players={players} seats={seatsFor(players)} clearance={32}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>{\`Poker · \${players / 2}v\${players / 2}\`}</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ThemeViewport>
))}</MatrixGrid>);
}` } } } };
export const WideLargeLight = { name: 'Wide large · light', ...matrixStory('wideLarge', 'light'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, ThemeRoot, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ThemeFrame = styled.div(viewportSize);
function ThemeViewport({ viewport, theme, children }: {
  viewport: { width: number; height: number }; theme: 'dark' | 'light'; children: ReactNode;
}) {
  return <ThemeRoot theme={theme}><ThemeFrame viewport={viewport}>{children}</ThemeFrame></ThemeRoot>;
}

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const MatrixGrid = styled(Matrix)({ display: 'grid', gap: vars.space[6] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<MatrixGrid>{COUNTS.map((players) => (
  <ThemeViewport key={players} theme="light" viewport={VIEWPORTS.wideLarge}>
    <Table players={players} seats={seatsFor(players)} clearance={32}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>{\`Poker · \${players / 2}v\${players / 2}\`}</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ThemeViewport>
))}</MatrixGrid>);
}` } } } };

export const SlotOrderAndGeometry: Story = {
  name: 'Slot order and geometry',
  play: async () => {
    await expect(resolveTableTurnDirection()).toBe('counterclockwise');
    await expect(resolveTableTurnDirection('clockwise')).toBe('clockwise');
    await expect(buildTableOrderSlots(SEATS, 'clockwise').map((slot) => slot.key)).toEqual(['you', 'drew', 'emery', 'frankie', 'alex', 'blair']);
    await expect(buildTableOrderSlots(SEATS, 'counterclockwise').map((slot) => slot.key)).toEqual(['you', 'blair', 'alex', 'frankie', 'emery', 'drew']);
    const partial = buildAlternatingSlots([SEATS[1], SEATS[2]], 6, 'clockwise');
    await expect(partial.map((slot) => slot.player?.key ?? null)).toEqual(['you', 'blair', null, null, null, null]);
    await expect(getTablePointSeatIndexes(partial)).toEqual({ bottomLeaderSeatIndex: 0, frontLeaderSeatIndex: 1 });
    await expect(getTablePointSeatIndexes(buildAlternatingSlots([], 2, 'clockwise'))).toEqual({ bottomLeaderSeatIndex: -1, frontLeaderSeatIndex: -1 });
    for (const players of COUNTS) {
      const layout = buildBoardLayoutModel({ surface: 'match', totalSeats: players });
      await expect(layout.seatGeometries).toHaveLength(players);
      await expect(layout.fit).toBe('measuring');
      await expect(layout.seatConfig.radiusX).toBe(0);
      for (const [index, seat] of layout.seatGeometries.entries()) {
        await expect(seat.angleDeg).toBeCloseTo(90 + 360 * index / players, 8);
        await expect(seat.groupShiftY).toBe(0);
      }
    }
  },
};

export const PrebuiltSlotsAndEmptyPlaces: Story = {
  name: 'Prebuilt slots and empty places',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, buildAlternatingSlots, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<ViewportFrame viewport={VIEWPORTS.portraitShort}>
<Table players={6} seatSlots={buildAlternatingSlots([SEATS[2]], 6, 'clockwise')}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · 10 / 20</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
</ViewportFrame>);
}` } } },
  args: { seats: undefined, slots: buildAlternatingSlots([SEATS[2]], 6, 'clockwise') },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="game-table-seat"]')).toHaveLength(6);
    await expect(within(canvasElement).getAllByText('Open seat')).toHaveLength(5);
    await expect(canvasElement.querySelectorAll('[data-seat-hidden-card]')).toHaveLength(0);
  },
};

export const Lobby: Story = {
  name: 'Lobby',
  args: { surface: 'lobby', players: 4, seats: seatsFor(4) },
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<ViewportFrame viewport={VIEWPORTS.portraitShort}>
<Table players={4} seats={seatsFor(4)} surface="lobby">
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · 10 / 20</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
</ViewportFrame>);
}` } } },
};

export const LobbyLandscape: Story = {
  name: 'Lobby landscape',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<ViewportFrame viewport={VIEWPORTS.wide}>
<Table players={6} seats={SEATS} surface="lobby">
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · 10 / 20</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
</ViewportFrame>);
}` } } },
  args: { surface: 'lobby', viewport: VIEWPORTS.wide },
  play: async ({ canvasElement }) => {
    const surface = required(canvasElement.querySelector<HTMLElement>('[data-game-surface]') ?? undefined).getBoundingClientRect();
    await expect(surface.width).toBeGreaterThan(100);
    await expect(surface.height).toBeGreaterThan(100);
    await expect(surface.width).toBeCloseTo(surface.height, 1);
  },
};

export const ExplicitRegionsAndRtl: Story = {
  name: 'Explicit regions and RTL',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<ViewportFrame viewport={VIEWPORTS.portraitShort}>
<Table players={6} seats={SEATS} dir="rtl">
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>{0}</Table.Header>
    <Table.Dock>{0}</Table.Dock>
    <Table.Footer>{0}</Table.Footer>
    <Table.Floating>{0}</Table.Floating>
  </Table>
</ViewportFrame>);
}` } } },
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
  name: 'Mirrored seats',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard, CARD_BACK_PATTERNS } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot, type GameTableProps as TableProps } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const MatrixRow = styled(Matrix)({ display: 'flex' });

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

interface Player extends SeatLike { name: string }

const SEATS: [Player, Player, Player, Player, Player, Player] = [
  { key: 'alex', teamIdx: 0, name: 'Alex' },
  { key: 'blair', teamIdx: 1, name: 'Blair' },
  { key: 'you', teamIdx: 0, isMe: true, name: 'You' },
  { key: 'drew', teamIdx: 1, name: 'Drew' },
  { key: 'emery', teamIdx: 0, name: 'Emery' },
  { key: 'frankie', teamIdx: 1, name: 'Frankie' },
];

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

const spanishSeat: RegionFixture<Player> = ((slot) => (
  <CardsRow>
    <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={\`\${slot.player?.name ?? 'Lugar libre'}: carta oculta\`} />
    <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={\`\${slot.player?.name ?? 'Lugar libre'}: segunda carta oculta\`} />
  </CardsRow>
));

const spanishPlay: GameTableProps<Player>['renderPlay'] = (_slot, index) => (
  index % 2 === 0
    ? <GameCard size="sm" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} label="as de oros" />
    : <GameCard size="sm" value={{ deck: 'spanish', suit: 'copas', rank: 10 }} label="sota de copas" />
);

export default function Example() {
  return (<MatrixRow>{(['ltr', 'rtl'] as const).map((dir) => (
  <ViewportFrame key={dir} viewport={VIEWPORTS.portraitShort}>
    <Table players={6} seats={SEATS} dir={dir}>
    <Table.Seat><FixtureContent<Player> content={spanishSeat} /></Table.Seat>
    <Table.Play><FixtureContent<Player> content={spanishPlay} /></Table.Play>
    <Table.Center><span>Truco</span></Table.Center>
    <Table.Header>Truco</Table.Header>
    <Table.Dock><Button>Quiero</Button></Table.Dock>

  </Table>
  </ViewportFrame>
))}</MatrixRow>);
}` } } },
  args: { renderPlay: (slot, index, geometry) => spanishPlay?.(slot, index, geometry), renderSeat: fn((slot, index, geometry) => spanishSeat(slot, index, geometry)), center: <span>Truco</span>, header: 'Truco', dock: <Button>Quiero</Button> },
  render: (args) => (
    <MatrixRow>
      {(['ltr', 'rtl'] as const).map((dir) => (
        <ViewportFrame key={dir} viewport={args.viewport}>
          <Table {...tableRootProps({ ...args, dir })}>
            <Table.Seat><FixtureContent<Player> content={args.renderSeat} /></Table.Seat>
            <Table.Play><FixtureContent<Player> content={args.renderPlay} /></Table.Play>
            <Table.Center>{args.center}</Table.Center>
            <Table.Header>{args.header}</Table.Header>
            <Table.Dock>{args.dock}</Table.Dock>
          </Table>
        </ViewportFrame>
      ))}
    </MatrixRow>
  ),
  play: async ({ canvasElement }) => {
    const tables = canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]');
    const ltr = required(tables[0]);
    const rtl = required(tables[1]);
    await expectSeatFraming(ltr, 6, 'portraitShort');
    await expectSeatFraming(rtl, 6, 'portraitShort');
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
  tags: ['!autodocs'],
  play: async () => {
    for (const players of COUNTS) {
      const layout = buildBoardLayoutModel({ surface: 'match', totalSeats: players });
      await expect(layout.seatGeometries).toHaveLength(players);
      await expect(layout.fit).toBe('measuring');
      await expect(layout.seatConfig.radiusX).toBe(0);
      for (const [index, seat] of layout.seatGeometries.entries()) {
        await expect(seat.angleDeg).toBeCloseTo(90 + 360 * index / players, 8);
        await expect(seat.groupShiftY).toBe(0);
      }
    }
    const aspectSweep = [0.45, 0.75, 1.0, 1.33, 1.6, 2.0, 2.4] as const;
    for (const aspect of aspectSweep) {
      for (const players of COUNTS) {
        for (const surface of ['match', 'lobby'] as const) {
          for (const direction of ['ltr', 'rtl'] as const) {
            const height = 600;
            const width = Math.round(height * aspect);
            const measurement: BoardMeasurements = {
              width, height, centerX: width / 2, centerY: height / 2,
              direction,
              seatPlacement: 'edge',
              surfaceBorderBox: { width, height },
              available: { left: width / 2, right: width / 2, top: height / 2, bottom: height / 2 },
              seats: Array.from({ length: players }, () => ({ width: 110, height: 90, minimumScale: 32 / 110 })),
              center: { width: 120, height: 80, minimumScale: 1 },
              gap: 8,
              minimumScale: 0,
            };
            const layout = buildBoardLayoutModel({ surface, totalSeats: players, measurement });
            await expect(layout.seatGeometries).toHaveLength(players);
            await expect(layout.fit).not.toBe('measuring');
            await expect(layout.seatConfig.radiusX).toBeGreaterThan(0);
            await expect(layout.seatConfig.radiusY).toBeGreaterThan(0);
            if (surface === 'lobby' && aspect === 1.0) {
              await expect(layout.seatConfig.radiusX).toBeCloseTo(layout.seatConfig.radiusY, 1);
            }
          }
        }
      }
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
    <ViewportFrame viewport={VIEWPORTS.portraitShort}>
      <Table players={6} seats={SEATS}>
        <Table.Seat><FixtureContent<Player> content={spanishSeat} /></Table.Seat>
        <Table.Play>{!empty && <GameCard size="lg" value={{ deck: 'spanish', suit: 'bastos', rank: 12 }} label="rey de bastos" />}</Table.Play>
        <Table.Center><span>Truco</span></Table.Center>
        <Table.Header>Truco</Table.Header>
        <Table.Dock><Button>Quiero</Button></Table.Dock>
      </Table>
    </ViewportFrame>
  </>;
}

/** Large played cards scale to their own floor; empty regions release their footprint. */
export const PlayRegionResizeAndFloors: Story = {
  name: 'Play region resize and floors',
  parameters: { docs: { source: { language: "tsx", code: `import { useState, type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard, CARD_BACK_PATTERNS } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const spanishSeat: RegionFixture<Player> = ((slot) => (
  <CardsRow>
    <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={\`\${slot.player?.name ?? 'Lugar libre'}: carta oculta\`} />
    <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={\`\${slot.player?.name ?? 'Lugar libre'}: segunda carta oculta\`} />
  </CardsRow>
));

function ChangingPlays() {
  const [empty, setEmpty] = useState(false);
  return <>
    <Button onClick={() => setEmpty(true)}>Retirar jugadas</Button>
    <ViewportFrame viewport={VIEWPORTS.portraitShort}>
      <Table players={6} seats={SEATS}>
        <Table.Seat><FixtureContent<Player> content={spanishSeat} /></Table.Seat>
        <Table.Play>{!empty && <GameCard size="lg" value={{ deck: 'spanish', suit: 'bastos', rank: 12 }} label="rey de bastos" />}</Table.Play>
        <Table.Center><span>Truco</span></Table.Center>
        <Table.Header>Truco</Table.Header>
        <Table.Dock><Button>Quiero</Button></Table.Dock>
      </Table>
    </ViewportFrame>
  </>;
}

export default function Example() {
  return (<ChangingPlays />);
}` } } },
  render: () => <ChangingPlays />,
  play: async ({ canvasElement, userEvent }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(table, 6, 'portraitShort');
    const play = required(table.querySelector<HTMLElement>('[data-ui="game-table-play"]') ?? undefined);
    const scale = Number.parseFloat(play.style.getPropertyValue('--game-table-play-scale'));
    await expect(scale).toBeLessThan(1);
    await expect(scale * 112).toBeGreaterThanOrEqual(GAME_TABLE_LIMITS.minimumCardWidthPx - 0.01);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Retirar jugadas' }));
    await waitFor(() => expect(table.querySelectorAll('[data-ui="game-table-play"] [data-ui~="game-card"]')).toHaveLength(0));
    await expectSeatFraming(table, 6, 'portraitShort');
    await expect(play.getBoundingClientRect().width).toBe(0);
    await expect(play.getBoundingClientRect().height).toBe(0);
    await expect(Number.parseFloat(getComputedStyle(table).getPropertyValue('--game-table-content-scale'))).toBe(1);
  },
};

export const InputConservation: Story = {
  tags: ['!autodocs'],
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
    const rawPlayers: SeatLike[] = [
      { key: 'p0' },
      { key: 'p1' },
      { key: 'p2' },
      { key: 'p3' },
      { key: 'p4' },
      { key: 'p5' },
    ];
    for (const teamCount of [1, 2, 3] as const) {
      for (const direction of ['clockwise', 'counterclockwise'] as const) {
        for (const count of [2, 3, 4, 5, 6]) {
          const list = rawPlayers.slice(0, count);
          const slots = buildAlternatingSlots(list, count, direction, teamCount);
          await expect(slots).toHaveLength(count);
          await expect(slots.flatMap((s) => s.player ? [s.player.key] : []).sort()).toEqual(list.map((p) => p.key).sort());
          for (const slot of slots) {
            if (slot.player) {
              const origIdx = list.findIndex((p) => p.key === slot.player!.key);
              await expect(slot.teamIdx).toBe(origIdx % teamCount);
            }
          }

          const withLocal = list.map((p, idx) => ({ ...p, isMe: idx === 1 }));
          const localSlots = buildAlternatingSlots(withLocal, count, direction, teamCount);
          await expect(localSlots[0]?.player?.key).toBe('p1');
          await expect(localSlots[0]?.player?.isMe).toBe(true);
          await expect(localSlots).toHaveLength(count);
          for (const slot of localSlots) {
            if (slot.player) {
              const origIdx = withLocal.findIndex((p) => p.key === slot.player!.key);
              await expect(slot.teamIdx).toBe(origIdx % teamCount);
            }
          }
        }
      }
    }
    const p4 = rawPlayers.slice(0, 4);
    await expect(buildAlternatingSlots(p4, 4, 'clockwise', 1).map((s) => s.teamIdx)).toEqual([0, 0, 0, 0]);
    await expect(buildAlternatingSlots(p4, 4, 'clockwise', 2).map((s) => s.teamIdx)).toEqual([0, 1, 0, 1]);
    await expect(buildAlternatingSlots(p4, 4, 'clockwise', 3).map((s) => s.teamIdx)).toEqual([0, 1, 2, 0]);
    const p6 = rawPlayers.slice(0, 6);
    await expect(buildAlternatingSlots(p6, 6, 'clockwise', 3).map((s) => s.teamIdx)).toEqual([0, 1, 2, 0, 1, 2]);

    await expect(() => buildAlternatingSlots([{ key: 'a', teamIdx: -1 }], 2, 'clockwise', 2)).toThrow('outside the round-robin range 0–1');
    await expect(() => buildAlternatingSlots([{ key: 'a', teamIdx: 2 }], 2, 'clockwise', 2)).toThrow('outside the round-robin range 0–1');
    await expect(() => buildAlternatingSlots([{ key: 'a', teamIdx: 3 }], 4, 'clockwise', 3)).toThrow('outside the round-robin range 0–2');
    await expect(() => buildAlternatingSlots([{ key: 'a', teamIdx: 1 }], 2, 'clockwise', 1)).toThrow('outside the round-robin range 0–0');
    await expect(() => buildAlternatingSlots([{ key: 'a', teamIdx: 1.5 }], 2, 'clockwise', 2)).toThrow('outside the round-robin range');
    await expect(() => buildAlternatingSlots([{ key: 'a' }], 2, 'clockwise', 0)).toThrow('GameTable requires an integer teamCount >= 1');
    await expect(() => buildAlternatingSlots([{ key: 'a' }], 2, 'clockwise', -1)).toThrow('GameTable requires an integer teamCount >= 1');
    await expect(() => buildAlternatingSlots([{ key: 'a' }], 2, 'clockwise', 1.5)).toThrow('GameTable requires an integer teamCount >= 1');

    await expect(() => buildAlternatingSlots([{ key: 'a', teamIdx: 1 }, { key: 'b', teamIdx: 1 }, { key: 'c', teamIdx: 1 }], 4, 'clockwise', 2)).toThrow('alternating team 1 capacity is 2; received 3 players');
    await expect(() => buildAlternatingSlots([{ key: 'a', teamIdx: 1 }, { key: 'b', teamIdx: 1 }], 3, 'clockwise', 2)).toThrow('alternating team 1 capacity is 1; received 2 players');
    await expect(() => buildAlternatingSlots([{ key: 'a', teamIdx: 2 }, { key: 'b', teamIdx: 2 }], 5, 'clockwise', 3)).toThrow('alternating team 2 capacity is 1; received 2 players');

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
  name: 'Lobby matrix',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<Matrix>{Object.entries(VIEWPORTS).map(([caseName, viewport]) => COUNTS.map((players) => (
  <ViewportFrame key={\`\${caseName}-\${players}\`} viewport={viewport}>
    <Table players={players} seats={seatsFor(players)} surface="lobby">
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · 10 / 20</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ViewportFrame>
)))}</Matrix>);
}` } } },
  render: (args) => (
    <Matrix>
      {Object.entries(VIEWPORTS).map(([caseName, viewport]) => COUNTS.map((players) => (
        <ViewportFrame key={`${caseName}-${players}`} viewport={viewport}>
          <Table {...tableRootProps({ ...args, viewport, players, slots: undefined, seats: seatsFor(players), surface: 'lobby' })}>
            <Table.Seat><FixtureContent<Player> content={args.renderSeat} /></Table.Seat>
            <Table.Play><FixtureContent<Player> content={args.renderPlay} /></Table.Play>
            <Table.Center>{args.center}</Table.Center>
            <Table.Header>{args.header}</Table.Header>
            <Table.Dock>{args.dock}</Table.Dock>
          </Table>
        </ViewportFrame>
      )))}
    </Matrix>
  ),
  play: async ({ canvasElement }) => {
    const tables = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]'));
    await expect(tables).toHaveLength(18);
    let index = 0;
    for (const [caseName] of Object.entries(VIEWPORTS) as [CaseName, ViewportSize][]) for (const players of COUNTS) {
      const expectedFit = caseName === 'wide' && players === 6 ? 'insufficient-space' : 'fitted';
      await expectSeatFraming(required(tables[index++]), players, caseName, expectedFit);
    }
  },
};

export const RtlMatrix: Story = {
  name: 'RTL matrix',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<Matrix>{Object.entries(VIEWPORTS).map(([caseName, viewport]) => COUNTS.map((players) => (
  <ViewportFrame key={\`\${caseName}-\${players}\`} viewport={viewport}>
    <Table players={players} seats={seatsFor(players)} dir="rtl">
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · 10 / 20</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ViewportFrame>
)))}</Matrix>);
}` } } },
  render: (args) => (
    <Matrix>
      {Object.entries(VIEWPORTS).map(([caseName, viewport]) => COUNTS.map((players) => (
          <ViewportFrame key={`${caseName}-${players}`} viewport={viewport}>
            <Table {...tableRootProps({ ...args, viewport, players, slots: undefined, seats: seatsFor(players), dir: 'rtl' })}>
              <Table.Seat><FixtureContent<Player> content={args.renderSeat} /></Table.Seat>
              <Table.Play><FixtureContent<Player> content={args.renderPlay} /></Table.Play>
              <Table.Center>{args.center}</Table.Center>
              <Table.Header>{args.header}</Table.Header>
              <Table.Dock>{args.dock}</Table.Dock>
            </Table>
          </ViewportFrame>
      )))}
    </Matrix>
  ),
  play: async ({ canvasElement }) => {
    const tables = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]'));
    await expect(tables).toHaveLength(18);
    let index = 0;
    for (const [caseName] of Object.entries(VIEWPORTS) as [CaseName, ViewportSize][]) for (const players of COUNTS) {
      await expectSeatFraming(required(tables[index++]), players, caseName, 'fitted');
    }
  },
};

const cardComposition = (clearance: boolean): Story => ({
  args: { viewport: VIEWPORTS.wide },

  render: (args) => (
    <Matrix>
      {(['sm', 'md', 'lg'] as const).map((size, index) => (
        <ViewportFrame key={size} data-card-composition={size} viewport={{ ...VIEWPORTS.wide, height: clearance ? 420 : 480 }}>
          <Table {...tableRootProps({ ...args, clearance: clearance ? [32,64,96][index] : 0 })}>
            <Table.Seat><FixtureContent<Player> content={(slot) => (
            <GameCard size={size} label={`${slot.player?.name}: hidden card`} />
            )} /></Table.Seat>
            <Table.Play><FixtureContent<Player> content={args.renderPlay} /></Table.Play>
            <Table.Center>{args.center}</Table.Center>
            <Table.Header>{args.header}</Table.Header>
            <Table.Dock>{args.dock}</Table.Dock>
          </Table>
        </ViewportFrame>
      ))}
    </Matrix>
  ),
  play: async ({ canvasElement }) => {
    for (const wrapper of canvasElement.querySelectorAll('[data-card-composition]')) {
      const table = required(wrapper.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
      await expectSeatFraming(table, 6, 'wide');
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
export const LandscapeCardSizes = { name: 'Landscape card sizes', ...cardComposition(false), parameters: { docs: { description: { story: "Compare sm, md and lg cards at 840×480. Their intrinsic sizes stay unchanged; the table scales the composition to fit." }, source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<Matrix>{(['sm', 'md', 'lg'] as const).map((size, index) => (
      <ViewportFrame key={size} data-card-composition={size} viewport={{ ...VIEWPORTS.wide, height: 480 }}>
        <Table players={6} seats={SEATS} clearance={0}>
    <Table.Seat><FixtureContent<Player> content={(slot) => <GameCard size={size} label={\`\${slot.player?.name}: hidden card\`} />} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · 10 / 20</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
      </ViewportFrame>
    ))}</Matrix>);
}` } } } };
export const LandscapeCardSizesWithClearance = { name: 'Landscape card sizes with clearance', ...cardComposition(true), parameters: { docs: { description: { story: "Compare the same sm, md and lg cards with additional shell clearance." }, source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<Matrix>{(['sm', 'md', 'lg'] as const).map((size, index) => (
      <ViewportFrame key={size} data-card-composition={size} viewport={{ ...VIEWPORTS.wide, height: 480 }}>
        <Table players={6} seats={SEATS} clearance={[32, 64, 96][index]}>
    <Table.Seat><FixtureContent<Player> content={(slot) => <GameCard size={size} label={\`\${slot.player?.name}: hidden card\`} />} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · 10 / 20</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
      </ViewportFrame>
    ))}</Matrix>);
}` } } } };

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
      <ResizableFrame narrow={narrow} roomy={roomy}>
        <Table players={2} clearance={clearance} seats={empty ? [SEATS[2]] : seatsFor(2)}>
          <Table.Seat><FixtureContent<Player> content={(slot) => slot.player ? (
            <SpacedCards>
              {['first', 'second', 'third'].filter((key) => !removed || key !== 'second').map((key) => (
                <GameCard key={key} size={large ? 'lg' : 'sm'} label={`${slot.player?.name}: ${key}`}
                  value={revealed && key === 'first' ? { deck: 'french', suit: 'spades', rank: 'A' } : undefined} />
              ))}
            </SpacedCards>
          ) : <span>Open seat</span>} /></Table.Seat>
          <Table.Play />
          <Table.Center>{center}</Table.Center>
          <Table.Header>Poker</Table.Header>
          <Table.Dock><Button>Check</Button></Table.Dock>
        </Table>
      </ResizableFrame>
    </>
  );
}

/** Changing card sizes and container dimensions keeps the same card nodes and flight markers. */
export const ContentResizeAndFlightMarkers: Story = {
  name: 'Content resize and flight markers',
  parameters: { docs: { source: { language: "tsx", code: `import { StrictMode, useState, type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const SpacedCards = styled.div({ display: 'flex', gap: vars.space[2] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const ResizableFrame = styled.div<{ narrow: boolean; roomy: boolean }>(({ narrow, roomy }) => ({
  inlineSize: narrow ? 380 : 500, blockSize: roomy ? 800 : narrow ? 360 : 440,
}));

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

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
      <ResizableFrame narrow={narrow} roomy={roomy}>
        <Table players={2} clearance={clearance} seats={empty ? [SEATS[2]] : seatsFor(2)}>
          <Table.Seat><FixtureContent<Player> content={(slot) => slot.player ? (
            <SpacedCards>
              {['first', 'second', 'third'].filter((key) => !removed || key !== 'second').map((key) => (
                <GameCard key={key} size={large ? 'lg' : 'sm'} label={\`\${slot.player?.name}: \${key}\`}
                  value={revealed && key === 'first' ? { deck: 'french', suit: 'spades', rank: 'A' } : undefined} />
              ))}
            </SpacedCards>
          ) : <span>Open seat</span>} /></Table.Seat>
          <Table.Play />
          <Table.Center>{center}</Table.Center>
          <Table.Header>Poker</Table.Header>
          <Table.Dock><Button>Check</Button></Table.Dock>
        </Table>
      </ResizableFrame>
    </>
  );
}

export default function Example() {
  return (<StrictMode><ChangingContent /></StrictMode>);
}` } } },
  render: () => <StrictMode><ChangingContent /></StrictMode>,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    const rival = () => Array.from(table.querySelectorAll<HTMLElement>('[data-seat-hidden-card="blair"]'));
    await waitFor(() => expect(rival()).toHaveLength(3));
    await expect(rival().map((card) => card.dataset.seatHiddenCardIndex)).toEqual(['0', '1', '2']);
    await expect(table.querySelectorAll('[data-seat-hidden-card="you"]')).toHaveLength(0);
    const third = required(rival()[2]);
    await expectSeatFraming(table, 2, 'wideLarge');
    const scale = () => Number.parseFloat(getComputedStyle(table).getPropertyValue('--game-table-content-scale'));
    const initialScale = scale();
    await userEvent.click(canvas.getByRole('button', { name: 'Grow content' }));
    await waitFor(() => expect(scale()).toBeLessThan(initialScale));
    await expectSeatFraming(table, 2, 'wideLarge');
    const grownScale = scale();
    await userEvent.click(canvas.getByRole('button', { name: 'Shrink container' }));
    await waitFor(() => expect(scale()).toBeLessThan(grownScale));
    await expect(table.parentElement?.getBoundingClientRect().width).toBe(380);
    await expect(table.parentElement?.getBoundingClientRect().height).toBe(360);
    await expectSeatFraming(table, 2, 'wideLarge');
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
    await expectSeatFraming(table, 2, 'wideLarge');
    await userEvent.click(canvas.getByRole('button', { name: 'Restore room' }));
    await waitFor(() => expect(table).toHaveAttribute('data-clearance', 'requested'));
    await expect(Number(table.dataset.clearanceStart)).toBeCloseTo(96, 2);
    await expectSeatFraming(table, 2, 'wideLarge');
  },
};

function ResizingTables() {
  const [viewport, setViewport] = useState(VIEWPORTS.portraitShort);
  const first = useRef<HTMLDivElement>(null);
  const second = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState('');
  return (
    <>
      <Button onClick={() => setViewport(VIEWPORTS.wide)}>Landscape viewport</Button>
      <Button onClick={() => {
        const a = first.current?.querySelector<HTMLElement>('[data-game-surface]');
        const b = second.current?.querySelector<HTMLElement>('[data-game-surface]');
        setMeasured(a && b && a !== b ? `${measurementFormat.format(a.getBoundingClientRect().width)} / ${measurementFormat.format(b.getBoundingClientRect().width)}` : 'Missing surface');
      }}>Measure tables</Button>
      <output>{measured}</output>
      {[first, second].map((ref, index) => (
        <TransformedFrame key={index} viewport={viewport} scaled={Boolean(index)}>
          <FullHeight>
            <Table ref={ref} dir={index ? 'rtl' : 'ltr'} players={2} seatSlots={buildTableOrderSlots([SEATS[0],SEATS[2]], 'clockwise')}>
              <Table.Seat><FixtureContent<Player> content={(slot) => <span>{slot.player?.name}</span>} /></Table.Seat>
              <Table.Play />
              <Table.Center />
            </Table>
          </FullHeight>
        </TransformedFrame>
      ))}
    </>
  );
}
export const WrappedTablesAndViewportUpdate: Story = {
  name: 'Wrapped tables and viewport update',
  parameters: { docs: { source: { language: "tsx", code: `import { useRef, useState, type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { GameTable as Table, useGameTableSeat, buildTableOrderSlots, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const FullHeight = styled.div({ blockSize: '100%' });

const TransformedFrame = styled.section<{ viewport: { width: number; height: number }; scaled: boolean }>(
  viewportSize,
  ({ scaled }) => ({ transform: scaled ? 'scale(0.75)' : undefined, transformOrigin: 'top left' }),
);

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const measurementFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function ResizingTables() {
  const [viewport, setViewport] = useState(VIEWPORTS.portraitShort);
  const first = useRef<HTMLDivElement>(null);
  const second = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState('');
  return (
    <>
      <Button onClick={() => setViewport(VIEWPORTS.wide)}>Landscape viewport</Button>
      <Button onClick={() => {
        const a = first.current?.querySelector<HTMLElement>('[data-game-surface]');
        const b = second.current?.querySelector<HTMLElement>('[data-game-surface]');
        setMeasured(a && b && a !== b ? \`\${measurementFormat.format(a.getBoundingClientRect().width)} / \${measurementFormat.format(b.getBoundingClientRect().width)}\` : 'Missing surface');
      }}>Measure tables</Button>
      <output>{measured}</output>
      {[first, second].map((ref, index) => (
        <TransformedFrame key={index} viewport={viewport} scaled={Boolean(index)}>
          <FullHeight>
            <Table ref={ref} dir={index ? 'rtl' : 'ltr'} players={2} seatSlots={buildTableOrderSlots([SEATS[0],SEATS[2]], 'clockwise')}>
              <Table.Seat><FixtureContent<Player> content={(slot) => <span>{slot.player?.name}</span>} /></Table.Seat>
              <Table.Play />
              <Table.Center />
            </Table>
          </FullHeight>
        </TransformedFrame>
      ))}
    </>
  );
}

export default function Example() {
  return (<ResizingTables />);
}` } } },
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
    const frame = required(tables[0]).closest('section');
    await expect(frame?.getBoundingClientRect().width).toBe(VIEWPORTS.wide.width);
    await expect(frame?.getBoundingClientRect().height).toBe(VIEWPORTS.wide.height);
    await userEvent.click(canvas.getByRole('button', { name: 'Measure tables' }));
    await expect(canvas.getByRole('status').textContent).not.toBe(before);
  },
};

const seatWithAvatar = (slot: GameTableSlot<Player>, size: AvatarSize = 'sm') => (
  <SeatCards>
    <Table.SeatChrome>
      <Avatar size={size} name={slot.player?.name ?? 'Open seat'} />
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: first hidden card`} />
    <GameCard size="sm" label={`${slot.player?.name ?? 'Open seat'}: second hidden card`} />
  </SeatCards>
);

export const WithAvatars: Story = {
  name: 'With avatars',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Avatar, Button, styled, type AvatarSize } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

const seatWithAvatar = (slot: GameTableSlot<Player>, size: AvatarSize = 'sm') => (
  <SeatCards>
    <Table.SeatChrome>
      <Avatar size={size} name={slot.player?.name ?? 'Open seat'} />
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

export default function Example() {
  return (<ViewportFrame viewport={VIEWPORTS.wideLarge}>
<Table players={6} seats={SEATS} >
    <Table.Seat><FixtureContent<Player> content={(slot) => seatWithAvatar(slot, 'sm')} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · Avatars</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
</ViewportFrame>);
}` } } },
  args: {
    players: 6, seats: SEATS, viewport: VIEWPORTS.wideLarge,
    renderSeat: fn((slot, _index, _geometry) => seatWithAvatar(slot, 'sm')),
    center, header: 'Poker · Avatars', dock: <Button>Check</Button>,
  },
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(table, 6, 'wideLarge', 'fitted');
    const avatars = table.querySelectorAll('[data-ui="avatar"]');
    await expect(avatars).toHaveLength(6);
    for (const seat of table.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]')) {
      const matrix = new DOMMatrix(getComputedStyle(seat).transform);
      const rotationDeg = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
      await expect(Math.abs(rotationDeg)).toBeLessThan(0.01);
    }
  },
};

export const UprightCasesWithAvatars: Story = {
  name: 'Upright cases with avatars',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Avatar, Button, styled, type AvatarSize } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const CaseColumn = styled.div({ display: 'flex', flexDirection: 'column', gap: vars.space[6] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

const seatWithAvatar = (slot: GameTableSlot<Player>, size: AvatarSize = 'sm') => (
  <SeatCards>
    <Table.SeatChrome>
      <Avatar size={size} name={slot.player?.name ?? 'Open seat'} />
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

export default function Example() {
  return (<CaseColumn>{Object.entries(VIEWPORTS).map(([caseName, viewport]) => (
  <ViewportFrame key={caseName} data-container-case={caseName} viewport={viewport}>
    <Table players={6} seats={SEATS} >
    <Table.Seat><FixtureContent<Player> content={(slot) => seatWithAvatar(slot, 'sm')} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>{\`Poker · \${caseName} (6p)\`}</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ViewportFrame>
))}</CaseColumn>);
}` } } },
  render: () => (
    <CaseColumn>
      {(['portraitShort', 'portrait', 'wide', 'square', 'squareWide', 'wideLarge'] as const).map((caseName) => (
        <ViewportFrame key={caseName} data-container-case={caseName} viewport={VIEWPORTS[caseName]}>
          <Table players={6} seats={SEATS}>
            <Table.Seat><FixtureContent<Player> content={(slot) => seatWithAvatar(slot, 'sm')} /></Table.Seat>
            <Table.Play />
            <Table.Center>{center}</Table.Center>
            <Table.Header>{`Poker · ${caseName} (6p)`}</Table.Header>
            <Table.Dock><Button>Check</Button></Table.Dock>
          </Table>
        </ViewportFrame>
      ))}
    </CaseColumn>
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
  name: 'Avatar independence',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Avatar, Button, styled, type AvatarSize } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

const seatWithAvatar = (slot: GameTableSlot<Player>, size: AvatarSize = 'sm') => (
  <SeatCards>
    <Table.SeatChrome>
      <Avatar size={size} name={slot.player?.name ?? 'Open seat'} />
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

export default function Example() {
  return (<ViewportFrame viewport={VIEWPORTS.wideLarge}>
<Table players={4} seats={seatsFor(4)} >
    <Table.Seat><FixtureContent<Player> content={(slot, index) => {
      if (index === 0) return seatChrome(slot);
      if (index === 1) return <SeatCards><GameCard size="sm" label="First hidden card" /><GameCard size="sm" label="Second hidden card" /></SeatCards>;
      return seatWithAvatar(slot, index === 2 ? 'sm' : 'md');
    }} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · Avatar Independence</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
</ViewportFrame>);
}` } } },
  args: {
    players: 4, seats: seatsFor(4), viewport: VIEWPORTS.wideLarge,
    renderSeat: fn((slot, index, _geometry) => {
      if (index === 0) return seatChrome(slot);
      if (index === 1) return (
        <SeatCards>
          <GameCard size="sm" label="First hidden card" />
          <GameCard size="sm" label="Second hidden card" />
        </SeatCards>
      );
      if (index === 2) return seatWithAvatar(slot, 'sm');
      return seatWithAvatar(slot, 'md');
    }),
    center, header: 'Poker · Avatar Independence', dock: <Button>Check</Button>,
  },
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(table, 4, 'wideLarge', 'fitted');
  },
};

export const ChromeRemovalParity: Story = {
  name: 'Chrome removal parity',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const ParityGrid = styled.div({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: vars.space[4] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const seatCardsOnly = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<ParityGrid>
  <div data-parity-group="with-chrome"><Table players={6} seats={SEATS} >
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · Chrome Removal Parity</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table></div>
  <div data-parity-group="without-chrome"><Table players={6} seats={SEATS} >
    <Table.Seat><FixtureContent<Player> content={seatCardsOnly} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · Chrome Removal Parity</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table></div>
</ParityGrid>);
}` } } },
  args: {
    players: 6, seats: SEATS, viewport: VIEWPORTS.wideLarge,
    center, header: 'Poker · Chrome Removal Parity', dock: <Button>Check</Button>,
  },
  render: (args) => (
    <ParityGrid>
      <div data-parity-group="with-chrome">
        <Table {...tableRootProps(args)}>
          <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
          <Table.Play><FixtureContent<Player> content={args.renderPlay} /></Table.Play>
          <Table.Center>{args.center}</Table.Center>
          <Table.Header>{args.header}</Table.Header>
          <Table.Dock>{args.dock}</Table.Dock>
        </Table>
      </div>
      <div data-parity-group="without-chrome">
        <Table {...tableRootProps(args)}>
          <Table.Seat><FixtureContent<Player> content={seatCardsOnly} /></Table.Seat>
          <Table.Play><FixtureContent<Player> content={args.renderPlay} /></Table.Play>
          <Table.Center>{args.center}</Table.Center>
          <Table.Header>{args.header}</Table.Header>
          <Table.Dock>{args.dock}</Table.Dock>
        </Table>
      </div>
    </ParityGrid>
  ),
  play: async ({ canvasElement }) => {
    const withChromeTable = required(canvasElement.querySelector<HTMLElement>('[data-parity-group="with-chrome"] [data-ui="game-table"]') ?? undefined);
    const withoutChromeTable = required(canvasElement.querySelector<HTMLElement>('[data-parity-group="without-chrome"] [data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(withChromeTable, 6, 'wideLarge', 'fitted');
    await expectSeatFraming(withoutChromeTable, 6, 'wideLarge', 'fitted');

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
  name: 'Oversized content, insufficient space',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const SpacedCards = styled.div({ display: 'flex', gap: vars.space[2] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<ViewportFrame viewport={VIEWPORTS.portraitShort}>
<Table players={6} seats={SEATS} >
    <Table.Seat><FixtureContent<Player> content={(slot) => <SpacedCards>
      {[1, 2, 3, 4, 5, 6].map((index) => <GameCard key={index} size="lg" label={\`\${slot.player?.name}: card \${index}\`} />)}
    </SpacedCards>} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · Insufficient Space</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
</ViewportFrame>);
}` } } },
  args: {
    players: 6, seats: SEATS, viewport: VIEWPORTS.portraitShort,
    center, header: 'Poker · Insufficient Space', dock: <Button>Check</Button>,
    renderSeat: fn((slot, _index, _geometry) => (
      <SpacedCards>
        <GameCard size="lg" label={`${slot.player?.name}: card 1`} />
        <GameCard size="lg" label={`${slot.player?.name}: card 2`} />
        <GameCard size="lg" label={`${slot.player?.name}: card 3`} />
        <GameCard size="lg" label={`${slot.player?.name}: card 4`} />
        <GameCard size="lg" label={`${slot.player?.name}: card 5`} />
        <GameCard size="lg" label={`${slot.player?.name}: card 6`} />
      </SpacedCards>
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
  name: 'State stability',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Avatar, Button, styled, type AvatarSize } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

const seatWithAvatar = (slot: GameTableSlot<Player>, size: AvatarSize = 'sm') => (
  <SeatCards>
    <Table.SeatChrome>
      <Avatar size={size} name={slot.player?.name ?? 'Open seat'} />
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

export default function Example() {
  return (<ViewportFrame viewport={VIEWPORTS.wide}>
<Table players={6} seats={SEATS} >
    <Table.Seat><FixtureContent<Player> content={(slot) => seatWithAvatar(slot, 'sm')} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · State Stability</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
</ViewportFrame>);
}` } } },
  args: {
    players: 6, seats: SEATS, viewport: VIEWPORTS.wide,
    renderSeat: fn((slot, _index, _geometry) => seatWithAvatar(slot, 'sm')), center, header: 'Poker · State Stability', dock: <Button>Check</Button>,
  },
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(table, 6, 'wide', 'fitted');
    const states = new Set<string | null>();
    for (let frame = 0; frame < 12; frame++) {
      await new Promise(requestAnimationFrame);
      states.add(table.getAttribute('data-layout-fit'));
    }
    await expect([...states]).toEqual(['fitted']);
  },
};

const spanishSeat = fn<GameTableProps<Player>['renderSeat']>((slot) => (
  <CardsRow>
    <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={`${slot.player?.name ?? 'Lugar libre'}: carta oculta`} />
    <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={`${slot.player?.name ?? 'Lugar libre'}: segunda carta oculta`} />
  </CardsRow>
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

/** Each seat shows the player, badges, hidden hand and turn. */
export const TrucoPlayerChrome: Story = {
  name: 'Truco player chrome',
  args: { viewport: VIEWPORTS.wideLarge, players: 4, seats: seatsFor(4) },
  render: (args) => <DeckProvider default="spanish">
    <ViewportFrame viewport={args.viewport}>
      <Table players={args.players} seats={args.seats ?? []}>
        <Table.Seat><TrucoPlayerSeat /></Table.Seat>
        <Table.Play><FixtureContent<Player> content={spanishPlay} /></Table.Play>
        <Table.Center>Truco</Table.Center>
        <Table.Header>Nosotros 12 · Ellos 8</Table.Header>
        <Table.Dock><Button>Quiero</Button></Table.Dock>
      </Table>
    </ViewportFrame>
  </DeckProvider>,
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Avatar, Badge, Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameHand } from '@jfrader/ui/game-hand';
import { GameSeat } from '@jfrader/ui/game-seat';
import { DeckProvider } from '@jfrader/ui/deck';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot, type GameTableProps as TableProps } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

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

interface Player extends SeatLike { name: string }

const SEATS: [Player, Player, Player, Player, Player, Player] = [
  { key: 'alex', teamIdx: 0, name: 'Alex' },
  { key: 'blair', teamIdx: 1, name: 'Blair' },
  { key: 'you', teamIdx: 0, isMe: true, name: 'You' },
  { key: 'drew', teamIdx: 1, name: 'Drew' },
  { key: 'emery', teamIdx: 0, name: 'Emery' },
  { key: 'frankie', teamIdx: 1, name: 'Frankie' },
];

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

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

export default function Example() {
  return (<DeckProvider default="spanish">
  <ViewportFrame viewport={VIEWPORTS.wideLarge}>
<Table players={4} seats={seatsFor(4)} >
    <Table.Seat><TrucoPlayerSeat /></Table.Seat>
    <Table.Play><FixtureContent<Player> content={spanishPlay} /></Table.Play>
    <Table.Center>Truco</Table.Center>
    <Table.Header>Nosotros 12 · Ellos 8</Table.Header>
    <Table.Dock><Button>Quiero</Button></Table.Dock>

  </Table>
</ViewportFrame>
</DeckProvider>);
}` } } },
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(table, 4, 'wideLarge');
    await expect(table.querySelectorAll('[data-ui="game-seat"]')).toHaveLength(4);
    await expect(table.querySelectorAll('[data-ui="game-hand-hidden-card"]')).toHaveLength(12);
    await expect(table.querySelectorAll('[data-ui="game-seat-timer"]')).toHaveLength(1);
  },
};

/** Hidden cards at the edge and played cards toward the centre, at all six sizes. */
export const TrucoPlayRing: Story = {
  name: 'Truco play ring',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard, CARD_BACK_PATTERNS } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot, type GameTableProps as TableProps } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const Row = styled.div({ display: 'flex' });

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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

const spanishSeat: RegionFixture<Player> = ((slot) => (
  <CardsRow>
    <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={\`\${slot.player?.name ?? 'Lugar libre'}: carta oculta\`} />
    <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={\`\${slot.player?.name ?? 'Lugar libre'}: segunda carta oculta\`} />
  </CardsRow>
));

const spanishPlay: GameTableProps<Player>['renderPlay'] = (_slot, index) => (
  index % 2 === 0
    ? <GameCard size="sm" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} label="as de oros" />
    : <GameCard size="sm" value={{ deck: 'spanish', suit: 'copas', rank: 10 }} label="sota de copas" />
);

export default function Example() {
  return (<Matrix>{Object.entries(VIEWPORTS).map(([caseName, viewport]) => COUNTS.map((players) => (
  <Row key={\`\${caseName}-\${players}\`}>
    <ViewportFrame data-measurement="before" viewport={viewport}>
      <Table players={players} seats={seatsFor(players)} seatPlacement="inside">
    <Table.Seat><FixtureContent<Player> content={spanishSeat} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center><span>Truco</span></Table.Center>
    <Table.Header>Truco</Table.Header>
    <Table.Dock><Button>Quiero</Button></Table.Dock>

  </Table>
    </ViewportFrame>
    <ViewportFrame data-measurement="after" viewport={viewport}>
      <Table players={players} seats={seatsFor(players)} seatPlacement="edge">
    <Table.Seat><FixtureContent<Player> content={spanishSeat} /></Table.Seat>
    <Table.Play><FixtureContent<Player> content={spanishPlay} /></Table.Play>
    <Table.Center><span>Truco</span></Table.Center>
    <Table.Header>Truco</Table.Header>
    <Table.Dock><Button>Quiero</Button></Table.Dock>

  </Table>
    </ViewportFrame>
  </Row>
)))}</Matrix>);
}` } } },
  args: { seatPlacement: 'edge', renderSeat: spanishSeat, renderPlay: spanishPlay, center: <span>Truco</span>, header: 'Truco', dock: <Button>Quiero</Button> },
  render: (args) => <Matrix>
    {Object.entries(VIEWPORTS).map(([caseName, viewport]) => COUNTS.map((players) => {
      const size = caseName === 'wide' ? { ...viewport, height: 480 } : viewport;
      return (
      <Row key={`${caseName}-${players}`}>
        <ViewportFrame data-measurement="before" viewport={size}>
          <Table {...tableRootProps({ ...args, seatPlacement: 'inside', viewport: size, players, slots: undefined, seats: seatsFor(players) })}>
            <Table.Seat><FixtureContent<Player> content={args.renderSeat} /></Table.Seat>
            <Table.Play />
            <Table.Center>{args.center}</Table.Center>
            <Table.Header>{args.header}</Table.Header>
            <Table.Dock>{args.dock}</Table.Dock>
          </Table>
        </ViewportFrame>
        <ViewportFrame data-measurement="after" viewport={size}>
          <Table {...tableRootProps({ ...args, viewport: size, players, slots: undefined, seats: seatsFor(players) })}>
            <Table.Seat><FixtureContent<Player> content={args.renderSeat} /></Table.Seat>
            <Table.Play><FixtureContent<Player> content={args.renderPlay} /></Table.Play>
            <Table.Center>{args.center}</Table.Center>
            <Table.Header>{args.header}</Table.Header>
            <Table.Dock>{args.dock}</Table.Dock>
          </Table>
        </ViewportFrame>
      </Row>
      );
    }))}
  </Matrix>,
  play: async ({ canvasElement }) => {
    const tables = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-measurement="after"] [data-ui="game-table"]'));
    const previousTables = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-measurement="before"] [data-ui="game-table"]'));
    await expect(tables).toHaveLength(18);
    const measurements = [];
    let index = 0;
    for (const [caseName, viewport] of Object.entries(VIEWPORTS)) for (const players of COUNTS) {
      const table = required(tables[index++]);
      const previous = required(previousTables[index - 1]);
      const expectedFit = 'fitted';
      await expectSeatFraming(previous, players, caseName, expectedFit);
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
      measurements.push({ caseName, players, fit: table.dataset.layoutFit,
        beforeSurface: [Number(previousSurface.width.toFixed(2)), Number(previousSurface.height.toFixed(2))],
        afterSurface: [Number(surface.width.toFixed(2)), Number(surface.height.toFixed(2))],
        seatOverhangs: radialMetrics(seats).map((metric) => metric.overhang),
        playRadii: radialMetrics(plays).map((metric) => metric.radius),
        beforeInset: Number((previousSurface.bottom - previousOwn.bottom).toFixed(2)),
        beforeFreeInnerRadius: Number(innerRadius(previousSeats, previousSurface).toFixed(2)),
        seatOutset: Number((own.bottom - surface.bottom).toFixed(2)),
        playRadius: Number(playRadius.toFixed(2)), freeInnerRadius: Number(innerRadius(plays, surface).toFixed(2)),
        seatInnerRadius: Number((seatRadius - own.height / 2).toFixed(2)), viewport });
      await expectSeatFraming(table, players, caseName, expectedFit);
      if (table.dataset.layoutFit === 'fitted') {
        await expect(own.bottom - surface.bottom, `${caseName}/${players} crosses felt border`).toBeGreaterThan(0.5);
        await expect(playRadius).toBeGreaterThan(0);
        await expect(playRadius).toBeLessThan(seatRadius);
      }
    }
    console.info('GAME_TABLE_PLAY_MEASUREMENTS', JSON.stringify(measurements));
  },
};

/** Compare legacy containment, edge-centred cards and cards outside the felt. */
export const SeatPlacementModes: Story = {
  name: 'Seat placement modes',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard, CARD_BACK_PATTERNS } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot, type GameTableProps as TableProps } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const MatrixRow = styled(Matrix)({ display: 'flex' });

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

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatsFor = (players: number) => players === 2 ? [SEATS[1], SEATS[2]] : SEATS.slice(0, players);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

const spanishSeat: RegionFixture<Player> = ((slot) => (
  <CardsRow>
    <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={\`\${slot.player?.name ?? 'Lugar libre'}: carta oculta\`} />
    <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={\`\${slot.player?.name ?? 'Lugar libre'}: segunda carta oculta\`} />
  </CardsRow>
));

const spanishPlay: GameTableProps<Player>['renderPlay'] = (_slot, index) => (
  index % 2 === 0
    ? <GameCard size="sm" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} label="as de oros" />
    : <GameCard size="sm" value={{ deck: 'spanish', suit: 'copas', rank: 10 }} label="sota de copas" />
);

export default function Example() {
  return (<MatrixRow>{COUNTS.map((players) => (['inside', 'edge', 'outside'] as const).map((seatPlacement) => (
  <ViewportFrame key={\`\${players}-\${seatPlacement}\`} data-placement-count={players} viewport={VIEWPORTS.portraitShort}>
    <Table players={players} seats={seatsFor(players)} seatPlacement={seatPlacement}>
    <Table.Seat><FixtureContent<Player> content={spanishSeat} /></Table.Seat>
    <Table.Play><FixtureContent<Player> content={spanishPlay} /></Table.Play>
    <Table.Center><span>Truco</span></Table.Center>
    <Table.Header>Truco</Table.Header>
    <Table.Dock><Button>Quiero</Button></Table.Dock>

  </Table>
  </ViewportFrame>
)))}</MatrixRow>);
}` } } },
  args: { players: 2, seats: seatsFor(2), renderSeat: spanishSeat, renderPlay: spanishPlay, center: <span>Truco</span>, header: 'Truco', dock: <Button>Quiero</Button> },
  render: (args) => <MatrixRow>
    {COUNTS.map((players) => (['inside', 'edge', 'outside'] as const).map((seatPlacement) => (
      <ViewportFrame key={`${players}-${seatPlacement}`} data-placement-count={players} viewport={args.viewport}>
        <Table {...tableRootProps({ ...args, players, slots: undefined, seats: seatsFor(players), seatPlacement })}>
          <Table.Seat><FixtureContent<Player> content={args.renderSeat} /></Table.Seat>
          <Table.Play><FixtureContent<Player> content={args.renderPlay} /></Table.Play>
          <Table.Center>{args.center}</Table.Center>
          <Table.Header>{args.header}</Table.Header>
          <Table.Dock>{args.dock}</Table.Dock>
        </Table>
      </ViewportFrame>
    )))}
  </MatrixRow>,
  play: async ({ canvasElement }) => {
    for (const table of canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]')) {
      const players = Number(table.closest<HTMLElement>('[data-placement-count]')?.dataset.placementCount);
      await expectSeatFraming(table, players, 'portraitShort');
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
const GENERAL_CASES = ['portraitShort', 'wideLarge'] as const;
const generalSeats = (count: number, teamCount: number): Player[] => Array.from({ length: count }, (_, index) => ({
  key: `player-${index}`, name: `P${index + 1}`, teamIdx: index % teamCount, isMe: index === count - 1,
}));

export const RoundRobinTeams: Story = {
  name: 'Round-robin teams',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
}

interface Player extends SeatLike { name: string }

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

const generalSeats = (count: number, teamCount: number): Player[] => Array.from({ length: count }, (_, index) => ({
  key: \`player-\${index}\`, name: \`P\${index + 1}\`, teamIdx: index % teamCount, isMe: index === count - 1,
}));

export default function Example() {
  return (<ViewportFrame viewport={VIEWPORTS.wideLarge}>
<Table players={9} seats={generalSeats(9, 3)} teamCount={3}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · 10 / 20</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
</ViewportFrame>);
}` } } },
  args: { players: 9, teamCount: 3, seats: generalSeats(9, 3), viewport: VIEWPORTS.wideLarge },
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(table, 9, 'wideLarge');
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
        await expect(buildBoardLayoutModel({ surface: 'match', totalSeats: count }).playerCount).toBe(count);
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
      await expect(() => buildBoardLayoutModel({ surface: 'match', totalSeats: count })).toThrow('integer seat count >= 2');
    }
    const freeForAll = buildAlternatingSlots(generalSeats(5, 1), 5, 'clockwise', 1);
    await expect(getTablePointSeatIndexes(freeForAll, 1)).toEqual({ bottomLeaderSeatIndex: 0, frontLeaderSeatIndex: -1 });
    const threeTeams = buildAlternatingSlots(generalSeats(9, 3), 9, 'clockwise', 3);
    await expect(getTablePointSeatIndexes(threeTeams, 3)).toEqual({ bottomLeaderSeatIndex: 0, frontLeaderSeatIndex: 4 });
  },
};

/** An arbitrary visual order and team numbers do not go through round-robin validation. */
export const ArbitraryPrebuiltTeams: Story = {
  name: 'Arbitrary prebuilt teams',
  parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

function FixtureContent<T extends SeatLike>({ content }: { content?: RegionFixture<T> }) {
  const { slot, index, geometry } = useGameTableSeat<T>();
  return content?.(slot, index, geometry);
}

interface Player extends SeatLike { name: string }

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

export default function Example() {
  return (<ViewportFrame viewport={VIEWPORTS.portraitShort}>
<Table players={3} seatSlots={[
    { key: 'third', teamIdx: 42, player: { key: 'c', name: 'Casey', teamIdx: 42 } },
    { key: 'first', teamIdx: 7, player: { key: 'a', name: 'Alex', teamIdx: 7 } },
    { key: 'empty', teamIdx: 99, player: null },
  ]}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · 10 / 20</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
</ViewportFrame>);
}` } } },
  args: { players: 3, seats: undefined, slots: [
    { key: 'third', teamIdx: 42, player: { key: 'c', name: 'Casey', teamIdx: 42 } },
    { key: 'first', teamIdx: 7, player: { key: 'a', name: 'Alex', teamIdx: 7 } },
    { key: 'empty', teamIdx: 99, player: null },
  ] },
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(table, 3, 'portraitShort');
    await expect(Array.from(table.querySelectorAll<HTMLElement>('[data-slot-team]'), (seat) => [seat.dataset.slotKey, seat.dataset.slotTeam]))
      .toEqual([['third', '42'], ['first', '7'], ['empty', '99']]);
  },
};

const generalCountMatrix = (seatPlacement: NonNullable<GameTableProps['seatPlacement']>, dir = 'ltr'): Story => ({

  args: { seatPlacement, dir, center: <span>Pot: 240</span>, renderPlay: spanishPlay },
  render: (args) => <Matrix>
    {GENERAL_CASES.map((caseName) => GENERAL_COUNTS.map((players) => (
      <ViewportFrame key={`${caseName}-${players}`} data-general-count={players} viewport={VIEWPORTS[caseName]}>
        <Table {...tableRootProps({ ...args, viewport: VIEWPORTS[caseName], players, teamCount: 3, slots: undefined, seats: generalSeats(players, 3) })}>
          <Table.Seat><FixtureContent<Player> content={args.renderSeat} /></Table.Seat>
          <Table.Play><FixtureContent<Player> content={args.renderPlay} /></Table.Play>
          <Table.Center>{args.center}</Table.Center>
          <Table.Header>{args.header}</Table.Header>
          <Table.Dock>{args.dock}</Table.Dock>
        </Table>
      </ViewportFrame>
    )))}
  </Matrix>,
  play: async ({ canvasElement }) => {
    const tables = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]'));
    await expect(tables).toHaveLength(GENERAL_CASES.length * GENERAL_COUNTS.length);
    const measurements = [];
    let index = 0;
    for (const caseName of GENERAL_CASES) for (const players of GENERAL_COUNTS) {
      const table = required(tables[index++]);
      const expectedFit = seatPlacement === 'inside' && caseName === 'portraitShort' && players === 9 ? 'insufficient-space' : 'fitted';
      await expectSeatFraming(table, players, caseName, expectedFit, true);
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
      await expect(freeInnerRadius, `${caseName}/${players} free inner radius`).toBeGreaterThan(0);
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
      measurements.push({ caseName, players, seatPlacement, fit: table.dataset.layoutFit,
        surface: [surface.width, surface.height], freeInnerRadius, minimumSeparation,
        scale: Number.parseFloat(getComputedStyle(table).getPropertyValue('--game-table-content-scale')) });
    }
    console.info('GAME_TABLE_GENERAL_MEASUREMENTS', JSON.stringify(measurements));
  },
});

/** Three round-robin teams, 2–9 places, and one played card per seat. */
export const GeneralSeatCounts = { name: 'General seat counts', ...generalCountMatrix('edge'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot, type GameTableProps as TableProps } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

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

interface Player extends SeatLike { name: string }

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

const spanishPlay: GameTableProps<Player>['renderPlay'] = (_slot, index) => (
  index % 2 === 0
    ? <GameCard size="sm" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} label="as de oros" />
    : <GameCard size="sm" value={{ deck: 'spanish', suit: 'copas', rank: 10 }} label="sota de copas" />
);

const GENERAL_COUNTS = [2, 3, 4, 5, 6, 7, 9] as const;

const GENERAL_CASES = ['portraitShort', 'wideLarge'] as const;

const generalSeats = (count: number, teamCount: number): Player[] => Array.from({ length: count }, (_, index) => ({
  key: \`player-\${index}\`, name: \`P\${index + 1}\`, teamIdx: index % teamCount, isMe: index === count - 1,
}));

export default function Example() {
  return (<Matrix>{GENERAL_CASES.map((caseName) => GENERAL_COUNTS.map((players) => (
  <ViewportFrame key={\`\${caseName}-\${players}\`} data-general-count={players} viewport={VIEWPORTS[caseName]}>
    <Table players={players} seats={generalSeats(players, 3)} teamCount={3} seatPlacement="edge" dir="ltr">
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play><FixtureContent<Player> content={spanishPlay} /></Table.Play>
    <Table.Center><span>Pot: 240</span></Table.Center>
    <Table.Header>Poker · 10 / 20</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ViewportFrame>
)))}</Matrix>);
}` } } } };
export const GeneralSeatCountsInside = { name: 'General seat counts · inside', ...generalCountMatrix('inside'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot, type GameTableProps as TableProps } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

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

interface Player extends SeatLike { name: string }

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

const spanishPlay: GameTableProps<Player>['renderPlay'] = (_slot, index) => (
  index % 2 === 0
    ? <GameCard size="sm" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} label="as de oros" />
    : <GameCard size="sm" value={{ deck: 'spanish', suit: 'copas', rank: 10 }} label="sota de copas" />
);

const GENERAL_COUNTS = [2, 3, 4, 5, 6, 7, 9] as const;

const GENERAL_CASES = ['portraitShort', 'wideLarge'] as const;

const generalSeats = (count: number, teamCount: number): Player[] => Array.from({ length: count }, (_, index) => ({
  key: \`player-\${index}\`, name: \`P\${index + 1}\`, teamIdx: index % teamCount, isMe: index === count - 1,
}));

export default function Example() {
  return (<Matrix>{GENERAL_CASES.map((caseName) => GENERAL_COUNTS.map((players) => (
  <ViewportFrame key={\`\${caseName}-\${players}\`} data-general-count={players} viewport={VIEWPORTS[caseName]}>
    <Table players={players} seats={generalSeats(players, 3)} teamCount={3} seatPlacement="inside" dir="ltr">
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play><FixtureContent<Player> content={spanishPlay} /></Table.Play>
    <Table.Center><span>Pot: 240</span></Table.Center>
    <Table.Header>Poker · 10 / 20</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ViewportFrame>
)))}</Matrix>);
}` } } } };
export const GeneralSeatCountsOutside = { name: 'General seat counts · outside', ...generalCountMatrix('outside'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot, type GameTableProps as TableProps } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

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

interface Player extends SeatLike { name: string }

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

const spanishPlay: GameTableProps<Player>['renderPlay'] = (_slot, index) => (
  index % 2 === 0
    ? <GameCard size="sm" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} label="as de oros" />
    : <GameCard size="sm" value={{ deck: 'spanish', suit: 'copas', rank: 10 }} label="sota de copas" />
);

const GENERAL_COUNTS = [2, 3, 4, 5, 6, 7, 9] as const;

const GENERAL_CASES = ['portraitShort', 'wideLarge'] as const;

const generalSeats = (count: number, teamCount: number): Player[] => Array.from({ length: count }, (_, index) => ({
  key: \`player-\${index}\`, name: \`P\${index + 1}\`, teamIdx: index % teamCount, isMe: index === count - 1,
}));

export default function Example() {
  return (<Matrix>{GENERAL_CASES.map((caseName) => GENERAL_COUNTS.map((players) => (
  <ViewportFrame key={\`\${caseName}-\${players}\`} data-general-count={players} viewport={VIEWPORTS[caseName]}>
    <Table players={players} seats={generalSeats(players, 3)} teamCount={3} seatPlacement="outside" dir="ltr">
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play><FixtureContent<Player> content={spanishPlay} /></Table.Play>
    <Table.Center><span>Pot: 240</span></Table.Center>
    <Table.Header>Poker · 10 / 20</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ViewportFrame>
)))}</Matrix>);
}` } } } };
export const GeneralSeatCountsRtl = { name: 'General seat counts · RTL', ...generalCountMatrix('edge', 'rtl'), parameters: { docs: { source: { language: "tsx", code: `import { type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot, type GameTableProps as TableProps } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const ViewportFrame = styled.div(viewportSize);

const SeatCards = styled.div({ position: 'relative', display: 'flex', gap: vars.space[1] });

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

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

interface Player extends SeatLike { name: string }

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const seatChrome = (slot: GameTableSlot<Player>) => (
  <SeatCards>
    <Table.SeatChrome>
      <span>{slot.player?.name ?? 'Open seat'}</span>
    </Table.SeatChrome>
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: first hidden card\`} />
    <GameCard size="sm" label={\`\${slot.player?.name ?? 'Open seat'}: second hidden card\`} />
  </SeatCards>
);

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);

const spanishPlay: GameTableProps<Player>['renderPlay'] = (_slot, index) => (
  index % 2 === 0
    ? <GameCard size="sm" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} label="as de oros" />
    : <GameCard size="sm" value={{ deck: 'spanish', suit: 'copas', rank: 10 }} label="sota de copas" />
);

const GENERAL_COUNTS = [2, 3, 4, 5, 6, 7, 9] as const;

const GENERAL_CASES = ['portraitShort', 'wideLarge'] as const;

const generalSeats = (count: number, teamCount: number): Player[] => Array.from({ length: count }, (_, index) => ({
  key: \`player-\${index}\`, name: \`P\${index + 1}\`, teamIdx: index % teamCount, isMe: index === count - 1,
}));

export default function Example() {
  return (<Matrix>{GENERAL_CASES.map((caseName) => GENERAL_COUNTS.map((players) => (
  <ViewportFrame key={\`\${caseName}-\${players}\`} data-general-count={players} viewport={VIEWPORTS[caseName]}>
    <Table players={players} seats={generalSeats(players, 3)} teamCount={3} seatPlacement="edge" dir="rtl">
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play><FixtureContent<Player> content={spanishPlay} /></Table.Play>
    <Table.Center><span>Pot: 240</span></Table.Center>
    <Table.Header>Poker · 10 / 20</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
  </ViewportFrame>
)))}</Matrix>);
}` } } } };

const POKER_BOARD = [
  { id: 'as', label: 'Ace of spades', value: { suit: 'spades', rank: 'A' } },
  { id: 'kh', label: 'King of hearts', value: { suit: 'hearts', rank: 'K' } },
  { id: 'qc', label: 'Queen of clubs', value: { suit: 'clubs', rank: 'Q' } },
  { id: 'jd', label: 'Jack of diamonds', value: { suit: 'diamonds', rank: 'J' } },
  { id: 'ts', label: 'Ten of spades', value: { suit: 'spades', rank: 10 } },
] as const;

function PokerTable() {
  // Low-level escape hatch: the board is not a hand or a seat pile, so this story launches its own
  // flight. It measures the endpoints it owns through refs; a board composition uses useBoardFlights.
  const deckRef = useRef<HTMLDivElement>(null);
  const boardRefs = useRef(new Map<string, HTMLDivElement>());
  const { launch, landingTargets } = useCardFlights();
  return <Table players={6} teamCount={1} seats={generalSeats(6, 1)}>
    <Table.Header>Texas Hold'em · 10 / 20</Table.Header>
    <Table.Seat><PokerSeat /></Table.Seat>
    <Table.Center><BoardCenter>
      <PotRow>
        <span>Pot: 240</span><div ref={deckRef} data-community-deck><GameCard size="sm" label="Deck" /></div>
      </PotRow>
      <CardsRow>
        {POKER_BOARD.map((card) => <div key={card.id} data-community-card={card.id} ref={(node) => {
          if (node) boardRefs.current.set(card.id, node); else boardRefs.current.delete(card.id);
        }}><GameCard size="sm" value={card.value} label={card.label} /></div>)}
      </CardsRow>
    </BoardCenter></Table.Center>
    <Table.Dock><Button disabled={landingTargets.size > 0} onClick={() => {
      const deck = deckRef.current;
      if (!deck) return;
      const from = measureCardBox(deck);
      launch(POKER_BOARD.flatMap((card, index) => {
        const destination = boardRefs.current.get(card.id);
        return destination ? [{ card, target: `community:${card.id}`, destination, from, to: measureCardBox(destination), face: 'reveal' as const,
          durationMs: motionDurationMs.cardDeal, delayMs: index * motionDurationMs.cardDealStagger }] : [];
      }));
    }}>Deal board</Button></Table.Dock>
  </Table>;
}

function PokerSeat() {
  const { player } = useGameTableSeat<Player>();
  return <PokerSeatContent data-poker-seat><span>{player?.name}</span><span>1,200 chips</span></PokerSeatContent>;
}

function PokerViewport({ viewport, caseName }: { viewport: ViewportSize; caseName: CaseName }) {
  return <FlightsViewport data-viewport-case={caseName} viewport={viewport}>
    <PokerTable />
  </FlightsViewport>;
}

function PokerFixture() {
  return <DeckProvider default="french"><Matrix>
    {(['portraitShort', 'portrait', 'wide', 'wideLarge'] as const).map((caseName) => <PokerViewport key={caseName} caseName={caseName}
      viewport={caseName === 'wide' ? { ...VIEWPORTS.wide, height: 480 } : VIEWPORTS[caseName]} />)}
  </Matrix></DeckProvider>;
}

/** Six free-for-all seats, five community cards and a pot. Press Deal board to replay the deal. */
export const PokerCommunityBoard: Story = {
  name: 'Poker community board',
  render: () => <PokerFixture />,
  parameters: { a11y: { test: 'error' }, ...{ docs: { source: { language: "tsx", code: `import { useRef, type ComponentProps, type ReactNode } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { DeckProvider } from '@jfrader/ui/deck';
import { CardFlightsProvider, measureCardBox, useCardFlights } from '@jfrader/ui/card-flights';
import { GameTable as Table, useGameTableSeat, type SeatLike, type BoardSeatGeometry, type GameTableSlot, type GameTableProps as TableProps } from '@jfrader/ui/game-table';

const viewportSize = ({ viewport }: { viewport: { width: number; height: number } }) => ({ inlineSize: viewport.width, blockSize: viewport.height });

const FlightsViewport = styled(({ viewport: _viewport, ...props }: { viewport: { width: number; height: number } } & ComponentProps<typeof CardFlightsProvider>) => <CardFlightsProvider {...props} />)(viewportSize);

const CardsRow = styled.div({ display: 'flex', gap: vars.space[1] });

const BoardCenter = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[2] });

const PotRow = styled.div({ display: 'flex', alignItems: 'center', gap: vars.space[2] });

const Matrix = styled.div({ inlineSize: 'max-content' });

const PokerSeatContent = styled.div({ display: 'grid', justifyItems: 'center' });

type RegionFixture<T extends SeatLike> = (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;

type GameTableProps<T extends SeatLike = SeatLike> = Omit<TableProps<T>, 'slots' | 'seatSlots'> & {
  slots?: readonly GameTableSlot<T>[];
  renderSeat: RegionFixture<T>;
  renderPlay?: RegionFixture<T>;
  header?: ReactNode; center?: ReactNode; dock?: ReactNode; footer?: ReactNode; floating?: ReactNode;
};

interface Player extends SeatLike { name: string }

const VIEWPORTS = {
  portraitShort: { width: 412, height: 816 },
  portrait: { width: 390, height: 844 },
  wide: { width: 840, height: 360 },
  square: { width: 834, height: 1112 },
  squareWide: { width: 1000, height: 900 },
  wideLarge: { width: 1440, height: 900 },
} satisfies Record<string, { width: number; height: number }>;

const center = (
  <BoardCenter>
    <span>Pot: 240</span>
    <CardsRow>
      <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
      <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
      <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
    </CardsRow>
  </BoardCenter>
);
import { base } from '@jfrader/tokens';

const motionDurationMs = {
  cardDeal: Number.parseFloat(base.motion.duration.cardDeal),
  cardDealStagger: Number.parseFloat(base.motion.duration.cardDealStagger),
};

const generalSeats = (count: number, teamCount: number): Player[] => Array.from({ length: count }, (_, index) => ({
  key: \`player-\${index}\`, name: \`P\${index + 1}\`, teamIdx: index % teamCount, isMe: index === count - 1,
}));

const POKER_BOARD = [
  { id: 'as', label: 'Ace of spades', value: { suit: 'spades', rank: 'A' } },
  { id: 'kh', label: 'King of hearts', value: { suit: 'hearts', rank: 'K' } },
  { id: 'qc', label: 'Queen of clubs', value: { suit: 'clubs', rank: 'Q' } },
  { id: 'jd', label: 'Jack of diamonds', value: { suit: 'diamonds', rank: 'J' } },
  { id: 'ts', label: 'Ten of spades', value: { suit: 'spades', rank: 10 } },
] as const;

function PokerTable() {
  // Low-level escape hatch: the board is not a hand or a seat pile, so this story launches its own
  // flight. It measures the endpoints it owns through refs; a board composition uses useBoardFlights.
  const deckRef = useRef<HTMLDivElement>(null);
  const boardRefs = useRef(new Map<string, HTMLDivElement>());
  const { launch, landingTargets } = useCardFlights();
  return <Table players={6} teamCount={1} seats={generalSeats(6, 1)}>
    <Table.Header>Texas Hold'em · 10 / 20</Table.Header>
    <Table.Seat><PokerSeat /></Table.Seat>
    <Table.Center><BoardCenter>
      <PotRow>
        <span>Pot: 240</span><div ref={deckRef} data-community-deck><GameCard size="sm" label="Deck" /></div>
      </PotRow>
      <CardsRow>
        {POKER_BOARD.map((card) => <div key={card.id} data-community-card={card.id} ref={(node) => {
          if (node) boardRefs.current.set(card.id, node); else boardRefs.current.delete(card.id);
        }}><GameCard size="sm" value={card.value} label={card.label} /></div>)}
      </CardsRow>
    </BoardCenter></Table.Center>
    <Table.Dock><Button disabled={landingTargets.size > 0} onClick={() => {
      const deck = deckRef.current;
      if (!deck) return;
      const from = measureCardBox(deck);
      launch(POKER_BOARD.flatMap((card, index) => {
        const destination = boardRefs.current.get(card.id);
        return destination ? [{ card, target: \`community:\${card.id}\`, destination, from, to: measureCardBox(destination), face: 'reveal' as const,
          durationMs: motionDurationMs.cardDeal, delayMs: index * motionDurationMs.cardDealStagger }] : [];
      }));
    }}>Deal board</Button></Table.Dock>
  </Table>;
}

function PokerSeat() {
  const { player } = useGameTableSeat<Player>();
  return <PokerSeatContent data-poker-seat><span>{player?.name}</span><span>1,200 chips</span></PokerSeatContent>;
}

function PokerViewport({ viewport }: { viewport: ViewportSize }) {
  return <FlightsViewport viewport={viewport}>
    <PokerTable />
  </FlightsViewport>;
}

function PokerFixture() {
  return <DeckProvider default="french"><Matrix>
    {(['portraitShort', 'portrait', 'wide', 'wideLarge'] as const).map((caseName) => <PokerViewport key={caseName}
      viewport={caseName === 'wide' ? { ...VIEWPORTS.wide, height: 480 } : VIEWPORTS[caseName]} />)}
  </Matrix></DeckProvider>;
}

export default function Example() {
  return (<PokerFixture />);
}` } } } },
  play: async ({ canvasElement, userEvent }) => {
    const tables = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]'));
    await expect(tables).toHaveLength(4);
    for (const table of tables) {
      const caseName = (table.closest('[data-viewport-case]') as HTMLElement).dataset.viewportCase as CaseName;
      await expectSeatFraming(table, 6, caseName);
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
