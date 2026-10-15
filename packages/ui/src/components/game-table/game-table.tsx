'use client';

import { Children, Fragment, createContext, isValidElement, useContext, useLayoutEffect, useMemo, type CSSProperties, type ReactNode, type ReactElement } from 'react';
import { useFlightRegistry } from '../card-flights/flight-registry';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { buildBoardLayoutModel } from './layout-model';
import { useBoardMeasurements } from './use-board-measurements';
import {
  buildAlternatingSlots, resolveTableTurnDirection, validateSlots,
  type GameTableSlot, type SeatLike, type TableTurnDirection,
} from './table-slots';
import type { BoardSeatGeometry, BoardSurface } from './types';
import { resolveSeatCount } from './viewport';
import { TableRoot, type GameTableRootProps, type GameTableRootCustomization } from './table-root';
import { DeckArtProvider, type DeckArtOptions } from '../deck/art-context';

export type GameTablePartProps = GameTableRootProps & GameTableRootCustomization & SxProps;

type SeatInput<T extends SeatLike> =
  | {
    /** Round-robin teams: team j has the places whose index modulo teamCount is j. Player keys must be unique. */
    seats: readonly T[];
    seatSlots?: never;
  }
  | {
    /** Prebuilt visual order for arbitrary teams; slot and occupied-player keys must each be unique. */
    seatSlots: readonly GameTableSlot<T>[];
    seats?: never;
  };

export type GameTableProps<T extends SeatLike = SeatLike> =
  GameTablePartProps & SeatInput<T> & DeckArtOptions & {
    /** Integer number of places >= 2, including empty seats. */
    players: number;
    /** Number of round-robin teams for `seats`. Defaults to 2; use 1 for free-for-all. Prebuilt `seatSlots` keep their teams. */
    teamCount?: number;
    /** Viewport dimensions in CSS pixels; supplied by the consumer for SSR and resize updates. */
    viewport: { width: number; height: number };
    /** Match geometry or waiting-room geometry. Defaults to `match`. */
    surface?: BoardSurface;
    /** Content inside the felt, centred on its edge (default), or outside it. */
    seatPlacement?: 'inside' | 'edge' | 'outside';
    /** Preferred block-axis space. Yields to zero before cards cross GAME_TABLE_LIMITS.minimumCardWidthPx.
     * data-clearance="reduced" declares this concession. If floors still cannot fit,
     * data-layout-fit="insufficient-space" declares possible overflow/collisions; floors are preserved.
     * The floor covers normal-flow GameCard content in local CSS pixels, before external ancestor transforms.
     */
    clearance?: CSSProperties['paddingBlock'];
    /** Order for `seats`. Prebuilt `seatSlots` already carry their visual order. */
    turnDirection?: TableTurnDirection;
    /** Direct region parts, in any order; fragments are accepted. */
    children?: ReactNode;
  };

const rootStyle = css({
  label: 'game-table',
  position: 'relative',
  isolation: 'isolate',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  inlineSize: '100%',
  blockSize: '100%',
  maxBlockSize: '100%',
  overflow: 'hidden',
  minBlockSize: 0,
  paddingBlockStart: 'var(--game-table-padding-top)',
  paddingBlockEnd: 'var(--game-table-padding-bottom)',
  paddingInline: 'var(--game-table-padding-inline)',
  color: vars.color.text,
  backgroundColor: vars.color.bg,
});
const shellStyle = css({
  display: 'flex',
  position: 'relative',
  flexGrow: 1,
  minBlockSize: 0,
  inlineSize: '100%',
  boxSizing: 'border-box',
  paddingBlock: 'calc(var(--game-table-seat-clearance) + var(--game-table-reserve-block, 0px))',
  paddingInline: 'var(--game-table-reserve-inline, 0px)',
  maxInlineSize: 'var(--game-table-shell-max-width)',
  marginInline: 'auto',
  alignItems: 'center',
  justifyContent: 'center',
});
const surfaceStyle = css({
  position: 'relative',
  boxSizing: 'border-box',
  inlineSize: 'var(--game-table-width)',
  maxInlineSize: 'var(--game-table-max-width)',
  blockSize: 'var(--game-table-height)',
  maxBlockSize: 'min(var(--game-table-max-height), 100%)',
  aspectRatio: 'var(--game-table-ratio)',
  borderRadius: 'var(--game-table-radius)',
  border: `var(--game-table-border) solid ${vars.color.border}`,
  outline: `var(--game-table-outline) solid ${vars.color.surfaceRaised}`,
  backgroundColor: vars.color.surfaceInset,
  columnGap: vars.space[2],
  '&[data-layout-fit="measuring"] > [data-ui~="game-table-seat"], &[data-layout-fit="measuring"] > [data-ui~="game-table-center"], &[data-layout-fit="measuring"] > [data-ui~="game-table-play"]': {
    visibility: 'hidden',
  },
});
const seatChromeStyle = css({
  position: 'absolute',
  insetBlockStart: 'var(--game-table-chrome-block)',
  insetInlineStart: 'var(--game-table-chrome-inline)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  inlineSize: 'max-content',
  gap: vars.space[1],
  transform: 'translate(var(--game-table-chrome-x), var(--game-table-chrome-y))',
  '&:dir(rtl)': { transform: 'translate(calc(-1 * var(--game-table-chrome-x)), var(--game-table-chrome-y))' },
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  '& > *': { pointerEvents: 'auto' },
});

