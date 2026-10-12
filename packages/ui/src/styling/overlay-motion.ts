import { vars } from '@jfrader/tokens/vars';
import { REDUCED_MOTION } from './media';

// Entrance and retained exit for overlay surfaces, as declaration fragments. Entrances start from
// `@starting-style`; exits return to the same values while the owner is `data-state="closing"`
// (see `overlay/exit-motion.ts`). Transitions (not keyframes) let a reopen during the exit reverse
// smoothly. Only `opacity`, `scale` and `translate` move, so a positioning `transform` stays free.

/** Scale a centered modal panel grows from. */
export const MODAL_ENTER_SCALE = 0.96;
/** A command palette comes in from a little further, for a quicker "summoned" feel. */
export const PALETTE_ENTER_SCALE = 0.92;

/** Timing of an entrance; exits are quicker. */
export const enterTransition = {
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
} as const;
export const exitTransition = { transitionDuration: vars.motion.duration.fast } as const;

/** Panel inside a native <dialog> rendered with `styledDialogTransition`. */
export function modalPanelMotion(scale: number) {
  const hidden = { opacity: 0, scale: String(scale), translate: `0 ${vars.space[2]}` };
  return {
    transitionProperty: 'opacity, scale, translate',
    ...enterTransition,
    '@starting-style': hidden,
    '[data-state="closing"] > &': { ...hidden, ...exitTransition },
    [REDUCED_MOTION]: { '&, [data-state="closing"] > &': { transitionDuration: '0s' } },
  } as const;
}

/** The scrim of a native <dialog> fades with its panel. */
export const modalBackdropMotion = {
  '&::backdrop': {
    transitionProperty: 'opacity',
    ...enterTransition,
  },
  '&[open]::backdrop': { '@starting-style': { opacity: 0 } },
  '&[data-state="closing"]::backdrop': { opacity: 0, ...exitTransition },
  '&[data-state="closing"]': { pointerEvents: 'none' },
  [REDUCED_MOTION]: { '&::backdrop, &[data-state="closing"]::backdrop': { transitionDuration: '0s' } },
} as const;

/**
 * Floating surface that slides a little from its anchor: set `data-side` to the resolved side and
 * `data-state="closing"` on the surface while it exits (see `useExitPresence`).
 */
export const floatingSurfaceMotion = {
  transitionProperty: 'opacity, translate',
  ...enterTransition,
  '@starting-style': { opacity: 0, translate: 'var(--overlay-enter-x, 0) var(--overlay-enter-y, 0)' },
  '&[data-state="closing"]': {
    opacity: 0,
    translate: 'var(--overlay-enter-x, 0) var(--overlay-enter-y, 0)',
    pointerEvents: 'none',
    ...exitTransition,
  },
  '&[data-side="bottom"]': { '--overlay-enter-y': `calc(-1 * ${vars.space[1]})` },
  '&[data-side="top"]': { '--overlay-enter-y': vars.space[1] },
  '&[data-side="left"]': { '--overlay-enter-x': vars.space[1] },
  '&[data-side="right"]': { '--overlay-enter-x': `calc(-1 * ${vars.space[1]})` },
  [REDUCED_MOTION]: { '&, &[data-state="closing"]': { transitionDuration: '0s' } },
} as const;
