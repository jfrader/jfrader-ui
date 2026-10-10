import { vars } from '@jfrader/tokens/vars';
import { css } from './css';

// Shared fragments for native choice controls (Checkbox, Switch, RadioGroup.Radio): a label root
// holding a row of hidden native input + visual span + label text. Components compose them in the
// `css` prop and keep their own control visuals and sizing.

/** Column root layout and the checked accent fill on the visual span. */
export const choiceRootStyle = css({
  display: 'inline-flex',
  flexDirection: 'column',
  gap: vars.space[1],
  cursor: 'pointer',
  'input:checked + span': { backgroundColor: vars.color.accent, borderColor: vars.color.accent },
});

/** Focus ring on the visual span and the disabled look. */
export const choiceRootStateStyle = css({
  'input:focus-visible + span': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
  '&:has(input:disabled)': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
});

/** Row holding the input, the visual span and the label. */
export const choiceRowStyle = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
});

/** Transparent native input that stays operable and focusable. */
export const choiceInputStyle = css({
  position: 'absolute',
  opacity: 0,
  inlineSize: '16px',
  blockSize: '16px',
  margin: 0,
});
