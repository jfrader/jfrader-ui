'use client';

import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { buildBoardLayoutModel } from './layout-model';
import {
  buildAlternatingSlots, resolveTableTurnDirection,
  type GameTableSlot, type SeatLike, type TableTurnDirection,
} from './table-slots';
import type { BoardPlayerCount, BoardSeatGeometry, BoardSurface } from './types';

type Part = 'surface' | 'seat' | 'center' | 'header' | 'dock' | 'footer' | 'floating';
export interface GameTablePartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

type SeatInput<T extends SeatLike> =
  | { seats: readonly T[]; slots?: never }
  | { slots: readonly GameTableSlot<T>[]; seats?: never };

export type GameTableProps<T extends SeatLike = SeatLike> =
  Omit<ComponentPropsWithRef<'div'>, 'children'> & SxProps & SeatInput<T> & {
    /** Number of places, including empty seats. */
    players: BoardPlayerCount;
    /** Viewport dimensions in CSS pixels; supplied by the consumer for SSR and resize updates. */
    viewport: { width: number; height: number };
    /** Match geometry or waiting-room geometry. Defaults to `match`. */
    surface?: BoardSurface;
    /** Order for `seats`. Prebuilt `slots` already carry their visual order. */
    turnDirection?: TableTurnDirection;
    /** Seat chrome and controls. Geometry uses inline-start coordinates, mirrored in RTL. */
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
  '--game-table-seat-clearance': vars.space[8],
  position: 'relative',
  isolation: 'isolate',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  inlineSize: '100%',
  blockSize: '100%',
  minBlockSize: 0,
  padding: vars.space[4],
  gap: vars.space[4],
  color: vars.color.text,
  backgroundColor: vars.color.bg,
});
const shellStyle = css({
  display: 'flex',
  position: 'relative',
  flex: '1 1 0',
  minBlockSize: 0,
  inlineSize: '100%',
  boxSizing: 'border-box',
  paddingBlock: 'var(--game-table-seat-clearance)',
  alignItems: 'center',
  justifyContent: 'center',
});
const surfaceStyle = css({
  position: 'relative',
  boxSizing: 'border-box',
  flexShrink: 0,
  inlineSize: 'var(--game-table-width)',
  maxInlineSize: 'var(--game-table-max-width)',
  blockSize: 'var(--game-table-height)',
  maxBlockSize: 'var(--game-table-max-height)',
  aspectRatio: 'var(--game-table-ratio)',
  borderRadius: 'var(--game-table-radius)',
  border: `var(--game-table-border) solid ${vars.color.border}`,
  outline: `var(--game-table-outline) solid ${vars.color.surfaceRaised}`,
  backgroundColor: vars.color.surfaceInset,
});
const seatStyle = css({
  position: 'absolute',
  zIndex: 2,
  inlineSize: 'var(--game-table-seat-width)',
  maxInlineSize: 'var(--game-table-seat-max-width)',
  insetInlineStart: 'var(--game-table-seat-inline)',
  insetBlockStart: 'var(--game-table-seat-block)',
  transform: 'translate(calc(-50% + var(--game-table-seat-shift-x)), calc(-50% + var(--game-table-seat-shift-y) + var(--game-table-seat-group-shift-y)))',
  '&:dir(rtl)': {
    transform: 'translate(calc(50% - var(--game-table-seat-shift-x)), calc(-50% + var(--game-table-seat-shift-y) + var(--game-table-seat-group-shift-y)))',
  },
});
const centerStyle = css({
  position: 'absolute',
  zIndex: 1,
  insetInlineStart: '50%',
  insetBlockStart: '50%',
  inlineSize: 'var(--game-table-center-size)',
  blockSize: 'var(--game-table-center-size)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transform: 'translate(-50%, -50%)',
  '&:dir(rtl)': { transform: 'translate(50%, -50%)' },
});
const stripStyle = css({ position: 'relative', flexShrink: 0, zIndex: 3, textAlign: 'center' });
const floatingStyle = css({
  position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
  '& > *': { pointerEvents: 'auto' },
});

type TableVariables = CSSProperties & { [key: `--game-table-${string}`]: string };

export function GameTable<T extends SeatLike>({
  ref, seats, slots: suppliedSlots, players, viewport, surface = 'match', turnDirection,
  renderSeat, header, center, dock, footer, floating, slotProps, className, sx, style, ...rest
}: GameTableProps<T>) {
  const slots = suppliedSlots ?? buildAlternatingSlots(seats ?? [], players, resolveTableTurnDirection(turnDirection));
  if (slots.length !== players) {
    throw new Error('GameTable requires one slot per place. Pass fewer seats to fill empty places, or exactly players slots.');
  }
  const layout = buildBoardLayoutModel({
    surface, totalSeats: players,
    viewport: { ...viewport, aspectRatio: viewport.width / Math.max(viewport.height, 1) },
  });
  const { frame } = layout;
  const variables: TableVariables = {
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
    ...style,
  };
  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(rootClass) => (
        <div
          {...rest} ref={ref} className={rootClass} style={variables}
          data-ui="game-table" data-profile={layout.profile} data-surface={surface}
        >
          {isRenderable(header) && (
            <div data-ui="game-table-header" className={slotProps?.header?.className} css={[stripStyle, slotProps?.header?.css]}>
              {header}
            </div>
          )}
          <div data-ui="game-table-shell" css={shellStyle}>
            {/* Stable measurement target for future card flights; owned by this library. */}
            <div
              data-ui="game-table-surface" data-game-surface="true"
              className={slotProps?.surface?.className} css={[surfaceStyle, slotProps?.surface?.css]}
            >
              {slots.map((slot, index) => {
                const geometry = layout.seatGeometries[index];
                if (!geometry) throw new Error('GameTable is missing seat geometry.');
                const seatVariables: TableVariables = {
                  '--game-table-seat-inline': `${geometry.leftPercent}%`,
                  '--game-table-seat-block': `${geometry.topPercent}%`,
                  '--game-table-seat-shift-x': `${geometry.seatShiftX}px`,
                  '--game-table-seat-shift-y': `${geometry.seatShiftY}px`,
                  '--game-table-seat-group-shift-y': `${geometry.groupShiftY}px`,
                };
                return (
                  <div
                    key={slot.key} data-ui="game-table-seat" data-slot-key={slot.key} data-slot-team={slot.teamIdx}
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
          {isRenderable(dock) && (
            <div data-ui="game-table-dock" className={slotProps?.dock?.className} css={[stripStyle, slotProps?.dock?.css]}>
              {dock}
            </div>
          )}
          {isRenderable(footer) && (
            <div data-ui="game-table-footer" className={slotProps?.footer?.className} css={[stripStyle, slotProps?.footer?.css]}>
              {footer}
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
