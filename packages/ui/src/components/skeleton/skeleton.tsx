// Decorative loading placeholder: aria-hidden, no role, not focusable. Announce the loading state
// elsewhere (a Spinner, aria-busy on the region being filled). Dimensions are dynamic, so they go
// through the style attribute; numbers are pixels, strings pass through as CSS lengths.
import type { ComponentPropsWithRef } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes } from '../../styling/css';
import { REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';

type Length = number | string;

export interface SkeletonProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  width?: Length;
  height?: Length;
  /** Round placeholder; height follows width unless `height` is given. */
  circle?: boolean;
  radius?: Length;
}

// Background is twice the element width: 200% parks the highlight before the start, -100% past the end.
const shimmer = keyframes({
  from: { backgroundPosition: '200% 0' },
  to: { backgroundPosition: '-100% 0' },
});

const baseStyle = css({
  display: 'block',
  inlineSize: '100%',
  blockSize: '1em',
  flexShrink: 0,
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.surfaceHover,
  backgroundImage: `linear-gradient(90deg, transparent, ${vars.color.border}, transparent)`,
  backgroundSize: '200% 100%',
  backgroundRepeat: 'no-repeat',
  animation: `${shimmer} 1.6s ease-in-out infinite`,
  '&:dir(rtl)': { animationDirection: 'reverse' },
  [REDUCED_MOTION]: {
    animation: 'none',
    backgroundImage: 'none',
  },
});

const circleStyle = css({
  inlineSize: vars.space[10],
  blockSize: 'auto',
  aspectRatio: '1',
  borderRadius: vars.radius.full,
});

export function Skeleton({ ref, width, height, circle = false, radius, style, className, sx, ...rest }: SkeletonProps) {
  return (
    <WithSx className={className} styles={[baseStyle, circle && circleStyle]} sx={sx}>
      {(className) => (
        <div
          {...rest}
          ref={ref}
          aria-hidden="true"
          data-ui="skeleton"
          style={{ inlineSize: width, blockSize: height, borderRadius: circle ? undefined : radius, ...style }}
          className={className}
        />
      )}
    </WithSx>
  );
}

Skeleton.displayName = 'Skeleton';
