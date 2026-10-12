// Field chrome shared by the slider skins (Slider, ElasticSlider); each skin owns its track and thumb.
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS } from '../../styling/media';

export const sliderRootStyle = css({
  display: 'grid',
  gap: vars.space[2],
  minInlineSize: 0,
  inlineSize: '100%',
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
});
export const sliderHeaderStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: vars.space[2],
  alignItems: 'baseline',
});
export const sliderLabelStyle = css({ fontWeight: vars.fontWeight.medium });
export const sliderReadoutStyle = css({ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' });
export const sliderDescriptionStyle = css({ color: vars.color.textMuted });
export const sliderErrorStyle = css({ color: vars.color.dangerText });
export const sliderRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
  minInlineSize: 0,
  paddingBlockStart: vars.space[8],
});
export const sliderControlStyle = css({
  position: 'relative',
  flex: 1,
  minInlineSize: vars.space[8],
  marginInline: vars.space[4],
  touchAction: 'pan-y',
  userSelect: 'none',
  cursor: 'pointer',
  '&[data-disabled]': { cursor: 'default' },
});
export const sliderSizeStyles = {
  sm: css({ minBlockSize: vars.space[8] }),
  md: css({ minBlockSize: vars.space[10] }),
};
export const sliderMarksStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2] });
export const sliderMarkStyle = css({
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  paddingBlock: vars.space[1],
  paddingInline: vars.space[2],
  font: 'inherit',
  overflowWrap: 'anywhere',
  maxInlineSize: '100%',
  color: vars.color.text,
  background: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  cursor: 'pointer',
  '&:focus-visible': focusRingOutset,
  '&:disabled': { cursor: 'default' },
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
});
