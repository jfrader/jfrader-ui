'use client';

import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { buildBoardLayoutModel } from './layout-model';
import { useBoardMeasurements } from './use-board-measurements';
import {
  buildAlternatingSlots, resolveTableTurnDirection, validateSlots,
  type GameTableSlot, type SeatLike, type TableTurnDirection,
} from './table-slots';
import type { BoardPlayerCount, BoardSeatGeometry, BoardSurface } from './types';

type Part = 'surface' | 'seat' | 'play' | 'center' | 'header' | 'dock' | 'footer' | 'floating';
export interface GameTablePartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

type SeatInput<T extends SeatLike> =
  | {
    /** Alternating teams only: each team must fit its available places (players / 2); player keys must be unique. */
    seats: readonly T[];
    slots?: never;
  }
  | {
    /** Prebuilt visual order for arbitrary teams; slot and occupied-player keys must each be unique. */
    slots: readonly GameTableSlot<T>[];
    seats?: never;
  };

export type GameTableProps<T extends SeatLike = SeatLike> =
  Omit<ComponentPropsWithRef<'div'>, 'children'> & SxProps & SeatInput<T> & {
    /** Number of places, including empty seats. */
    players: BoardPlayerCount;
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
    /** Order for `seats`. Prebuilt `slots` already carry their visual order. */
    turnDirection?: TableTurnDirection;
    /** Intrinsic card content, upright for the spectator. Put names/avatars in GameTable.SeatChrome:
     * it floats out of flow on the outward side without affecting card placement or sizing.
     * Arbitrary unmarked in-flow content still participates in layout.
     * GameCard backs in occupied rival seats receive hidden-card flight markers in DOM order.
     */
    renderSeat: (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;
    /** Played content on the inward ring, measured and scaled independently per place. */
    renderPlay?: (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;
    header?: ReactNode;
    center?: ReactNode;
    dock?: ReactNode;
    footer?: ReactNode;
    /** Table-local floating content, above seats and center; not a portal or modal. */
    floating?: ReactNode;
    slotProps?: Partial<Record<Part, GameTablePartProps>>;
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
  '&[data-layout-fit="measuring"] > [data-ui="game-table-seat"], &[data-layout-fit="measuring"] > [data-ui="game-table-center"], &[data-layout-fit="measuring"] > [data-ui="game-table-play"]': {
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

export type GameTableSeatChromeProps = ComponentPropsWithRef<'div'> & SxProps;

export function GameTableSeatChrome({
  ref,
  className,
  sx,
  children,
  ...rest
}: GameTableSeatChromeProps) {
  return (
    <WithSx className={className} styles={seatChromeStyle} sx={sx}>
      {(rootClass) => (
        <div {...rest} ref={ref} data-ui="game-table-seat-chrome" className={rootClass}>
          {children}
        </div>
      )}
    </WithSx>
  );
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
const dockStyle = css({ marginBlockStart: 'var(--game-table-bottom-margin)', inlineSize: '100%', maxInlineSize: '58rem', marginInline: 'auto' });
const footerStyle = css({ marginBlockStart: '0.8rem', inlineSize: '100%', maxInlineSize: '56rem', marginInline: 'auto' });
const floatingStyle = css({
  position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
  '& > *': { pointerEvents: 'auto' },
});

type TableVariables = CSSProperties & { [key: `--game-table-${string}`]: string };

export function GameTable<T extends SeatLike>({
  ref, seats, slots: suppliedSlots, players, viewport, surface = 'match', turnDirection, clearance = 0,
  renderSeat, renderPlay, seatPlacement = 'edge', header, center, dock, footer, floating, slotProps, className, sx, style, ...rest
}: GameTableProps<T>) {
  const { surfaceRef, measurement } = useBoardMeasurements();
  const slots = suppliedSlots ?? buildAlternatingSlots(seats ?? [], players, resolveTableTurnDirection(turnDirection));
  if (slots.length !== players) {
    throw new Error('GameTable requires one slot per place. Pass fewer seats to fill empty places, or exactly players slots.');
  }
  validateSlots(slots);
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
    ...style,
  };
  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(rootClass) => (
        <div
          {...rest} ref={ref} className={rootClass} style={variables}
          data-ui="game-table" data-profile={layout.profile} data-surface={surface} data-seat-placement={seatPlacement} data-layout-fit={layout.fit}
          data-clearance={measurement?.clearance && (measurement.clearance.start < measurement.clearance.requestedStart || measurement.clearance.end < measurement.clearance.requestedEnd) ? 'reduced' : 'requested'}
          data-clearance-start={measurement?.clearance?.start} data-clearance-end={measurement?.clearance?.end}
        >
          {isRenderable(header) && (
            <div data-ui="game-table-header" className={slotProps?.header?.className} css={[stripStyle, headerStyle, slotProps?.header?.css]}>
              {header}
            </div>
          )}
          <div data-ui="game-table-shell" css={shellStyle}>
            {/* Stable measurement target for future card flights; owned by this library. */}
            <div
              ref={surfaceRef} data-ui="game-table-surface" data-game-surface="true" data-layout-fit={layout.fit}
              className={slotProps?.surface?.className} css={[surfaceStyle, slotProps?.surface?.css]}
            >
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
                  <div
                    key={slot.key} data-ui="game-table-seat" data-slot-key={slot.key} data-slot-team={slot.teamIdx}
                    data-slot-player={slot.player?.key} data-slot-own={slot.player?.isMe ? 'true' : undefined}
                    className={slotProps?.seat?.className} css={[seatStyle, slotProps?.seat?.css]} style={seatVariables}
                  >
                    {renderSeat(slot, index, geometry)}
                  </div>
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
                return <div key={slot.key} data-ui="game-table-play" data-play-slot-key={slot.key}
                  style={playVariables} className={slotProps?.play?.className} css={[playStyle, slotProps?.play?.css]}>
                  {renderPlay?.(slot, index, geometry)}
                </div>;
              })}
              <div data-ui="game-table-center" className={slotProps?.center?.className} css={[centerStyle, slotProps?.center?.css]}>
                {center}
              </div>
            </div>
          </div>
          {isRenderable(footer) && (
            <div data-ui="game-table-footer" className={slotProps?.footer?.className} css={[stripStyle, footerStyle, slotProps?.footer?.css]}>
              {footer}
            </div>
          )}
          {isRenderable(dock) && (
            <div data-ui="game-table-dock" className={slotProps?.dock?.className} css={[stripStyle, dockStyle, slotProps?.dock?.css]}>
              {dock}
            </div>
          )}
          {isRenderable(floating) && (
            <div data-ui="game-table-floating" className={slotProps?.floating?.className} css={[floatingStyle, slotProps?.floating?.css]}>
              {floating}
            </div>
          )}
        </div>
      )}
    </WithSx>
  );
}
GameTable.displayName = 'GameTable';
GameTable.SeatChrome = GameTableSeatChrome;
