import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';

export const dialogStyle = css({
  border: 0,
  padding: 0,
  background: 'transparent',
  color: 'inherit',
  // Anchored to the top so the panel does not jump while the list height changes.
  marginBlockStart: vars.space[12],
  '&::backdrop': {
    backgroundColor: vars.color.scrim,
  },
});

export const panelStyle = css({
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.floating,
  inlineSize: 'min(560px, calc(100vw - 32px))',
  color: vars.color.text,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
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
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '-2px',
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
  '&:hover, &[data-active]': {
    backgroundColor: vars.color.surfaceHover,
  },
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
