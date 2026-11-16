'use client';

import { useEffect } from 'react';
import { useFloatingTree, type FloatingContext } from '@floating-ui/react';
import { getNodeChildren } from '@floating-ui/react/utils';
import { focusable, tabbable } from 'tabbable';

export function useFloatingTabOrder(context: FloatingContext, { enabled = true, closeOnFocusOut = true } = {}) {
  const { elements: { domReference, floating }, onOpenChange } = context;
  const tree = useFloatingTree();

  useEffect(() => {
    if (!enabled || !domReference || !floating) return;
    const document = floating.ownerDocument;
    if (!document.defaultView || !(domReference instanceof document.defaultView.HTMLElement)) return;
    const reference = domReference;
    const surface = floating;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const active = document.activeElement;
      const childOwnsFocus = tree && getNodeChildren(tree.nodesRef.current, context.nodeId).some(node =>
        (!event.shiftKey && node.context?.elements.domReference === active) || node.context?.elements.floating?.contains(active));
      if (childOwnsFocus) return;
      const inside = surface.contains(active);
      const content = tabbable(surface);
      const scope = reference.closest('dialog:modal') ?? document.body;
      const outside = tabbable(scope).filter((element) => !surface.contains(element));
      const referenceIndex = outside.findIndex((element) => element === reference);
      const next = referenceIndex === -1
        ? outside.find((element) => reference.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
        : outside[referenceIndex + 1];
      if (!inside && active !== reference) {
        if (!closeOnFocusOut && event.shiftKey && active === next && content.length) {
          event.preventDefault();
          content[content.length - 1]!.focus();
        }
        return;
      }

      const index = content.findIndex((element) => element === active);
      if (inside && index !== -1 && (event.shiftKey ? index > 0 : index < content.length - 1)) return;

      // A consumer can focus the surface itself (a panel announced as a dialog). Tab then
      // enters its first control instead of skipping the whole panel and leaving the layer.
      if (inside && index === -1 && !event.shiftKey && content.length) {
        event.preventDefault();
        content[0]!.focus();
        return;
      }

      if (event.shiftKey) {
        if (inside) {
          event.preventDefault();
          reference.focus();
        }
        return;
      }

      const first = content[0] ?? focusable(surface).find((element) => element.getAttribute('aria-disabled') !== 'true');
      if (!inside && first) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (closeOnFocusOut) onOpenChange(false, event, 'focus-out');
      if (next) {
        event.preventDefault();
        next.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled, closeOnFocusOut, domReference, floating, onOpenChange, tree, context.nodeId]);
}
