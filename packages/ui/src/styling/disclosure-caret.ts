import { vars } from '@jfrader/tokens/vars';
import { FORCED_COLORS } from './media';

// Triangle pointing toward inline-end, drawn with borders on an `&::after` pseudo-element.
// Components own the expanded rotation and the reduced-motion override.
export const disclosureCaret = {
  content: '""',
  flexShrink: 0,
  borderBlock: `${vars.space[1]} solid transparent`,
  borderInlineStart: `calc(${vars.space[1]} * 1.5) solid currentColor`,
  transitionProperty: 'transform',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none' as const,
    color: 'CanvasText',
  },
};
