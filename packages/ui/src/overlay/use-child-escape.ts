import { useLayoutEffect, useRef, type RefObject } from 'react';

const openLayers = new Set<Element>();
const OPEN_CHILD_SELECTOR = '[aria-expanded="true"][aria-haspopup], dialog[open]';

export function registerOpenLayer(element: Element) {
  openLayers.add(element);
  return () => { openLayers.delete(element); };
}

function hasOpenChild(element: HTMLElement) {
  for (const layer of openLayers) {
    if (layer !== element && element.contains(layer) && !layer.closest('[inert]')) return true;
  }
  return Array.from(element.querySelectorAll(OPEN_CHILD_SELECTOR)).some(child => !child.closest('[inert]'));
}

export function useChildEscape(elementRef: RefObject<HTMLElement | null>) {
  const owned = useRef(false);
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const document = element.ownerDocument;
    const capture = (event: KeyboardEvent) => {
      owned.current = event.key === 'Escape' && (event.isComposing || hasOpenChild(element));
    };
    const release = () => { owned.current = false; };
    element.addEventListener('keydown', capture, true);
    document.addEventListener('keyup', release, true);
    document.addEventListener('pointerdown', release, true);
    document.defaultView?.addEventListener('blur', release);
    return () => {
      element.removeEventListener('keydown', capture, true);
      document.removeEventListener('keyup', release, true);
      document.removeEventListener('pointerdown', release, true);
      document.defaultView?.removeEventListener('blur', release);
    };
  });
  return owned;
}
