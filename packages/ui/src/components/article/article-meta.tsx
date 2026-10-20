'use client';

import type { ComponentPropsWithRef, ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { articleLabelStyle, articleRule, articleTimeStyle } from '../../styling/article';
import { isRenderable } from '../../utils/renderable';
import { PresentationSlot, type PresentationParts, type PresentationSlots, type PrintedTime } from '../../utils/presentation-slot';

type Anatomy = { root: 'p'; place: 'span'; published: 'time'; updated: 'time'; publishedLabel: 'span'; updatedLabel: 'span'; placeSeparator: 'span'; updateSeparator: 'span' };
export type ArticleMetaSlots = PresentationSlots<Anatomy>;
export type ArticleMetaSlotProps = PresentationParts<Anatomy>;
export type ArticleMetaProps = Omit<ComponentPropsWithRef<'p'>, 'children'> & SxProps & {
  /** Adds rules and spacing with `ruled`. Defaults to `inline`. */
  variant?: 'inline' | 'ruled';
  /** Shows a location before the publication and update times. */
  place?: ReactNode;
  /** Shows the publication label and machine-readable timestamp. */
  published?: PrintedTime;
  /** Shows the update label and machine-readable timestamp. */
  updated?: PrintedTime;
  /** Adds text before the publication time when `published` has a visible label. */
  publishedLabel?: ReactNode;
  /** Adds text before the update time when `updated` has a visible label. */
  updatedLabel?: ReactNode;
  /** Replaces the paragraph root. `slots.root` takes precedence. */
  component?: ArticleMetaSlots['root'];
  /** Replaces metadata labels, times and separators. */
  slots?: ArticleMetaSlots;
  /** Passes props to metadata labels, times and separators. */
  slotProps?: ArticleMetaSlotProps;
};

const rootStyle = css({ display: 'flex', flexWrap: 'wrap', justifyContent: 'var(--_article-inline-justify, normal)', alignItems: 'baseline', gap: vars.space[2] });
const ruledStyle = css({ borderBlock: `${vars.editorial.rule.thin} solid ${articleRule}`, paddingBlock: vars.space[3] });

/** Show an article's location, publication time and latest update. */
export function ArticleMeta({ variant = 'inline', place, published, updated, publishedLabel, updatedLabel, component, slots, slotProps, ...props }: ArticleMetaProps) {
  const hasPlace = isRenderable(place);
  const hasPublished = published !== undefined && isRenderable(published.label);
  const hasUpdated = updated !== undefined && isRenderable(updated.label);
  if (!hasPlace && !hasPublished && !hasUpdated) return null;
  return (
    <PresentationSlot {...props} element="p" component={slots?.root ?? component} slotProps={slotProps?.root} marker="article-meta" data-variant={variant} styles={[articleLabelStyle, rootStyle, variant === 'ruled' && ruledStyle]}>
      {hasPlace && <PresentationSlot element="span" component={slots?.place} slotProps={slotProps?.place} data-ui="article-meta-place">{place}</PresentationSlot>}
      {hasPlace && hasPublished && <PresentationSlot element="span" component={slots?.placeSeparator} slotProps={slotProps?.placeSeparator} data-ui="article-meta-place-separator" aria-hidden="true">·</PresentationSlot>}
      {hasPublished && <>
        {isRenderable(publishedLabel) && <PresentationSlot element="span" component={slots?.publishedLabel} slotProps={slotProps?.publishedLabel} data-ui="article-meta-published-label">{publishedLabel}</PresentationSlot>}
        <PresentationSlot element="time" component={slots?.published} slotProps={slotProps?.published} data-ui="article-meta-published" dateTime={published!.dateTime} styles={articleTimeStyle}>{published!.label}</PresentationSlot>
      </>}
      {(hasPlace || hasPublished) && hasUpdated && <PresentationSlot element="span" component={slots?.updateSeparator} slotProps={slotProps?.updateSeparator} data-ui="article-meta-update-separator" aria-hidden="true">·</PresentationSlot>}
      {hasUpdated && <>
        {isRenderable(updatedLabel) && <PresentationSlot element="span" component={slots?.updatedLabel} slotProps={slotProps?.updatedLabel} data-ui="article-meta-updated-label">{updatedLabel}</PresentationSlot>}
        <PresentationSlot element="time" component={slots?.updated} slotProps={slotProps?.updated} data-ui="article-meta-updated" dateTime={updated!.dateTime} styles={articleTimeStyle}>{updated!.label}</PresentationSlot>
      </>}
    </PresentationSlot>
  );
}
ArticleMeta.displayName = 'Article.Meta';
