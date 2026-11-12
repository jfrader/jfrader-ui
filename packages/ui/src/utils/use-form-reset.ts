import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useLatestCallback } from './use-latest-callback';

export function useFormReset(
  ref: RefObject<{ form: HTMLFormElement | null } | null>,
  onReset: () => void,
  _formId?: string,
) {
  const reset = useLatestCallback(onReset);
  const binding = useRef<{
    element: { form: HTMLFormElement | null };
    form: HTMLFormElement;
    dispose: () => void;
  } | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    const form = element?.form;
    if (binding.current?.element === element && binding.current?.form === form) return;
    binding.current?.dispose();
    binding.current = null;
    const ownerWindow = form?.ownerDocument.defaultView;
    if (!element || !form || !ownerWindow) return;
    const pending = new Set<number>();
    const listener = (event: Event) => {
      const task = ownerWindow.setTimeout(() => {
        pending.delete(task);
        if (!event.defaultPrevented && ref.current === element && element.form === form && form.isConnected) reset();
      }, 0);
      pending.add(task);
    };
    form.addEventListener('reset', listener);
    binding.current = {
      element,
      form,
      dispose: () => {
        form.removeEventListener('reset', listener);
        for (const task of pending) ownerWindow.clearTimeout(task);
      },
    };
  });
  useLayoutEffect(() => () => {
    binding.current?.dispose();
    binding.current = null;
  }, []);
}
