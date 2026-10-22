import { useRef } from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

/**
 * A `motion.div` that holds its own compositor layer only while a layout animation runs.
 *
 * Layout animations write a new transform every frame. Without a layer, the browser repaints the
 * box each frame, and image content (vector artwork above all) re-rasterizes at every scale step.
 * `will-change` is set on start and cleared on completion, so the box rasterizes once per
 * animation, static content stays crisp, and the layer's memory is released afterwards.
 */
export function LayoutLayer({ onLayoutAnimationStart, onLayoutAnimationComplete, ...props }: HTMLMotionProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <motion.div
      {...props}
      ref={ref}
      onLayoutAnimationStart={() => {
        ref.current?.style.setProperty('will-change', 'transform');
        onLayoutAnimationStart?.();
      }}
      onLayoutAnimationComplete={() => {
        ref.current?.style.removeProperty('will-change');
        onLayoutAnimationComplete?.();
      }}
    />
  );
}
