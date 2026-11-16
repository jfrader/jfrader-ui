import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import {
  enterTransition as enter,
  exitTransition as exit,
  MODAL_ENTER_SCALE,
  modalBackdropMotion,
} from '../../styling/overlay-motion';

export const rootStyle = css({
  label: 'lightbox-gallery',
  minInlineSize: 0,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  '&:focus-visible': focusRingOutset,
});
export const gridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(var(--lightbox-columns, 2), minmax(0, 1fr))',
  gridAutoRows: '1px',
  gap: 'var(--lightbox-gap)',
  padding: 0,
  margin: 0,
  listStyle: 'none',
});
export const tileStyle = css({
  position: 'relative',
  display: 'block',
  inlineSize: '100%',
  minBlockSize: vars.space[8],
  padding: 0,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  background: 'transparent',
  cursor: 'pointer',
  overflow: 'hidden',
  '&:focus-visible': focusRingOutset,
});
export const imageStyle = css({
  position: 'relative',
  display: 'block',
  inlineSize: '100%',
  blockSize: '100%',
  objectFit: 'cover',
  userSelect: 'none',
});
// Motion: the viewer's own surface (background, border) and its chrome fade over the fading scrim;
// the image fades and scales in (during its flight from the tile, when it has one). On close an
// image that flies home stays put for the hand-off to the return flight; otherwise it fades with
// the chrome.
const hiddenSurface = { backgroundColor: 'transparent', borderColor: 'transparent' };
const hiddenImage = { opacity: 0, scale: String(MODAL_ENTER_SCALE) };
export const viewerStyle = css(
  {
    boxSizing: 'border-box',
    inlineSize: '100%',
    maxInlineSize: '100%',
    blockSize: '100dvh',
    maxBlockSize: '100dvh',
    margin: 0,
    border: `1px solid ${vars.color.borderControl}`,
    background: vars.color.bg,
    color: vars.color.text,
    padding: `max(${vars.space[4]}, env(safe-area-inset-top)) max(${vars.space[4]}, env(safe-area-inset-right)) max(${vars.space[4]}, env(safe-area-inset-bottom)) max(${vars.space[4]}, env(safe-area-inset-left))`,
    overflow: 'auto',
    fontFamily: vars.font.sans,
    '&::backdrop': { background: vars.color.scrim },
    transitionProperty: 'background-color, border-color',
    ...enter,
    '@starting-style': hiddenSurface,
    '&[data-state="closing"]': { ...hiddenSurface, ...exit },
    [REDUCED_MOTION]: { '&, &[data-state="closing"]': { transitionDuration: '0s' } },
    [FORCED_COLORS]: { boxShadow: 'none' },
  },
  modalBackdropMotion,
);
const CHROME = ':not([data-ui="lightbox-gallery-stage"])';
export const contentStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[3],
  blockSize: '100%',
  minBlockSize: 0,
  '& > *': { flexShrink: 0 },
  [`& > ${CHROME}`]: { transitionProperty: 'opacity', ...enter, '@starting-style': { opacity: 0 } },
  [`&[data-state="closing"] > ${CHROME}`]: { opacity: 0, ...exit },
  [REDUCED_MOTION]: { [`& > ${CHROME}, &[data-state="closing"] > ${CHROME}`]: { transitionDuration: '0s' } },
});
export const stageStyle = css({
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  flex: '1 1 auto',
  blockSize: '50dvh',
  minBlockSize: vars.space[12],
  overflow: 'hidden',
  touchAction: 'none',
  borderRadius: vars.radius.md,
  '&:focus-visible': focusRingOutset,
});
// Motion values own `transform` here (flight); the entrance moves the separate `scale` property.
export const viewerImageStyle = css({
  position: 'absolute',
  pointerEvents: 'none',
  display: 'grid',
  placeItems: 'center',
  transitionProperty: 'opacity, scale',
  ...enter,
  '@starting-style': hiddenImage,
  '&[data-exit="fade"]': { ...hiddenImage, ...exit },
  [REDUCED_MOTION]: { '&, &[data-exit="fade"]': { transitionDuration: '0s' } },
});
export const captionStyle = css({
  margin: 0,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  overflowWrap: 'anywhere',
  maxBlockSize: '25%',
  overflow: 'auto',
  '&:focus-visible': focusRingOutset,
});
export const fallbackStyle = css({
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: vars.space[3],
  color: vars.color.textMuted,
  textAlign: 'center',
  overflowWrap: 'anywhere',
});
export const statusStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  overflowWrap: 'anywhere',
});
// Hidden only while the client knows the image is loading (server markup never carries the
// state); only the reveal fades.
export const loadingStyle = css({
  transitionProperty: 'opacity',
  transitionDuration: vars.motion.duration.base,
  '&[data-image-state="loading"]': { opacity: 0, transitionDuration: '0s' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});
export const returnFlightStyle = css({
  position: 'fixed',
  pointerEvents: 'none',
  transformOrigin: 'top left',
  zIndex: 1,
  overflow: 'hidden',
  borderRadius: vars.radius.md,
});
