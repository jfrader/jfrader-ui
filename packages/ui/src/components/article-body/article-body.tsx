'use client';

import { Children, isValidElement, type ComponentPropsWithRef, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { ARTICLE_COLUMNS, articleBodyFont, articleHeadingFont, articleLabelStyle, articleMeasure, articleSoftRule } from '../../styling/article';
import { PresentationSlot, repeatedTemplate, type ArticleHeadingLevel, type PresentationHeadingProps, type PresentationParts, type PresentationSlots } from '../../utils/presentation-slot';
import { isRenderable } from '../../utils/renderable';
import { proseTypography } from '../prose/prose';

type Anatomy = { root: 'div' };
type ParagraphAnatomy = { root: 'p' };
type HeadingAnatomy = { root: 'h2' };
type FactAnatomy = { root: 'aside'; title: 'p'; list: 'ul'; item: 'li' };
type QuoteAnatomy = { root: 'blockquote'; excerpt: 'div'; speaker: 'p'; attribution: 'footer' };
type CellAnatomy = { root: 'div'; label: 'p'; content: 'div' };
type Customization<A extends Record<string, 'div' | 'p' | 'h2' | 'aside' | 'ul' | 'li' | 'blockquote' | 'span' | 'footer'>> = {
  component?: PresentationSlots<A>['root']; slots?: PresentationSlots<A>; slotProps?: PresentationParts<A>;
};
export type ArticleBodyProps = ComponentPropsWithRef<'div'> & SxProps & Customization<Anatomy>;
export type ArticleBodyParagraphProps = ComponentPropsWithRef<'p'> & SxProps & Customization<ParagraphAnatomy> & { variant?: 'standard' | 'drop-cap' };
export type ArticleBodyHeadingProps = PresentationHeadingProps & SxProps & Omit<Customization<HeadingAnatomy>, 'component' | 'slots'> & { component?: ComponentType<PresentationHeadingProps>; slots?: { root?: ComponentType<PresentationHeadingProps> } };
export type ArticleBodyFactItem = { id: string; content: ReactNode };
export type ArticleBodyFactProps = Omit<ComponentPropsWithRef<'aside'>, 'title'> & SxProps & Omit<Customization<FactAnatomy>, 'slots'> & {
  slots?: Omit<PresentationSlots<FactAnatomy>, 'title'> & { title?: ComponentType<ComponentPropsWithRef<'p'> & { level?: ArticleHeadingLevel }> };
  title?: ReactNode; level?: ArticleHeadingLevel;
} & ({ items: readonly ArticleBodyFactItem[]; children?: never } | { items?: never; children?: ReactNode });
export type ArticleBodyQuoteProps = ComponentPropsWithRef<'blockquote'> & SxProps & Customization<QuoteAnatomy> & { speaker?: ReactNode; attribution?: ReactNode };
export type ArticleBodyCellProps = ComponentPropsWithRef<'div'> & SxProps & Customization<CellAnatomy> & { label?: ReactNode };
export type ArticleBodySplitProps = Omit<ComponentPropsWithRef<'div'>, 'children'> & SxProps & Customization<Anatomy> & {
  children: readonly [ReactElement<ArticleBodyCellProps>, ReactElement<ArticleBodyCellProps>];
};

const bodyStyle = css({ maxInlineSize: articleMeasure, fontFamily: articleBodyFont, fontSize: vars.editorial.body });
const paragraphStyle = css({ fontFamily: articleBodyFont, fontSize: vars.editorial.body, lineHeight: vars.lineHeight.relaxed, overflowWrap: 'anywhere' });
const dropCapStyle = css({ display: 'flow-root', '&::first-letter': { float: 'inline-start', fontFamily: articleHeadingFont, fontSize: vars.editorial.dropCap, fontWeight: vars.fontWeight.bold, color: vars.color.text, lineHeight: vars.editorial.lineHeight.dropCap, paddingInlineEnd: vars.space[2] } });
const headingStyle = css({ fontFamily: articleHeadingFont, overflowWrap: 'anywhere' });
const factStyle = css({ border: `${vars.editorial.rule.thin} solid ${articleSoftRule}`, padding: vars.space[4], marginBlock: vars.space[6], backgroundColor: vars.color.surfaceRaised });
const listStyle = css({ listStyle: 'none', margin: 0, padding: 0 });
const itemStyle = css({ margin: 0, paddingBlock: vars.space[2], '& + &': { borderBlockStart: `${vars.editorial.rule.thin} solid ${articleSoftRule}` } });
const quoteStyle = css({ borderInlineStart: `${vars.editorial.rule.strong} solid ${vars.color.accentText}`, paddingInlineStart: vars.space[4], marginInline: 0, marginBlock: 0, color: vars.color.text, fontFamily: articleBodyFont, lineHeight: vars.lineHeight.relaxed, fontStyle: 'italic', overflowWrap: 'anywhere' });
const speakerStyle = css({ fontFamily: articleBodyFont, fontSize: vars.editorial.body, lineHeight: vars.lineHeight.base, color: vars.color.text, textTransform: 'none', fontStyle: 'normal', marginBlockStart: vars.space[2], marginBlockEnd: 0 });
const attributionStyle = css({ marginBlockStart: vars.space[3], fontStyle: 'normal', display: 'flex', flexWrap: 'wrap', gap: vars.space[2] });
const splitStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  border: `${vars.editorial.rule.thin} solid ${articleSoftRule}`,
  marginBlock: vars.space[6],
  '& > [data-ui~="article-body-cell"] + [data-ui~="article-body-cell"]': {
    borderBlockStart: `${vars.editorial.rule.thin} solid ${articleSoftRule}`,
  },
  [ARTICLE_COLUMNS]: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    '& > [data-ui~="article-body-cell"] + [data-ui~="article-body-cell"]': {
      borderBlockStart: 0,
      borderInlineStart: `${vars.editorial.rule.thin} solid ${articleSoftRule}`,
    },
  },
});
const cellStyle = css({ minInlineSize: 0, padding: vars.space[4], overflowWrap: 'anywhere', '& :where(p)': { margin: 0 } });

