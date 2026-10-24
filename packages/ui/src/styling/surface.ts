import { vars } from '@jfrader/tokens/vars';
import { css } from './css';
import { FORCED_COLORS, REDUCED_TRANSPARENCY } from './media';
import type { ThemeName } from './theme-scope';

// Shared declarations and material fragments for surfaces. Components keep radius, layout
// and spacing local.

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

export const translucentSurfaceStyle = css({
  backgroundColor: vars.color.surfaceGlass,
  backdropFilter: `blur(${vars.cardMaterial.blur})`,
  WebkitBackdropFilter: `blur(${vars.cardMaterial.blur})`,
  borderColor: vars.color.borderStrong,
  '--ui-translucent-shadow': `inset 0 1px 0 ${vars.color.surfaceHighlight}`,
  boxShadow: 'var(--ui-translucent-shadow)',
  '&[data-variant="raised"]': {
    '--ui-translucent-shadow': `inset 0 1px 0 ${vars.color.surfaceHighlight}, ${vars.shadow.raised}`,
  },
  [REDUCED_TRANSPARENCY]: {
    backgroundColor: vars.color.surfaceRaised,
    backgroundImage: 'none',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
  },
  [FORCED_COLORS]: {
    backgroundColor: 'Canvas',
    color: 'CanvasText',
    borderColor: 'CanvasText',
    backgroundImage: 'none',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    boxShadow: 'none',
  },
});

export const translucentControlStyle = css([
  translucentSurfaceStyle,
  {
    borderColor: `color-mix(in srgb, ${vars.color.borderControl} 70%, ${vars.color.text})`,
    boxShadow: `inset 0 1px 0 ${vars.color.surfaceHighlight}, ${vars.shadow.overlay}`,
    '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))': {
      backgroundColor: vars.color.surfaceRaised,
    },
    '@media (prefers-contrast: more)': {
      backgroundColor: vars.color.surfaceRaised,
      backgroundImage: 'none',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    },
    [FORCED_COLORS]: {
      backgroundColor: 'Canvas',
      color: 'CanvasText',
      borderColor: 'CanvasText',
      backgroundImage: 'none',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      boxShadow: 'none',
    },
  },
]);

/** Native `<dialog>` shell reset with the scrim backdrop; the panel inside draws the surface. */
export const modalShellReset = {
  zIndex: vars.zIndex.modal,
  border: 0,
  padding: 0,
  background: 'transparent',
  color: 'inherit',
  '&::backdrop': {
    backgroundColor: vars.color.scrim,
  },
} as const;
