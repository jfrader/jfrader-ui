'use client';

import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';

export type PatternVariant = 'stripes' | 'diagonal' | 'checks' | 'dots' | 'waves' | 'chevron';
export type PatternSize = 'sm' | 'md' | 'lg';
export type PatternTone = 'neutral' | 'accent' | 'card';

export interface PatternProps
  extends Omit<ComponentPropsWithRef<'svg'>, 'children' | 'viewBox' | 'aria-hidden' | 'tabIndex'>,
    SxProps {
  /** Reading direction; inherits from the surrounding surface when omitted. */
  dir?: 'ltr' | 'rtl';
  /** Repeating tile geometry. Defaults to `diagonal`. */
  variant?: PatternVariant;
  /** Tile side: `sm` 8px, `md` 16px, `lg` 24px. Defaults to `md`. */
  size?: PatternSize;
  /** Positive, finite multiplier of the tile side. Defaults to 1. */
  scale?: number;
  /** Token inks: `neutral`/`accent` for general surfaces; `card` uses red/paper for card backs. */
  tone?: PatternTone;
}

const rootStyle = css({
  display: 'block',
  inlineSize: '100%',
  blockSize: '100%',
  pointerEvents: 'none',
  '&[data-variant="diagonal"], &[data-variant="chevron"]': {
    '&[dir="rtl"], &:not([dir]):dir(rtl)': { transform: 'scaleX(-1)' },
  },
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    '& > rect': { fill: 'transparent' },
  },
});

const tileSizes: Record<PatternSize, number> = {
  sm: Number.parseFloat(base.space[2]),
  md: Number.parseFloat(base.space[4]),
  lg: Number.parseFloat(base.space[6]),
};

const inks: Record<PatternTone, { paper: string; ink: string }> = {
  neutral: { paper: vars.color.surfaceRaised, ink: vars.color.borderStrong },
  accent: { paper: vars.color.accentSoft, ink: vars.color.accent },
  card: { paper: vars.color.cardRed, ink: vars.color.cardFace },
};

const tiles: Record<PatternVariant, ReactNode> = {
  stripes: <rect width="4" height="16" />,
  diagonal: <path d="M0 0L16 16H12L0 4ZM12 0H16V4Z" />,
  checks: <path d="M0 0H8V8H0ZM8 8H16V16H8Z" />,
  dots: <circle cx="8" cy="8" r="2" />,
  waves: <path d="M0 7C4 1 4 1 8 7S12 13 16 7V9C12 15 12 15 8 9S4 3 0 9Z" />,
  chevron: <path d="M0 10L8 2L16 10V14L8 6L0 14Z" />,
};

/** Decorative SVG tiles. In forced colors, paints nothing so the enclosing surface and border remain visible. */
export function Pattern({
  ref,
  variant = 'diagonal',
  size = 'md',
  scale = 1,
  tone = 'neutral',
  className,
  sx,
  ...rest
}: PatternProps) {
  const id = useId();
  const tileSide = tileSizes[size] * (Number.isFinite(scale) && scale > 0 ? scale : 1);
  const { paper, ink } = inks[tone];

  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(rootClass) => (
        <svg {...rest} ref={ref} className={rootClass} data-ui="pattern" data-variant={variant}
          data-size={size} data-scale={scale}
          aria-hidden="true" focusable="false">
          <defs>
            <pattern id={id} patternUnits="userSpaceOnUse" width={tileSide} height={tileSide}
              viewBox="0 0 16 16">
              <rect width="16" height="16" fill={paper} />
              <g fill={ink} color={ink}>{tiles[variant]}</g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${id})`} />
        </svg>
      )}
    </WithSx>
  );
}

Pattern.displayName = 'Pattern';
