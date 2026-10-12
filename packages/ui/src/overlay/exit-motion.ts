// Retained exits: an overlay that is closing keeps its surface (or native top-layer state) until
// its exit transitions settle. Reduced motion zeroes those transitions, so there is nothing to
// wait for and the exit completes on the next microtask.
import { useEffect, useRef, useState } from 'react';

/**
 * Calls `done` once the finite animations and transitions running on `element` (and, with
 * `subtree`, its descendants and pseudo-elements such as `::backdrop`) have finished or been
 * canceled. Infinite animations (spinners) never hold the exit. Returns a cancel function.
 */
export function afterExitMotion(element: Element, done: () => void, { subtree = true } = {}): () => void {
  const running =
    typeof element.getAnimations === 'function'
      ? element
          .getAnimations({ subtree })
          .filter((animation) => Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))
      : [];
  let cancelled = false;
  void Promise.allSettled(running.map((animation) => animation.finished)).then(() => {
    if (!cancelled) done();
  });
  return () => {
    cancelled = true;
  };
}

/**
 * Presence for a floating surface that unmounts when closed: it stays mounted while `closing`
 * so its exit transition (styled through `data-state="closing"`) can run. Attach `ref` to the
 * surface; reopening during the exit keeps the same mount.
 */
export function useExitPresence<T extends Element>(open: boolean) {
  const ref = useRef<T | null>(null);
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);

  useEffect(() => {
    if (open || !present) return;
    const element = ref.current;
    if (!element) {
      setPresent(false);
      return;
    }
    return afterExitMotion(element, () => setPresent(false));
  }, [open, present]);

  return { ref, present, closing: present && !open };
}
