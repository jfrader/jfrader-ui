'use client';

import { useId } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { isRenderable } from '../../utils/renderable';
import { PresentationSlot, type ArticleHeadingLevel } from '../../utils/presentation-slot';
import { ArticleSectionBand } from './article-section-band';
import { ArticleSectionHeading } from './article-section-heading';
import { planArticleSection } from './article-section-plan';
import type { ArticleSectionProps } from './article-section.types';

const rootStyle = css({ minInlineSize: 0, display: 'grid', gap: vars.space[6], color: vars.color.text });
const nextLevel: Record<ArticleHeadingLevel, ArticleHeadingLevel> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 6 };

function ArticleSectionRoot({ articles, heading, level, component, slots, slotProps, ...props }: ArticleSectionProps) {
  const generatedId = useId();
  if (articles.length === 0) return null;
  const hasHeading = isRenderable(heading) && heading !== '';
  const { renderLink, slots: headingSlots, ...headingProps } = slotProps?.heading ?? {};
  const headingId = headingProps.slotProps?.heading?.id ?? generatedId;
  const articleLevel = level ?? (hasHeading ? nextLevel[headingProps.level ?? 2] : 2);
  const headingRoot = slots?.heading ?? headingSlots?.root;
  const headingLink = renderLink
    ? { renderLink, slots: { ...headingSlots, root: headingRoot, link: undefined } }
    : { renderLink: undefined, slots: { ...headingSlots, root: headingRoot } };
  const bands = planArticleSection(articles.length);

  return <PresentationSlot
    {...props}
    element="section"
    component={slots?.root ?? component}
    slotProps={slotProps?.root}
    marker="article-section"
    aria-labelledby={[hasHeading && headingId, props['aria-labelledby']].filter(Boolean).join(' ') || undefined}
    styles={rootStyle}
  >
    {hasHeading && <ArticleSectionHeading
      {...headingProps}
      title={heading}
      {...headingLink}
      slotProps={{ ...headingProps.slotProps, heading: { ...headingProps.slotProps?.heading, id: headingId } }}
    />}
    {bands.map((band) => <ArticleSectionBand
      key={band.start}
      band={band}
      articles={articles.slice(band.start, band.end)}
      level={articleLevel}
      slots={slots}
      slotProps={slotProps}
    />)}
  </PresentationSlot>;
}
ArticleSectionRoot.displayName = 'ArticleSection';

/** Render ordered articles as a section of leads, card pairs and headline lists. */
export const ArticleSection = Object.assign(ArticleSectionRoot, { Heading: ArticleSectionHeading });
