'use client';

import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { ARTICLE_DESKTOP, articleSoftRule } from '../../styling/article';
import { PresentationSlot, repeatedTemplate, type ArticleHeadingLevel } from '../../utils/presentation-slot';
import { Article, type ArticleSize, type ArticleVariant } from '../article';
import { ArticleList, type ArticleListEntry } from '../article-list';
import type { ArticleSectionBand as Band, ArticleSectionTreatment } from './article-section-plan';
import type { ArticleSectionEntry, ArticleSectionProps } from './article-section.types';

type Props = Pick<ArticleSectionProps, 'slots' | 'slotProps'> & {
  band: Band;
  articles: readonly ArticleSectionEntry[];
  level: ArticleHeadingLevel;
};

function repeatedAnatomy<P extends { id?: string; ref?: unknown }>(props: P | undefined): Omit<P, 'id' | 'ref'> | undefined {
  const template = repeatedTemplate(props);
  if (!template) return template;
  const parts: unknown = Reflect.get(template, 'slotProps');
  if (parts !== null && typeof parts === 'object') {
    Reflect.set(template, 'slotProps', Object.fromEntries(Object.entries(parts).map(([key, part]) => [key, repeatedAnatomy(part)])));
  }
  return template;
}

const bandStyle = css({
  minInlineSize: 0,
  paddingBlockStart: vars.space[6],
  borderBlockStart: `${vars.editorial.rule.thin} solid ${articleSoftRule}`,
  '&:first-of-type': { paddingBlockStart: 0, borderBlockStart: 0 },
});
const columnsStyle = css({
  display: 'grid',
  gap: vars.space[6],
  [ARTICLE_DESKTOP]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: vars.space[12] },
});
const featureStyle = css({
  display: 'grid',
  gap: vars.space[6],
  [ARTICLE_DESKTOP]: { gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', columnGap: vars.space[10] },
});
const featureListStyle = css({
  borderBlockStart: `${vars.editorial.rule.thin} solid ${articleSoftRule}`,
  paddingBlockStart: vars.space[4],
  [ARTICLE_DESKTOP]: {
    borderBlockStart: 0,
    paddingBlockStart: 0,
    borderInlineStart: `${vars.editorial.rule.thin} solid ${articleSoftRule}`,
    paddingInlineStart: vars.space[10],
  },
});

function isCardTreatment(treatment: ArticleSectionTreatment): treatment is ArticleVariant {
  return !treatment.startsWith('headline-');
}
const bandSizes: Record<Band['kind'], ArticleSize> = { wide: 'lead', pair: 'standard', headlines: 'brief', feature: 'secondary' };

export function ArticleSectionBand({ band, articles, level, slots, slotProps }: Props) {
  const articleTemplate = repeatedAnatomy(slotProps?.article);
  const listTemplate = repeatedAnatomy(slotProps?.list);
  const itemTemplate = repeatedAnatomy(slotProps?.listItem);
  const { renderLink: templateLink, slots: itemSlots, ...itemProps } = { ...listTemplate?.slotProps?.item, ...itemTemplate };
  const listItem = templateLink
    ? { ...itemProps, renderLink: templateLink, slots: { ...itemSlots, link: undefined } }
    : { ...itemProps, renderLink: undefined, slots: itemSlots };
  const featured = band.kind === 'feature' && articles.length > 1;
  const headlineItems: ArticleListEntry[] = [];
  const cards = articles.map(({ id, label, place, ...article }, index) => {
    const treatment = band.treatments[index]!;
    if (!isCardTreatment(treatment)) {
      headlineItems.push({ id, headline: article.headline, href: article.href, renderLink: article.renderLink, time: article.time, label, place, level: article.level ?? level, variant: treatment });
      return null;
    }
    return <Article
      {...articleTemplate}
      {...article}
      key={id}
      level={article.level ?? level}
      time={treatment === 'time-column' ? article.time : undefined}
      size={bandSizes[band.kind]}
      variant={treatment}
      slots={{ ...articleTemplate?.slots, root: slots?.article ?? articleTemplate?.slots?.root }}
      slotProps={{ ...articleTemplate?.slotProps, dek: { ...articleTemplate?.slotProps?.dek, ...(treatment === 'wide' ? { variant: 'columns' } : {}) } }}
    />;
  });

  return <PresentationSlot
    element="div"
    component={slots?.band}
    slotProps={repeatedTemplate(slotProps?.band)}
    marker="article-section-band"
    data-variant={band.kind}
    styles={[bandStyle, band.kind === 'pair' && articles.length > 1 && columnsStyle, featured && featureStyle]}
  >
    {cards}
    {headlineItems.length > 0 && <ArticleList
      {...listTemplate}
      items={headlineItems}
      slots={{ ...listTemplate?.slots, root: slots?.list ?? listTemplate?.slots?.root, item: slots?.listItem ?? listTemplate?.slots?.item }}
      slotProps={{
        ...listTemplate?.slotProps,
        root: { ...listTemplate?.slotProps?.root, sx: [featured && featureListStyle, listTemplate?.slotProps?.root?.sx] },
        item: listItem,
      }}
    />}
  </PresentationSlot>;
}
