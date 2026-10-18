'use client';

import type { ComponentPropsWithRef } from 'react';
import { MotionConfig, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes } from '../../styling/css';
import { REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';

export type StreamingCaretSize = 'sm' | 'md' | 'lg';
export interface StreamingCaretProps extends ComponentPropsWithRef<'span'>, SxProps {
  size?: StreamingCaretSize;
}
const blink = keyframes({ '0%, 100%': { opacity: 1 }, '50%': { opacity: 0 } });
const style = css({
  display: 'inline-block',
  inlineSize: '0.125em',
  blockSize: '1em',
  marginInlineStart: vars.space[1],
  backgroundColor: 'currentColor',
  verticalAlign: 'text-bottom',
  animation: `${blink} calc(${vars.motion.duration.slow} * 3) step-end infinite`,
  '&[data-reduced-motion]': { animation: 'none' },
  [REDUCED_MOTION]: { animation: 'none' },
});
const sizes = {
  sm: css({ fontSize: vars.textSize.sm }),
  md: css({ fontSize: vars.textSize.md }),
  lg: css({ fontSize: vars.textSize.lg }),
};
export function StreamingCaret({
  size = 'md', ref, className, sx, 'aria-hidden': hidden = true, ...props
}: StreamingCaretProps) {
  const reducedMotion = useReducedMotion();
  return (
    <MotionConfig reducedMotion="user">
      <WithSx styles={[style, sizes[size]]} className={className} sx={sx}>
        {(className) => (
          <span
            {...props}
            ref={ref}
            aria-hidden={hidden}
            data-ui="streaming-caret"
            data-reduced-motion={reducedMotion || undefined}
            className={className}
          />
        )}
      </WithSx>
    </MotionConfig>
  );
}
StreamingCaret.displayName = 'StreamingCaret';
