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
  GameTable as Table, useGameTableSeat, buildAlternatingSlots, buildTableOrderSlots,
  getTablePointSeatIndexes, resolveTableTurnDirection,
  type GameTableProps as TableProps, type BoardSeatGeometry, type SeatLike,
  type GameTableSlot, type GameTableRootProps,
} from './index';
import { REFERENCE_SLOT_KEYS } from './reference-fixtures';
import { buildBoardLayoutModel } from './layout-model';
import { fitBoardContent, GAME_TABLE_LIMITS, type BoardMeasurements } from './fit-layout';
import { regionSize } from './use-board-measurements';
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
const DecorativeFan = styled.div({ position: 'absolute', inset: 0, pointerEvents: 'none' });
const MeasuredCardControl = styled.button({ display: 'block', inlineSize: 'max-content', blockSize: 'max-content', padding: 0, border: 0, background: 'none' });
const ResponsiveFrame = styled.div({ inlineSize: '100%', blockSize: 720 });
const CompactFrame = styled.div({ inlineSize: '100%', blockSize: 320 });
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
  return { ...props, places: props.places ?? props.players ?? NaN, ...(slots ? { seatSlots: slots } : { seats: seats ?? [] }) };
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
      <Table places={2} seats={SEATS.slice(0, 2)}
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
            sx: { fontStyle: 'italic' }, ref: (node) => {
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

async function expectPlayInsideEllipse(play: Element, surface: Element) {
  const box = play.getBoundingClientRect();
  const felt = surface.getBoundingClientRect();
  for (const x of [box.left, box.right]) for (const y of [box.top, box.bottom]) {
    await expect(Math.hypot((x - felt.left - felt.width / 2) / (felt.width / 2),
      (y - felt.top - felt.height / 2) / (felt.height / 2)), 'play corner inside felt ellipse').toBeLessThanOrEqual(1);
  }
}

async function expectSeatFraming(table: HTMLElement, players: number, caseName: string, expectedFit: 'fitted' | 'scaled' | 'insufficient-space' = 'fitted', checkInsufficientGeometry = false) {
  await table.ownerDocument.fonts.ready;
  await waitFor(() => expect(table).toHaveAttribute('data-layout-fit', expectedFit));
  const preferredScale = Number.parseFloat(getComputedStyle(table).getPropertyValue('--game-table-content-scale'));
  if (expectedFit === 'fitted') await expect(preferredScale).toBe(1);
  if (expectedFit === 'scaled') {
    await expect(preferredScale).toBeGreaterThan(0);
    await expect(preferredScale).toBeLessThan(1);
  }
  for (const card of table.querySelectorAll<HTMLElement>('[data-ui~="game-card"]')) {
    const box = card.getBoundingClientRect();
    await expect(Math.min(box.width, box.height)).toBeGreaterThan(0);
  }
  for (const control of table.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')) {
    if (control.closest('[data-ui="game-table-seat-chrome"]')) continue;
    const box = control.getBoundingClientRect();
    await expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24 - GEOMETRY_TOLERANCE_PX);
    await expect(Math.max(box.width, box.height)).toBeGreaterThanOrEqual(32 - GEOMETRY_TOLERANCE_PX);
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
    await expectPlayInsideEllipse(play, surface);
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
    places: 6, seats: SEATS, viewport: VIEWPORTS.portraitShort,
    renderSeat, center, header: 'Poker · 10 / 20', dock: <Button>Check</Button>,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: { component: 'Arrange players around a game surface. Add cards, controls and floating content to named regions.' },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Seats and plays', stories: ['PrebuiltSlotsAndEmptyPlaces'] },
        { title: 'Layout', stories: ['SeatPlacementModes'] },
        { title: 'Interactions', stories: ['PokerCommunityBoard'] },
        { title: 'States', stories: ['Lobby'] },
        { title: 'Composition', stories: ['WithAvatars'] },
      ],
      usage: `### When to use
Use GameTable to arrange players, played cards, community cards, and game actions around an oval or circular playing surface. For standalone card displays or single hands without a table, use GameHand or GameCardStack directly.

### Values and constraints

Give the parent container explicit inline and block sizes. GameTable measures its container using container queries and ResizeObserver rather than the browser viewport. The parent is the only size cap; the felt, dock, and footer have no private maximum dimensions.

Keep seat and region content in normal document flow so ResizeObserver can measure footprints accurately; absolute elements must reserve their footprint in a parent wrapper. Interactive controls preserve a minimum footprint of 24px on both axes (32px on the primary axis).

Use at least two places with unique player and slot keys. Team assignments must fit the available places. Keep player chrome concise: it does not reserve layout space. If control minimum sizes cannot fit, overflow or collisions may remain; give the parent more space or reduce the composition. Do not scale measured child sizes a second time.

\`places\` counts occupied and empty places. The deprecated \`players\` alias remains for one release; \`places\` wins when both are passed. Card sizes are preferences and may scale below \`sm\`; only interactive controls impose size floors. \`data-layout-fit\` is \`measuring\` before measurement, \`fitted\` at preferred sizes, \`scaled\` when content shrinks, or \`insufficient-space\` when floors cannot fit. Play rectangles stay inside the felt ellipse, including with outside seats.

### Keyboard and accessibility

GameTable provides passive layout and adds no custom roles, landmarks, focus traps, or roving tabindex. Supply accessible names for all seats, cards, and buttons. Interactive controls retain their native semantics and natural Tab order. Floating content stays local to the table; it is not a modal dialog.`,
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
  return <Frame><GameTable places={6} seats={[]}>
    <GameTable.Header>Poker</GameTable.Header>
    <GameTable.Seat />
    <GameTable.Center>Pot: 240</GameTable.Center>
  </GameTable></Frame>;
}` } } },
  render: () => <Matrix>
    {ASPECT_CASES.map(({ viewport: size, players }) => ASPECT_MODES.map(({ surface, dir }) => (
      <ViewportFrame key={`${size.width}-${players}-${surface}-${dir}`} viewport={size}
        data-aspect-width={size.width} data-aspect-height={size.height} data-aspect-players={players}>
        <Table places={players} seats={seatsFor(players)} surface={surface} dir={dir}>
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
      const expectedFit = width === 260 ? 'scaled' : 'fitted';
      await expectSeatFraming(table, players, `${width}/${height}`, expectedFit);
      const container = required(table.querySelector<HTMLElement>('[data-ui="game-table-frame-container"]') ?? undefined);
      await expect(getComputedStyle(container).containerType).toBe('size');
      const surface = required(table.querySelector<HTMLElement>('[data-game-surface]') ?? undefined);
      await expect(getComputedStyle(surface).borderRadius).toBe('50%');
      if (table.dataset.surface === 'lobby' && width / height >= 1.3) {
        const box = surface.getBoundingClientRect();
        await expect(box.width).toBeGreaterThan(box.height);
        await expect(getComputedStyle(surface).maxInlineSize).toBe('none');
      }
      if (!short && expectedFit === 'fitted' && table.dataset.surface === 'match') await expectMirroredDirection(table, '[data-ui="game-table-seat"]');
    }
  },
};

export const Default: Story = {
  name: 'Poker table',
  parameters: { docs: {
    description: { story: 'Show six players with hidden cards, community cards and a check action.' },
    source: { language: 'tsx', code: `import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable, useGameTableSeat, type SeatLike } from '@jfrader/ui/game-table';

