// Nesting for floating overlays (Popover, HoverCard, DateRangePicker, Menu). Each layer registers a
// node in one shared floating tree, so a layer opened inside another one is its child: Escape and outside presses
// reach only the topmost open layer, and a press inside a child is not outside its parent.
// The first layer creates the tree; nested layers join it through React context, across portals.
// Overlays that do not take part (Select, Combobox, …) render inside `IsolatedOverlay`, so the
// enclosing layer's tree and node never change their roles, list navigation or focus handling.
import { useMemo, type KeyboardEvent, type ReactNode } from 'react';
import {
  FloatingNode,
  FloatingTree,
  useDismiss,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingTree,
  type ElementProps,
  type FloatingContext,
  type UseDismissProps,
} from '@floating-ui/react';
import { getDeepestNode } from '@floating-ui/react/utils';

/**
 * `container`: a layer whose content holds focus and may host other layers (Popover,
 * DateRangePicker). Escape and outside press are ignored by the layer itself while a child
 * layer is open.
 * `leaf`: a layer that hosts none (HoverCard). Focus usually stays outside it (e.g. in the
 * parent's content, whose own key handling stops the event from bubbling), so Escape is
 * handled in the capture phase and stops at its target once the leaf closes.
 */
export type LayerKind = 'container' | 'leaf';

const CONTAINER_DISMISS = { escapeKey: true, outsidePress: true, bubbles: false } satisfies UseDismissProps;

const LAYER_DISMISS = {
  container: CONTAINER_DISMISS,
  leaf: { ...CONTAINER_DISMISS, capture: { escapeKey: true, outsidePress: true } },
} satisfies Record<LayerKind, UseDismissProps>;

/**
 * Escape that reaches a container while a descendant layer is open (focus is in the
 * container's own content, not in the child) closes the topmost open descendant. The
 * container's dismiss handler, which runs next, keeps the container open and stops the event.
 */
function useTopmostEscape(context: FloatingContext, enabled: boolean): ElementProps {
  const tree = useFloatingTree();
  const { nodeId } = context;

  return useMemo(() => {
    if (!enabled || !tree) return {};
    const onKeyDown = (event: KeyboardEvent<Element>) => {
      if (event.key !== 'Escape' || event.nativeEvent.isComposing) return;
      const topmost = getDeepestNode(tree.nodesRef.current, nodeId);
      if (topmost && topmost.id !== nodeId) topmost.context?.onOpenChange(false, event.nativeEvent, 'escape-key');
    };
    return { reference: { onKeyDown }, floating: { onKeyDown } };
  }, [enabled, tree, nodeId]);
}

/** Escape and outside-press dismissal for one layer; pass the result into `useInteractions`. */
export function useLayerDismiss(context: FloatingContext, kind: LayerKind): ElementProps[] {
  const topmostEscape = useTopmostEscape(context, kind === 'container');
  const dismiss = useDismiss(context, LAYER_DISMISS[kind]);
  return [topmostEscape, dismiss];
}

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

/**
 * A layer for a menu. Its node joins the tree under the enclosing layer like any other, but the
 * menu's own hooks see no parent node: useRole and useListNavigation read a parent node as a parent
 * menu (a menuitem trigger, cross-axis open/close keys). The menu's content re-provides the node
 * through `LayerContent`, so layers opened inside it nest under it.
 */
export function MenuLayer({ children }: { children: (nodeId: string | undefined) => ReactNode }) {
  return <OverlayLayer>{(nodeId) => <FloatingNode id={undefined}>{children(nodeId)}</FloatingNode>}</OverlayLayer>;
}

MenuLayer.displayName = 'MenuLayer';

/** Makes `nodeId` the parent of layers rendered inside `children`. */
export function LayerContent({ nodeId, children }: { nodeId: string | undefined; children: ReactNode }) {
  return <FloatingNode id={nodeId}>{children}</FloatingNode>;
}

LayerContent.displayName = 'LayerContent';

/**
 * Root boundary for an overlay that does not take part in layer nesting. Inside a layer it gets
 * its own empty tree and no parent node, so it never reads the enclosing layer as its parent.
 */
export function IsolatedOverlay({ children }: { children: ReactNode }) {
  const tree = useFloatingTree();
  const parentNodeId = useFloatingParentNodeId();
  if (!tree && !parentNodeId) return children;
  return (
    <FloatingTree>
      <FloatingNode id={undefined}>{children}</FloatingNode>
    </FloatingTree>
  );
}

IsolatedOverlay.displayName = 'IsolatedOverlay';
