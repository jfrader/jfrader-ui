import { useEffect, type RefObject } from 'react';
import { useLatestCallback } from './use-latest-callback';

export function useFormReset(
  ref: RefObject<{ form: HTMLFormElement | null } | null>,
  onReset: () => void,
  formId?: string,
) {
  const reset = useLatestCallback(onReset);
  useEffect(() => {
    const form = ref.current?.form;
    const listener = (event: Event) => {
      queueMicrotask(() => {
        if (!event.defaultPrevented) reset();
      });
    };
    form?.addEventListener('reset', listener);
    return () => form?.removeEventListener('reset', listener);
  }, [ref, reset, formId]);
}