export type GameTableSeatChromeProps = GameTablePartProps;

export function GameTableSeatChrome(props: GameTableSeatChromeProps) {
  return <TableRoot {...props} marker="game-table-seat-chrome" structure={seatChromeStyle} />;
}
GameTableSeatChrome.displayName = 'GameTable.SeatChrome';

const seatStyle = css({
  position: 'absolute',
  zIndex: 2,
  inlineSize: 'max-content',
  insetInlineStart: 'var(--game-table-seat-inline)',
  insetBlockStart: 'var(--game-table-seat-block)',
  transform: 'translate(-50%, -50%) scale(var(--game-table-content-scale))',
  '&:dir(rtl)': {
    transform: 'translate(50%, -50%) scale(var(--game-table-content-scale))',
  },
});
const centerStyle = css({
  position: 'absolute',
  zIndex: 1,
  insetInlineStart: 'var(--game-table-center-inline)',
  insetBlockStart: 'var(--game-table-center-block)',
  inlineSize: 'max-content',
  blockSize: 'max-content',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transform: 'translate(-50%, -50%) scale(var(--game-table-center-scale))',
  '&:dir(rtl)': { transform: 'translate(50%, -50%) scale(var(--game-table-center-scale))' },
});
const playStyle = css({
  position: 'absolute', zIndex: 1, inlineSize: 'max-content',
  insetInlineStart: 'var(--game-table-play-inline)', insetBlockStart: 'var(--game-table-play-block)',
  transform: 'translate(-50%, -50%) scale(var(--game-table-play-scale))',
  '&:dir(rtl)': { transform: 'translate(50%, -50%) scale(var(--game-table-play-scale))' },
});
const stripStyle = css({ position: 'relative', flexShrink: 0, zIndex: 3, textAlign: 'center' });
const headerStyle = css({
  display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center',
  gap: 'var(--game-table-top-gap)', marginBlockEnd: 'var(--game-table-top-margin)',
  transform: 'translateY(var(--game-table-top-translate-y))',
});
const dockStyle = css({ marginBlockStart: 'var(--game-table-bottom-margin)', inlineSize: '100%', maxInlineSize: `calc(${vars.space[4]} * 58)`, marginInline: 'auto' });
const footerStyle = css({ marginBlockStart: `calc(${vars.space[4]} * 0.8)`, inlineSize: '100%', maxInlineSize: `calc(${vars.space[4]} * 56)`, marginInline: 'auto' });
const floatingStyle = css({
  position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
  '& > *': { pointerEvents: 'auto' },
});

type TableVariables = CSSProperties & { [key: `--game-table-${string}`]: string };

export interface GameTableSeatContext<T extends SeatLike = SeatLike> {
  slot: GameTableSlot<T>;
  player: T | null;
  index: number;
  geometry: BoardSeatGeometry;
}
const SeatContext = createContext<GameTableSeatContext | null>(null);
const RegionContext = createContext<GameTableRootProps | undefined>(undefined);