const Frame = styled.div({
  inlineSize: 412,
  blockSize: 816,
});

const SeatCards = styled.div({
  position: 'relative',
  display: 'flex',
  gap: vars.space[1],
});

const CenterContent = styled.div({
  display: 'grid',
  justifyItems: 'center',
  gap: vars.space[2],
});

const CommunityCards = styled.div({
  display: 'flex',
  gap: vars.space[1],
});

interface Player extends SeatLike {
  name: string;
}

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
  const name = player?.name ?? 'Open seat';

  return (
    <SeatCards>
      <GameTable.SeatChrome>
        <span>{name}</span>
      </GameTable.SeatChrome>
      <GameCard size="sm" label={\`\${name}: first hidden card\`} />
      <GameCard size="sm" label={\`\${name}: second hidden card\`} />
    </SeatCards>
  );
}

export default function Example() {
  return (
    <Frame>
      <GameTable places={6} seats={players}>
        <GameTable.Header>Poker · 10 / 20</GameTable.Header>
        <GameTable.Seat>
          <SeatContent />
        </GameTable.Seat>
        <GameTable.Play />
        <GameTable.Center>
          <CenterContent>
            <span>Pot: 240</span>
            <CommunityCards>
              <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
              <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
              <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
            </CommunityCards>
          </CenterContent>
        </GameTable.Center>
        <GameTable.Dock>
          <Button>Check</Button>
        </GameTable.Dock>
      </GameTable>
    </Frame>
  );
}` },
  } },
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

function FourPlaceTable() {
  return <Table places={4} seats={seatsFor(4)}>
    <Table.Header>Truco</Table.Header>
    <Table.Seat><GameCard size="sm" label="Hidden card" /></Table.Seat>
    <Table.Play><GameCard size="lg" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} /></Table.Play>
    <Table.Center>Round 1</Table.Center>
    <Table.Footer>Team 1 · 12 — Team 2 · 8</Table.Footer>
    <Table.Dock><Button>Check</Button></Table.Dock>
  </Table>;
}

async function expectFourPlays(table: HTMLElement, expectedFit: 'fitted' | 'scaled') {
  await waitFor(() => expect(table).toHaveAttribute('data-layout-fit', expectedFit));
  const plays = [...table.querySelectorAll<HTMLElement>('[data-ui="game-table-play"]')];
  await expect(plays).toHaveLength(4);
  const felt = required(table.querySelector('[data-game-surface]') ?? undefined);
  for (const play of plays) await expectPlayInsideEllipse(play, felt);
  const regions = [...table.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"], [data-ui="game-table-play"], [data-ui="game-table-center"]')];
  for (const [index, region] of regions.entries()) {
    await expectInside(region, table);
    for (const other of regions.slice(index + 1)) await expectNoOverlap(region, other, { tolerancePx: 0.1 });
  }
  const root = table.getBoundingClientRect();
  const frameStyle = getComputedStyle(required(table.querySelector<HTMLElement>('[data-ui="game-table-frame"]') ?? undefined));
  const frameWidth = root.width - Number.parseFloat(frameStyle.paddingInlineStart) - Number.parseFloat(frameStyle.paddingInlineEnd);
  for (const marker of ['dock', 'footer']) {
    const strip = required(table.querySelector<HTMLElement>(`[data-ui="game-table-${marker}"]`) ?? undefined);
    await expect(strip.getBoundingClientRect().width).toBeCloseTo(frameWidth, 1);
  }
  for (const control of table.querySelectorAll('button')) {
    const box = control.getBoundingClientRect();
    await expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24);
    await expect(Math.max(box.width, box.height)).toBeGreaterThanOrEqual(32);
  }
}

/** Four places use preferred sizes at 768px and 1440px; cards scale down on a 390px phone. */
export const ResponsiveFourPlaces: Story = {
  tags: ['!autodocs'],
  name: 'Responsive four places',
  args: { places: 4, seats: seatsFor(4) },
  parameters: { docs: { source: { language: 'tsx', code: `import { Button, styled } from '@jfrader/ui';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable } from '@jfrader/ui/game-table';

const Frame = styled.div({ inlineSize: '100%', blockSize: 720 });
const seats = [{ key: 'you', isMe: true }, { key: 'alex' }, { key: 'blair' }, { key: 'drew' }];

export default function Example() {
  return <Frame><GameTable places={4} seats={seats}>
    <GameTable.Header>Truco</GameTable.Header>
    <GameTable.Seat><GameCard size="sm" label="Hidden card" /></GameTable.Seat>
    <GameTable.Play><GameCard size="lg" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} /></GameTable.Play>
    <GameTable.Center>Round 1</GameTable.Center>
    <GameTable.Footer>Team 1 · 12 — Team 2 · 8</GameTable.Footer>
    <GameTable.Dock><Button>Check</Button></GameTable.Dock>
  </GameTable></Frame>;
}` } } },
  render: () => <ResponsiveFrame><FourPlaceTable /></ResponsiveFrame>,
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectFourPlays(table, table.ownerDocument.defaultView!.innerWidth <= 390 ? 'scaled' : 'fitted');
    await expectMirroredDirection(table, '[data-ui="game-table-play"]');
    await expect(table.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(table.ownerDocument.documentElement.clientWidth);
  },
};

