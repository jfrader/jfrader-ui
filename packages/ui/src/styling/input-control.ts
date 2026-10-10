import { vars } from '@jfrader/tokens/vars';
import { css } from './css';
import { REDUCED_MOTION } from './media';

// Shared control skin for text inputs (TextField, Textarea).
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
  '&:hover:not(:disabled):not(:focus-visible)': { borderColor: vars.color.textSubtle },
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
    borderColor: vars.color.focusRing,
  },
  '&:disabled': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  '&[aria-invalid="true"]:not(:focus-visible)': {
    borderColor: vars.color.dangerBorder,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});
