import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type SerializedStyles } from '../../styling/css';
import { focusRingInset, focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { modalShellReset } from '../../styling/surface';
import { touchTargetStyle } from '../../styling/touch-target';
import type { ResolvedVariant } from './dialog-stack.types';


// Structural sizes.
const LAYER_GUTTER = vars.space[4];
const SHEET_TOP_GAP = `calc(${vars.space[6]} + env(safe-area-inset-top, 0px))`;
const DIALOG_INLINE_CAP = '32rem';
// No depth shrinks a panel below this, so its header and actions stay reachable.
const PANEL_MIN_BLOCK = '12rem';
const DEPTH_SCALE_STEP = 0.05;
const DEPTH = 'var(--dialog-stack-depth, 0)';
const INDEX = 'var(--dialog-stack-index, 0)';
const ACTIVE_SIZE = 'var(--dialog-stack-active-size, 0px)';

const sheetEntry = keyframes({ from: { opacity: 0, transform: 'translateY(100%)' } });
const dialogEntry = keyframes({ from: { opacity: 0, transform: 'scale(0.96)' } });

export const shellStyle = css({
  ...modalShellReset,
  position: 'fixed',
  inset: 0,
  margin: 0,
  inlineSize: '100%',
  blockSize: '100%',
  maxInlineSize: 'none',
  maxBlockSize: 'none',
  overflow: 'hidden',
  '&[open]': { display: 'block' },
});

export const containedLayerStyle = css({
  zIndex: vars.zIndex.modal,
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  borderRadius: 'inherit',
});

export const scrimStyle = css({
  position: 'absolute',
  inset: 0,
  backgroundColor: vars.color.scrim,
});

// Panels opt back into pointer events, so a press beside them reaches the backdrop.
export const stageStyle = css({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
});

export const panelStyle = css({
  overflowWrap: 'anywhere',
  boxSizing: 'border-box',
  position: 'absolute',
  zIndex: INDEX,
  display: 'flex',
  flexDirection: 'column',
  minBlockSize: 0,
  pointerEvents: 'auto',
  overflow: 'hidden',
  '&:focus-visible': { ...focusRingInset },
  transformOrigin: 'top center',
  transitionProperty: 'transform, min-block-size',
  transitionDuration: vars.motion.duration.slow,
  transitionTimingFunction: vars.motion.easeStandard,
  animationDuration: vars.motion.duration.slow,
  animationTimingFunction: vars.motion.easeStandard,
  animationFillMode: 'backwards',
  [REDUCED_MOTION]: { animation: 'none', transitionDuration: '0s' },
});

/** Each level down the stack leaves one more peek of room, never below the panel minimum. */
function depthCappedBlockSize(gap: string, peek: string) {
  return `min(100%, max(${PANEL_MIN_BLOCK}, calc(100% - ${gap} - ${INDEX} * ${peek})))`;
}

// Layout per variant and the parents' peek. Separate top-level styles (no attribute selectors),
// so a consumer `sx` merged after them overrides them.
export const panelVariantStyles: Record<ResolvedVariant, SerializedStyles> = {
  sheet: css({
    borderRadius: 0,
    insetInline: 0,
    insetBlockEnd: 0,
    marginInline: 'auto',
    inlineSize: '100%',
    maxInlineSize: vars.size.dialogStackBreakpoint,
    maxBlockSize: depthCappedBlockSize(SHEET_TOP_GAP, vars.size.dialogStackSheetPeek),
    borderBlockEndWidth: 0,
    borderStartStartRadius: vars.radius.xl,
    borderStartEndRadius: vars.radius.xl,
    paddingBlockEnd: 'env(safe-area-inset-bottom, 0px)',
    animationName: sheetEntry,
    [FORCED_COLORS]: { borderBlockEndWidth: '1px' },
  }),
  dialog: css({
    inset: 0,
    margin: 'auto',
    inlineSize: `min(${DIALOG_INLINE_CAP}, calc(100% - 2 * ${LAYER_GUTTER}))`,
    blockSize: 'fit-content',
    maxBlockSize: depthCappedBlockSize(`2 * ${LAYER_GUTTER}`, `2 * ${vars.size.dialogStackDialogPeek}`),
    borderRadius: vars.radius.lg,
    animationName: dialogEntry,
  }),
};

// Parents peek above the active panel: at least its size plus one peek per level, scaled from the top edge.
const parentScale = `scale(calc(1 - ${DEPTH} * ${DEPTH_SCALE_STEP}))`;
export const parentStyles: Record<ResolvedVariant, SerializedStyles> = {
  sheet: css({
    animationName: 'none',
    minBlockSize: `calc(${ACTIVE_SIZE} + ${DEPTH} * ${vars.size.dialogStackSheetPeek})`,
    transform: parentScale,
  }),
  dialog: css({
    animationName: 'none',
    blockSize: ACTIVE_SIZE,
    transform: `translateY(calc(-1 * ${DEPTH} * ${vars.size.dialogStackDialogPeek})) ${parentScale}`,
  }),
};

export const handleStyle = css({
  flexShrink: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  blockSize: vars.space[8],
  cursor: 'grab',
  touchAction: 'none',
  '&::before': {
    content: '""',
    inlineSize: vars.space[10],
    blockSize: vars.space[1],
    borderRadius: vars.radius.full,
    backgroundColor: vars.color.borderControl,
  },
  '&[data-dragging]': { cursor: 'grabbing' },
  '[data-variant="dialog"] > &': { display: 'none' },
  '[data-sheet-no-drag] > &': { cursor: 'auto', touchAction: 'auto' },
  [REDUCED_MOTION]: { cursor: 'auto', touchAction: 'auto' },
  [FORCED_COLORS]: { '&::before': { backgroundColor: 'CanvasText' } },
});

export const scrollerStyle = css({
  flex: '1 1 auto',
  minBlockSize: 0,
  overflow: 'auto',
  overscrollBehavior: 'contain',
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[2],
  paddingInline: vars.space[5],
  paddingBlockStart: vars.space[4],
  fontSize: vars.textSize.sm,
  // Below the handle: just enough room for a focus ring.
  '[data-variant="sheet"] > &': { paddingBlockStart: vars.space[1] },
  // Without a Footer the content keeps its bottom padding; the Footer brings its own.
  '&:not(:has(> [data-ui~="dialog-stack-footer"]))': { paddingBlockEnd: vars.space[5] },
});

export const footerStyle = css({
  position: 'sticky',
  insetBlockEnd: 0,
  marginBlockStart: 'auto',
  marginInline: `calc(-1 * ${vars.space[5]})`,
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: vars.space[3],
  paddingInline: vars.space[5],
  paddingBlock: vars.space[4],
  backgroundColor: vars.color.surfaceRaised,
  borderBlockStart: `1px solid ${vars.color.border}`,
});

export const titleStyle = css({
  margin: 0,
  fontSize: vars.textSize.lg,
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.tight,
  borderRadius: vars.radius.sm,
  '&:focus': { outline: 'none' },
  '&:focus-visible': { ...focusRingOutset },
  [FORCED_COLORS]: { '&:focus-visible': { outlineColor: 'Highlight' } },
});

export const descriptionStyle = css({
  margin: 0,
  color: vars.color.textMuted,
});

export const actionStyle = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[1],
  alignSelf: 'flex-start',
  boxSizing: 'border-box',
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  border: '1px solid transparent',
  borderRadius: vars.radius.md,
  backgroundColor: 'transparent',
  paddingBlock: vars.space[1],
  paddingInline: vars.space[2],
  font: 'inherit',
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.textMuted,
  cursor: 'pointer',
  transitionProperty: 'background-color, color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '& > svg': { inlineSize: '1em', blockSize: '1em', flexShrink: 0 },
  '&:hover:not(:disabled)': { backgroundColor: vars.color.surfaceHover, color: vars.color.text },
  '&:focus-visible': { ...focusRingOutset },
  '&:disabled': { opacity: 0.55, cursor: 'not-allowed' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    borderColor: 'ButtonBorder',
    '&:focus-visible': { outlineColor: 'Highlight' },
  },
}, touchTargetStyle);

// Back and Close share one top bar: Back at the inline start, Close at the end. Rendering them as
// scroller children would stack them in the content column.
export const topBarStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
  minBlockSize: vars.space[8],
});
export const topBarEndStyle = css({ marginInlineStart: 'auto' });

// The back chevron points toward the inline start in either direction.
export const backIconStyle = css({ '&:dir(rtl)': { transform: 'scaleX(-1)' } });