/** The same four plays in a short container; preferred cards shrink below sm. */
export const CompactFourPlays: Story = {
  tags: ['!autodocs'],
  args: { places: 4, seats: seatsFor(4) },
  parameters: { docs: { source: { language: 'tsx', code: `import { Button, styled } from '@jfrader/ui';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable } from '@jfrader/ui/game-table';

const Frame = styled.div({ inlineSize: '100%', blockSize: 320 });
const seats = [{ key: 'you', isMe: true }, { key: 'alex' }, { key: 'blair' }, { key: 'drew' }];

export default function Example() {
  return <Frame><GameTable places={4} seats={seats}>
    <GameTable.Header>Truco</GameTable.Header>
    <GameTable.Seat><GameCard size="sm" label="Hidden card" /></GameTable.Seat>
    <GameTable.Play><GameCard size="lg" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} /></GameTable.Play>
    <GameTable.Center>Round 1</GameTable.Center>
    <GameTable.Footer>Team 1 · 12 — Team 2 · 8</GameTable.Footer>
    <GameTable.Dock><Button>Check</Button></GameTable.Dock>
  </GameTable></Frame>;
}` } } },
  render: () => <CompactFrame><FourPlaceTable /></CompactFrame>,
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectFourPlays(table, 'scaled');
    await expect(table).toHaveAttribute('data-layout-fit', 'scaled');
    await expect(table.querySelector('[data-game-surface]')).toHaveAttribute('data-layout-fit', 'scaled');
    const card = required(table.querySelector<HTMLElement>('[data-ui="game-table-play"] [data-ui="game-card"]') ?? undefined);
    await expect(card.getBoundingClientRect().width).toBeLessThan(32);
  },
};

export const FourPlayContainerMatrix: Story = {
  tags: ['!autodocs'],
  render: () => <MatrixGrid>{[390, 768, 1440].map((width) => <ViewportFrame key={width} viewport={{ width, height: 900 }}><FourPlaceTable /></ViewportFrame>)}</MatrixGrid>,
  play: async ({ canvasElement }) => {
    const tables = [...canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]')];
    await expect(tables).toHaveLength(3);
    for (const table of tables) {
      await expectFourPlays(table, table.getBoundingClientRect().width === 390 ? 'scaled' : 'fitted');
      await expectMirroredDirection(table, '[data-ui="game-table-play"]');
    }
    const surfaces = tables.map((table) => required(table.querySelector('[data-game-surface]') ?? undefined).getBoundingClientRect());
    await expect(required(surfaces[2]).width).toBeGreaterThan(1000);
    await expect(required(surfaces[2]).width).toBeGreaterThan(required(surfaces[1]).width);
    await expect(required(surfaces[2]).height).toBeGreaterThan(608);
  },
};

export const PlayEllipseContainment: Story = {
  tags: ['!autodocs'],
  render: () => <MatrixGrid>{([{ places: 6, placement: 'outside' }, { places: 4, placement: 'edge' }] as const).map(({ places, placement }) =>
    <ViewportFrame key={placement} viewport={{ width: 768, height: 600 }}>
      <Table places={places} seatPlacement={placement} seats={seatsFor(places)}>
        <Table.Seat><GameCard size="sm" label="Hidden card" /></Table.Seat>
        <Table.Play><GameCard size="md" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} /></Table.Play>
        <Table.Center>Round 1</Table.Center>
      </Table>
    </ViewportFrame>)}</MatrixGrid>,
  play: async ({ canvasElement }) => {
    for (const [places, placement] of [[6, 'outside'], [4, 'edge']] as const) {
      const measurement: BoardMeasurements = {
        width: 600, height: 400, centerX: 300, centerY: 200, seatPlacement: placement,
        available: { left: 420, right: 420, top: 320, bottom: 320 },
        seats: Array.from({ length: places }, () => ({ width: 80, height: 70 })),
        plays: Array.from({ length: places }, () => ({ width: 80, height: 100 })),
        center: { width: 60, height: 30 }, gap: 8, minimumScale: 0,
      };
      const fitted = fitBoardContent(measurement);
      await expect(fitted.fits).toBe(true);
      await expect(fitted.scale).toBe(1);
      for (const play of fitted.positions) for (const dx of [-40, 40]) for (const dy of [-50, 50]) {
        await expect(Math.hypot((play.playX + dx) / 300, (play.playY + dy) / 200)).toBeLessThanOrEqual(1);
      }
      const table = required(canvasElement.querySelector<HTMLElement>(`[data-ui="game-table"][data-seat-placement="${placement}"]`) ?? undefined);
      await expectSeatFraming(table, places, 'ellipse containment', 'fitted');
      await expectMirroredDirection(table, '[data-ui="game-table-play"]');
    }
  },
};

export const PlaceCountCompatibility: Story = {
  tags: ['!autodocs'],
  render: () => <>
    <ViewportFrame viewport={{ width: 390, height: 300 }}><Table players={2} seats={[]} /></ViewportFrame>
    <ViewportFrame viewport={{ width: 390, height: 300 }}><Table places={4} players={2} seats={[]} /></ViewportFrame>
  </>,
  play: async ({ canvasElement }) => {
    const tables = [...canvasElement.querySelectorAll('[data-ui="game-table"]')];
    await expect(required(tables[0]).querySelectorAll('[data-ui="game-table-seat"]')).toHaveLength(2);
    await expect(required(tables[1]).querySelectorAll('[data-ui="game-table-seat"]')).toHaveLength(4);
    for (const table of tables) {
      await expect(table).not.toHaveAttribute('players');
      await expect(table).not.toHaveAttribute('places');
    }
  },
};

function DecorativeFanFixture() {
  const [decorated, setDecorated] = useState(false);
  return <>
    <Button onClick={() => setDecorated((value) => !value)}>Toggle decorative fan</Button>
    <MatrixGrid>{[260, 390].map((width) => <ViewportFrame key={width} viewport={{ width, height: 480 }}>
      <Table places={2} seats={seatsFor(2)}>
        <Table.Seat>
          <MeasuredCardControl type="button" aria-label="Inspect hand card"><GameCard size="md" label="Hand card" /></MeasuredCardControl>
          {decorated && <DecorativeFan aria-hidden="true" data-decorative-fan="true">
            <CardsRow>{[0, 1, 2].map((index) => <GameCard key={index} size="sm" label="Decorative card" />)}</CardsRow>
          </DecorativeFan>}
        </Table.Seat>
        <Table.Play><GameCard size="md" label="Played card" value={{ deck: 'french', suit: 'spades', rank: 'A' }} /></Table.Play>
        <Table.Center>Round 1</Table.Center>
      </Table>
    </ViewportFrame>)}</MatrixGrid>
  </>;
}

