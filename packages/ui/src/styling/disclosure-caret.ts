import { vars } from '@jfrader/tokens/vars';
import { FORCED_COLORS } from './media';

// Triangle pointing toward inline-end, drawn with borders on the component's own pseudo-element.
// Components own which side it sits on, the expanded rotation and the reduced-motion override.
// `disclosureCaretInlineSize` is the glyph's inline size, for a component whose content is inset
// from the caret's column.
export const disclosureCaretInlineSize = `calc(${vars.space[1]} * 1.5)`;
export const disclosureCaret = {
  content: '""',
  flexShrink: 0,
  borderBlock: `${vars.space[1]} solid transparent`,
  borderInlineStart: `${disclosureCaretInlineSize} solid currentColor`,
  transitionProperty: 'transform',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none' as const,
    color: 'CanvasText',
  },
};
