import { vars } from '@jfrader/tokens/vars';
import { keyframes } from './css';
import { FORCED_COLORS } from './media';

// Spinning ring shared by Button's loading decoration and Spinner. Components own sizing and
// their reduced-motion pulse.

const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

/** Opacity pulse that replaces the rotation under reduced motion. */
export const loadingRingPulse = keyframes({
  from: { opacity: 1 },
  to: { opacity: 0.35 },
});

export const loadingRing = {
  display: 'inline-block',
  border: '2px solid currentColor',
  borderInlineEndColor: 'transparent',
  borderRadius: vars.radius.full,
  animation: `${spin} 0.7s linear infinite`,
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none' as const,
    color: 'CanvasText',
  },
};