export const DecorativeFanMeasurement: Story = {
  tags: ['!autodocs'],
  render: () => <DecorativeFanFixture />,
  play: async ({ canvasElement, userEvent }) => {
    const tables = [...canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-table"]')];
    await expect(tables).toHaveLength(2);
    const snapshot = (table: HTMLElement) => {
      const root = table.getBoundingClientRect();
      const surface = required(table.querySelector<HTMLElement>('[data-game-surface]') ?? undefined).getBoundingClientRect();
      const shell = required(table.querySelector<HTMLElement>('[data-ui="game-table-shell"]') ?? undefined);
      return {
        fit: table.dataset.layoutFit, scale: table.style.getPropertyValue('--game-table-content-scale'),
        reserveInline: shell.style.getPropertyValue('--game-table-reserve-inline'),
        reserveBlock: shell.style.getPropertyValue('--game-table-reserve-block'),
        surface: { x: surface.x - root.x, y: surface.y - root.y, width: surface.width, height: surface.height },
        regions: [...table.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"], [data-ui="game-table-play"]')].map((region) => ({
          size: regionSize(region), style: region.getAttribute('style'),
        })),
      };
    };
    for (const table of tables) {
      await expectSeatFraming(table, 2, 'decorative fan baseline', 'scaled');
      for (const seat of table.querySelectorAll<HTMLElement>('[data-ui="game-table-seat"]')) {
        await expect(regionSize(seat).minimumScale).toBe(24 / 72);
      }
      for (const play of table.querySelectorAll<HTMLElement>('[data-ui="game-table-play"]')) {
        await expect(regionSize(play).minimumScale).toBe(0);
      }
    }
    const baseline = tables.map(snapshot);
    const toggle = within(canvasElement).getByRole('button', { name: 'Toggle decorative fan' });
    for (const expectedCards of [12, 0]) {
      await userEvent.click(toggle);
      await expect(canvasElement.querySelectorAll('[data-decorative-fan] [data-ui~="game-card"]')).toHaveLength(expectedCards);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      for (const [index, table] of tables.entries()) {
        await expectSeatFraming(table, 2, 'decorative fan unchanged', 'scaled');
        await expect(snapshot(table)).toEqual(required(baseline[index]));
      }
    }
  },
};

export const ControlFloorFailure: Story = {
  tags: ['!autodocs'],
  render: () => <ViewportFrame viewport={{ width: 80, height: 100 }}>
    <Table places={2} seats={[]} clearance={80}>
      <Table.Center><Button>Start round</Button></Table.Center>
    </Table>
  </ViewportFrame>,
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expectSeatFraming(table, 2, 'control floor', 'insufficient-space');
    await expect(table).toHaveAttribute('data-clearance', 'reduced');
    await expect(getComputedStyle(table).overflowX).toBe('visible');
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
    await expect(getComputedStyle(required(table.querySelector('[data-game-surface]') ?? undefined)).maxInlineSize).toBe('none');
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
          <Table {...tableRootProps({ ...args, clearance: 32, slots: undefined, places: players, seats: seatsFor(players) })}>
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
    <Table places={players} seats={seatsFor(players)} clearance={32}>
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
    <Table places={players} seats={seatsFor(players)} clearance={32}>
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
    <Table places={players} seats={seatsFor(players)} clearance={32}>
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
    <Table places={players} seats={seatsFor(players)} clearance={32}>
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
    <Table places={players} seats={seatsFor(players)} clearance={32}>
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
    <Table places={players} seats={seatsFor(players)} clearance={32}>
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
    <Table places={players} seats={seatsFor(players)} clearance={32}>
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
    <Table places={players} seats={seatsFor(players)} clearance={32}>
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
    <Table places={players} seats={seatsFor(players)} clearance={32}>
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
    <Table places={players} seats={seatsFor(players)} clearance={32}>
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
    <Table places={players} seats={seatsFor(players)} clearance={32}>
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
    <Table places={players} seats={seatsFor(players)} clearance={32}>
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
      }
    }
  },
};

export const PrebuiltSlotsAndEmptyPlaces: Story = {
  name: 'Prebuilt slots and empty places',
  parameters: { docs: {
    description: { story: 'Reserve five open places around a table with one seated player.' },
    source: { language: 'tsx', code: `import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable, buildAlternatingSlots, useGameTableSeat, type SeatLike } from '@jfrader/ui/game-table';

const Frame = styled.div({
  inlineSize: 412,
  blockSize: 816,
});

const SeatCards = styled.div({
  position: 'relative',
  display: 'flex',
  gap: vars.space[1],
});

const CenterContent = styled.div({
  display: 'grid',
  justifyItems: 'center',
  gap: vars.space[2],
});

const CommunityCards = styled.div({
  display: 'flex',
  gap: vars.space[1],
});

interface Player extends SeatLike {
  name: string;
}

const seatedPlayer: Player = {
  key: 'you',
  name: 'You',
  teamIdx: 0,
  isMe: true,
};

const prebuiltSlots = buildAlternatingSlots([seatedPlayer], 6, 'clockwise');

function SeatContent() {
  const { player } = useGameTableSeat<Player>();
  const name = player?.name ?? 'Open seat';

  return (
    <SeatCards>
      <GameTable.SeatChrome>
        <span>{name}</span>
      </GameTable.SeatChrome>
      <GameCard size="sm" label={\`\${name}: first hidden card\`} />
      <GameCard size="sm" label={\`\${name}: second hidden card\`} />
    </SeatCards>
  );
}

export default function Example() {
  return (
    <Frame>
      <GameTable places={6} seatSlots={prebuiltSlots}>
        <GameTable.Header>Poker · 10 / 20</GameTable.Header>
        <GameTable.Seat>
          <SeatContent />
        </GameTable.Seat>
        <GameTable.Play />
        <GameTable.Center>
          <CenterContent>
            <span>Pot: 240</span>
            <CommunityCards>
              <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
              <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
              <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
            </CommunityCards>
          </CenterContent>
        </GameTable.Center>
        <GameTable.Dock>
          <Button>Check</Button>
        </GameTable.Dock>
      </GameTable>
    </Frame>
  );
}` },
  } },
  args: { seats: undefined, slots: buildAlternatingSlots([SEATS[2]], 6, 'clockwise') },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="game-table-seat"]')).toHaveLength(6);
    await expect(within(canvasElement).getAllByText('Open seat')).toHaveLength(5);
    await expect(canvasElement.querySelectorAll('[data-seat-hidden-card]')).toHaveLength(0);
  },
};

