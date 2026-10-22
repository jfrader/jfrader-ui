import { useCallback, useEffect, useRef } from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

/** Motion stops an interrupted layout animation without firing `onLayoutAnimationComplete`. */
const LAYOUT_LAYER_TIMEOUT_MS = 1500;

/**
 * A `motion.div` that holds its own compositor layer only while a layout animation runs.
 *
 * Layout animations write a new transform every frame. Without a layer, the browser repaints the
 * box each frame, and image content (vector artwork above all) re-rasterizes at every scale step.
 * `will-change` is set on start and cleared on completion or after a safety timeout, so the box
 * rasterizes once per animation, static content stays crisp, and the layer's memory is released
 * even when Motion cancels the animation on a resize or a newer layout change.
 */
export function LayoutLayer({ onLayoutAnimationStart, onLayoutAnimationComplete, ...props }: HTMLMotionProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearLayer = useCallback(() => {
    ref.current?.style.removeProperty('will-change');
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  useEffect(() => clearLayer, [clearLayer]);
  return (
    <motion.div
      {...props}
      ref={ref}
      onLayoutAnimationStart={() => {
        ref.current?.style.setProperty('will-change', 'transform');
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = setTimeout(clearLayer, LAYOUT_LAYER_TIMEOUT_MS);
        onLayoutAnimationStart?.();
      }}
      onLayoutAnimationComplete={() => {
        clearLayer();
        onLayoutAnimationComplete?.();
      }}
    />
  );
}