function ArticleBodyRoot({ component, slots, slotProps, ...props }: ArticleBodyProps) {
  return <PresentationSlot {...props} element="div" component={slots?.root ?? component} slotProps={slotProps?.root} marker="article-body" styles={[proseTypography, bodyStyle]} />;
}
ArticleBodyRoot.displayName = 'ArticleBody';
/** Render a paragraph with an optional drop cap. */
function Paragraph({ variant = 'standard', component, slots, slotProps, ...props }: ArticleBodyParagraphProps) {
  return <PresentationSlot {...props} element="p" component={slots?.root ?? component} slotProps={slotProps?.root} marker="article-body-paragraph" data-variant={variant} styles={[paragraphStyle, variant === 'drop-cap' && dropCapStyle]} />;
}
Paragraph.displayName = 'ArticleBody.Paragraph';
/** Introduce a section of the article. */
function Heading({ level = 2, component, slots, slotProps, children, ...props }: ArticleBodyHeadingProps) {
  if (!isRenderable(children) || children === '') return null;
  const Root = slots?.root ?? component;
  return <PresentationSlot {...props} element={`h${level}`} component={Root} slotProps={slotProps?.root} marker="article-body-heading" styles={headingStyle} {...(Root ? { level } : {})}>{children}</PresentationSlot>;
}
Heading.displayName = 'ArticleBody.Heading';
/** Set aside supporting facts with an optional title and list. */
function Fact({ title, level, items, children, component, slots, slotProps, ...props }: ArticleBodyFactProps) {
  return <PresentationSlot {...props} element="aside" component={slots?.root ?? component} slotProps={slotProps?.root} marker="article-body-fact" styles={factStyle}>
    {isRenderable(title) && title !== '' && <PresentationSlot element={level ? `h${level}` : 'p'} component={slots?.title} slotProps={slotProps?.title} marker="article-body-fact-title" styles={articleLabelStyle} {...(slots?.title ? { level } : {})}>{title}</PresentationSlot>}
    {items ? items.length > 0 && <PresentationSlot element="ul" component={slots?.list} slotProps={slotProps?.list} marker="article-body-fact-list" styles={listStyle}>{items.map(({ id, content }) => <PresentationSlot key={id} element="li" component={slots?.item} slotProps={repeatedTemplate(slotProps?.item)} marker="article-body-fact-item" styles={itemStyle}>{content}</PresentationSlot>)}</PresentationSlot> : children}
  </PresentationSlot>;
}
Fact.displayName = 'ArticleBody.Fact';
/** Present a quotation with its speaker and attribution. */
function Quote({ children, speaker, attribution, component, slots, slotProps, ...props }: ArticleBodyQuoteProps) {
  if (!isRenderable(children)) return null;
  return <PresentationSlot {...props} element="blockquote" component={slots?.root ?? component} slotProps={slotProps?.root} marker="article-body-quote" styles={quoteStyle}>
    <PresentationSlot element="div" component={slots?.excerpt} slotProps={slotProps?.excerpt} marker="article-body-quote-excerpt">{children}</PresentationSlot>
    {isRenderable(speaker) && <PresentationSlot element="p" component={slots?.speaker} slotProps={slotProps?.speaker} marker="article-body-quote-speaker" styles={speakerStyle}>{speaker}</PresentationSlot>}
    {isRenderable(attribution) && <PresentationSlot element="footer" component={slots?.attribution} slotProps={slotProps?.attribution} marker="article-body-quote-attribution" styles={[articleLabelStyle, attributionStyle]}>{attribution}</PresentationSlot>}
  </PresentationSlot>;
}
Quote.displayName = 'ArticleBody.Quote';
/** Arrange two article elements in a responsive split layout. */
function Split({ children, component, slots, slotProps, ...props }: ArticleBodySplitProps) {
  const cells = Children.toArray(children);
  if (cells.length !== 2 || cells.some((child) => !isValidElement(child))) throw new Error('ArticleBody.Split requires exactly two elements.');
  return <PresentationSlot {...props} element="div" component={slots?.root ?? component} slotProps={slotProps?.root} marker="article-body-split" styles={splitStyle}>{children}</PresentationSlot>;
}
Split.displayName = 'ArticleBody.Split';
/** Hold one side of a split with an optional label. */
function Cell({ label, children, component, slots, slotProps, ...props }: ArticleBodyCellProps) {
  return <PresentationSlot {...props} element="div" component={slots?.root ?? component} slotProps={slotProps?.root} marker="article-body-cell" styles={cellStyle}>
    {isRenderable(label) && <PresentationSlot element="p" component={slots?.label} slotProps={slotProps?.label} marker="article-body-cell-label" styles={articleLabelStyle}>{label}</PresentationSlot>}
    <PresentationSlot element="div" component={slots?.content} slotProps={slotProps?.content} marker="article-body-cell-content">{children}</PresentationSlot>
  </PresentationSlot>;
}
Cell.displayName = 'ArticleBody.Cell';
/** Compose article prose, headings, facts and quotations. */
export const ArticleBody = Object.assign(ArticleBodyRoot, { Paragraph, Heading, Fact, Quote, Split, Cell });