export const Lobby: Story = {
  name: 'Lobby surface',
  args: { surface: 'lobby', places: 4, seats: seatsFor(4) },
  parameters: { docs: {
    description: { story: 'Arrange four players around a lobby surface.' },
    source: { language: 'tsx', code: `import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable, useGameTableSeat, type SeatLike } from '@jfrader/ui/game-table';

const Frame = styled.div({
  inlineSize: 412,
  blockSize: 816,
});

const SeatCards = styled.div({
  position: 'relative',
  display: 'flex',
  gap: vars.space[1],
});

const CenterContent = styled.div({
  display: 'grid',
  justifyItems: 'center',
  gap: vars.space[2],
});

const CommunityCards = styled.div({
  display: 'flex',
  gap: vars.space[1],
});

interface Player extends SeatLike {
  name: string;
}

const players: Player[] = [
  { key: 'alex', name: 'Alex', teamIdx: 0 },
  { key: 'blair', name: 'Blair', teamIdx: 1 },
  { key: 'you', name: 'You', teamIdx: 0, isMe: true },
  { key: 'drew', name: 'Drew', teamIdx: 1 },
];

function SeatContent() {
  const { player } = useGameTableSeat<Player>();
  const name = player?.name ?? 'Open seat';

  return (
    <SeatCards>
      <GameTable.SeatChrome>
        <span>{name}</span>
      </GameTable.SeatChrome>
      <GameCard size="sm" label={\`\${name}: first hidden card\`} />
      <GameCard size="sm" label={\`\${name}: second hidden card\`} />
    </SeatCards>
  );
}

export default function Example() {
  return (
    <Frame>
      <GameTable places={4} seats={players} surface="lobby">
        <GameTable.Header>Poker · 10 / 20</GameTable.Header>
        <GameTable.Seat>
          <SeatContent />
        </GameTable.Seat>
        <GameTable.Play />
        <GameTable.Center>
          <CenterContent>
            <span>Pot: 240</span>
            <CommunityCards>
              <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
              <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
              <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
            </CommunityCards>
          </CenterContent>
        </GameTable.Center>
        <GameTable.Dock>
          <Button>Check</Button>
        </GameTable.Dock>
      </GameTable>
    </Frame>
  );
}` },
  } },
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
<Table places={6} seats={SEATS} surface="lobby">
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
    await expect(surface.width).toBeGreaterThan(surface.height);
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
<Table places={6} seats={SEATS} dir="rtl">
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
    <Table places={6} seats={SEATS} dir={dir}>
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
    const fourPlayParentWidth = 390;
    const fourPlayMeasurement: BoardMeasurements = {
      width: 300, height: 300, centerX: 150, centerY: 150,
      seatPlacement: 'edge', surfaceBorderBox: { width: 300, height: 300 },
      available: { left: fourPlayParentWidth / 2, right: fourPlayParentWidth / 2, top: 195, bottom: 195 },
      seats: Array.from({ length: 4 }, () => ({ width: 32, height: 47 })),
      plays: Array.from({ length: 4 }, () => ({ width: 106.7, height: 135 })),
      center: { width: 50, height: 20 }, gap: 8, minimumScale: 0,
    };
    const fourPlay = buildBoardLayoutModel({ surface: 'match', totalSeats: 4, measurement: fourPlayMeasurement });
    await expect(fourPlay.fit).toBe('scaled');
    const fittedFourPlay = fitBoardContent(fourPlayMeasurement);
    await expect(fittedFourPlay.fits).toBe(true);
    const boxes = fittedFourPlay.positions.map((point) => ({
      x: point.playX, y: point.playY, width: 106.7 * point.playScale, height: 135 * point.playScale,
    }));
    for (const [index, box] of boxes.entries()) for (const other of boxes.slice(index + 1)) {
      await expect(Math.abs(box.x - other.x) >= (box.width + other.width) / 2 + 8 - 0.01 ||
        Math.abs(box.y - other.y) >= (box.height + other.height) / 2 + 8 - 0.01).toBe(true);
    }
    await expect(fitBoardContent({ ...fourPlayMeasurement,
      plays: fourPlayMeasurement.plays!.map((play) => ({ ...play, minimumScale: 1 })),
    }).fits).toBe(false);
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
    await expect(required(mixed.positions[0]).scale * 112).toBeGreaterThanOrEqual(32);
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
      <Table places={6} seats={SEATS}>
        <Table.Seat><FixtureContent<Player> content={spanishSeat} /></Table.Seat>
        <Table.Play>{!empty && <GameCard size="lg" value={{ deck: 'spanish', suit: 'bastos', rank: 12 }} label="rey de bastos" />}</Table.Play>
        <Table.Center><span>Truco</span></Table.Center>
        <Table.Header>Truco</Table.Header>
        <Table.Dock><Button>Quiero</Button></Table.Dock>
      </Table>
    </ViewportFrame>
  </>;
}

