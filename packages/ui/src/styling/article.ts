import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css } from './css';
import { focusRingOutset } from './focus-ring';

export const ARTICLE_DESKTOP = `@media (min-width: ${base.editorial.breakpoint.desktop})`;
export const ARTICLE_COLUMNS = `@media (min-width: ${base.editorial.breakpoint.columns})`;
export const articleRule = `var(--article-rule-color, ${vars.color.text})`;
export const articleSoftRule = `var(--article-rule-soft-color, ${vars.color.borderStrong})`;
export const articleMeasure = `var(--article-measure, ${vars.editorial.measure})`;
export const articleBodyFont = `var(--article-font-body, ${vars.font.sans})`;
export const articleHeadingFont = `var(--article-font-heading, ${vars.font.sans})`;
export const articleLabelFont = `var(--article-font-label, ${vars.font.sans})`;
export const articleLabelStyle = css({
  margin: 0,
  fontFamily: articleLabelFont,
  fontSize: vars.editorial.meta,
  lineHeight: vars.lineHeight.base,
  letterSpacing: vars.editorial.tracking.label,
  textTransform: 'uppercase',
  color: vars.color.textMuted,
  overflowWrap: 'anywhere',
});
export const articleLinkStyle = css({
  color: 'inherit',
  textDecoration: 'none',
  textDecorationThickness: 'from-font',
  textUnderlineOffset: '0.18em',
  '&:hover': { color: vars.color.accentText, textDecoration: 'underline' },
  '&:focus-visible': focusRingOutset,
  '@media (forced-colors: active)': { color: 'LinkText', textDecoration: 'underline', '&:focus-visible': { outlineColor: 'Highlight' } },
});
export const articleTimeStyle = css({ unicodeBidi: 'isolate', fontVariantNumeric: 'tabular-nums', flexShrink: 0 });
