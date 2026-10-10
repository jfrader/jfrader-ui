import {
  autoUpdate,
  flip,
  offset,
  shift,
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
}

/**
 * Shared positioning for Popover, Tooltip and Menu. `autoUpdate` only runs while both
 * elements are mounted, so a closed (unmounted) surface does no positioning work.
 */
export function useOverlayFloating({
  open,
  onOpenChange,
  placement,
}: OverlayFloatingOptions): UseFloatingReturn<HTMLButtonElement> {
  return useFloating<HTMLButtonElement>({
    open,
    onOpenChange,
    placement,
    middleware: [offset(ANCHOR_GAP), flip({ padding: VIEWPORT_PADDING }), shift({ padding: VIEWPORT_PADDING })],
    whileElementsMounted: autoUpdate,
  });
}
