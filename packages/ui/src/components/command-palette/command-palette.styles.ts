import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { modalBackdropMotion, modalPanelMotion, PALETTE_ENTER_SCALE } from '../../styling/overlay-motion';
import { modalShellReset, raisedSurface } from '../../styling/surface';

export const dialogStyle = css(
  {
    ...modalShellReset,
    // Anchored to the top so the panel does not jump while the list height changes.
    marginBlockStart: vars.space[12],
  },
  modalBackdropMotion,
);

export const panelStyle = css({
  ...raisedSurface,
  display: 'flex',
  flexDirection: 'column',
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.floating,
  inlineSize: 'min(560px, calc(100vw - 32px))',
  ...modalPanelMotion(PALETTE_ENTER_SCALE),
});

export const inputStyle = css({
  boxSizing: 'border-box',
  inlineSize: '100%',
  blockSize: '48px',
  margin: 0,
  border: 0,
  borderBlockEnd: `1px solid ${vars.color.borderControl}`,
  borderStartStartRadius: vars.radius.lg,
  borderStartEndRadius: vars.radius.lg,
  backgroundColor: 'transparent',
  paddingInline: vars.space[4],
  font: 'inherit',
  fontSize: vars.textSize.md,
  color: vars.color.text,
  '&::placeholder': { color: vars.color.textSubtle },
  '&:focus-visible': {
    ...focusRingInset,
  },
});

export const listStyle = css({
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  maxBlockSize: '320px',
  overflow: 'auto',
  padding: vars.space[1],
  '&[hidden]': {
    display: 'none',
  },
});

export const groupStyle = css({
  display: 'flex',
  flexDirection: 'column',
  '&[hidden]': {
    display: 'none',
  },
});

export const groupHeadingStyle = css({
  paddingBlock: vars.space[1],
  paddingInline: vars.space[2],
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.textMuted,
});

export const itemStyle = css({
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  '&[hidden]': {
    display: 'none',
  },
});

export const emptyStyle = css({
  paddingBlock: vars.space[6],
  paddingInline: vars.space[4],
  textAlign: 'center',
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});