export function useOptionalGameTableSeat() {
  return useContext(SeatContext);
}

/** Read the current place from children of Seat or Play. */
export function useGameTableSeat<T extends SeatLike = SeatLike>(): GameTableSeatContext<T> {
  const context = useOptionalGameTableSeat();
  if (!context) throw new Error('useGameTableSeat requires GameTable.Seat or GameTable.Play.');
  return context as GameTableSeatContext<T>;
}
export type GameTableSeatProps = GameTablePartProps & {
  /** Omit to repeat this part at every place, or select one place by its slot key. */
  slotKey?: string;
};
export type GameTablePlayProps = GameTableSeatProps;

function SeatProvider({ slot, geometry, children }: { slot: GameTableSlot; geometry: BoardSeatGeometry; children: ReactNode }) {
  const value = useMemo(() => ({ slot, player: slot.player, index: geometry.index, geometry }), [slot, geometry]);
  return <SeatContext value={value}>{children}</SeatContext>;
}
export function GameTableSeat({ slotKey: _slotKey, ...props }: GameTableSeatProps) {
  useGameTableSeat();
  const attributes = useContext(RegionContext);
  return <TableRoot {...props} attributes={attributes} marker="game-table-seat" structure={seatStyle} />;
}
export function GameTablePlay({ slotKey: _slotKey, ...props }: GameTablePlayProps) {
  useGameTableSeat();
  const attributes = useContext(RegionContext);
  return <TableRoot {...props} attributes={attributes} marker="game-table-play" structure={playStyle} />;
}
export function GameTableCenter(props: GameTablePartProps) {
  return <TableRoot {...props} marker="game-table-center" structure={centerStyle} />;
}
export function GameTableHeader(props: GameTablePartProps) {
  return <TableRoot {...props} marker="game-table-header" structure={[stripStyle, headerStyle]} />;
}
export function GameTableDock(props: GameTablePartProps) {
  return <TableRoot {...props} marker="game-table-dock" structure={[stripStyle, dockStyle]} />;
}
export function GameTableFooter(props: GameTablePartProps) {
  return <TableRoot {...props} marker="game-table-footer" structure={[stripStyle, footerStyle]} />;
}
export function GameTableFloating(props: GameTablePartProps) {
  return <TableRoot {...props} marker="game-table-floating" structure={floatingStyle} />;
}
GameTableSeat.displayName = 'GameTable.Seat';
GameTablePlay.displayName = 'GameTable.Play';
GameTableCenter.displayName = 'GameTable.Center';
GameTableHeader.displayName = 'GameTable.Header';
GameTableDock.displayName = 'GameTable.Dock';
GameTableFooter.displayName = 'GameTable.Footer';
GameTableFloating.displayName = 'GameTable.Floating';

const REGION_PARTS: ReadonlySet<unknown> = new Set([
  GameTableSeat, GameTablePlay, GameTableCenter, GameTableHeader, GameTableDock, GameTableFooter, GameTableFloating,
]);

function collectRegions(children: ReactNode): ReactElement<GameTableSeatProps>[] {
  const regions: ReactElement<GameTableSeatProps>[] = [];
  Children.forEach(children, (child) => {
    if (!isRenderable(child)) return;
    if (!isValidElement<GameTableSeatProps>(child)) throw new Error('GameTable children must be region parts.');
    if (child.type === Fragment) regions.push(...collectRegions(child.props.children));
    else if (REGION_PARTS.has(child.type)) regions.push(child);
    else throw new Error('GameTable children must be direct region parts (fragments are accepted).');
  });
  return regions;
}

