import { useCallback, useRef, useState } from 'react';

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

  const requestChange = useCallback(
    (next: T) => {
      if (next === currentRef.current) return;
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  return [current, requestChange] as const;
}
