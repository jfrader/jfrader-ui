import { vars } from '@jfrader/tokens/vars';
import { css } from './css';
import { focusRingOutset } from './focus-ring';
import { REDUCED_MOTION } from './media';

// A shell is the visible control around its own input; it takes the ring when that input has keyboard focus.
const FOCUSED = '&:focus-visible, &:has(> input:focus-visible)';
const NOT_FOCUSED = ':not(:focus-visible, :has(> input:focus-visible))';

// Shared control skin for text inputs (TextField, Textarea, PasswordField) and for shells wrapping
// a bare input (SearchField, TagInput).
export const inputControlStyle = css({
  display: 'block',
  inlineSize: '100%',
  boxSizing: 'border-box',
  margin: 0,
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  transitionProperty: 'border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&::placeholder': { color: vars.color.textSubtle },
  [`&:hover:not(:disabled)${NOT_FOCUSED}`]: { borderColor: vars.color.textSubtle },
  [FOCUSED]: { ...focusRingOutset, borderColor: vars.color.focusRing },
  '&:disabled': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  [`&[aria-invalid="true"]${NOT_FOCUSED}`]: {
    borderColor: vars.color.dangerBorder,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});
