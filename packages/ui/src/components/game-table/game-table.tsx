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

type Part = 'surface' | 'seat' | 'center' | 'header' | 'dock' | 'footer' | 'floating';
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
    /** Extra block-axis space around the surface. Defaults to zero; content fits the remaining measured space. */
    clearance?: CSSProperties['paddingBlock'];
    /** Order for `seats`. Prebuilt `slots` already carry their visual order. */
    turnDirection?: TableTurnDirection;
    /** Intrinsic seat content. The table measures, scales and rotates it; do not apply geometry.scale again. GameCard backs in occupied rival seats receive hidden-card flight markers in DOM order. */
    renderSeat: (slot: GameTableSlot<T>, index: number, geometry: BoardSeatGeometry) => ReactNode;
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
  paddingBlock: 'var(--game-table-seat-clearance)',
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
  '&[data-layout-fit="measuring"] > [data-ui="game-table-seat"], &[data-layout-fit="measuring"] > [data-ui="game-table-center"]': {
    visibility: 'hidden',
  },
});
const seatStyle = css({
  position: 'absolute',
  zIndex: 2,
  inlineSize: 'max-content',
  insetInlineStart: 'var(--game-table-seat-inline)',
  insetBlockStart: 'var(--game-table-seat-block)',
  transform: 'translate(-50%, -50%) rotate(var(--game-table-seat-rotation)) scale(var(--game-table-content-scale))',
  '&:dir(rtl)': {
    transform: 'translate(50%, -50%) rotate(calc(-1 * var(--game-table-seat-rotation))) scale(var(--game-table-content-scale))',
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
  transform: 'translate(-50%, -50%) scale(var(--game-table-content-scale))',
  '&:dir(rtl)': { transform: 'translate(50%, -50%) scale(var(--game-table-content-scale))' },
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
  renderSeat, header, center, dock, footer, floating, slotProps, className, sx, style, ...rest
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
    '--game-table-center-size': frame.centerSize,
    '--game-table-content-scale': String(layout.seatConfig.scale),
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
          data-ui="game-table" data-profile={layout.profile} data-surface={surface} data-layout-fit={layout.fit}
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
                const seatVariables: TableVariables = {
                  '--game-table-seat-inline': `${geometry.leftPercent}%`,
                  '--game-table-seat-block': `${geometry.topPercent}%`,
                  '--game-table-seat-rotation': `${geometry.rotationDeg}deg`,
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
