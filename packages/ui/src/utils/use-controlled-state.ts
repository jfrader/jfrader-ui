import { useCallback, useRef, useState } from 'react';
import { useLatestCallback } from './use-latest-callback';

/**
 * One state authority for controlled/uncontrolled components.
 * `value === undefined` means uncontrolled; internal state seeds from `defaultValue`.
 * Requests dedupe against the current value and notify only through `onChange`.
 * Do not switch modes during an instance's lifetime (see SKILL.md §5).
 */
export function useControlledState<T>(
  value: T | undefined,
  defaultValue: T | undefined,
  onChange?: (next: T) => void,
) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<T | undefined>(defaultValue);
  const current = isControlled ? value : internal;
  const currentRef = useRef(current);
  currentRef.current = current;
  const notify = useLatestCallback(onChange);

  // Keyed on the mode only: an inline `onChange` must not give every render a new setter,
  // since roots pass it into their memoized context values.
  const requestChange = useCallback(
    (next: T) => {
      if (next === currentRef.current) return;
      if (!isControlled) setInternal(next);
      notify(next);
    },
    [isControlled, notify],
  );

  return [current, requestChange] as const;
}