/** Large played cards scale from their preferred size; empty regions release their footprint. */
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
      <Table places={6} seats={SEATS}>
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
    await expectSeatFraming(table, 6, 'portraitShort', 'scaled');
    const play = required(table.querySelector<HTMLElement>('[data-ui="game-table-play"]') ?? undefined);
    const scale = Number.parseFloat(play.style.getPropertyValue('--game-table-play-scale'));
    await expect(scale).toBeLessThan(1);
    await expect(scale * 112).toBeGreaterThan(0);
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
    <Table places={players} seats={seatsFor(players)} surface="lobby">
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
          <Table {...tableRootProps({ ...args, viewport, places: players, slots: undefined, seats: seatsFor(players), surface: 'lobby' })}>
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
      const expectedFit = 'fitted';
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
    <Table places={players} seats={seatsFor(players)} dir="rtl">
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
            <Table {...tableRootProps({ ...args, viewport, places: players, slots: undefined, seats: seatsFor(players), dir: 'rtl' })}>
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
      const size = wrapper.getAttribute('data-card-composition');
      if (size !== 'sm' && size !== 'md' && size !== 'lg') throw new Error('Unknown card size');
      const expectedFit = size === 'lg' || (clearance && size === 'md') ? 'scaled' : 'fitted';
      await expectSeatFraming(table, 6, 'wide', expectedFit);
      if (clearance && wrapper.getAttribute('data-card-composition') === 'lg') {
        await expect(table).toHaveAttribute('data-clearance', 'reduced');
        await expect(table).toHaveAttribute('data-clearance-start', '0');
      }
      const ownCard = required(table.querySelector<HTMLElement>('[data-ui="game-table-seat"] [data-ui="game-card"]') ?? undefined);
      const intrinsicWidths = { sm: 32, md: 72, lg: 112 };
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
        <Table places={6} seats={SEATS} clearance={0}>
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
        <Table places={6} seats={SEATS} clearance={[32, 64, 96][index]}>
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
        <Table places={2} clearance={clearance} seats={empty ? [SEATS[2]] : seatsFor(2)}>
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
        <Table places={2} clearance={clearance} seats={empty ? [SEATS[2]] : seatsFor(2)}>
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
    await expectSeatFraming(table, 2, 'grown content', 'scaled');
    const grownScale = scale();
    await userEvent.click(canvas.getByRole('button', { name: 'Shrink container' }));
    await waitFor(() => expect(scale()).toBeLessThan(grownScale));
    await expect(table.parentElement?.getBoundingClientRect().width).toBe(380);
    await expect(table.parentElement?.getBoundingClientRect().height).toBe(360);
    await expectSeatFraming(table, 2, 'shrunk container', 'scaled');
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
    await expectSeatFraming(table, 2, 'clearance request', 'scaled');
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
            <Table ref={ref} dir={index ? 'rtl' : 'ltr'} places={2} seatSlots={buildTableOrderSlots([SEATS[0],SEATS[2]], 'clockwise')}>
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
            <Table ref={ref} dir={index ? 'rtl' : 'ltr'} places={2} seatSlots={buildTableOrderSlots([SEATS[0],SEATS[2]], 'clockwise')}>
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
  name: 'Player avatars',
  parameters: { docs: {
    description: { story: 'Add upright avatars and names outside each player’s hidden cards.' },
    source: { language: 'tsx', code: `import { Avatar, Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable, useGameTableSeat, type SeatLike } from '@jfrader/ui/game-table';

const Frame = styled.div({
  inlineSize: '100%',
  blockSize: 900,
});

const SeatCards = styled.div({
  position: 'relative',
  display: 'flex',
  gap: vars.space[1],
});

const CenterContent = styled.div({
  display: 'grid',
  justifyItems: 'center',
  gap: vars.space[2],
});

const CommunityCards = styled.div({
  display: 'flex',
  gap: vars.space[1],
});

interface Player extends SeatLike {
  name: string;
}

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
  const name = player?.name ?? 'Open seat';

  return (
    <SeatCards>
      <GameTable.SeatChrome>
        <Avatar size="sm" name={name} />
        <span>{name}</span>
      </GameTable.SeatChrome>
      <GameCard size="sm" label={\`\${name}: first hidden card\`} />
      <GameCard size="sm" label={\`\${name}: second hidden card\`} />
    </SeatCards>
  );
}

export default function Example() {
  return (
    <Frame>
      <GameTable places={6} seats={players}>
        <GameTable.Header>Poker · Avatars</GameTable.Header>
        <GameTable.Seat>
          <SeatContent />
        </GameTable.Seat>
        <GameTable.Play />
        <GameTable.Center>
          <CenterContent>
            <span>Pot: 240</span>
            <CommunityCards>
              <GameCard size="sm" label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />
              <GameCard size="sm" label="King of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'K' }} />
              <GameCard size="sm" label="Queen of clubs" value={{ deck: 'french', suit: 'clubs', rank: 'Q' }} />
            </CommunityCards>
          </CenterContent>
        </GameTable.Center>
        <GameTable.Dock>
          <Button>Check</Button>
        </GameTable.Dock>
      </GameTable>
    </Frame>
  );
}` },
  } },
  args: {
    places: 6, seats: SEATS, viewport: VIEWPORTS.wideLarge,
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
    <Table places={6} seats={SEATS} >
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
          <Table places={6} seats={SEATS}>
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
<Table places={4} seats={seatsFor(4)} >
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
    places: 4, seats: seatsFor(4), viewport: VIEWPORTS.wideLarge,
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
  <div data-parity-group="with-chrome"><Table places={6} seats={SEATS} >
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · Chrome Removal Parity</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table></div>
  <div data-parity-group="without-chrome"><Table places={6} seats={SEATS} >
    <Table.Seat><FixtureContent<Player> content={seatCardsOnly} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · Chrome Removal Parity</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table></div>
</ParityGrid>);
}` } } },
  args: {
    places: 6, seats: SEATS, viewport: VIEWPORTS.wideLarge,
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
<Table places={6} seats={SEATS} >
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
    places: 6, seats: SEATS, viewport: VIEWPORTS.portraitShort,
    center, header: 'Poker · Insufficient Space', dock: <Button>Check</Button>,
    renderSeat: fn((slot, _index, _geometry) => (
      <SpacedCards>
        <GameCard size="lg" label={`${slot.player?.name}: card 1`} />
        <GameCard size="lg" label={`${slot.player?.name}: card 2`} />
        <GameCard size="lg" label={`${slot.player?.name}: card 3`} />
        <GameCard size="lg" label={`${slot.player?.name}: card 4`} />
        <GameCard size="lg" label={`${slot.player?.name}: card 5`} />
        <GameCard size="lg" label={`${slot.player?.name}: card 6`} />
        <Button>Inspect cards</Button>
      </SpacedCards>
    )),
  },
  play: async ({ canvasElement }) => {
    const table = required(canvasElement.querySelector<HTMLElement>('[data-ui="game-table"]') ?? undefined);
    await expect(table).toHaveAttribute('data-layout-fit', 'insufficient-space');
    for (const control of table.querySelectorAll('button')) {
      const box = control.getBoundingClientRect();
      await expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24 - 0.01);
      await expect(Math.max(box.width, box.height)).toBeGreaterThanOrEqual(32 - 0.01);
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
<Table places={6} seats={SEATS} >
    <Table.Seat><FixtureContent<Player> content={(slot) => seatWithAvatar(slot, 'sm')} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · State Stability</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
</ViewportFrame>);
}` } } },
  args: {
    places: 6, seats: SEATS, viewport: VIEWPORTS.wide,
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
  return <GameSeat name={name} avatar={<Avatar name={name} size="sm" aria-hidden="true" />}
    badges={<Badge>{player?.isMe ? 'Vos' : index === 1 ? 'Anfitrión' : 'Jugador'}</Badge>}
    points={index === 0 ? '12' : undefined}
    hand={<GameHand.Hidden count={3} size="sm" label="Tres cartas ocultas" playerKey={player?.key} />}
    turned={index === 1} turn={index === 1 ? { remainingMs: 45000, durationMs: 60000 } : undefined}
    chat={index === 1 ? <span aria-live="polite">Tu turno</span> : undefined} />;
}

