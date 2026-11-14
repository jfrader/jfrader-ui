import { useEffect, type ReactElement } from 'react';
import { FloatingFocusManager, type FloatingContext } from '@floating-ui/react';
import { focusable, tabbable } from 'tabbable';
import { OverlayPortal } from '../../overlay/overlay-portal';

export function MenuFocusManager({ context, children }: { context: FloatingContext; children: ReactElement }) {
  const { elements: { domReference, floating }, onOpenChange } = context;

  useEffect(() => {
    if (!domReference || !floating) return;
    const document = floating.ownerDocument;
    if (!document.defaultView || !(domReference instanceof document.defaultView.HTMLElement)) return;
    const reference = domReference;
    const surface = floating;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const active = document.activeElement;
      const inside = surface.contains(active);
      if (!inside && active !== reference) return;

      const content = tabbable(surface);
      const index = content.findIndex((element) => element === active);
      if (inside && index !== -1 && (event.shiftKey ? index > 0 : index < content.length - 1)) return;

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

      const scope = reference.closest('dialog:modal') ?? document.body;
      const outside = tabbable(scope).filter((element) => !surface.contains(element));
      const referenceIndex = outside.findIndex((element) => element === reference);
      const next = referenceIndex === -1
        ? outside.find((element) => reference.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
        : outside[referenceIndex + 1];
      onOpenChange(false, event, 'focus-out');
      if (next) {
        event.preventDefault();
        next.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [domReference, floating, onOpenChange]);

  return (
    <OverlayPortal preserveTabOrder={false}>
      <FloatingFocusManager context={context} modal={false} guards={false} initialFocus={-1} returnFocus={false} restoreFocus>
        {children}
      </FloatingFocusManager>
    </OverlayPortal>
  );
}
