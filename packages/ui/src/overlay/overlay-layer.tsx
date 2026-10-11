// Nesting for floating overlays (Popover, HoverCard). Each layer registers a node in one shared
// floating tree, so a layer opened inside another one is its child: Escape and outside presses
// reach only the topmost open layer, and a press inside a child is not outside its parent.
// The first layer creates the tree; nested layers join it through React context, across portals.
import type { ReactNode } from 'react';
import {
  FloatingNode,
  FloatingTree,
  useFloatingNodeId,
  useFloatingTree,
  type UseDismissProps,
} from '@floating-ui/react';

/**
 * Dismissal for a layer that hosts other layers (Popover): Escape and outside press, both
 * ignored while a child layer is open.
 */
export const CONTAINER_LAYER_DISMISS = {
  escapeKey: true,
  outsidePress: true,
  bubbles: false,
} satisfies UseDismissProps;

/**
 * Dismissal for a layer that hosts none (HoverCard). Focus usually stays outside it (e.g. in
 * the parent's content, whose own key handling stops the event from bubbling), so Escape is
 * handled in the capture phase and stops at its target once the leaf closes.
 */
export const LEAF_LAYER_DISMISS = {
  ...CONTAINER_LAYER_DISMISS,
  capture: { escapeKey: true, outsidePress: true },
} satisfies UseDismissProps;

function LayerNode({ children }: { children: (nodeId: string | undefined) => ReactNode }) {
  const nodeId = useFloatingNodeId();
  return <FloatingNode id={nodeId}>{children(nodeId)}</FloatingNode>;
}

/**
 * Registers one overlay layer and renders `children` with its node id, which the layer passes
 * to `useOverlayFloating`. Layers rendered inside `children` become its children in the tree.
 */
export function OverlayLayer({ children }: { children: (nodeId: string | undefined) => ReactNode }) {
  const tree = useFloatingTree();
  const node = <LayerNode>{children}</LayerNode>;
  return tree ? node : <FloatingTree>{node}</FloatingTree>;
}

OverlayLayer.displayName = 'OverlayLayer';
