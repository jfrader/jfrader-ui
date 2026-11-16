// Step marker shared by Stepper and PaymentFlow: a content-sized pill whose `data-state` is
// `complete`, `current`, `upcoming` or `error`. The host sets the size and numeral font variables.
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';

export const CONNECTOR_THICKNESS = '2px';
export const STEP_MARKER_SIZE = '--stepper-marker-size';
export const STEP_MARKER_FONT = '--stepper-marker-font';
export const stepMarker = `var(${STEP_MARKER_SIZE})`;

export const stepMarkerStyle = css({
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  // Content-sized: long Intl numerals grow the pill instead of overflowing it.
  minInlineSize: stepMarker,
  blockSize: stepMarker,
  paddingInline: vars.space[1],
  border: `${CONNECTOR_THICKNESS} solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  backgroundColor: 'transparent',
  color: vars.color.textMuted,
  fontSize: `var(${STEP_MARKER_FONT})`,
  fontWeight: vars.fontWeight.medium,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  transitionProperty: 'background-color, border-color, color',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  '& svg': { inlineSize: '1em', blockSize: '1em' },
  // Generated content keeps the decorative numeral out of the button's visible-text name check.
  '&[data-numeral]::before': { content: 'attr(data-numeral)' },
  '&[data-state="complete"]': {
    borderColor: vars.color.accent,
    backgroundColor: vars.color.accent,
    color: vars.color.accentContrast,
  },
  // Beyond color, the current marker gains a detached halo ring and a heavier numeral. The halo
  // sits inside the head's padding, so the head's focus ring still draws outside it.
  '&[data-state="current"]': {
    borderColor: vars.color.accent,
    backgroundColor: vars.color.accentSoft,
    color: vars.color.text,
    fontWeight: vars.fontWeight.semibold,
    outline: `${CONNECTOR_THICKNESS} solid ${vars.color.accent}`,
    outlineOffset: CONNECTOR_THICKNESS,
  },
  '&[data-state="error"]': {
    borderColor: vars.color.dangerText,
    backgroundColor: vars.color.dangerSoft,
    color: vars.color.dangerText,
  },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    borderColor: 'CanvasText',
    '&[data-state="current"], &[data-state="error"]': { borderColor: 'Highlight', outlineColor: 'Highlight' },
    '&[data-state="complete"]': {
      forcedColorAdjust: 'none',
      borderColor: 'Highlight',
      backgroundColor: 'Highlight',
      color: 'HighlightText',
    },
  },
});
