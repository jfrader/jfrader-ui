import { vars } from '@jfrader/tokens/vars';
import { css, keyframes } from '../../styling/css';
import { focusRingInset, focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION, REDUCED_TRANSPARENCY } from '../../styling/media';

/** Opacity of the chrome bars and tile favorites over the photo, before the blur. */
const CHROME_MIX = '85%';
/** Narrow or hoverless viewports: the viewer drops previous/next (swipe and the filmstrip remain) and shrinks. */
const COMPACT_CHROME = '@media (max-width: 40rem), (hover: none)';
/** Cells narrower than this show the favorite below the photo instead of over it. */
const COMPACT_CELL = '@container (max-width: 7rem)';
const favoritePop = keyframes({ from: { transform: 'scale(0.85)' }, to: { transform: 'scale(1)' } });
const captionFade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

const translucentChrome = {
  background: `color-mix(in oklab, ${vars.color.bg} ${CHROME_MIX}, transparent)`,
  backdropFilter: `blur(${vars.space[3]})`,
  [REDUCED_TRANSPARENCY]: { background: vars.color.bg, backdropFilter: 'none' },
};

export const rootStyle = css({
  label: 'photo-grid',
  display: 'grid',
  gap: vars.space[4],
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  color: vars.color.text,
  lineHeight: vars.lineHeight.base,
  '&:focus-visible': focusRingOutset,
});
export const headerStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[3],
});
export const headingStyle = css({ display: 'grid', gap: vars.space[1], minInlineSize: 0 });
export const titleStyle = css({
  margin: 0,
  fontSize: vars.textSize.lg,
  fontWeight: vars.fontWeight.semibold,
  overflowWrap: 'anywhere',
});
export const summaryStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[3],
  margin: 0,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  fontVariantNumeric: 'tabular-nums',
});
export const densityStyle = css({
  display: 'flex',
  gap: vars.space[1],
  padding: vars.space[1],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.full,
  background: vars.color.surfaceInset,
});
export const segmentStyle = css({ borderRadius: vars.radius.full });
export const listStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(var(--photo-grid-columns), minmax(0, 1fr))',
  gap: vars.space[1],
  padding: 0,
  margin: 0,
  listStyle: 'none',
  touchAction: 'pan-y',
});
export const cellStyle = css({ containerType: 'inline-size' });
export const itemStyle = css({ position: 'relative', display: 'grid', gap: vars.space[1], minInlineSize: 0 });
export const photoStyle = css({
  appearance: 'none',
  boxSizing: 'border-box',
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  inlineSize: '100%',
  aspectRatio: '1',
  padding: 0,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  background: vars.color.surfaceInset,
  color: vars.color.text,
  font: 'inherit',
  fontSize: vars.textSize.sm,
  cursor: 'pointer',
  overflow: 'hidden',
  '&:focus-visible': focusRingOutset,
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
});
// Over the photo, the favorite shows while pressed, focused or hovered, and always without hover.
export const tileFavoriteStyle = css({
  font: 'inherit',
  appearance: 'none',
  boxSizing: 'border-box',
  position: 'absolute',
  insetBlockEnd: vars.space[2],
  insetInlineStart: vars.space[2],
  display: 'grid',
  placeItems: 'center',
  inlineSize: vars.space[8],
  blockSize: vars.space[8],
  padding: 0,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  color: vars.color.text,
  cursor: 'pointer',
  ...translucentChrome,
  opacity: 0,
  transitionProperty: 'opacity',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '*:hover > &, &:focus-visible, &[aria-pressed="true"]': { opacity: 1 },
  '&:focus-visible': focusRingOutset,
  '&[aria-pressed="true"]': {
    color: vars.color.accentText,
    animation: `${favoritePop} ${vars.motion.duration.base} ${vars.motion.easeStandard}`,
  },
  '@media (hover: none)': { opacity: 1 },
  [COMPACT_CELL]: { position: 'static', justifySelf: 'start', opacity: 1, background: vars.color.surfaceRaised },
  [REDUCED_MOTION]: { transitionDuration: '0s', '&[aria-pressed="true"]': { animation: 'none' } },
  [FORCED_COLORS]: { borderColor: 'ButtonText', '&[aria-pressed="true"]': { borderColor: 'Highlight' } },
});
export const imageBoxStyle = css({ inlineSize: '100%', blockSize: '100%', minInlineSize: 0, minBlockSize: 0, borderRadius: 'inherit' });
export const viewerStyle = css({
  boxSizing: 'border-box',
  inlineSize: '100%',
  blockSize: '100dvh',
  maxInlineSize: '100%',
  maxBlockSize: '100dvh',
  overflow: 'hidden',
  border: 'none',
  borderRadius: 0,
  padding: 0,
  margin: 0,
  background: vars.color.bg,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  position: 'fixed',
  inset: 0,
  '&[open]': { display: 'flex' },
  flexDirection: 'column',
  '&::backdrop': { background: vars.color.scrim },
});
// The stage spans every row; the chrome bars sit over its top and bottom edges.
export const viewerContentStyle = css({
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  gridTemplateColumns: 'minmax(0, 1fr)',
  flex: '1 1 0',
  minBlockSize: 0,
  transitionProperty: 'opacity, transform',
  transitionDuration: vars.motion.duration.slow,
  transitionTimingFunction: vars.motion.easeStandard,
  'dialog[data-state="closing"] &': { opacity: 0, transform: 'scale(0.98)' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});
export const barStyle = css({
  zIndex: 1,
  gridColumn: '1',
  display: 'grid',
  gap: vars.space[2],
  minInlineSize: 0,
  ...translucentChrome,
  [FORCED_COLORS]: { border: '1px solid CanvasText' },
});
export const topBarStyle = css({
  gridRow: '1',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  padding: `max(${vars.space[2]}, env(safe-area-inset-top)) max(${vars.space[4]}, env(safe-area-inset-right)) ${vars.space[2]} max(${vars.space[4]}, env(safe-area-inset-left))`,
});
export const bottomBarStyle = css({
  gridRow: '3',
  padding: `${vars.space[2]} max(${vars.space[4]}, env(safe-area-inset-right)) max(${vars.space[2]}, env(safe-area-inset-bottom)) max(${vars.space[4]}, env(safe-area-inset-left))`,
});
export const viewerTitleStyle = css({
  margin: 0,
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.semibold,
  overflowWrap: 'anywhere',
});
export const toolbarStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
  alignItems: 'center',
  gap: vars.space[2],
  [COMPACT_CHROME]: { gridTemplateColumns: 'minmax(0, 1fr) auto' },
});
export const controlsStyle = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[1] });
export const favoriteSlotStyle = css({ justifySelf: 'end' });
export const compactHiddenStyle = css({ [COMPACT_CHROME]: { display: 'none' } });
export const dividerStyle = css({
  alignSelf: 'stretch',
  marginBlock: vars.space[2],
  marginInline: vars.space[1],
  borderInlineStart: `1px solid ${vars.color.border}`,
});
export const stageStyle = css({
  position: 'relative',
  gridRow: '1 / -1',
  gridColumn: '1',
  display: 'grid',
  placeItems: 'center',
  minBlockSize: 0,
  overflow: 'hidden',
  touchAction: 'none',
  '&:focus-visible': focusRingInset,
});
export const viewerThumbStyle = css({
  scrollMarginInline: vars.space[1],
  [COMPACT_CHROME]: { inlineSize: vars.space[8], blockSize: vars.space[8] },
});
export const statusStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  overflowWrap: 'anywhere',
});
export const counterStyle = css({
  fontSize: vars.textSize.sm,
  fontVariantNumeric: 'tabular-nums',
  overflowWrap: 'anywhere',
  [COMPACT_CHROME]: { gridColumn: '1 / -1' },
});
export const detailStyle = css({
  margin: 0,
  color: vars.color.textMuted,
  fontSize: vars.textSize.sm,
  overflowWrap: 'anywhere',
  animation: `${captionFade} ${vars.motion.duration.slow} ${vars.motion.easeStandard}`,
  [REDUCED_MOTION]: { animation: 'none' },
});
export const viewerDetailStyle = css({ color: vars.color.text });
