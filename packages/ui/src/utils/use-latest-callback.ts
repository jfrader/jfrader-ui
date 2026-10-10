import { useCallback, useEffect, useRef } from 'react';

/**
 * A stable function that forwards to the latest `callback` (a no-op while it is undefined), so
 * an inline consumer callback does not change the identity of the memoized values it feeds.
 * No render-time ref writes: an abandoned render cannot leak its callback.
 * `useControlledState`'s setter and Combobox's `onInputChange` call this only from event
 * handlers, after commit/effects, so they see the current callback. A child layout effect
 * in the commit that swaps the callback can still see the previous one; that is acceptable
 * for these event-only call sites. Initializing the ref keeps pre-effect mount calls correct.
 */
export function useLatestCallback<Args extends unknown[]>(callback: ((...args: Args) => void) | undefined) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });
  return useCallback((...args: Args) => callbackRef.current?.(...args), []);
}
