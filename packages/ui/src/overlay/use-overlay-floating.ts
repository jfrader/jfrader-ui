import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
  type OpenChangeReason,
  type Placement,
  type Strategy,
  type UseFloatingReturn,
} from '@floating-ui/react';

/** Gap between the trigger and the floating surface, in px (matches `space[2]`). */
export const ANCHOR_GAP = 8;
/** Minimum distance kept from the viewport edge when flipping or shifting, in px. */
const VIEWPORT_PADDING = 8;

export interface OverlayFloatingOptions {
  open: boolean;
  onOpenChange: (open: boolean, event?: Event, reason?: OpenChangeReason) => void;
  placement: Placement;
  /** Node id from `OverlayLayer`, for overlays that take part in nested dismissal. */
  nodeId?: string;
  /** Collision boundary for flip/shift/size. Defaults to the clipping ancestors (and viewport). */
  boundary?: Element | null;
  /** Receives the space left for the surface inside the boundary after each positioning pass. */
  onAvailableSize?: (size: OverlayAvailableSize) => void;
  /** CSS positioning strategy. Defaults to `absolute`. */
  strategy?: Strategy;
  /** Gap between the anchor and the surface, in px. Defaults to `ANCHOR_GAP`. */
  gap?: number;
  /** Position with `transform` (default) or with `left`/`top`, which leaves `transform` and
   * `scale` free for the surface's own animation. */
  transform?: boolean;
  /** Disable viewport flip and shift for geometry owned by the consumer. */
  collision?: 'shift' | 'none';
}

export interface OverlayAvailableSize {
  width: number;
  height: number;
}

/**
 * Shared positioning for Popover, Tooltip and Menu. `autoUpdate` only runs while both
 * elements are mounted, so a closed (unmounted) surface does no positioning work.
 */
export function useOverlayFloating({
  open,
  onOpenChange,
  placement,
  nodeId,
  boundary,
  onAvailableSize,
  strategy,
  gap = ANCHOR_GAP,
  transform,
  collision = 'shift',
}: OverlayFloatingOptions): UseFloatingReturn<HTMLButtonElement> {
  const detectOverflow = { padding: VIEWPORT_PADDING, ...(boundary ? { boundary } : {}) };
  return useFloating<HTMLButtonElement>({
    open,
    onOpenChange,
    placement,
    nodeId,
    strategy,
    transform,
    middleware: [
      offset(gap),
      collision === 'shift' && flip(detectOverflow),
      collision === 'shift' && shift({ ...detectOverflow, crossAxis: true }),
      onAvailableSize &&
        size({
          ...detectOverflow,
          apply: ({ availableWidth, availableHeight }) =>
            onAvailableSize({ width: availableWidth, height: availableHeight }),
        }),
    ],
    whileElementsMounted: autoUpdate,
  });
}
