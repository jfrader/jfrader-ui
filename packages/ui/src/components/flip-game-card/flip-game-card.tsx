'use client';

import { useEffect, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { MotionConfig, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import type { GameCardPartProps, GameCardSize } from '../game-card';
import { CARD_FRAME, CARD_PERSPECTIVE } from '../game-card/card-frame';
import { gameCardSizeStyles } from '../game-card/game-card';

export interface FlipGameCardProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  /** Shows `back` when true and `front` when false. No interaction changes this prop. */
  flipped: boolean;
  /** Content shown when `flipped` is false. */
  front: ReactNode;
  /** Content shown when `flipped` is true. Both faces stay mounted. */
  back: ReactNode;
  /** Card width, using the GameCard scale. Defaults to `md`. */
  size?: GameCardSize;
  slotProps?: {
    rotator?: GameCardPartProps;
    front?: GameCardPartProps;
    back?: GameCardPartProps;
  };
}

const rootStyle = css({
  label: 'flip-game-card',
  position: 'relative',
  flexShrink: 0,
  inlineSize: 'var(--game-card-width)',
  blockSize: `calc(var(--game-card-width) * ${CARD_FRAME.ratio})`,
  borderRadius: `calc(var(--game-card-width) / ${CARD_FRAME.cornerDivisor})`,
  perspective: CARD_PERSPECTIVE.flip,
});

const stillStyle = css({
  '& > [data-ui="flip-game-card-rotator"]': {
    transform: 'none',
    transition: 'none',
    '& > [aria-hidden="true"]': { visibility: 'hidden' },
  },
});

const reducedStyle = css({
  '&[data-reduced-motion="true"]': stillStyle,
  [REDUCED_MOTION]: stillStyle,
});

const rotatorStyle = css({
  position: 'relative',
  inlineSize: '100%',
  blockSize: '100%',
  transformStyle: 'preserve-3d',
  transform: 'rotateY(0deg)',
  transition: `transform ${vars.motion.duration.cardFlip} ${vars.motion.easeCardFlip}`,
  '&[data-state="back"]': { transform: 'rotateY(180deg)' },
});

const faceStyle = css({
  position: 'absolute',
  inset: 0,
  backfaceVisibility: 'hidden',
  '& > [data-ui~="game-card"]': { '--game-card-width': 'inherit', inlineSize: '100%', blockSize: '100%' },
});

const backStyle = css({
  transform: 'rotateY(180deg)',
  '&[data-reduced-motion="true"]': { transform: 'none' },
  [REDUCED_MOTION]: { transform: 'none' },
});

export function FlipGameCard({
  ref,
  flipped,
  front,
  back,
  size = 'md',
  slotProps,
  className,
  sx,
  ...rest
}: FlipGameCardProps) {
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const state = flipped ? 'back' : 'front';

  return (
    <MotionConfig reducedMotion="user">
      <WithSx className={className} styles={[rootStyle, gameCardSizeStyles[size], reducedStyle]} sx={sx}>
        {(rootClass) => (
          <div
            {...rest}
            ref={ref}
            className={rootClass}
            data-ui="flip-game-card"
            data-state={state}
            data-size={size}
            data-reduced-motion={(mounted && reducedMotion) || undefined}
          >
            <div
              data-ui="flip-game-card-rotator"
              data-state={state}
              className={slotProps?.rotator?.className}
              css={[rotatorStyle, slotProps?.rotator?.css]}
            >
              <div
                data-ui="flip-game-card-front"
                inert={flipped}
                aria-hidden={flipped || undefined}
                className={slotProps?.front?.className}
                css={[faceStyle, slotProps?.front?.css]}
              >
                {front}
              </div>
              <div
                data-ui="flip-game-card-back"
                data-reduced-motion={(mounted && reducedMotion) || undefined}
                inert={!flipped}
                aria-hidden={!flipped || undefined}
                className={slotProps?.back?.className}
                css={[faceStyle, backStyle, slotProps?.back?.css]}
              >
                {back}
              </div>
            </div>
          </div>
        )}
      </WithSx>
    </MotionConfig>
  );
}

FlipGameCard.displayName = 'FlipGameCard';
