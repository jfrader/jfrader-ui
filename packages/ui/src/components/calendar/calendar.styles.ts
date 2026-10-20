import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';

// ---- Styles.

export const rootStyle = css({
  display: 'inline-flex',
  flexDirection: 'column',
  inlineSize: `calc(7 * 36px + 6 * ${vars.space[1]})`,
  maxInlineSize: '100%',
  gap: vars.space[2],
  fontFamily: vars.font.sans,
  color: vars.color.text,
});

export const headerStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
});

export const labelStyle = css({
  flex: 1,
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  textAlign: 'center',
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.semibold,
});

const controlTransition = {
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
};

export const navButtonStyle = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  inlineSize: '32px',
  flexShrink: 0,
  blockSize: '32px',
  padding: 0,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  font: 'inherit',
  fontSize: vars.textSize.lg,
  lineHeight: 1,
  color: vars.color.text,
  cursor: 'pointer',
  transitionProperty: 'background-color',
  ...controlTransition,
  '&:hover:not([aria-disabled="true"])': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&[aria-disabled="true"]': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  '&:focus-visible': {
    ...focusRingOutset,
  },
});

export const glyphStyle = css({
  display: 'inline-block',
  '&:dir(rtl)': {
    transform: 'scaleX(-1)',
  },
});

export const gridStyle = css({
  tableLayout: 'fixed',
  inlineSize: `calc(100% + 2 * ${vars.space[1]})`,
  borderCollapse: 'separate',
  borderSpacing: vars.space[1],
  marginInline: `calc(-1 * ${vars.space[1]})`,
});

export const weekdayStyle = css({
  overflowWrap: 'anywhere',
  paddingBlock: vars.space[1],
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.textMuted,
  textAlign: 'center',
});

export const cellStyle = css({
  padding: 0,
  textAlign: 'center',
});

export const dayStyle = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  inlineSize: '100%',
  blockSize: '36px',
  padding: 0,
  border: '1px solid transparent',
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  font: 'inherit',
  fontSize: vars.textSize.sm,
  fontVariantNumeric: 'tabular-nums',
  color: vars.color.text,
  cursor: 'pointer',
  transitionProperty: 'background-color, border-color, color',
  ...controlTransition,
  '&:hover:not(:disabled):not([data-selected]):not([data-in-range])': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&[data-today]': {
    borderColor: vars.color.borderControl,
    fontWeight: vars.fontWeight.semibold,
    textDecoration: 'underline',
  },
  '&[data-selected]': {
    backgroundColor: vars.color.accent,
    borderColor: vars.color.accent,
    color: vars.color.accentContrast,
    fontWeight: vars.fontWeight.semibold,
  },
  '&[data-selected]:hover': {
    backgroundColor: vars.color.accentHover,
  },
  // Range mode: the interior is tinted and outlined, the endpoints are filled; a preview is a
  // dashed outline, so neither state relies on color alone.
  '&[data-in-range]': {
    backgroundColor: vars.color.accentSoft,
    borderColor: vars.color.accentBorder,
  },
  '&[data-preview]:not([data-in-range])': {
    borderStyle: 'dashed',
    borderColor: vars.color.accentText,
  },
  '&[data-range-start], &[data-range-end]': {
    backgroundColor: vars.color.accent,
    borderColor: vars.color.accent,
    color: vars.color.accentContrast,
    fontWeight: vars.fontWeight.semibold,
  },
  '&[data-range-start]:hover, &[data-range-end]:hover': {
    backgroundColor: vars.color.accentHover,
  },
  '&:disabled': {
    opacity: 0.55,
    cursor: 'not-allowed',
    textDecoration: 'line-through',
  },
  '&[data-today]:disabled': {
    textDecoration: 'underline line-through',
  },
  '&:focus-visible': {
    ...focusRingOutset,
  },
  [FORCED_COLORS]: {
    '&[data-in-range], &[data-preview]': {
      borderColor: 'CanvasText',
    },
    '&[data-selected], &[data-in-range], &[data-range-start], &[data-range-end]': {
      forcedColorAdjust: 'none',
      backgroundColor: 'Highlight',
      borderColor: 'Highlight',
      color: 'HighlightText',
    },
  },
});
