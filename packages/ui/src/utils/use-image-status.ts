import { useLayoutEffect, useRef, useState } from 'react';

export type ImageStatus = 'loading' | 'loaded' | 'error';

/**
 * Load status of the `<img>` that receives `ref` for `src`. `status` stays `undefined` until the
 * image mounts, and always in server markup, so styles hide only `[data-image-state="loading"]`
 * and an image rendered without JavaScript stays visible. On mount, an image that already finished
 * (`complete` with a `naturalWidth`) counts as loaded: React does not replay a `load` that fired
 * before hydration, and a cached image can finish before any listener exists.
 * Status is keyed by `src`, so a new source starts over without an effect resetting it.
 */
export function useImageStatus(src: string | undefined) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [state, setState] = useState<{ src: string; status: ImageStatus }>();

  useLayoutEffect(() => {
    const image = ref.current;
    if (!image || !src) return;
    const status = image.complete && image.naturalWidth > 0 ? 'loaded' : 'loading';
    setState((current) => (current?.src === src ? current : { src, status }));
  }, [src]);

  return {
    ref,
    status: src && state?.src === src ? state.status : undefined,
    onLoad: () => {
      if (src) setState({ src, status: 'loaded' });
    },
    onError: () => {
      if (src) setState({ src, status: 'error' });
    },
  };
}
