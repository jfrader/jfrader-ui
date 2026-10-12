import { vars } from '@jfrader/tokens/vars';
import { css } from './css';
import { REDUCED_MOTION } from './media';

// Shared fragments for listbox-like popups (Menu, Select, Combobox, CommandPalette). Components
// compose them in the `css` prop and keep their own focus, sizing and visibility rules.

/** Popup surface of Menu, Select and Combobox. */
export const listboxSurfaceStyle = css({
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.overlay,
  padding: vars.space[1],
  minInlineSize: `min(180px, calc(100vw - ${vars.space[8]}))`,
  maxInlineSize: `min(320px, calc(100vw - ${vars.space[8]}))`,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
});

/** A surface that stays mounted while closed and scrolls past its maximum height. */
export const listboxScrollStyle = css({
  maxBlockSize: `min(280px, calc(100vh - ${vars.space[8]}))`,
  overflow: 'auto',
  '&[hidden]': {
    display: 'none',
  },
});

/** Virtual-focus option: the active option carries the focus ring. */
export const listboxItemStyle = css({
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  inlineSize: '100%',
  minBlockSize: vars.space[8],
  flexShrink: 0,
  borderRadius: vars.radius.sm,
  paddingBlock: vars.space[1],
  paddingInline: vars.space[2],
  fontSize: vars.textSize.sm,
  color: vars.color.text,
  cursor: 'pointer',
  userSelect: 'none',
  transitionProperty: 'background-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&[data-active]': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '-2px',
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

/** Hover/active highlight that skips disabled items, and the disabled look. */
export const listboxItemStateStyle = css({
  '&:hover:not([aria-disabled="true"]), &[data-active]:not([aria-disabled="true"])': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&[aria-disabled="true"]': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
});

/** Selectable option with a text part and a trailing check. */
export const listboxOptionStyle = css({
  gap: vars.space[2],
  '&[aria-selected="true"]': {
    fontWeight: vars.fontWeight.medium,
  },
});

export const listboxOptionTextStyle = css({
  flex: 1,
  minInlineSize: 0,
});

export const listboxOptionCheckStyle = css({
  color: vars.color.accentText,
});