/** Each seat shows the player, badges, hidden hand and turn. */
export const TrucoPlayerChrome: Story = {
  name: 'Truco player chrome',
  args: { viewport: VIEWPORTS.wideLarge, places: 4, seats: seatsFor(4) },
  render: (args) => <DeckProvider default="spanish">
    <ViewportFrame viewport={args.viewport}>
      <Table places={args.places ?? args.players!} seats={args.seats ?? []}>
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
  return <GameSeat name={name} avatar={<Avatar name={name} size="sm" aria-hidden="true" />}
    badges={<Badge>{player?.isMe ? 'Vos' : index === 1 ? 'Anfitrión' : 'Jugador'}</Badge>}
    points={index === 0 ? '12' : undefined}
    hand={<GameHand.Hidden count={3} size="sm" label="Tres cartas ocultas" playerKey={player?.key} />}
    turned={index === 1} turn={index === 1 ? { remainingMs: 45000, durationMs: 60000 } : undefined}
    chat={index === 1 ? <span aria-live="polite">Tu turno</span> : undefined} />;
}

export default function Example() {
  return (<DeckProvider default="spanish">
  <ViewportFrame viewport={VIEWPORTS.wideLarge}>
<Table places={4} seats={seatsFor(4)} >
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
  parameters: { docs: {
    description: { story: 'Place hidden hands on the edge and played cards on an inward ring.' },
    source: { language: 'tsx', code: `import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { CARD_BACK_PATTERNS, GameCard } from '@jfrader/ui/game-card';
import { GameTable, useGameTableSeat, type SeatLike } from '@jfrader/ui/game-table';

const Frame = styled.div({
  inlineSize: 412,
  blockSize: 816,
});

const CardsRow = styled.div({
  display: 'flex',
  gap: vars.space[1],
});

interface Player extends SeatLike {
  name: string;
}

const players: Player[] = [
  { key: 'alex', name: 'Alex', teamIdx: 0 },
  { key: 'blair', name: 'Blair', teamIdx: 1 },
  { key: 'you', name: 'You', teamIdx: 0, isMe: true },
  { key: 'drew', name: 'Drew', teamIdx: 1 },
];

function SeatCards() {
  const { player } = useGameTableSeat<Player>();
  const name = player?.name ?? 'Lugar libre';

  return (
    <CardsRow>
      <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={\`\${name}: carta oculta\`} />
      <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={\`\${name}: segunda carta oculta\`} />
    </CardsRow>
  );
}

function PlayCard() {
  const { index } = useGameTableSeat<Player>();

  return index % 2 === 0 ? (
    <GameCard size="sm" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} label="As de oros" />
  ) : (
    <GameCard size="sm" value={{ deck: 'spanish', suit: 'copas', rank: 10 }} label="Sota de copas" />
  );
}

export default function Example() {
  return (
    <Frame>
      <GameTable places={4} seats={players} seatPlacement="edge">
        <GameTable.Header>Truco</GameTable.Header>
        <GameTable.Seat>
          <SeatCards />
        </GameTable.Seat>
        <GameTable.Play>
          <PlayCard />
        </GameTable.Play>
        <GameTable.Center>
          <span>Truco</span>
        </GameTable.Center>
        <GameTable.Dock>
          <Button>Quiero</Button>
        </GameTable.Dock>
      </GameTable>
    </Frame>
  );
}` },
  } },
  args: { seatPlacement: 'edge', renderSeat: spanishSeat, renderPlay: spanishPlay, center: <span>Truco</span>, header: 'Truco', dock: <Button>Quiero</Button> },
  render: (args) => <Matrix>
    {Object.entries(VIEWPORTS).map(([caseName, viewport]) => COUNTS.map((players) => {
      const size = caseName === 'wide' ? { ...viewport, height: 480 } : viewport;
      return (
      <Row key={`${caseName}-${players}`}>
        <ViewportFrame data-measurement="before" viewport={size}>
          <Table {...tableRootProps({ ...args, seatPlacement: 'inside', viewport: size, places: players, slots: undefined, seats: seatsFor(players) })}>
            <Table.Seat><FixtureContent<Player> content={args.renderSeat} /></Table.Seat>
            <Table.Play />
            <Table.Center>{args.center}</Table.Center>
            <Table.Header>{args.header}</Table.Header>
            <Table.Dock>{args.dock}</Table.Dock>
          </Table>
        </ViewportFrame>
        <ViewportFrame data-measurement="after" viewport={size}>
          <Table {...tableRootProps({ ...args, viewport: size, places: players, slots: undefined, seats: seatsFor(players) })}>
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
  parameters: { docs: {
    description: { story: 'Compare inside, edge and outside placement for two, four and six players.' },
    source: { language: 'tsx', code: `import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { CARD_BACK_PATTERNS, GameCard } from '@jfrader/ui/game-card';
import { GameTable, useGameTableSeat, type SeatLike } from '@jfrader/ui/game-table';

const MatrixRow = styled.div({
  display: 'flex',
  gap: vars.space[4],
  inlineSize: 'max-content',
});

const Frame = styled.div({
  inlineSize: 412,
  blockSize: 816,
});

const CardsRow = styled.div({
  display: 'flex',
  gap: vars.space[1],
});

interface Player extends SeatLike {
  name: string;
}

const players: Player[] = [
  { key: 'alex', name: 'Alex', teamIdx: 0 },
  { key: 'blair', name: 'Blair', teamIdx: 1 },
  { key: 'you', name: 'You', teamIdx: 0, isMe: true },
  { key: 'drew', name: 'Drew', teamIdx: 1 },
  { key: 'emery', name: 'Emery', teamIdx: 0 },
  { key: 'frankie', name: 'Frankie', teamIdx: 1 },
];

const counts = [2, 4, 6] as const;
const modes = ['inside', 'edge', 'outside'] as const;

function seatsFor(count: number): Player[] {
  return count === 2 ? [players[1], players[2]] : players.slice(0, count);
}

function SeatCards() {
  const { player } = useGameTableSeat<Player>();
  const name = player?.name ?? 'Lugar libre';

  return (
    <CardsRow>
      <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={\`\${name}: carta oculta\`} />
      <GameCard size="sm" backPattern={CARD_BACK_PATTERNS.spanish} label={\`\${name}: segunda carta oculta\`} />
    </CardsRow>
  );
}

function PlayCard() {
  const { index } = useGameTableSeat<Player>();

  return index % 2 === 0 ? (
    <GameCard size="sm" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} label="As de oros" />
  ) : (
    <GameCard size="sm" value={{ deck: 'spanish', suit: 'copas', rank: 10 }} label="Sota de copas" />
  );
}

export default function Example() {
  return (
    <MatrixRow>
      {counts.map((playerCount) =>
        modes.map((mode) => (
          <Frame key={\`\${playerCount}-\${mode}\`}>
            <GameTable places={playerCount} seats={seatsFor(playerCount)} seatPlacement={mode}>
              <GameTable.Header>Truco</GameTable.Header>
              <GameTable.Seat>
                <SeatCards />
              </GameTable.Seat>
              <GameTable.Play>
                <PlayCard />
              </GameTable.Play>
              <GameTable.Center>
                <span>Truco</span>
              </GameTable.Center>
              <GameTable.Dock>
                <Button>Quiero</Button>
              </GameTable.Dock>
            </GameTable>
          </Frame>
        )),
      )}
    </MatrixRow>
  );
}` },
  } },
  args: { places: 2, seats: seatsFor(2), renderSeat: spanishSeat, renderPlay: spanishPlay, center: <span>Truco</span>, header: 'Truco', dock: <Button>Quiero</Button> },
  render: (args) => <MatrixRow>
    {COUNTS.map((players) => (['inside', 'edge', 'outside'] as const).map((seatPlacement) => (
      <ViewportFrame key={`${players}-${seatPlacement}`} data-placement-count={players} viewport={args.viewport}>
        <Table {...tableRootProps({ ...args, places: players, slots: undefined, seats: seatsFor(players), seatPlacement })}>
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
<Table places={9} seats={generalSeats(9, 3)} teamCount={3}>
    <Table.Seat><FixtureContent<Player> content={seatChrome} /></Table.Seat>
    <Table.Play></Table.Play>
    <Table.Center>{center}</Table.Center>
    <Table.Header>Poker · 10 / 20</Table.Header>
    <Table.Dock><Button>Check</Button></Table.Dock>

  </Table>
</ViewportFrame>);
}` } } },
  args: { places: 9, teamCount: 3, seats: generalSeats(9, 3), viewport: VIEWPORTS.wideLarge },
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
<Table places={3} seatSlots={[
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
  args: { places: 3, seats: undefined, slots: [
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
        <Table {...tableRootProps({ ...args, viewport: VIEWPORTS[caseName], places: players, teamCount: 3, slots: undefined, seats: generalSeats(players, 3) })}>
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
      const expectedFit = 'fitted';
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
    <Table places={players} seats={generalSeats(players, 3)} teamCount={3} seatPlacement="edge" dir="ltr">
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
    <Table places={players} seats={generalSeats(players, 3)} teamCount={3} seatPlacement="inside" dir="ltr">
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
    <Table places={players} seats={generalSeats(players, 3)} teamCount={3} seatPlacement="outside" dir="ltr">
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
    <Table places={players} seats={generalSeats(players, 3)} teamCount={3} seatPlacement="edge" dir="rtl">
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
  return <Table places={6} teamCount={1} seats={generalSeats(6, 1)}>
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
  parameters: {
    a11y: { test: 'error' },
    docs: {
      description: { story: 'Press Deal board to fly five community cards from the deck into the center.' },
      source: { language: 'tsx', code: `import { useRef } from 'react';
import { Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider } from '@jfrader/ui/deck';
import { CardFlightsProvider, measureCardBox, useCardFlights } from '@jfrader/ui/card-flights';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable, useGameTableSeat, type SeatLike } from '@jfrader/ui/game-table';

const Frame = styled.div({
  inlineSize: 412,
  blockSize: 816,
});

const BoardCenter = styled.div({
  display: 'grid',
  justifyItems: 'center',
  gap: vars.space[2],
});

const PotRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
});

const CardsRow = styled.div({
  display: 'flex',
  gap: vars.space[1],
});

const SeatContent = styled.div({
  display: 'grid',
  justifyItems: 'center',
});

interface Player extends SeatLike {
  name: string;
}

const players: Player[] = [
  { key: 'player-0', name: 'P1', teamIdx: 0 },
  { key: 'player-1', name: 'P2', teamIdx: 0 },
  { key: 'player-2', name: 'P3', teamIdx: 0 },
  { key: 'player-3', name: 'P4', teamIdx: 0 },
  { key: 'player-4', name: 'P5', teamIdx: 0 },
  { key: 'player-5', name: 'P6', teamIdx: 0, isMe: true },
];

const communityCards = [
  { id: 'as', label: 'Ace of spades', value: { suit: 'spades', rank: 'A' } },
  { id: 'kh', label: 'King of hearts', value: { suit: 'hearts', rank: 'K' } },
  { id: 'qc', label: 'Queen of clubs', value: { suit: 'clubs', rank: 'Q' } },
  { id: 'jd', label: 'Jack of diamonds', value: { suit: 'diamonds', rank: 'J' } },
  { id: 'ts', label: 'Ten of spades', value: { suit: 'spades', rank: 10 } },
] as const;

function PokerSeat() {
  const { player } = useGameTableSeat<Player>();
  return (
    <SeatContent>
      <span>{player?.name}</span>
      <span>1,200 chips</span>
    </SeatContent>
  );
}

function TexasHoldemTable() {
  const deckRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const { launch, landingTargets } = useCardFlights();

  const handleDeal = () => {
    const deck = deckRef.current;
    if (!deck) return;
    const from = measureCardBox(deck);

    launch(
      communityCards.flatMap((card, index) => {
        const destination = cardRefs.current.get(card.id);
        if (!destination) return [];
        return [
          {
            card,
            target: \`community:\${card.id}\`,
            destination,
            from,
            to: measureCardBox(destination),
            face: 'reveal' as const,
            durationMs: 300,
            delayMs: index * 60,
          },
        ];
      }),
    );
  };

  return (
    <GameTable places={6} teamCount={1} seats={players}>
      <GameTable.Header>Texas Hold'em · 10 / 20</GameTable.Header>
      <GameTable.Seat>
        <PokerSeat />
      </GameTable.Seat>
      <GameTable.Center>
        <BoardCenter>
          <PotRow>
            <span>Pot: 240</span>
            <div ref={deckRef}>
              <GameCard size="sm" label="Deck" />
            </div>
          </PotRow>
          <CardsRow>
            {communityCards.map((card) => (
              <div
                key={card.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(card.id, node);
                  else cardRefs.current.delete(card.id);
                }}
              >
                <GameCard size="sm" value={card.value} label={card.label} />
              </div>
            ))}
          </CardsRow>
        </BoardCenter>
      </GameTable.Center>
      <GameTable.Dock>
        <Button disabled={landingTargets.size > 0} onClick={handleDeal}>
          Deal board
        </Button>
      </GameTable.Dock>
    </GameTable>
  );
}

export default function Example() {
  return (
    <DeckProvider default="french">
      <CardFlightsProvider>
        <Frame>
          <TexasHoldemTable />
        </Frame>
      </CardFlightsProvider>
    </DeckProvider>
  );
}` },
    },
  },
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
