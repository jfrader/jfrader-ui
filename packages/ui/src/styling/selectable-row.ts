import { vars } from '@jfrader/tokens/vars';
import { css } from './css';
import { FORCED_COLORS, REDUCED_MOTION } from './media';

// Hover and selection for rounded rows in trees and outlines (TreeView, JsonViewer). Selection is a
// tonal fill inside an inset hairline that follows the corner radius, and a medium weight carries
// it without color. Nothing takes layout space, so selecting never moves content. Forced colors
// drop the shadow, so the hairline becomes a real outline there; the focus ring replaces it on the
// focused row. Never mark a rounded row with a one-sided border.

/** Row hover and selection. `selected` is the nested selector that matches the selected row, such
 * as `&[aria-selected="true"]` or `[aria-selected="true"] > &`. Compose it after the row's own
 * styles; the selected state wins over hover, and the row's focus rule must be more specific. */
export function selectableRowStyle(selected: string) {
  return css({
    transitionProperty: 'background-color, box-shadow',
    transitionDuration: vars.motion.duration.fast,
    transitionTimingFunction: vars.motion.easeStandard,
    '&:hover': { backgroundColor: vars.color.surfaceHover },
    [selected]: {
      backgroundColor: vars.color.accentSoft,
      boxShadow: `inset 0 0 0 1px ${vars.color.accentBorder}`,
      fontWeight: vars.fontWeight.medium,
    },
    [REDUCED_MOTION]: { transitionDuration: '0s' },
    [FORCED_COLORS]: {
      [selected]: { outline: '1px solid Highlight', outlineOffset: '-1px' },
    },
  });
}
