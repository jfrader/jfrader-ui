import { vars } from '@jfrader/tokens/vars';

// Shared declaration fragments for overlay surfaces. Components spread them into their own
// `css()` objects and keep radius, shadow, layout and spacing local.

/** Raised panel: surface color, hairline border and the base text setup. */
export const raisedSurface = {
  boxSizing: 'border-box',
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.border}`,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
} as const;

/** Native `<dialog>` shell reset with the scrim backdrop; the panel inside draws the surface. */
export const modalShellReset = {
  border: 0,
  padding: 0,
  background: 'transparent',
  color: 'inherit',
  '&::backdrop': {
    backgroundColor: vars.color.scrim,
  },
} as const;
