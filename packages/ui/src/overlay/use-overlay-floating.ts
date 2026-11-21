import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
  useFloatingTree,
  type OpenChangeReason,
  type Placement,
  type ReferenceType,
  type Strategy,
  type UseFloatingReturn,
} from '@floating-ui/react';
import { getDeepestNode } from '@floating-ui/react/utils';
import { useLatestCallback } from '../utils/use-latest-callback';

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
  shiftCrossAxis?: boolean;
  /**
   * Explicit anchor for an overlay without a trigger, such as a tour step. When omitted,
   * the overlay uses the element registered through `refs.setReference`.
   */
  reference?: Element | null;
  /** Called after each positioning pass, for chrome that tracks the anchor. */
  onUpdate?: () => void;
}

export interface OverlayAvailableSize {
  width: number;
  height: number;
}

/**
 * Shared positioning for Popover, Tooltip and Menu. `autoUpdate` only runs while both
 * elements are mounted, so a closed (unmounted) surface does no positioning work.
 */
export function useOverlayFloating<Reference extends ReferenceType = HTMLButtonElement>(
  options: OverlayFloatingOptions,
): UseFloatingReturn<Reference>;
export function useOverlayFloating(options: OverlayFloatingOptions): UseFloatingReturn<HTMLButtonElement>;
export function useOverlayFloating<Reference extends ReferenceType = HTMLButtonElement>({
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
  shiftCrossAxis = true,
  reference,
  onUpdate,
}: OverlayFloatingOptions): UseFloatingReturn<Reference> {
  const tree = useFloatingTree();
  const childOwnsPointerRef = useRef(false);
  const onPositionUpdate = useLatestCallback(onUpdate);
  const detectOverflow = { padding: VIEWPORT_PADDING, ...(boundary ? { boundary } : {}) };
  const floating = useFloating<Reference>({
    open,
    onOpenChange: (next, event, reason) => {
      if (!next && reason === 'focus-out' && childOwnsPointerRef.current) return;
      onOpenChange(next, event, reason);
    },
    placement,
    nodeId,
    strategy,
    transform,
    elements: reference ? { reference } : undefined,
    middleware: [
      offset(gap),
      collision === 'shift' && flip(detectOverflow),
      collision === 'shift' && shift({ ...detectOverflow, crossAxis: shiftCrossAxis }),
      onAvailableSize &&
        size({
          ...detectOverflow,
          apply: ({ availableWidth, availableHeight }) =>
            onAvailableSize({ width: availableWidth, height: availableHeight }),
        }),
    ],
    whileElementsMounted: (referenceEl, floatingEl, update) =>
      autoUpdate(referenceEl, floatingEl, () => {
        update();
        onPositionUpdate();
      }),
  });

  // `elements.reference` seeds the first position. The option is not reactive on its
  // own, so a step that moves to another target must register the new element.
  useLayoutEffect(() => {
    if (reference === undefined) return;
    floating.refs.setReference((reference ?? null) as Reference | null);
  }, [reference, floating.refs]);

  const anchor = floating.elements.domReference;
  useEffect(() => {
    if (!open || !tree || nodeId === undefined || !anchor) return;
    const doc = anchor.ownerDocument;
    const onPointerDown = () => {
      const topmost = getDeepestNode(tree.nodesRef.current, nodeId);
      childOwnsPointerRef.current = Boolean(topmost && topmost.id !== nodeId);
    };
    const reset = () => { childOwnsPointerRef.current = false; };
    doc.addEventListener('pointerdown', onPointerDown, true);
    doc.addEventListener('pointerup', reset, true);
    doc.addEventListener('pointercancel', reset, true);
    doc.addEventListener('keydown', reset, true);
    return () => {
      reset();
      doc.removeEventListener('pointerdown', onPointerDown, true);
      doc.removeEventListener('pointerup', reset, true);
      doc.removeEventListener('pointercancel', reset, true);
      doc.removeEventListener('keydown', reset, true);
    };
  }, [open, tree, nodeId, anchor]);

  return floating;
}
