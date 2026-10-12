// Retained exits for surfaces whose motion is styled: entrances run from `@starting-style`, exits
// are transitions keyed on `data-state="closing"`. Reduced motion zeroes those transitions, so
// there is nothing to wait for and the exit completes on the next microtask.
import { useEffect, useRef, useState } from 'react';
import type { NativeDialogTransition } from './use-native-dialog';

/**
 * Settles once the finite animations and transitions running on `element` (and, with `subtree`,
 * its descendants and pseudo-elements such as `::backdrop`) have finished or been canceled.
 * Infinite animations (spinners) never hold the exit.
 */
export function exitMotionFinished(element: Element, { subtree = true } = {}): Promise<unknown> {
  const running =
    typeof element.getAnimations === 'function'
      ? element
          .getAnimations({ subtree })
          .filter((animation) => Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))
      : [];
  return Promise.allSettled(running.map((animation) => animation.finished));
}

/**
 * Native dialog transition for styled motion: `useNativeDialog` renders `data-state="closing"`
 * before the exit runs, so the exit only waits for the transitions that state started.
 */
export const styledDialogTransition: NativeDialogTransition = {
  // The entrance runs from `@starting-style`; a reopen during the exit reverses the transitions.
  enter: () => {},
  exit: (dialog) => exitMotionFinished(dialog),
};

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
    let cancelled = false;
    void exitMotionFinished(element).then(() => {
      if (!cancelled) setPresent(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, present]);

  return { ref, present, closing: present && !open };
}
