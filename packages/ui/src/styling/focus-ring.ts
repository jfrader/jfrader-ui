import { vars } from '@jfrader/tokens/vars';

// Focus ring declarations; components spread them into their own focus selector.

/** Ring drawn outside the element's border box. */
export const focusRingOutset = {
  outline: `2px solid ${vars.color.focusRing}`,
  outlineOffset: '2px',
};

/** Ring drawn inside the element's border box, for items packed edge to edge. */
export const focusRingInset = {
  outline: `2px solid ${vars.color.focusRing}`,
  outlineOffset: '-2px',
};
