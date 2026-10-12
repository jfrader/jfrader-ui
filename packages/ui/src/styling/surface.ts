import { vars } from '@jfrader/tokens/vars';
import type { ThemeName } from './theme-scope';

// Shared declaration fragments for overlay surfaces. Components spread them into their own
// `css()` objects and keep radius, shadow, layout and spacing local.

/** Surface appearance: `contrast` wears the dark theme plus the elevated-charcoal overrides. */
export type SurfaceAppearance = 'default' | 'contrast';

/** The theme a surface appearance wears; `default` keeps whatever theme is in scope. */
export function surfaceTheme(appearance: SurfaceAppearance): ThemeName | null {
  return appearance === 'contrast' ? 'dark' : null;
}

/** Attributes a surface sets for its appearance: the theme it wears and the overrides that go with it. */
export function surfaceAttributes(appearance: SurfaceAppearance): Record<string, string> | null {
  const theme = surfaceTheme(appearance);
  return theme ? { 'data-theme': theme, 'data-appearance': appearance } : null;
}

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
