import { vars } from '@jfrader/tokens/vars';
import { controlSizeStyles, controlTouchTargetStyles } from './control-size';
import { css } from './css';
import { REDUCED_MOTION } from './media';

// Shared button style for overlay triggers (Dialog, Popover, Menu).
export const triggerStyle = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceRaised,
  paddingBlock: vars.space[2],
  paddingInline: vars.space[4],
  font: 'inherit',
  fontWeight: vars.fontWeight.medium,
  color: vars.color.text,
  cursor: 'pointer',
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not(:disabled)': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
  '&:disabled': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
}, controlSizeStyles.md, controlTouchTargetStyles.md);