export function GameTable<T extends SeatLike>({
  seats, seatSlots: suppliedSlots, players, teamCount = 2, viewport, surface = 'match', turnDirection, clearance = 0,
  children, seatPlacement = 'edge', style, artSet, cardArtSets, ...rest
}: GameTableProps<T>) {
  const { surfaceRef, measurement } = useBoardMeasurements(rest.slots?.root ?? rest.component);
  const seatCount = resolveSeatCount(players);
  const slots = useMemo(() => suppliedSlots ?? buildAlternatingSlots(seats ?? [], seatCount, resolveTableTurnDirection(turnDirection), teamCount),
    [suppliedSlots, seats, seatCount, turnDirection, teamCount]);
  const flightRegistry = useFlightRegistry();
  useLayoutEffect(() => {
    const node = surfaceRef.current;
    if (!flightRegistry || !node) return;
    flightRegistry.tables.set(node, { node, seats: slots.map((slot) => ({ key: slot.player?.key ?? slot.key, isMe: slot.player?.isMe })) });
    return () => { flightRegistry.tables.delete(node); };
  }, [flightRegistry, surfaceRef, slots]);
  if (slots.length !== seatCount) {
    throw new Error('GameTable requires one slot per place. Pass fewer seats to fill empty places, or exactly players seatSlots.');
  }
  validateSlots(slots);
  const regions = collectRegions(children);
  const one = (type: typeof GameTableSeat, slotKey?: string) => {
    const matches = regions.filter((region) => region.type === type &&
      (slotKey === undefined || region.props.slotKey === undefined || region.props.slotKey === slotKey));
    if (matches.length > 1) throw new Error(`GameTable requires at most one ${type.displayName} per region.`);
    return matches[0];
  };
  for (const region of regions) if (region.props.slotKey !== undefined && !slots.some((slot) => slot.key === region.props.slotKey)) {
    throw new Error(`GameTable has no slot named "${region.props.slotKey}".`);
  }
  const layout = buildBoardLayoutModel({
    surface, totalSeats: players, measurement,
    viewport: { ...viewport, aspectRatio: viewport.width / Math.max(viewport.height, 1) },
  });
  const { frame } = layout;
  const [paddingTop = '0px', paddingInline = paddingTop, paddingBottom = paddingTop] = frame.rootPadding.split(/\s+/);
  const variables: TableVariables = {
    '--game-table-seat-clearance': typeof clearance === 'number' ? `${clearance}px` : clearance,
    '--game-table-padding-top': paddingTop,
    '--game-table-padding-inline': paddingInline,
    '--game-table-padding-bottom': paddingBottom,
    '--game-table-shell-max-width': frame.shellMaxWidth,
    '--game-table-top-gap': frame.topStripGap,
    '--game-table-top-margin': frame.topStripMarginBottom,
    '--game-table-bottom-margin': frame.bottomStripMarginTop,
    '--game-table-top-translate-y': surface === 'lobby' ? `calc(0px - ${paddingTop})` : '0px',
    '--game-table-width': frame.boardWidth,
    '--game-table-max-width': frame.boardMaxWidth,
    '--game-table-height': frame.boardWidth === 'auto' && frame.boardHeight === 'auto' ? '100%' : frame.boardHeight,
    '--game-table-max-height': frame.boardMaxHeight,
    '--game-table-ratio': frame.boardAspectRatio,
    '--game-table-radius': frame.boardBorderRadius,
    '--game-table-border': frame.boardBorderWidth,
    '--game-table-outline': frame.boardOutlineWidth,
    '--game-table-seat-width': frame.seatWidth,
    '--game-table-seat-max-width': frame.seatMaxWidth,
    '--game-table-content-scale': String(layout.seatConfig.scale),
    '--game-table-center-scale': String(layout.seatConfig.centerScale),
    '--game-table-radius-x': `${layout.seatConfig.radiusX}px`,
    '--game-table-radius-y': `${layout.seatConfig.radiusY}px`,
    '--game-table-content-gap': `${layout.seatConfig.gap}px`,
    '--game-table-center-inline': `${measurement?.width ? measurement.centerX / measurement.width * 100 : 50}%`,
    '--game-table-center-block': `${measurement?.height ? measurement.centerY / measurement.height * 100 : 50}%`,
  };
  return (
    <DeckArtProvider artSet={artSet} cardArtSets={cardArtSets}><TableRoot {...rest} marker="game-table" structure={rootStyle} style={style} attributes={{ style: variables,
      'data-profile': layout.profile, 'data-surface': surface, 'data-seat-placement': seatPlacement, 'data-layout-fit': layout.fit,
      'data-clearance': measurement?.clearance && (measurement.clearance.start < measurement.clearance.requestedStart || measurement.clearance.end < measurement.clearance.requestedEnd) ? 'reduced' : 'requested',
      'data-clearance-start': measurement?.clearance?.start, 'data-clearance-end': measurement?.clearance?.end,
    }}>
      {one(GameTableHeader)}
      <div data-ui="game-table-shell" css={shellStyle}>
        {/* Stable measurement target for future card flights; owned by this library. */}
        <div ref={surfaceRef} data-ui="game-table-surface" data-game-surface="true" data-layout-fit={layout.fit} css={surfaceStyle}>
          {slots.map((slot, index) => {
            const geometry = layout.seatGeometries[index];
            if (!geometry) throw new Error('GameTable is missing seat geometry.');
            const chromeOnSide = Math.abs(geometry.cos) > Math.abs(geometry.sin);
            const chromeInline = geometry.cos > 0 ? `calc(100% + ${vars.space[1]})` : `calc(0px - ${vars.space[1]})`;
            const chromeBlock = geometry.sin > 0 ? `calc(100% + ${vars.space[1]})` : `calc(0px - ${vars.space[1]})`;
            const seatVariables: TableVariables = {
              '--game-table-chrome-inline': chromeOnSide ? chromeInline : '50%',
              '--game-table-chrome-block': chromeOnSide ? '50%' : chromeBlock,
              '--game-table-chrome-x': chromeOnSide ? (geometry.cos > 0 ? '0%' : '-100%') : '-50%',
              '--game-table-chrome-y': chromeOnSide ? '-50%' : (geometry.sin > 0 ? '0%' : '-100%'),
              '--game-table-chrome-fallback-block': chromeBlock,
              '--game-table-chrome-fallback-y': geometry.sin > 0 ? '0%' : '-100%',
              '--game-table-seat-inline': `${geometry.leftPercent}%`,
              '--game-table-seat-block': `${geometry.topPercent}%`,
              '--game-table-seat-rotation': `${geometry.rotationDeg}deg`,
              '--game-table-content-scale': String(geometry.scale),
            };
            return (
              <SeatProvider key={slot.key} slot={slot} geometry={geometry}>
                <RegionContext value={{ style: seatVariables, 'data-slot-key': slot.key, 'data-slot-team': slot.teamIdx,
                  'data-slot-player': slot.player?.key, 'data-slot-own': slot.player?.isMe ? 'true' : undefined }}>
                  {one(GameTableSeat, slot.key) ?? <GameTableSeat />}
                </RegionContext>
              </SeatProvider>
            );
          })}
          {slots.map((slot, index) => {
            const geometry = layout.seatGeometries[index]!;
            const playCos = measurement?.direction === 'rtl' ? -geometry.cos : geometry.cos;
            const playVariables: TableVariables = {
              '--game-table-play-inline': `${geometry.playLeftPercent}%`,
              '--game-table-play-block': `${geometry.playTopPercent}%`,
              '--game-table-play-scale': String(geometry.playScale),
              '--game-table-play-angle': `${Math.atan2(geometry.sin, playCos) * 180 / Math.PI}deg`,
              '--game-table-play-cos': String(playCos), '--game-table-play-sin': String(geometry.sin),
            };
            return <SeatProvider key={slot.key} slot={slot} geometry={geometry}>
              <RegionContext value={{ style: playVariables, 'data-play-slot-key': slot.key }}>
                {one(GameTablePlay, slot.key) ?? <GameTablePlay />}
              </RegionContext>
            </SeatProvider>;
          })}
          {one(GameTableCenter) ?? <GameTableCenter />}
        </div>
      </div>
      {one(GameTableFooter)}
      {one(GameTableDock)}
      {one(GameTableFloating)}
    </TableRoot></DeckArtProvider>
  );
}
GameTable.displayName = 'GameTable';
GameTable.SeatChrome = GameTableSeatChrome;
GameTable.Seat = GameTableSeat;
GameTable.Play = GameTablePlay;
GameTable.Center = GameTableCenter;
GameTable.Header = GameTableHeader;
GameTable.Dock = GameTableDock;
GameTable.Footer = GameTableFooter;
GameTable.Floating = GameTableFloating;
