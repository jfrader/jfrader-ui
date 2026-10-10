import { vars } from '@jfrader/tokens/vars';
import { css } from './css';

// Shared button style for overlay triggers (Dialog, Popover, Menu).
export const triggerStyle = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceRaised,
  minBlockSize: '40px',
  paddingBlock: vars.space[2],
  paddingInline: vars.space[4],
  font: 'inherit',
  fontSize: vars.textSize.sm,
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
  '@media (prefers-reduced-motion: reduce)': {
    transitionDuration: '0s',
  },
});
