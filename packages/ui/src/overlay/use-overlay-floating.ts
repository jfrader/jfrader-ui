import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
  type OpenChangeReason,
  type Placement,
  type UseFloatingReturn,
} from '@floating-ui/react';

/** Gap between the trigger and the floating surface, in px (matches `space[2]`). */
const ANCHOR_GAP = 8;
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
}: OverlayFloatingOptions): UseFloatingReturn<HTMLButtonElement> {
  const detectOverflow = { padding: VIEWPORT_PADDING, ...(boundary ? { boundary } : {}) };
  return useFloating<HTMLButtonElement>({
    open,
    onOpenChange,
    placement,
    nodeId,
    middleware: [
      offset(ANCHOR_GAP),
      flip(detectOverflow),
      shift(detectOverflow),
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
