'use client';

import { useId, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { articleBodyFont, articleLabelStyle, articleLinkStyle } from '../../styling/article';
import { isRenderable } from '../../utils/renderable';
import { PresentationSlot, repeatedTemplate, type ArticleHeadingLevel, type PresentationHeadingProps, type PresentationParts, type PresentationSlots, type RenderArticleLink } from '../../utils/presentation-slot';

type Anatomy = { root: 'section'; heading: 'h2'; list: 'ul'; item: 'li'; link: 'a' };
export type ArticleSourcesSlots = Omit<PresentationSlots<Anatomy>, 'heading'> & { heading?: ComponentType<PresentationHeadingProps> };
export type ArticleSourcesSlotProps = PresentationParts<Anatomy>;
export type ArticleSourceItem = { id: string; label: ReactNode; href?: string; renderLink?: RenderArticleLink };
type AccessibleName = { title: ReactNode } | { title?: never; 'aria-label': string } | { title?: never; 'aria-labelledby': string };
export type ArticleSourcesProps = Omit<ComponentPropsWithRef<'section'>, 'title' | 'children'> & SxProps & AccessibleName & {
  level?: ArticleHeadingLevel;
  variant?: 'inline' | 'stacked';
  component?: ArticleSourcesSlots['root'];
  slotProps?: ArticleSourcesSlotProps;
} & (
  { slots?: Omit<ArticleSourcesSlots, 'link'> & { link?: never }; items: readonly ArticleSourceItem[] }
  | { slots?: ArticleSourcesSlots; items: readonly (Omit<ArticleSourceItem, 'renderLink'> & { renderLink?: never })[] }
);

const rootStyle = css({ minInlineSize: 0, color: vars.color.text, overflowWrap: 'anywhere' });
const listStyle = css({ listStyle: 'none', margin: 0, marginBlockStart: vars.space[3], padding: 0, display: 'flex', gap: vars.space[3], fontFamily: articleBodyFont, fontSize: vars.textSize.sm, lineHeight: vars.lineHeight.relaxed });
const variants = { inline: css({ flexWrap: 'wrap' }), stacked: css({ flexDirection: 'column', gap: vars.space[2] }) };
const itemStyle = css({ minInlineSize: 0, maxInlineSize: '100%' });

/** List prepared source labels and links below an article. */
export function ArticleSources({ title, items, level = 2, variant = 'inline', component, slots, slotProps, ...props }: ArticleSourcesProps) {
  const generatedId = useId();
  if (items.length === 0) return null;
  const hasTitle = isRenderable(title) && title !== '';
  const titleId = slotProps?.heading?.id ?? generatedId;
  const externalName = slotProps?.root?.['aria-label'] ?? props['aria-label'];
  const externalRelationship = [props['aria-labelledby'], slotProps?.root?.['aria-labelledby']].filter(Boolean).join(' ');
  if (!hasTitle && !externalName?.trim() && !externalRelationship.trim()) throw new Error('ArticleSources requires a title or external accessible name.');
  return <PresentationSlot {...props} element="section" component={slots?.root ?? component} slotProps={slotProps?.root} marker="article-sources" data-variant={variant} aria-labelledby={[hasTitle && titleId, props['aria-labelledby']].filter(Boolean).join(' ') || undefined} styles={rootStyle}>
    {hasTitle && <PresentationSlot element={`h${level}`} component={slots?.heading} slotProps={slotProps?.heading} marker="article-sources-heading" id={titleId} styles={articleLabelStyle} {...(slots?.heading ? { level } : {})}>{title}</PresentationSlot>}
    <PresentationSlot element="ul" component={slots?.list} slotProps={slotProps?.list} marker="article-sources-list" styles={[listStyle, variants[variant]]}>
      {items.map(({ id, label, href, renderLink }) => <PresentationSlot key={id} element="li" component={slots?.item} slotProps={repeatedTemplate(slotProps?.item)} marker="article-sources-item" styles={itemStyle}>
        {href !== undefined || renderLink ? <PresentationSlot element="a" href={href} renderLink={renderLink} component={slots?.link} slotProps={repeatedTemplate(slotProps?.link)} marker="article-sources-link" styles={articleLinkStyle}>{label}</PresentationSlot> : label}
      </PresentationSlot>)}
    </PresentationSlot>
  </PresentationSlot>;
}
ArticleSources.displayName = 'ArticleSources';
